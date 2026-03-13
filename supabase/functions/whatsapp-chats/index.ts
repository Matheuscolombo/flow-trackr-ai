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
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify user
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

    // Get user's workspace
    const { data: workspace } = await serviceClient
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!workspace) {
      return new Response(JSON.stringify({ error: "No workspace" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list_chats";

    if (action === "list_chats") {
      const instanceId = url.searchParams.get("instance_id") || null;

      // Get distinct conversations with last message, ordered by recency
      // Using a raw approach: fetch recent messages grouped by phone
      let query = serviceClient
        .from("whatsapp_messages")
        .select("id, phone, remote_jid, body, direction, message_type, timestamp_msg, instance_id, lead_id")
        .eq("workspace_id", workspace.id)
        .order("timestamp_msg", { ascending: false })
        .limit(1000);

      if (instanceId) {
        query = query.eq("instance_id", instanceId);
      }

      const { data: messages, error } = await query;
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Group by phone to get conversations
      const chatMap = new Map<string, {
        phone: string;
        remote_jid: string;
        last_message: string;
        last_message_type: string;
        last_direction: string;
        last_timestamp: string;
        instance_id: string | null;
        lead_id: string | null;
        message_count: number;
      }>();

      for (const msg of messages || []) {
        if (!chatMap.has(msg.phone)) {
          chatMap.set(msg.phone, {
            phone: msg.phone,
            remote_jid: msg.remote_jid,
            last_message: msg.body || `[${msg.message_type}]`,
            last_message_type: msg.message_type,
            last_direction: msg.direction,
            last_timestamp: msg.timestamp_msg,
            instance_id: msg.instance_id,
            lead_id: msg.lead_id,
            message_count: 1,
          });
        } else {
          chatMap.get(msg.phone)!.message_count++;
        }
      }

      // For messages action, also fetch payload_raw to extract body fallback
      

      // Enrich with lead names
      const leadIds = [...new Set([...chatMap.values()].filter(c => c.lead_id).map(c => c.lead_id!))];
      let leadNames: Record<string, string> = {};

      if (leadIds.length > 0) {
        const { data: leads } = await serviceClient
          .from("leads")
          .select("id, name, email")
          .in("id", leadIds);

        if (leads) {
          for (const l of leads) {
            leadNames[l.id] = l.name || l.email || "";
          }
        }
      }

      const chats = [...chatMap.values()]
        .sort((a, b) => new Date(b.last_timestamp).getTime() - new Date(a.last_timestamp).getTime())
        .map(c => ({
          ...c,
          contact_name: c.lead_id ? (leadNames[c.lead_id] || null) : null,
        }));

      return new Response(JSON.stringify({ chats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "messages") {
      const phone = url.searchParams.get("phone");
      const instanceId = url.searchParams.get("instance_id") || null;
      const limit = parseInt(url.searchParams.get("limit") || "100");
      const before = url.searchParams.get("before") || null; // cursor for pagination

      if (!phone) {
        return new Response(JSON.stringify({ error: "Missing phone param" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let query = serviceClient
        .from("whatsapp_messages")
        .select("id, phone, remote_jid, body, direction, message_type, timestamp_msg, status, media_url, media_mime_type, lead_id, instance_id, message_id")
        .eq("workspace_id", workspace.id)
        .eq("phone", phone)
        .order("timestamp_msg", { ascending: true })
        .limit(limit);

      if (instanceId) {
        query = query.eq("instance_id", instanceId);
      }

      if (before) {
        query = query.lt("timestamp_msg", before);
      }

      const { data: msgs, error } = await query;
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ messages: msgs || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[whatsapp-chats] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
