import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MEDIA_EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/opus": "opus",
  "audio/ogg; codecs=opus": "ogg",
  "video/mp4": "mp4", "video/3gpp": "3gp",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

/** Check if a response contains actual media (not an HTML error page) */
function isValidMediaResponse(res: Response): boolean {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  // Reject HTML responses (error pages from CDN)
  if (ct.includes("text/html") || ct.includes("text/plain")) return false;
  return true;
}

/**
 * Upload a blob to Supabase Storage and return permanent public URL.
 */
async function uploadToStorage(
  serviceClient: ReturnType<typeof createClient>,
  blob: Blob,
  workspaceId: string,
  messageId: string,
  mimeType: string | null,
): Promise<string | null> {
  const ext = (mimeType && MEDIA_EXT_MAP[mimeType]) || "bin";
  const safeId = messageId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const storagePath = `${workspaceId}/${safeId}.${ext}`;

  const { error: uploadErr } = await serviceClient.storage
    .from("whatsapp-media")
    .upload(storagePath, blob, {
      contentType: mimeType || "application/octet-stream",
      upsert: true,
    });

  if (uploadErr) {
    console.error("[media-upload] error:", uploadErr.message);
    return null;
  }

  const { data: publicData } = serviceClient.storage
    .from("whatsapp-media")
    .getPublicUrl(storagePath);

  console.log(`[media-upload] stored: ${storagePath} (${blob.size} bytes)`);
  return publicData.publicUrl;
}

/** Extract short messageId (without owner prefix) */
function shortMessageId(fullId: string): string {
  const parts = fullId.split(":");
  return parts.length > 1 ? parts[parts.length - 1] : fullId;
}

/**
 * Try to extract valid media blob from a UAZAPI response.
 */
async function extractBlobFromResponse(
  res: Response,
  mimeType: string | null,
): Promise<Blob | null> {
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  if (ct.includes("application/json")) {
    const json = await res.json();
    // UAZAPI v2 returns base64Data and/or fileURL
    const base64 = json.base64Data || json.base64 || json.data || json.media;
    if (base64 && typeof base64 === "string") {
      const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const blob = new Blob([binary], { type: mimeType || "application/octet-stream" });
      if (blob.size > 0 && blob.size < 20 * 1024 * 1024) return blob;
    }
    const dlUrl = json.fileURL || json.url || json.mediaUrl || json.fileUrl;
    if (dlUrl && typeof dlUrl === "string") {
      const dlRes = await fetch(dlUrl, { redirect: "follow" });
      if (dlRes.ok && isValidMediaResponse(dlRes)) {
        const blob = await dlRes.blob();
        if (blob.size > 0 && blob.size < 20 * 1024 * 1024) return blob;
      }
    }
    return null;
  }

  if (ct.includes("text/html") || ct.includes("text/plain")) return null;

  const blob = await res.blob();
  if (blob.size > 0 && blob.size < 20 * 1024 * 1024) return blob;
  return null;
}

/**
 * Download media using UAZAPI downloadMediaMessage endpoint, then upload to Storage.
 * Tries multiple endpoint variations, HTTP methods, and messageId formats.
 */
