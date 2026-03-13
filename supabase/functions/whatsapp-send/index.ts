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

/** Clean number: remove @s.whatsapp.net suffix, keep only digits */
function cleanNumber(raw: string): string {
  return (raw || "").replace(/@.*$/, "").replace(/\D/g, "");
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
    const { instance_id, remote_jid, text } = body as {
      instance_id: string;
      remote_jid: string;
      text: string;
    };

    if (!instance_id || !remote_jid || !text) {
      return new Response(JSON.stringify({ error: "Missing instance_id, remote_jid, or text" }), {
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
    console.log(`[whatsapp-send] Sending to ${number} via ${inst.instance_name} at ${baseUrl}`);

    // Try multiple endpoint/payload/header combinations
    const attempts = [
      {
        label: "sendText with textMessage body + apikey header",
        url: `${baseUrl}/message/sendText/${inst.instance_name}`,
        headers: { "Content-Type": "application/json", "apikey": token },
        body: { number, textMessage: { text } },
      },
      {
        label: "sendText with text body + apikey header",
        url: `${baseUrl}/message/sendText/${inst.instance_name}`,
        headers: { "Content-Type": "application/json", "apikey": token },
        body: { number, text },
      },
      {
        label: "sendText with token header",
        url: `${baseUrl}/message/sendText/${inst.instance_name}`,
        headers: { "Content-Type": "application/json", "token": token },
        body: { number, textMessage: { text } },
      },
      {
        label: "sendText with token header + simple body",
        url: `${baseUrl}/message/sendText/${inst.instance_name}`,
        headers: { "Content-Type": "application/json", "token": token },
        body: { number, text },
      },
      {
        label: "sendText no instance in path + apikey",
        url: `${baseUrl}/message/sendText`,
        headers: { "Content-Type": "application/json", "apikey": token },
        body: { number, text, instanceName: inst.instance_name },
      },
      {
        label: "sendMessage endpoint + apikey",
        url: `${baseUrl}/message/sendMessage/${inst.instance_name}`,
        headers: { "Content-Type": "application/json", "apikey": token },
        body: { number, message: text },
      },
    ];

    let lastErr: unknown = null;
    for (const attempt of attempts) {
      try {
        console.log(`[whatsapp-send] Trying: ${attempt.label} -> ${attempt.url}`);
        const res = await fetch(attempt.url, {
          method: "POST",
          headers: attempt.headers,
          body: JSON.stringify(attempt.body),
        });
        const resBody = await res.json().catch(() => ({}));
        console.log(`[whatsapp-send] ${attempt.label}: status=${res.status} body=${JSON.stringify(resBody).slice(0, 200)}`);

        if (res.ok || (res.status >= 200 && res.status < 300)) {
          // Success! Save outbound message
          const phone = normPhone(remote_jid);
          const messageId = `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

          const { error: insertErr } = await serviceClient.from("whatsapp_messages").insert({
            workspace_id: inst.workspace_id,
            instance_id: inst.id,
            lead_id: null,
            remote_jid,
            phone,
            message_id: messageId,
            direction: "outbound",
            message_type: "text",
            body: text,
            status: "sent",
            timestamp_msg: new Date().toISOString(),
            payload_raw: {},
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

        lastErr = resBody;
      } catch (e) {
        console.error(`[whatsapp-send] ${attempt.label} error:`, e);
        lastErr = e;
      }
    }

    // All attempts failed
    return new Response(JSON.stringify({ error: "All send attempts failed", detail: lastErr }), {
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
