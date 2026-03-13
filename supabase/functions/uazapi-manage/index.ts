import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UazJson = Record<string, unknown>;

async function parseJsonResponse(res: Response): Promise<UazJson> {
  const raw = await res.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw) as UazJson;
  } catch {
    return { raw };
  }
}

function buildTokenHeaders(token: string, apiKey?: string | null): Array<Record<string, string>> {
  const headers: Array<Record<string, string>> = [
    { token },
    { Token: token },
    { Authorization: token },
    { Authorization: `Bearer ${token}` },
  ];

  if (apiKey) {
    headers.push(
      { token, apikey: apiKey },
      { token, admintoken: apiKey },
      { Authorization: `Bearer ${token}`, apikey: apiKey },
      { Authorization: token, apikey: apiKey },
    );
  }

  return headers;
}

function normalizeInstanceStatus(rawState: unknown): string {
  const state = String(rawState ?? "").toLowerCase();

  if (["open", "connected", "online", "ready", "authenticated"].includes(state)) {
    return "connected";
  }

  if (["connecting", "qrcode", "qr", "pairing", "pending"].includes(state)) {
    return "connecting";
  }

  return "disconnected";
}

function extractConnectionState(payload: UazJson): {
  status: string;
  phone: string | null;
  profileName: string | null;
  profilePicUrl: string | null;
} {
  // UAZAPI v2 response: { instance: { status, owner, profileName, profilePicUrl }, status: { connected, loggedIn } }
  const topInstance = (payload.instance && typeof payload.instance === "object" ? payload.instance : {}) as UazJson;
  const topStatus = (payload.status && typeof payload.status === "object" ? payload.status : null) as UazJson | null;
  const data = (payload.data && typeof payload.data === "object" ? payload.data : {}) as UazJson;
  const dataInstance = (data.instance && typeof data.instance === "object" ? data.instance : {}) as UazJson;

  // Determine connected status
  let finalStatus = "disconnected";

  // UAZAPI v2: check status.connected boolean first
  if (topStatus && topStatus.connected === true) {
    finalStatus = "connected";
  } else {
    // Fallback: check string-based status fields
    const rawState =
      topInstance.status ??
      payload.state ??
      (typeof payload.status === "string" ? payload.status : null) ??
      data.state ??
      data.status ??
      dataInstance.state ??
      dataInstance.status;

    finalStatus = normalizeInstanceStatus(rawState);
  }

  // Extract phone
  const rawPhone =
    topInstance.owner ??
    topInstance.phoneNumber ??
    topInstance.phone ??
    payload.phoneNumber ??
    payload.phone ??
    data.phoneNumber ??
    data.phone ??
    data.number ??
    dataInstance.phoneNumber ??
    dataInstance.phone ??
    dataInstance.number;

  // Extract profile info
  const profileName =
    topInstance.profileName ??
    dataInstance.profileName ??
    data.profileName ??
    null;

  const profilePicUrl =
    topInstance.profilePicUrl ??
    dataInstance.profilePicUrl ??
    data.profilePicUrl ??
    null;

  return {
    status: finalStatus,
    phone: rawPhone ? String(rawPhone) : null,
    profileName: profileName ? String(profileName) : null,
    profilePicUrl: profilePicUrl ? String(profilePicUrl) : null,
  };
}

