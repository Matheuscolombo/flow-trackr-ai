import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instance_id, remote_jid, presence, delay } = await req.json();

    if (!instance_id || !remote_jid || !presence) {
      return new Response(
        JSON.stringify({ error: "instance_id, remote_jid, presence required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch instance (RLS ensures ownership)
    const { data: instance, error: instErr } = await supabase
      .from("whatsapp_instances")
      .select("server_url, api_token")
      .eq("id", instance_id)
      .single();

    if (instErr || !instance) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = (instance.server_url || Deno.env.get("UAZAPI_URL") || "").replace(/\/+$/, "");
    const apiToken = instance.api_token || Deno.env.get("UAZAPI_API_KEY") || "";

    // Extract phone number from remote_jid (e.g. "5511999999999@s.whatsapp.net" -> "5511999999999")
    const number = remote_jid.replace(/@.*$/, "");

    const res = await fetch(`${baseUrl}/message/presence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: apiToken,
      },
      body: JSON.stringify({
        number,
        presence, // "composing" | "recording" | "paused"
        delay: delay || 30000,
      }),
    });

    const result = await res.json().catch(() => ({}));

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[whatsapp-presence] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