async function downloadAndStoreMedia(
  serviceClient: ReturnType<typeof createClient>,
  mediaUrl: string,
  workspaceId: string,
  messageId: string,
  mimeType: string | null,
  uazapiBaseUrl?: string | null,
  uazapiToken?: string | null,
): Promise<string | null> {
  try {
    const shortId = shortMessageId(messageId);

    // Strategy 1: UAZAPI endpoints with multiple variations
    if (uazapiBaseUrl && uazapiToken) {
      // UAZAPI v2: POST /message/download { "id": "shortMessageId" }
      const attempts: Array<{ label: string; fn: () => Promise<Response> }> = [
        {
          label: "POST /message/download (shortId)",
          fn: () => fetch(`${uazapiBaseUrl}/message/download`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": uazapiToken },
            body: JSON.stringify({ id: shortId }),
          }),
        },
        {
          label: "POST /message/download (fullId)",
          fn: () => fetch(`${uazapiBaseUrl}/message/download`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": uazapiToken },
            body: JSON.stringify({ id: messageId }),
          }),
        },
      ];

      for (const attempt of attempts) {
        try {
          console.log(`[media-download] trying: ${attempt.label}`);
          const res = await attempt.fn();
          console.log(`[media-download] ${attempt.label}: ${res.status} ${res.headers.get("content-type")}`);

          if (res.ok) {
            const blob = await extractBlobFromResponse(res, mimeType);
            if (blob) {
              console.log(`[media-download] SUCCESS via ${attempt.label}: ${blob.size} bytes`);
              return await uploadToStorage(serviceClient, blob, workspaceId, messageId, mimeType);
            }
          }
        } catch (e) {
          console.log(`[media-download] ${attempt.label} error: ${e}`);
        }
      }
    }

    // Strategy 2: Direct CDN fetch (fallback - usually encrypted)
    console.log(`[media-download] trying direct CDN: ${mediaUrl.slice(0, 80)}...`);
    const response = await fetch(mediaUrl, { redirect: "follow" });
    if (!response.ok) {
      console.log(`[media-download] CDN failed: ${response.status}`);
      return null;
    }
    if (!isValidMediaResponse(response)) {
      console.log(`[media-download] CDN returned non-media: ${response.headers.get("content-type")}`);
      return null;
    }
    const blob = await response.blob();
    if (blob.size === 0 || blob.size > 20 * 1024 * 1024) {
      console.log(`[media-download] CDN blob invalid size: ${blob.size}`);
      return null;
    }

    console.log(`[media-download] CDN success: ${blob.size} bytes`);
    return await uploadToStorage(serviceClient, blob, workspaceId, messageId, mimeType);
  } catch (err) {
    console.error("[media-download] error:", err);
    return null;
  }
}

