import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Detect specific media type from MIME type string */
function mimeToType(mime: string): string {
  if (!mime) return "media";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("application/") || mime.startsWith("text/")) return "document";
  return "media";
}

/** Generate a friendly preview text for the chat list */
function mediaPreview(messageType: string): string {
  const icons: Record<string, string> = {
    image: "📷 Foto",
    audio: "🎤 Áudio",
    video: "🎬 Vídeo",
    document: "📄 Documento",
    sticker: "🩷 Sticker",
    media: "📎 Mídia",
  };
  return icons[messageType] || `[${messageType}]`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify user via getClaims (ES256 compatible)
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      console.error("[whatsapp-chats] JWT validation failed:", claimsErr);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

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

      // Group by phone
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
          const preview = msg.message_type === "text"
            ? (msg.body || "")
            : (msg.body ? `${mediaPreview(msg.message_type)} ${msg.body}` : mediaPreview(msg.message_type));
          chatMap.set(msg.phone, {
            phone: msg.phone,
            remote_jid: msg.remote_jid,
            last_message: preview,
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

      // Enrich with lead names
      let leadIds = [...new Set([...chatMap.values()].filter(c => c.lead_id).map(c => c.lead_id!))];

      let leadInfo: Record<string, { name: string; profile_pic_url: string | null }> = {};

      if (leadIds.length > 0) {
        const { data: leads } = await serviceClient
          .from("leads")
          .select("id, name, email, profile_pic_url")
          .in("id", leadIds);

        if (leads) {
          for (const l of leads) {
            leadInfo[l.id] = {
              name: l.name || l.email || "",
              profile_pic_url: l.profile_pic_url || null,
            };
          }
        }
      }

      const chats = [...chatMap.values()]
        .sort((a, b) => new Date(b.last_timestamp).getTime() - new Date(a.last_timestamp).getTime())
        .map(c => ({
          ...c,
          contact_name: c.lead_id ? (leadInfo[c.lead_id]?.name || null) : null,
          profile_pic_url: c.lead_id ? (leadInfo[c.lead_id]?.profile_pic_url || null) : null,
        }));

      return new Response(JSON.stringify({ chats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "messages") {
      const phone = url.searchParams.get("phone");
      const instanceId = url.searchParams.get("instance_id") || null;
      const limit = parseInt(url.searchParams.get("limit") || "100");
      const before = url.searchParams.get("before") || null;

      if (!phone) {
        return new Response(JSON.stringify({ error: "Missing phone param" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let query = serviceClient
        .from("whatsapp_messages")
        .select("id, phone, remote_jid, body, direction, message_type, timestamp_msg, status, media_url, media_mime_type, lead_id, instance_id, message_id, payload_raw")
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

      // Enrich: derive body and media_url from payload_raw when missing
      const enriched = (msgs || []).map((m: Record<string, unknown>) => {
        let body = m.body as string | null;
        let mediaUrl = m.media_url as string | null;
        let mediaMimeType = m.media_mime_type as string | null;
        let messageType = m.message_type as string;

        if (m.payload_raw && typeof m.payload_raw === "object") {
          const pr = m.payload_raw as Record<string, unknown>;
          const msg = (pr.message || {}) as Record<string, unknown>;
          const content = (msg.content && typeof msg.content === "object" ? msg.content : {}) as Record<string, unknown>;

          // Derive body from payload_raw
          if (!body) {
            body =
              (typeof msg.text === "string" ? msg.text : null) ||
              (typeof msg.content === "string" ? msg.content : null) ||
              (typeof content.text === "string" ? content.text : null) ||
              (typeof content.caption === "string" ? content.caption : null) ||
              null;
          }

          // Derive media_url from payload_raw
          if (!mediaUrl && typeof content.URL === "string") {
            mediaUrl = content.URL;
          }
          if (!mediaMimeType && typeof content.mimetype === "string") {
            mediaMimeType = content.mimetype;
          }

          // Refine message_type from 'media' to specific type
          if (messageType === "media" && mediaMimeType) {
            messageType = mimeToType(mediaMimeType);
          }
        }

        const { payload_raw, ...rest } = m as Record<string, unknown>;
        return {
          ...rest,
          body,
          media_url: mediaUrl,
          media_mime_type: mediaMimeType,
          message_type: messageType,
        };
      });

      return new Response(JSON.stringify({ messages: enriched }), {
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
