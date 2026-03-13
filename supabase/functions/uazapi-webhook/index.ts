import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Download media from a URL and upload to Supabase Storage.
 * Returns the permanent public URL, or null if download fails.
 */
async function downloadAndStoreMedia(
  serviceClient: ReturnType<typeof createClient>,
  mediaUrl: string,
  workspaceId: string,
  messageId: string,
  mimeType: string | null,
): Promise<string | null> {
  try {
    const response = await fetch(mediaUrl, { redirect: "follow" });
    if (!response.ok) {
      console.log(`[media-download] failed to fetch: ${response.status} ${response.statusText}`);
      return null;
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      console.log("[media-download] empty blob, skipping");
      return null;
    }
    if (blob.size > 20 * 1024 * 1024) {
      console.log(`[media-download] file too large: ${blob.size} bytes, skipping`);
      return null;
    }

    // Determine extension from mime
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
      "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/opus": "opus",
      "audio/ogg; codecs=opus": "ogg",
      "video/mp4": "mp4", "video/3gpp": "3gp",
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    };
    const ext = (mimeType && extMap[mimeType]) || "bin";
    const safeId = messageId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const storagePath = `${workspaceId}/${safeId}.${ext}`;

    const { error: uploadErr } = await serviceClient.storage
      .from("whatsapp-media")
      .upload(storagePath, blob, {
        contentType: mimeType || "application/octet-stream",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[media-download] upload error:", uploadErr.message);
      return null;
    }

    const { data: publicData } = serviceClient.storage
      .from("whatsapp-media")
      .getPublicUrl(storagePath);

    console.log(`[media-download] stored: ${storagePath} (${blob.size} bytes)`);
    return publicData.publicUrl;
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

    if (instanceName) {
      const { data: inst } = await serviceClient
        .from("whatsapp_instances")
        .select("id, workspace_id")
        .eq("instance_name", instanceName)
        .maybeSingle();
      if (inst) { instanceId = inst.id; workspaceId = inst.workspace_id; }
    }

    if (!instanceId) {
      const webhookToken = (body.token as string) || "";
      if (webhookToken) {
        const { data: inst } = await serviceClient
          .from("whatsapp_instances")
          .select("id, workspace_id")
          .eq("api_token", webhookToken)
          .maybeSingle();
        if (inst) { instanceId = inst.id; workspaceId = inst.workspace_id; }
      }
    }

    if (!instanceId) {
      const ownerPhone = (body.owner as string) || "";
      if (ownerPhone) {
        const normalizedOwner = ownerPhone.replace(/\D/g, "");
        const { data: inst } = await serviceClient
          .from("whatsapp_instances")
          .select("id, workspace_id, phone")
          .eq("phone", normalizedOwner)
          .maybeSingle();
        if (inst) {
          instanceId = inst.id; workspaceId = inst.workspace_id;
        } else {
          const { data: inst2 } = await serviceClient
            .from("whatsapp_instances")
            .select("id, workspace_id, phone")
            .like("phone", `%${normalizedOwner.slice(-10)}%`)
            .maybeSingle();
          if (inst2) { instanceId = inst2.id; workspaceId = inst2.workspace_id; }
        }
      }
    }

    if (!instanceId) {
      console.log(`[uazapi-webhook] ignoring: instance "${instanceName}" not registered, owner="${body.owner}"`);
      return new Response(JSON.stringify({ ok: true, action: "instance_not_registered" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find lead
    const { data: lead } = await serviceClient
      .from("leads")
      .select("id")
      .eq("workspace_id", workspaceId!)
      .eq("phone", phone)
      .maybeSingle();

    // Timestamp
    let timestampMsg = new Date().toISOString();
    if (messageTimestamp) {
      const ts = Number(messageTimestamp);
      if (ts > 0) {
        timestampMsg = new Date(ts > 1e12 ? ts : ts * 1000).toISOString();
      }
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
          media_url: mediaUrl,
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

    console.log(`[uazapi-webhook] stored ${direction} ${messageType} from ${phone} body="${(textBody || "").slice(0, 30)}" media=${!!mediaUrl} lead=${lead?.id || "unknown"}`);

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
