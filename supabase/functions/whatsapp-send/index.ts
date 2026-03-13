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

function cleanNumber(raw: string): string {
  return (raw || "").replace(/@.*$/, "").replace(/\D/g, "");
}

interface SendAttempt {
  label: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function buildTextAttempts(baseUrl: string, token: string, number: string, text: string): SendAttempt[] {
  return [
    {
      label: "v2 /send/text + token header",
      url: `${baseUrl}/send/text`,
      headers: { "Content-Type": "application/json", "token": token },
      body: { number, text },
    },
    {
      label: "v2 /send/text + apikey header",
      url: `${baseUrl}/send/text`,
      headers: { "Content-Type": "application/json", "apikey": token },
      body: { number, text },
    },
    {
      label: "v2 /api/send/text + token header",
      url: `${baseUrl}/api/send/text`,
      headers: { "Content-Type": "application/json", "token": token },
      body: { number, text },
    },
    {
      label: "legacy /message/sendText + apikey + textMessage",
      url: `${baseUrl}/message/sendText`,
      headers: { "Content-Type": "application/json", "apikey": token },
      body: { number, textMessage: { text } },
    },
    {
      label: "legacy /message/sendText + apikey + text",
      url: `${baseUrl}/message/sendText`,
      headers: { "Content-Type": "application/json", "apikey": token },
      body: { number, text },
    },
  ];
}

function buildMediaAttempts(
  baseUrl: string, token: string, number: string,
  mediaUrl: string, type: string, caption?: string, fileName?: string
): SendAttempt[] {
  return [
    {
      label: "v2 /send/media + token header",
      url: `${baseUrl}/send/media`,
      headers: { "Content-Type": "application/json", "token": token },
      body: { number, mediaUrl, type, caption: caption || "", fileName: fileName || "" },
    },
    {
      label: "v2 /send/media + apikey header",
      url: `${baseUrl}/send/media`,
      headers: { "Content-Type": "application/json", "apikey": token },
      body: { number, mediaUrl, type, caption: caption || "", fileName: fileName || "" },
    },
    {
      label: "v2 /api/send/media + token header",
      url: `${baseUrl}/api/send/media`,
      headers: { "Content-Type": "application/json", "token": token },
      body: { number, mediaUrl, type, caption: caption || "", fileName: fileName || "" },
    },
  ];
}

async function tryAttempts(attempts: SendAttempt[]) {
  const attemptResults: Array<{ label: string; status: number; snippet: string }> = [];

  for (const attempt of attempts) {
    try {
      console.log(`[whatsapp-send] Trying: ${attempt.label} -> ${attempt.url}`);
      const res = await fetch(attempt.url, {
        method: "POST",
        headers: attempt.headers,
        body: JSON.stringify(attempt.body),
      });

      let resBody: unknown;
      const resText = await res.text();
      try { resBody = JSON.parse(resText); } catch { resBody = resText; }

      const snippet = typeof resBody === "string" ? resBody.slice(0, 200) : JSON.stringify(resBody).slice(0, 200);
      console.log(`[whatsapp-send] ${attempt.label}: status=${res.status} body=${snippet}`);
      attemptResults.push({ label: attempt.label, status: res.status, snippet });

      if (res.ok) {
        return { ok: true as const, resBody, attempt, attemptResults };
      }
    } catch (e) {
      console.error(`[whatsapp-send] ${attempt.label} error:`, e);
      attemptResults.push({ label: attempt.label, status: 0, snippet: String(e) });
    }
  }

  return { ok: false as const, attemptResults };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { instance_id, remote_jid, text, mediaUrl, mediaType, caption, fileName } = body as {
      instance_id: string;
      remote_jid: string;
      text?: string;
      mediaUrl?: string;
      mediaType?: string;
      caption?: string;
      fileName?: string;
    };

    if (!instance_id || !remote_jid) {
      return new Response(JSON.stringify({ error: "Missing instance_id or remote_jid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Must have either text or mediaUrl
    if (!text && !mediaUrl) {
      return new Response(JSON.stringify({ error: "Missing text or mediaUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch instance
    const { data: inst, error: instErr } = await serviceClient
      .from("whatsapp_instances")
      .select("id, workspace_id, instance_name, api_token, server_url, status")
      .eq("id", instance_id)
      .maybeSingle();

    if (instErr || !inst) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user owns workspace
    const { data: ws } = await serviceClient
      .from("workspaces")
      .select("id")
      .eq("id", inst.workspace_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!ws) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = (inst.server_url || Deno.env.get("UAZAPI_URL") || "").replace(/\/+$/, "");
    const token = inst.api_token || "";

    if (!baseUrl || !token) {
      return new Response(JSON.stringify({ error: "Instance missing server_url or token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const number = cleanNumber(remote_jid);
    const isMedia = !!mediaUrl;
    const msgType = isMedia ? (mediaType || "document") : "text";

    console.log(`[whatsapp-send] Sending ${msgType} to ${number} via ${inst.instance_name} at ${baseUrl}`);

    const attempts = isMedia
      ? buildMediaAttempts(baseUrl, token, number, mediaUrl!, msgType, caption, fileName)
      : buildTextAttempts(baseUrl, token, number, text!);

    const result = await tryAttempts(attempts);

    if (result.ok) {
      const { resBody, attempt } = result;
      // Persist outbound message
      const phone = normPhone(remote_jid);
      const apiMsgId = typeof resBody === "object" && resBody !== null
        ? (resBody as Record<string, unknown>).messageId || (resBody as Record<string, unknown>).id || null
        : null;
      const messageId = apiMsgId ? String(apiMsgId) : `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const { error: insertErr } = await serviceClient.from("whatsapp_messages").insert({
        workspace_id: inst.workspace_id,
        instance_id: inst.id,
        lead_id: null,
        remote_jid,
        phone,
        message_id: messageId,
        direction: "outbound",
        message_type: msgType,
        body: text || caption || null,
        media_url: mediaUrl || null,
        media_mime_type: null,
        status: "sent",
        timestamp_msg: new Date().toISOString(),
        payload_raw: typeof resBody === "object" ? resBody : { raw: resBody },
      });

      if (insertErr) console.error("[whatsapp-send] DB insert error:", insertErr);

      // Link to lead
      if (phone) {
        const { data: lead } = await serviceClient
          .from("leads")
          .select("id")
          .eq("workspace_id", inst.workspace_id)
          .eq("phone", phone)
          .maybeSingle();
        if (lead) {
          await serviceClient.from("whatsapp_messages")
            .update({ lead_id: lead.id })
            .eq("message_id", messageId);
        }
      }

      return new Response(JSON.stringify({ ok: true, message_id: messageId, attempt: attempt.label }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All attempts failed
    console.error("[whatsapp-send] All attempts failed:", JSON.stringify(result.attemptResults));
    return new Response(JSON.stringify({
      error: "All send attempts failed",
      attempts: result.attemptResults.map(a => ({ label: a.label, status: a.status })),
    }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[whatsapp-send] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
