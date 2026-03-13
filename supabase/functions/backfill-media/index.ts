import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Find messages with CDN media URLs (mmg.whatsapp.net) that need re-downloading
  const { data: messages, error } = await serviceClient
    .from("whatsapp_messages")
    .select("id, message_id, media_url, media_mime_type, workspace_id")
    .not("media_url", "is", null)
    .like("media_url", "%mmg.whatsapp.net%")
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/opus": "opus",
    "audio/ogg; codecs=opus": "ogg",
    "video/mp4": "mp4", "video/3gpp": "3gp",
    "application/pdf": "pdf",
  };

  let success = 0;
  let failed = 0;

  for (const msg of messages || []) {
    try {
      const res = await fetch(msg.media_url, { redirect: "follow" });
      if (!res.ok) { failed++; continue; }
      const blob = await res.blob();
      if (blob.size === 0) { failed++; continue; }

      const ext = (msg.media_mime_type && extMap[msg.media_mime_type]) || "bin";
      const safeId = msg.message_id.replace(/[^a-zA-Z0-9_-]/g, "_");
      const storagePath = `${msg.workspace_id}/${safeId}.${ext}`;

      const { error: uploadErr } = await serviceClient.storage
        .from("whatsapp-media")
        .upload(storagePath, blob, {
          contentType: msg.media_mime_type || "application/octet-stream",
          upsert: true,
        });

      if (uploadErr) { failed++; continue; }

      const { data: publicData } = serviceClient.storage
        .from("whatsapp-media")
        .getPublicUrl(storagePath);

      await serviceClient
        .from("whatsapp_messages")
        .update({ media_url: publicData.publicUrl })
        .eq("id", msg.id);

      success++;
    } catch {
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, total: messages?.length || 0, success, failed }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
