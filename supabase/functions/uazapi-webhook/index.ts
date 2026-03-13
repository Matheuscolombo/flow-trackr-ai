import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Normaliza telefone removendo sufixo @s.whatsapp.net e formatando com +55
 */
function normPhone(raw: string): string {
  const cleaned = (raw || "").replace(/@.*$/, "").replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.length === 11) return `+55${cleaned}`;
  if (cleaned.length === 13 && cleaned.startsWith("55")) return `+${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith("55")) return `+${cleaned}`;
  return `+55${cleaned.slice(-11)}`;
}

/**
 * Extrai dados relevantes do payload da UAZAPI v2
 * 
 * Formato UAZAPI v2:
 * {
 *   BaseUrl, EventType, chat, chatSource, instanceName, message, owner, token
 * }
 * 
 * message pode conter:
 * { key: { remoteJid, fromMe, id }, message: { conversation, extendedTextMessage, ... }, messageTimestamp, ... }
 * 
 * Formato legado:
 * { event, data: { key: { remoteJid }, message: { ... } } }
 */
function extractMessageData(body: Record<string, unknown>) {
  // Detect format: UAZAPI v2 has EventType and message at top level
  const eventType = (body.EventType as string) || (body.event as string) || "";
  const instanceName = (body.instanceName as string) || (body.instance as string) || "";

  // UAZAPI v2: message is at top level
  const topMessage = (body.message || {}) as Record<string, unknown>;
  
  // Legacy: data.key / data.message
  const data = (body.data || {}) as Record<string, unknown>;
  const legacyKey = (data.key || {}) as Record<string, unknown>;
  const legacyMessage = (data.message || {}) as Record<string, unknown>;

  // Try v2 first (message.key), then legacy (data.key)
  const key = (topMessage.key && typeof topMessage.key === "object" ? topMessage.key : legacyKey) as Record<string, unknown>;
  const msgContent = (topMessage.message && typeof topMessage.message === "object" 
    ? topMessage.message 
    : topMessage.conversation !== undefined ? topMessage 
    : legacyMessage) as Record<string, unknown>;

  const remoteJid = (key.remoteJid as string) || (data.remoteJid as string) || (topMessage.remoteJid as string) || "";
  const messageId = (key.id as string) || (topMessage.id as string) || (data.messageId as string) || (data.id as string) || "";
  const fromMe = key.fromMe === true;

  // Extract message timestamp  
  const messageTimestamp = topMessage.messageTimestamp || data.messageTimestamp;

  // Extract body from message content
  let textBody = "";
  let messageType = "text";
  let mediaUrl: string | null = null;
  let mediaMimeType: string | null = null;

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
      event,
      instanceName,
      remoteJid,
      messageId,
      fromMe,
      textBody,
      messageType,
      mediaUrl,
      mediaMimeType,
      messageTimestamp,
    } = extractMessageData(body);

    console.log(`[uazapi-webhook] parsed: event=${event} instance=${instanceName} jid=${remoteJid} msgId=${messageId} fromMe=${fromMe} type=${messageType}`);

    // Ignorar mensagens de grupo
    if (remoteJid.includes("@g.us")) {
      return new Response(JSON.stringify({ ok: true, action: "group_ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ignorar eventos que não são mensagens
    const messageEvents = [
      "messages.upsert",
      "messages",
      "message",
      "messages.update",
      "message.any",
      "onMessage",
      "onMessageReceived",
      "", // empty = accept
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

    // Find instance by name
    let instanceId: string | null = null;
    let workspaceId: string | null = null;

    if (instanceName) {
      const { data: inst } = await serviceClient
        .from("whatsapp_instances")
        .select("id, workspace_id")
        .eq("instance_name", instanceName)
        .maybeSingle();

      if (inst) {
        instanceId = inst.id;
        workspaceId = inst.workspace_id;
      }
    }

    // Se não encontrou instância registrada, ignorar
    if (!instanceId) {
      console.log(`[uazapi-webhook] ignoring: instance "${instanceName}" not registered`);
      return new Response(JSON.stringify({ ok: true, action: "instance_not_registered" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tentar encontrar lead pelo telefone no workspace da instância
    const { data: lead } = await serviceClient
      .from("leads")
      .select("id")
      .eq("workspace_id", workspaceId!)
      .eq("phone", phone)
      .maybeSingle();

    // Calcular timestamp da mensagem
    let timestampMsg = new Date().toISOString();
    if (messageTimestamp) {
      const ts = Number(messageTimestamp);
      if (ts > 0) {
        // UAZAPI sends epoch seconds
        timestampMsg = new Date(ts > 1e12 ? ts : ts * 1000).toISOString();
      }
    }

    // Inserir mensagem
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

    console.log(
      `[uazapi-webhook] stored ${direction} ${messageType} from ${phone} lead=${lead?.id || "unknown"}`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        phone,
        lead_id: lead?.id || null,
        direction,
        message_type: messageType,
      }),
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
