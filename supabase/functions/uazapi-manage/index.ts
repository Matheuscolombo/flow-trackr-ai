import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    const UAZAPI_API_KEY = Deno.env.get("UAZAPI_API_KEY");

    if (!UAZAPI_URL || !UAZAPI_API_KEY) {
      return new Response(JSON.stringify({ error: "UAZAPI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: get user from JWT
    const authHeader = req.headers.get("authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get workspace
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!workspace) {
      return new Response(JSON.stringify({ error: "No workspace found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── LIST instances ──
    if (req.method === "GET" && action === "list") {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify({ instances: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CREATE instance ──
    if (req.method === "POST" && action === "create") {
      const body = await req.json();
      const instanceName = (body.name || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const displayName = (body.display_name || body.name || "").trim();

      if (!instanceName) {
        return new Response(JSON.stringify({ error: "Instance name required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Call UAZAPI to create instance
      const baseUrl = UAZAPI_URL.replace(/\/$/, "");
      const uazRes = await fetch(`${baseUrl}/instance/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "admintoken": UAZAPI_API_KEY,
        },
        body: JSON.stringify({
          name: instanceName,
          systemName: "sentinel",
        }),
      });

      const uazData = await uazRes.json();
      console.log("[uazapi-manage] create response:", JSON.stringify(uazData));

      if (!uazRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to create instance on UAZAPI", detail: uazData }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract token from response
      const instanceToken = uazData.token || uazData.instance?.token || null;

      // Save to DB
      const { data: saved, error: saveErr } = await serviceClient
        .from("whatsapp_instances")
        .insert({
          workspace_id: workspace.id,
          instance_name: instanceName,
          instance_display_name: displayName || instanceName,
          status: "disconnected",
          api_token: instanceToken,
        })
        .select()
        .single();

      if (saveErr) {
        return new Response(JSON.stringify({ error: saveErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ instance: saved, uazapi: uazData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CONNECT (QR Code or Pairing Code) ──
    if (req.method === "POST" && action === "connect") {
      const body = await req.json();
      const instanceId = body.instance_id;
      if (!instanceId) {
        return new Response(JSON.stringify({ error: "instance_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: inst } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instanceId)
        .eq("workspace_id", workspace.id)
        .single();

      if (!inst || !inst.api_token) {
        return new Response(JSON.stringify({ error: "Instance not found or no token" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const baseUrl = UAZAPI_URL.replace(/\/$/, "");
      const connectBody: Record<string, string> = {};
      if (body.phone) connectBody.phone = body.phone;

      const connectRes = await fetch(`${baseUrl}/instance/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": inst.api_token,
        },
        body: JSON.stringify(connectBody),
      });

      const connectData = await connectRes.json();
      console.log("[uazapi-manage] connect response:", JSON.stringify(connectData));

      // Update status to connecting
      await serviceClient
        .from("whatsapp_instances")
        .update({ status: "connecting" })
        .eq("id", instanceId);

      return new Response(JSON.stringify(connectData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STATUS (connection state) ──
    if (req.method === "GET" && action === "status") {
      const instanceId = url.searchParams.get("instance_id");
      if (!instanceId) {
        return new Response(JSON.stringify({ error: "instance_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: inst } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instanceId)
        .eq("workspace_id", workspace.id)
        .single();

      if (!inst || !inst.api_token) {
        return new Response(JSON.stringify({ error: "Instance not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const baseUrl = UAZAPI_URL.replace(/\/$/, "");
      const stateRes = await fetch(`${baseUrl}/instance/connectionState`, {
        headers: { "token": inst.api_token },
      });

      const stateData = await stateRes.json();
      const newStatus = stateData.state === "open" ? "connected"
        : stateData.state === "connecting" ? "connecting"
        : "disconnected";

      // Update status in DB
      const phone = stateData.phoneNumber || stateData.phone || inst.phone;
      await serviceClient
        .from("whatsapp_instances")
        .update({ status: newStatus, phone: phone || inst.phone })
        .eq("id", instanceId);

      return new Response(JSON.stringify({ status: newStatus, detail: stateData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE instance ──
    if (req.method === "POST" && action === "delete") {
      const body = await req.json();
      const instanceId = body.instance_id;

      const { data: inst } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instanceId)
        .eq("workspace_id", workspace.id)
        .single();

      if (!inst) {
        return new Response(JSON.stringify({ error: "Instance not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try to delete on UAZAPI side
      if (inst.api_token) {
        try {
          const baseUrl = UAZAPI_URL.replace(/\/$/, "");
          await fetch(`${baseUrl}/instance/delete`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "admintoken": UAZAPI_API_KEY,
            },
            body: JSON.stringify({ name: inst.instance_name }),
          });
        } catch (e) {
          console.error("[uazapi-manage] delete UAZAPI error:", e);
        }
      }

      // Delete from DB
      await serviceClient.from("whatsapp_instances").delete().eq("id", instanceId);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[uazapi-manage] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
