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
    // Auth: extract user from JWT
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify the user
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

    // Fetch instance (verify ownership via workspace)
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

    // Send via UAZAPI
    const sendUrl = `${baseUrl}/message/sendText/${inst.instance_name}`;
    console.log(`[whatsapp-send] POST ${sendUrl}`);

    const uazRes = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": token,
      },
      body: JSON.stringify({
        number: remote_jid,
        text: text,
      }),
    });

    const uazBody = await uazRes.json().catch(() => ({}));
    console.log(`[whatsapp-send] UAZAPI status=${uazRes.status}`, JSON.stringify(uazBody));

    if (!uazRes.ok) {
      // Try alternative endpoint format
      const altUrl = `${baseUrl}/message/sendText`;
      const altRes = await fetch(altUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": token,
        },
        body: JSON.stringify({
          number: remote_jid,
          text: text,
          instanceName: inst.instance_name,
        }),
      });
      const altBody = await altRes.json().catch(() => ({}));
      if (!altRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to send via UAZAPI", detail: altBody }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Save outbound message to DB
    const phone = normPhone(remote_jid);
    const messageId = `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { error: insertErr } = await serviceClient.from("whatsapp_messages").insert({
      workspace_id: inst.workspace_id,
      instance_id: inst.id,
      lead_id: null, // will be linked later if lead exists
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

    if (insertErr) {
      console.error("[whatsapp-send] DB insert error:", insertErr);
    }

    // Try to link to lead
    if (phone) {
      const { data: lead } = await serviceClient
        .from("leads")
        .select("id")
        .eq("workspace_id", inst.workspace_id)
        .eq("phone", phone)
        .maybeSingle();

      if (lead) {
        await serviceClient
          .from("whatsapp_messages")
          .update({ lead_id: lead.id })
          .eq("message_id", messageId);
      }
    }

    return new Response(JSON.stringify({ ok: true, message_id: messageId }), {
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