function normPhone(raw: string): string {
  const cleaned = (raw || "").replace(/@.*$/, "").replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.length === 11) return `+55${cleaned}`;
  if (cleaned.length === 13 && cleaned.startsWith("55")) return `+${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith("55")) return `+${cleaned}`;
  return `+55${cleaned.slice(-11)}`;
}

/** Detect specific media type from MIME type string */
function mimeToType(mime: string): string {
  if (!mime) return "media";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("application/") || mime.startsWith("text/")) return "document";
  return "media";
}

/**
 * Extract message data from UAZAPI v2 payload.
 */
function extractMessageData(body: Record<string, unknown>) {
  const eventType = (body.EventType as string) || (body.event as string) || "";
  const instanceName = (body.instanceName as string) || (body.instance as string) || "";
  const topMessage = (body.message || {}) as Record<string, unknown>;
  const chat = (body.chat || {}) as Record<string, unknown>;
  const data = (body.data || {}) as Record<string, unknown>;

  // --- Extract remoteJid ---
  const msgKey = (topMessage.key && typeof topMessage.key === "object" ? topMessage.key : {}) as Record<string, unknown>;
  const legacyKey = (data.key || {}) as Record<string, unknown>;
  const key = (msgKey.remoteJid ? msgKey : legacyKey) as Record<string, unknown>;

  const remoteJid = (key.remoteJid as string) ||
    (chat.wa_chatid as string) ||
    (chat.remoteJid as string) ||
    (topMessage.remoteJid as string) ||
    (data.remoteJid as string) || "";

  const messageId = (key.id as string) || (msgKey.id as string) ||
    (topMessage.id as string) || (data.messageId as string) || (data.id as string) || "";

  // --- Extract fromMe ---
  const fromMe = topMessage.fromMe === true || topMessage.fromMe === "true" ||
    key.fromMe === true || msgKey.fromMe === true;

  // --- Extract timestamp ---
  const messageTimestamp = topMessage.messageTimestamp || data.messageTimestamp;

  // --- Extract message content ---
  let textBody = "";
  let messageType = "text";
  let mediaUrl: string | null = null;
  let mediaMimeType: string | null = null;

  // ====== UAZAPI v2: message.content is an object with URL, mimetype, caption ======
  const v2Content = topMessage.content;
  const v2Text = topMessage.text as string | undefined;
  const v2Type = (topMessage.type as string) || (topMessage.messageType as string) || (topMessage.mediaType as string) || "";

  let extractedFromV2 = false;

  // v2 content object with media URL
  if (v2Content && typeof v2Content === "object") {
    const contentObj = v2Content as Record<string, unknown>;
    if (contentObj.URL && typeof contentObj.URL === "string") {
      mediaUrl = contentObj.URL;
      mediaMimeType = (contentObj.mimetype as string) || null;
      textBody = (contentObj.caption as string) || "";
      messageType = mediaMimeType ? mimeToType(mediaMimeType) : (v2Type || "media");
      extractedFromV2 = true;
    } else if (typeof contentObj.text === "string") {
      textBody = contentObj.text;
      extractedFromV2 = true;
    }
  }

  // v2 flat text fields
  if (!extractedFromV2) {
    if (typeof v2Text === "string" && v2Text) {
      textBody = v2Text;
      extractedFromV2 = true;
    } else if (typeof v2Content === "string" && v2Content) {
      textBody = v2Content;
      extractedFromV2 = true;
    }
  }

  // v2 type mapping
  if (v2Type && !mediaUrl) {
    const typeMap: Record<string, string> = {
      "text": "text", "chat": "text", "conversation": "text",
      "image": "image", "imageMessage": "image",
      "audio": "audio", "audioMessage": "audio", "ptt": "audio",
      "video": "video", "videoMessage": "video",
      "document": "document", "documentMessage": "document",
      "sticker": "sticker", "stickerMessage": "sticker",
      "media": "media",
    };
    const mapped = typeMap[v2Type];
    if (mapped && mapped !== "text") {
      messageType = mapped;
      extractedFromV2 = true;
    }
  }

  // Fallback: legacy nested format
  if (!extractedFromV2) {
    const nestedMsg = (topMessage.message && typeof topMessage.message === "object"
      ? topMessage.message : {}) as Record<string, unknown>;
    const legacyMessage = (data.message || {}) as Record<string, unknown>;
    const msgContent = (nestedMsg.conversation !== undefined ? nestedMsg :
      Object.keys(nestedMsg).length > 0 ? nestedMsg : legacyMessage) as Record<string, unknown>;

    if (msgContent.conversation) {
      textBody = msgContent.conversation as string;
      messageType = "text";
    } else if (msgContent.extendedTextMessage) {
      const ext = msgContent.extendedTextMessage as Record<string, unknown>;
      textBody = (ext.text as string) || "";
      messageType = "text";
    } else if (msgContent.imageMessage) {
      const img = msgContent.imageMessage as Record<string, unknown>;
      textBody = (img.caption as string) || "";
      messageType = "image";
      mediaUrl = (img.url as string) || null;
      mediaMimeType = (img.mimetype as string) || "image/jpeg";
    } else if (msgContent.audioMessage) {
      messageType = "audio";
      const aud = msgContent.audioMessage as Record<string, unknown>;
      mediaMimeType = (aud.mimetype as string) || "audio/ogg";
    } else if (msgContent.videoMessage) {
      const vid = msgContent.videoMessage as Record<string, unknown>;
      textBody = (vid.caption as string) || "";
      messageType = "video";
      mediaMimeType = (vid.mimetype as string) || "video/mp4";
    } else if (msgContent.documentMessage) {
      const doc = msgContent.documentMessage as Record<string, unknown>;
      textBody = (doc.fileName as string) || "";
      messageType = "document";
      mediaMimeType = (doc.mimetype as string) || null;
    } else if (msgContent.stickerMessage) {
      messageType = "sticker";
    }
  }

  // v2 top-level media fields fallback
  if (!mediaUrl && topMessage.mediaUrl) mediaUrl = topMessage.mediaUrl as string;
  if (!mediaMimeType && topMessage.mimetype) mediaMimeType = topMessage.mimetype as string;

  // If we have mediaUrl but type is still generic, refine from mime
  if (mediaUrl && messageType === "media" && mediaMimeType) {
    messageType = mimeToType(mediaMimeType);
  }

  console.log(`[extract] jid=${remoteJid} msgId=${messageId} fromMe=${fromMe} type=${messageType} media=${!!mediaUrl} body="${(textBody || "").slice(0, 50)}"`);

  return {
    event: eventType,
    instanceName,
    remoteJid,
    messageId,
    fromMe,
    textBody,
    messageType,
    mediaUrl,
    mediaMimeType,
    messageTimestamp,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    console.log("[uazapi-webhook] EventType:", body.EventType || body.event, "keys:", JSON.stringify(Object.keys(body)));

    const {
      event, instanceName, remoteJid, messageId, fromMe,
      textBody, messageType, mediaUrl, mediaMimeType, messageTimestamp,
    } = extractMessageData(body);

    console.log(`[uazapi-webhook] parsed: event=${event} instance=${instanceName} jid=${remoteJid} msgId=${messageId} fromMe=${fromMe} type=${messageType} media=${!!mediaUrl} body="${(textBody || "").slice(0, 40)}"`);

    // Ignore group messages
    if (remoteJid.includes("@g.us")) {
      return new Response(JSON.stringify({ ok: true, action: "group_ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle status update events (messages_update / messages.update)
    const statusEvents = ["messages.update", "messages_update", "message.update"];
    if (statusEvents.includes(event)) {
      // Extract status from payload
      const topMessage = (body.message || body.data || {}) as Record<string, unknown>;
      const newStatus = (topMessage.status as string) || "";
      const statusMsgId = messageId || (topMessage.id as string) || (topMessage.messageid as string) || "";

      if (statusMsgId && newStatus) {
        // Map UAZAPI status values to our status
        const statusMap: Record<string, string> = {
          "SERVER_ACK": "sent",
          "DELIVERY_ACK": "delivered", 
          "READ": "read",
          "PLAYED": "read",
          "ERROR": "failed",
          "sent": "sent",
          "delivered": "delivered",
          "read": "read",
          "played": "read",
          "failed": "failed",
        };
        const mappedStatus = statusMap[newStatus] || newStatus;

        console.log(`[uazapi-webhook] status update: msgId=${statusMsgId} status=${newStatus} -> ${mappedStatus}`);

        const { error: updateErr } = await serviceClient
          .from("whatsapp_messages")
          .update({ status: mappedStatus })
          .eq("message_id", statusMsgId);

        if (updateErr) {
          console.error("[uazapi-webhook] status update error:", updateErr);
        }

        return new Response(
          JSON.stringify({ ok: true, action: "status_updated", message_id: statusMsgId, status: mappedStatus }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Ignore non-message events
    const messageEvents = [
      "messages.upsert", "messages", "message", "messages.update",
      "message.any", "onMessage", "onMessageReceived", "",
    ];
    if (event && !messageEvents.includes(event)) {
      console.log(`[uazapi-webhook] ignoring event: ${event}`);
      return new Response(JSON.stringify({ ok: true, action: "event_ignored", event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!remoteJid || !messageId) {
      console.log(`[uazapi-webhook] missing data: remoteJid="${remoteJid}" messageId="${messageId}"`);
      return new Response(JSON.stringify({ error: "Missing remoteJid or messageId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = normPhone(remoteJid);
    if (!phone) {
      return new Response(JSON.stringify({ error: "Could not normalize phone from remoteJid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const direction = fromMe ? "outbound" : "inbound";

    // Find instance
    let instanceId: string | null = null;
    let workspaceId: string | null = null;
    let uazapiServerUrl: string | null = null;
    let uazapiApiToken: string | null = null;

    if (instanceName) {
      const { data: inst } = await serviceClient
        .from("whatsapp_instances")
        .select("id, workspace_id, server_url, api_token")
        .eq("instance_name", instanceName)
        .maybeSingle();
      if (inst) { instanceId = inst.id; workspaceId = inst.workspace_id; uazapiServerUrl = inst.server_url; uazapiApiToken = inst.api_token; }
    }

    if (!instanceId) {
      const webhookToken = (body.token as string) || "";
      if (webhookToken) {
        const { data: inst } = await serviceClient
          .from("whatsapp_instances")
          .select("id, workspace_id, server_url, api_token")
          .eq("api_token", webhookToken)
          .maybeSingle();
        if (inst) { instanceId = inst.id; workspaceId = inst.workspace_id; uazapiServerUrl = inst.server_url; uazapiApiToken = inst.api_token; }
      }
    }

    if (!instanceId) {
      const ownerPhone = (body.owner as string) || "";
      if (ownerPhone) {
        const normalizedOwner = ownerPhone.replace(/\D/g, "");
        const { data: inst } = await serviceClient
          .from("whatsapp_instances")
          .select("id, workspace_id, phone, server_url, api_token")
          .eq("phone", normalizedOwner)
          .maybeSingle();
        if (inst) {
          instanceId = inst.id; workspaceId = inst.workspace_id; uazapiServerUrl = inst.server_url; uazapiApiToken = inst.api_token;
        } else {
          const { data: inst2 } = await serviceClient
            .from("whatsapp_instances")
            .select("id, workspace_id, phone, server_url, api_token")
            .like("phone", `%${normalizedOwner.slice(-10)}%`)
            .maybeSingle();
          if (inst2) { instanceId = inst2.id; workspaceId = inst2.workspace_id; uazapiServerUrl = inst2.server_url; uazapiApiToken = inst2.api_token; }
        }
      }
    }

    if (!instanceId) {
      console.log(`[uazapi-webhook] ignoring: instance "${instanceName}" not registered, owner="${body.owner}"`);
      return new Response(JSON.stringify({ ok: true, action: "instance_not_registered" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find lead (with 9th-digit phone normalization)
    let lead: { id: string } | null = null;
    {
      const { data: leadExact } = await serviceClient
        .from("leads")
        .select("id")
        .eq("workspace_id", workspaceId!)
        .eq("phone", phone)
        .maybeSingle();
      lead = leadExact;

      // Try variant with/without 9th digit
      if (!lead) {
        const digits = phone.replace(/\D/g, "");
        let variant: string | null = null;
        if (digits.length === 13 && digits.startsWith("55")) {
          variant = `+${digits.slice(0, 4)}${digits.slice(5)}`;
        } else if (digits.length === 12 && digits.startsWith("55")) {
          variant = `+${digits.slice(0, 4)}9${digits.slice(4)}`;
        }
        if (variant) {
          const { data: leadVar } = await serviceClient
            .from("leads")
            .select("id")
            .eq("workspace_id", workspaceId!)
            .eq("phone", variant)
            .maybeSingle();
          lead = leadVar;
        }
      }

      // Auto-create lead if inbound and not found
      if (!lead && direction === "inbound" && workspaceId) {
        // Extract name from payload
        const topMsg = (body.message || {}) as Record<string, unknown>;
        const chatObj = (body.chat || {}) as Record<string, unknown>;
        const contactName =
          (topMsg.pushName as string) ||
          (body.pushName as string) ||
          (chatObj.wa_contactName as string) ||
          (chatObj.wa_name as string) ||
          (topMsg.senderName as string) || null;

        // Try to fetch profile pic from UAZAPI
        let profilePicUrl: string | null = null;
        const effectiveBaseUrl = uazapiServerUrl || (body.BaseUrl as string) || null;
        const effectiveToken = uazapiApiToken || (body.token as string) || null;
        if (effectiveBaseUrl && effectiveToken) {
          try {
            const phoneDigits = phone.replace(/\D/g, "");
            const detailsRes = await fetch(`${effectiveBaseUrl}/chat/details`, {
              method: "POST",
              headers: { "Content-Type": "application/json", token: effectiveToken },
              body: JSON.stringify({ number: phoneDigits, preview: true }),
            });
            if (detailsRes.ok) {
              const details = await detailsRes.json();
              profilePicUrl = (details.imagePreview as string) || (details.profilePicUrl as string) || (details.imgUrl as string) || null;
              // Use UAZAPI name if we don't have one from payload
              if (!contactName && (details.wa_name || details.wa_contactName || details.name)) {
                // contactName is const, handled below
              }
            }
          } catch (e) {
            console.log("[uazapi-webhook] chat/details failed:", e);
          }
        }

        const { data: newLead, error: createErr } = await serviceClient
          .from("leads")
          .insert({
            workspace_id: workspaceId!,
            phone,
            name: contactName || null,
            source: "whatsapp",
            profile_pic_url: profilePicUrl,
          })
          .select("id")
          .single();

        if (createErr) {
          console.error("[uazapi-webhook] lead create error:", createErr);
        } else {
          lead = newLead;
          console.log(`[uazapi-webhook] auto-created lead ${newLead.id} for ${phone} name="${contactName}"`);
        }
      }
    }

    // Timestamp
    let timestampMsg = new Date().toISOString();
    if (messageTimestamp) {
      const ts = Number(messageTimestamp);
      if (ts > 0) {
        timestampMsg = new Date(ts > 1e12 ? ts : ts * 1000).toISOString();
      }
    }

    // Download media to permanent storage if URL is from WhatsApp CDN
    let permanentMediaUrl = mediaUrl;
    if (mediaUrl && workspaceId) {
      // Also try BaseUrl from webhook payload as fallback for UAZAPI base URL
      const baseUrlFromPayload = (body.BaseUrl as string) || null;
      const effectiveBaseUrl = uazapiServerUrl || baseUrlFromPayload;
      const effectiveToken = uazapiApiToken || (body.token as string) || null;
      const stored = await downloadAndStoreMedia(serviceClient, mediaUrl, workspaceId, messageId, mediaMimeType, effectiveBaseUrl, effectiveToken);
      if (stored) {
        permanentMediaUrl = stored;
      }
      // If download fails, keep the original CDN URL as fallback
    }

    // Upsert message
    const { error: insertErr } = await serviceClient
      .from("whatsapp_messages")
      .upsert(
        {
          workspace_id: workspaceId!,
          instance_id: instanceId,
          lead_id: lead?.id || null,
          remote_jid: remoteJid,
          phone,
          message_id: messageId,
          direction,
          message_type: messageType,
          body: textBody || null,
          media_url: permanentMediaUrl,
          media_mime_type: mediaMimeType,
          status: direction === "inbound" ? "received" : "sent",
          timestamp_msg: timestampMsg,
          payload_raw: body,
        },
        { onConflict: "message_id" }
      );

    if (insertErr) {
      console.error("[uazapi-webhook] insert error:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[uazapi-webhook] stored ${direction} ${messageType} from ${phone} body="${(textBody || "").slice(0, 30)}" media=${!!permanentMediaUrl} lead=${lead?.id || "unknown"}`);

    return new Response(
      JSON.stringify({ ok: true, phone, lead_id: lead?.id || null, direction, message_type: messageType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[uazapi-webhook] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