async function fetchConnectionState(params: {
  baseUrl: string;
  instanceName: string;
  token: string;
  apiKey?: string | null;
}) {
  const { baseUrl, instanceName, token, apiKey } = params;

  // UAZAPI v2 uses GET /instance/status with header "token"
  // Also try Evolution API style endpoints as fallback
  const endpoints = [
    `${baseUrl}/instance/status`,
    `${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`,
    `${baseUrl}/instance/connectionState`,
  ];

  let lastAttempt: {
    status: number;
    data: UazJson;
    endpoint: string;
    authHeader: string;
  } | null = null;

  for (const endpoint of endpoints) {
    for (const headers of buildTokenHeaders(token, apiKey)) {
      try {
        const res = await fetch(endpoint, {
          method: "GET",
          headers,
        });
        const data = await parseJsonResponse(res);
        const authHeader = Object.keys(headers).join(",");

        console.log(`[fetchConnectionState] ${endpoint} [${authHeader}] → ${res.status}`, JSON.stringify(data));

        if (res.ok) {
          return { ok: true as const, data, endpoint, authHeader };
        }

        if (!lastAttempt || res.status !== 404) {
          lastAttempt = { status: res.status, data, endpoint, authHeader };
        }
      } catch (e) {
        console.error(`[fetchConnectionState] ${endpoint} error:`, e);
      }
    }
  }

  return {
    ok: false as const,
    status: lastAttempt?.status ?? 404,
    data: lastAttempt?.data ?? { code: 404, message: "Not Found.", data: {} },
    endpoint: lastAttempt?.endpoint ?? endpoints[0],
    authHeader: lastAttempt?.authHeader ?? "token",
  };
}

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

    // ── IMPORT existing instance ──
    if (req.method === "POST" && action === "import") {
      const body = await req.json();
      const instanceName = (body.name || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
      const displayName = (body.display_name || body.name || "").trim();
      const token = (body.token || "").trim();
      const serverUrl = (body.server_url || "").trim() || null;

      if (!instanceName || !token) {
        return new Response(JSON.stringify({ error: "name and token are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate token by checking connection state — use provided server_url or fallback
      const baseUrl = (serverUrl || UAZAPI_URL).replace(/\/$/, "");
      let detectedStatus = "disconnected";
      let detectedPhone: string | null = null;
      let detectedProfileName: string | null = null;
      let detectedProfilePicUrl: string | null = null;

      try {
        const stateResult = await fetchConnectionState({
          baseUrl,
          instanceName,
          token,
          apiKey: UAZAPI_API_KEY,
        });

        if (!stateResult.ok) {
          return new Response(JSON.stringify({
            error: "Invalid token or instance not found on UAZAPI",
            detail: stateResult.data,
            debug: {
              endpoint: stateResult.endpoint,
              auth_header: stateResult.authHeader,
              status_code: stateResult.status,
            },
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log("[uazapi-manage] import validation:", JSON.stringify(stateResult.data));
        const parsed = extractConnectionState(stateResult.data);
        detectedStatus = parsed.status;
        detectedPhone = parsed.phone;
        detectedProfileName = parsed.profileName;
        detectedProfilePicUrl = parsed.profilePicUrl;
      } catch (e) {
        console.error("[uazapi-manage] import validation error:", e);
        return new Response(JSON.stringify({ error: "Could not reach UAZAPI to validate token" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save to DB
      const { data: saved, error: saveErr } = await serviceClient
        .from("whatsapp_instances")
        .insert({
          workspace_id: workspace.id,
          instance_name: instanceName,
          instance_display_name: displayName || instanceName,
          status: detectedStatus,
          api_token: token,
          phone: detectedPhone,
          server_url: serverUrl,
          profile_name: detectedProfileName,
          profile_pic_url: detectedProfilePicUrl,
        })
        .select()
        .single();

      if (saveErr) {
        return new Response(JSON.stringify({ error: saveErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ instance: saved, status: detectedStatus }), {
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

      const baseUrl = (inst.server_url || UAZAPI_URL).replace(/\/$/, "");
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

      const baseUrl = (inst.server_url || UAZAPI_URL).replace(/\/$/, "");
      const stateResult = await fetchConnectionState({
        baseUrl,
        instanceName: inst.instance_name,
        token: inst.api_token,
        apiKey: UAZAPI_API_KEY,
      });

      if (!stateResult.ok) {
        return new Response(JSON.stringify({
          error: "Failed to read instance status on UAZAPI",
          detail: stateResult.data,
          debug: {
            endpoint: stateResult.endpoint,
            auth_header: stateResult.authHeader,
            status_code: stateResult.status,
          },
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const parsed = extractConnectionState(stateResult.data);
      const newStatus = parsed.status;

      // Update status in DB
      const phone = parsed.phone || inst.phone;
      const updateData: Record<string, unknown> = {
        status: newStatus,
        phone: phone || inst.phone,
      };
      if (parsed.profileName) updateData.profile_name = parsed.profileName;
      if (parsed.profilePicUrl) updateData.profile_pic_url = parsed.profilePicUrl;

      await serviceClient
        .from("whatsapp_instances")
        .update(updateData)
        .eq("id", instanceId);

      return new Response(JSON.stringify({ status: newStatus, detail: stateResult.data }), {
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

    // ── UPDATE PROFILE (name, status, picture) ──
    if (req.method === "POST" && action === "update_profile") {
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

      const baseUrl = (inst.server_url || UAZAPI_URL).replace(/\/$/, "");
      const token = inst.api_token;
      const results: Record<string, unknown> = {};

      // Update profile name
      if (body.profile_name !== undefined) {
        const nameEndpoints = [
          { url: `${baseUrl}/profile/setProfileName`, method: "PUT" },
          { url: `${baseUrl}/profile/name`, method: "PUT" },
          { url: `${baseUrl}/instance/setProfileName`, method: "PUT" },
        ];
        for (const ep of nameEndpoints) {
          try {
            const res = await fetch(ep.url, {
              method: ep.method,
              headers: { "Content-Type": "application/json", token },
              body: JSON.stringify({ name: body.profile_name }),
            });
            const data = await parseJsonResponse(res);
            console.log(`[update_profile] name ${ep.url} → ${res.status}`, JSON.stringify(data));
            if (res.ok) { results.name = { ok: true, data }; break; }
          } catch (e) { console.error(`[update_profile] name error:`, e); }
        }
      }

      // Update status text (about/bio)
      if (body.status_text !== undefined) {
        const statusEndpoints = [
          { url: `${baseUrl}/profile/setStatus`, method: "PUT" },
          { url: `${baseUrl}/profile/status`, method: "PUT" },
          { url: `${baseUrl}/instance/setStatus`, method: "PUT" },
        ];
        for (const ep of statusEndpoints) {
          try {
            const res = await fetch(ep.url, {
              method: ep.method,
              headers: { "Content-Type": "application/json", token },
              body: JSON.stringify({ status: body.status_text }),
            });
            const data = await parseJsonResponse(res);
            console.log(`[update_profile] status ${ep.url} → ${res.status}`, JSON.stringify(data));
            if (res.ok) { results.status_text = { ok: true, data }; break; }
          } catch (e) { console.error(`[update_profile] status error:`, e); }
        }
      }

      // Update profile picture
      if (body.profile_pic_base64) {
        const picEndpoints = [
          { url: `${baseUrl}/profile/setProfilePicture`, method: "POST" },
          { url: `${baseUrl}/profile/picture`, method: "POST" },
          { url: `${baseUrl}/instance/setProfilePicture`, method: "POST" },
        ];
        for (const ep of picEndpoints) {
          try {
            const res = await fetch(ep.url, {
              method: ep.method,
              headers: { "Content-Type": "application/json", token },
              body: JSON.stringify({ image: body.profile_pic_base64 }),
            });
            const data = await parseJsonResponse(res);
            console.log(`[update_profile] pic ${ep.url} → ${res.status}`, JSON.stringify(data));
            if (res.ok) { results.picture = { ok: true, data }; break; }
          } catch (e) { console.error(`[update_profile] pic error:`, e); }
        }
      }

      // Update local DB
      const dbUpdate: Record<string, unknown> = {};
      if (body.profile_name !== undefined) dbUpdate.profile_name = body.profile_name;
      if (body.status_text !== undefined) dbUpdate.status_text = body.status_text;
      // For picture, re-fetch status to get new URL
      if (body.profile_pic_base64 && results.picture) {
        try {
          const stateResult = await fetchConnectionState({ baseUrl, instanceName: inst.instance_name, token, apiKey: UAZAPI_API_KEY });
          if (stateResult.ok) {
            const parsed = extractConnectionState(stateResult.data);
            if (parsed.profilePicUrl) dbUpdate.profile_pic_url = parsed.profilePicUrl;
          }
        } catch (e) { console.error("[update_profile] refetch pic url error:", e); }
      }

      if (Object.keys(dbUpdate).length > 0) {
        await serviceClient.from("whatsapp_instances").update(dbUpdate).eq("id", instanceId);
      }

      return new Response(JSON.stringify({ ok: true, results, updated: dbUpdate }), {
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
