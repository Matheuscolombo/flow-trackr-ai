import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
 * Extrai dados relevantes do payload da UAZAPI
 * A UAZAPI envia diferentes formatos dependendo do evento
 */
function extractMessageData(body: Record<string, unknown>) {
  // UAZAPI pode enviar em diferentes formatos
  // Formato principal: { event, data: { key: { remoteJid, ... }, message: { ... } } }
  const event = (body.event as string) || "";
  const data = (body.data || body) as Record<string, unknown>;
  const key = (data.key || {}) as Record<string, unknown>;
  const message = (data.message || {}) as Record<string, unknown>;

  const remoteJid = (key.remoteJid as string) || (data.remoteJid as string) || "";
  const messageId = (key.id as string) || (data.messageId as string) || (data.id as string) || "";
  const fromMe = (key.fromMe as boolean) || false;

  // Extrair corpo da mensagem
  let textBody = "";
  let messageType = "text";
  let mediaUrl: string | null = null;
  let mediaMimeType: string | null = null;

  if (message.conversation) {
    textBody = message.conversation as string;
    messageType = "text";
  } else if (message.extendedTextMessage) {
    const ext = message.extendedTextMessage as Record<string, unknown>;
    textBody = (ext.text as string) || "";
    messageType = "text";
  } else if (message.imageMessage) {
    const img = message.imageMessage as Record<string, unknown>;
    textBody = (img.caption as string) || "";
    messageType = "image";
    mediaUrl = (img.url as string) || null;
    mediaMimeType = (img.mimetype as string) || "image/jpeg";
  } else if (message.audioMessage) {
    messageType = "audio";
    const aud = message.audioMessage as Record<string, unknown>;
    mediaMimeType = (aud.mimetype as string) || "audio/ogg";
  } else if (message.videoMessage) {
    const vid = message.videoMessage as Record<string, unknown>;
    textBody = (vid.caption as string) || "";
    messageType = "video";
    mediaMimeType = (vid.mimetype as string) || "video/mp4";
  } else if (message.documentMessage) {
    const doc = message.documentMessage as Record<string, unknown>;
    textBody = (doc.fileName as string) || "";
    messageType = "document";
    mediaMimeType = (doc.mimetype as string) || null;
  } else if (message.stickerMessage) {
    messageType = "sticker";
  }

  return {
    event,
    remoteJid,
    messageId,
    fromMe,
    textBody,
    messageType,
    mediaUrl,
    mediaMimeType,
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
    console.log("[uazapi-webhook] event:", body.event, "data keys:", Object.keys(body.data || body));

    const {
      event,
      remoteJid,
      messageId,
      fromMe,
      textBody,
      messageType,
      mediaUrl,
      mediaMimeType,
    } = extractMessageData(body);

    // Ignorar mensagens de grupo
    if (remoteJid.includes("@g.us")) {
      return new Response(JSON.stringify({ ok: true, action: "group_ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ignorar eventos que não são mensagens
    const messageEvents = [
      "messages.upsert",
      "message",
      "messages.update",
      "message.any",
    ];
    if (event && !messageEvents.includes(event)) {
      console.log(`[uazapi-webhook] ignoring event: ${event}`);
      return new Response(JSON.stringify({ ok: true, action: "event_ignored", event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!remoteJid || !messageId) {
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

    // Identificar a instância pela qual a mensagem chegou
    // UAZAPI envia o nome da instância no payload
    const instanceName = (body.instance as string) || (body.instanceName as string) ||
      ((body.data as Record<string, unknown>)?.instance as string) || "";

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

    // Inserir mensagem (com ON CONFLICT para evitar duplicatas)
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
          timestamp_msg: new Date().toISOString(),
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
