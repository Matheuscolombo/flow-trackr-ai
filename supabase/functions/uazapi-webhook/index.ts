import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normPhone(raw: string): string {
  const cleaned = (raw || "").replace(/@.*$/, "").replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.length === 11) return `+55${cleaned}`;
  if (cleaned.length === 13 && cleaned.startsWith("55")) return `+${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith("55")) return `+${cleaned}`;
  return `+55${cleaned.slice(-11)}`;
}

/**
 * Extract message data from UAZAPI v2 payload.
 * 
 * UAZAPI v2 top-level: { BaseUrl, EventType, chat, chatSource, instanceName, message, owner, token }
 * message object has: { key: { remoteJid, fromMe, id }, message: { conversation, ... }, messageTimestamp, ... }
 * OR flat v2: { content, text, fromMe, type, ... } directly on message
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

  // --- Extract fromMe (v2 flat: message.fromMe; legacy: key.fromMe) ---
  const fromMe = topMessage.fromMe === true || topMessage.fromMe === "true" ||
    key.fromMe === true || msgKey.fromMe === true;

  // --- Extract timestamp ---
  const messageTimestamp = topMessage.messageTimestamp || data.messageTimestamp;

  // --- Extract message content ---
  // Priority 1: UAZAPI v2 flat fields on message object
  // message.text (string), message.content (string or {text}), message.type
  // Priority 2: Legacy nested message.message.conversation / extendedTextMessage etc.

  let textBody = "";
  let messageType = "text";
  let mediaUrl: string | null = null;
  let mediaMimeType: string | null = null;

  // Try v2 flat format first
  const v2Text = topMessage.text as string | undefined;
  const v2Content = topMessage.content;
  const v2Type = (topMessage.type as string) || (topMessage.messageType as string) || (topMessage.mediaType as string) || "";

  let extractedFromV2 = false;

  if (typeof v2Text === "string" && v2Text) {
    textBody = v2Text;
    extractedFromV2 = true;
  } else if (typeof v2Content === "string" && v2Content) {
    textBody = v2Content;
    extractedFromV2 = true;
  } else if (v2Content && typeof v2Content === "object") {
    const contentObj = v2Content as Record<string, unknown>;
    if (typeof contentObj.text === "string") {
      textBody = contentObj.text;
      extractedFromV2 = true;
    }
  }

  if (v2Type) {
    const typeMap: Record<string, string> = {
      "text": "text", "chat": "text", "conversation": "text",
      "image": "image", "imageMessage": "image",
      "audio": "audio", "audioMessage": "audio", "ptt": "audio",
      "video": "video", "videoMessage": "video",
      "document": "document", "documentMessage": "document",
      "sticker": "sticker", "stickerMessage": "sticker",
    };
    messageType = typeMap[v2Type] || v2Type;
    if (messageType !== "text") extractedFromV2 = true;
  }

  // Fallback: legacy nested format (message.message.conversation etc.)
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

  // v2 media fields
  if (!mediaUrl && topMessage.mediaUrl) mediaUrl = topMessage.mediaUrl as string;
  if (!mediaMimeType && topMessage.mimetype) mediaMimeType = topMessage.mimetype as string;

  console.log(`[extract] jid=${remoteJid} msgId=${messageId} fromMe=${fromMe} type=${messageType} body="${(textBody || "").slice(0, 50)}"`);

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

    console.log(`[uazapi-webhook] parsed: event=${event} instance=${instanceName} jid=${remoteJid} msgId=${messageId} fromMe=${fromMe} type=${messageType} body="${(textBody || "").slice(0, 40)}"`);

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

    // Find instance: by name, then by api_token, then by owner phone
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
        console.log(`[uazapi-webhook] trying match by api_token`);
        const { data: inst } = await serviceClient
          .from("whatsapp_instances")
          .select("id, workspace_id")
          .eq("api_token", webhookToken)
          .maybeSingle();
        if (inst) {
          instanceId = inst.id; workspaceId = inst.workspace_id;
          console.log(`[uazapi-webhook] matched by api_token -> ${inst.id}`);
        }
      }
    }

    if (!instanceId) {
      const ownerPhone = (body.owner as string) || "";
      if (ownerPhone) {
        const normalizedOwner = ownerPhone.replace(/\D/g, "");
        console.log(`[uazapi-webhook] trying match by owner phone: ${normalizedOwner}`);
        // Try exact match first, then partial
        const { data: inst } = await serviceClient
          .from("whatsapp_instances")
          .select("id, workspace_id, phone")
          .eq("phone", normalizedOwner)
          .maybeSingle();

        if (inst) {
          instanceId = inst.id; workspaceId = inst.workspace_id;
          console.log(`[uazapi-webhook] matched by phone exact: ${inst.phone} -> ${inst.id}`);
        } else {
          // Partial match (last 10 digits)
          const { data: inst2 } = await serviceClient
            .from("whatsapp_instances")
            .select("id, workspace_id, phone")
            .like("phone", `%${normalizedOwner.slice(-10)}%`)
            .maybeSingle();
          if (inst2) {
            instanceId = inst2.id; workspaceId = inst2.workspace_id;
            console.log(`[uazapi-webhook] matched by phone partial -> ${inst2.id}`);
          }
        }
      }
    }

    if (!instanceId) {
      console.log(`[uazapi-webhook] ignoring: instance "${instanceName}" not registered, owner="${body.owner}"`);
      return new Response(JSON.stringify({ ok: true, action: "instance_not_registered" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find lead by phone
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

    console.log(`[uazapi-webhook] stored ${direction} ${messageType} from ${phone} body="${(textBody || "").slice(0, 30)}" lead=${lead?.id || "unknown"}`);

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
