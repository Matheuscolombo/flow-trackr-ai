import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MEDIA_EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/opus": "opus",
  "video/mp4": "mp4", "video/3gpp": "3gp",
  "application/pdf": "pdf",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Find all media messages that need re-downloading
  // Include: CDN URLs (mmg.whatsapp.net) AND storage URLs (to re-download corrupted ones)
  const { data: messages, error } = await serviceClient
    .from("whatsapp_messages")
    .select("id, message_id, media_url, media_mime_type, workspace_id, instance_id")
    .not("media_url", "is", null)
    .neq("message_type", "text")
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // For storage URLs, check if the file is actually valid (try HEAD request)
  const needsDownload: typeof messages = [];
  for (const m of messages || []) {
    if (m.media_url?.includes("mmg.whatsapp.net") || m.media_url?.includes("mmg-fna.whatsapp.net")) {
      needsDownload.push(m);
    } else if (m.media_url?.includes("supabase.co/storage")) {
      // Check if stored file is valid
      try {
        const headRes = await fetch(m.media_url, { method: "HEAD" });
        const contentLength = parseInt(headRes.headers.get("content-length") || "0");
        const ct = (headRes.headers.get("content-type") || "").toLowerCase();
        if (!headRes.ok || contentLength < 100 || ct.includes("text/html") || ct.includes("xml")) {
          needsDownload.push(m);
        }
      } catch {
        needsDownload.push(m);
      }
    }
  }

  // Get unique instance IDs to fetch UAZAPI credentials
  const instanceIds = [...new Set(needsDownload.map(m => m.instance_id).filter(Boolean))];
  const instanceMap: Record<string, { server_url: string; api_token: string }> = {};
  
  for (const instId of instanceIds) {
    const { data: inst } = await serviceClient
      .from("whatsapp_instances")
      .select("server_url, api_token")
      .eq("id", instId)
      .maybeSingle();
    if (inst?.server_url && inst?.api_token) {
      instanceMap[instId] = { server_url: inst.server_url, api_token: inst.api_token };
    }
  }

  let success = 0;
  let failed = 0;

  for (const msg of needsDownload) {
    const creds = msg.instance_id ? instanceMap[msg.instance_id] : null;
    let blob: Blob | null = null;
    let downloadMethod = "";

    // Strategy 1: UAZAPI downloadMediaMessage
    if (creds) {
      const endpoints = [
        `${creds.server_url}/chat/downloadMediaMessage`,
        `${creds.server_url}/api/chat/downloadMediaMessage`,
      ];
      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": creds.api_token },
            body: JSON.stringify({ messageId: msg.message_id }),
          });
          if (res.ok) {
            const ct = (res.headers.get("content-type") || "").toLowerCase();
            if (ct.includes("application/json")) {
              const json = await res.json();
              const base64 = json.base64 || json.data || json.media;
              if (base64 && typeof base64 === "string") {
                const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                blob = new Blob([binary], { type: msg.media_mime_type || "application/octet-stream" });
                downloadMethod = "uazapi-base64";
                break;
              }
              const dlUrl = json.url || json.mediaUrl || json.fileUrl;
              if (dlUrl) {
                const dlRes = await fetch(dlUrl, { redirect: "follow" });
                if (dlRes.ok) {
                  blob = await dlRes.blob();
                  downloadMethod = "uazapi-url";
                  break;
                }
              }
            } else if (!ct.includes("text/html")) {
              blob = await res.blob();
              downloadMethod = "uazapi-binary";
              break;
            }
          }
        } catch { /* continue */ }
      }
    }

    // Strategy 2: Direct CDN (unlikely to work for old messages)
    if (!blob && msg.media_url) {
      try {
        const res = await fetch(msg.media_url, { redirect: "follow" });
        if (res.ok) {
          const ct = (res.headers.get("content-type") || "").toLowerCase();
          if (!ct.includes("text/html") && !ct.includes("text/plain")) {
            blob = await res.blob();
            downloadMethod = "cdn-direct";
          }
        }
      } catch { /* continue */ }
    }

    if (!blob || blob.size === 0 || blob.size > 20 * 1024 * 1024) {
      console.log(`[backfill] failed: ${msg.message_id} (${downloadMethod || "no-method"})`);
      failed++;
      continue;
    }

    const ext = (msg.media_mime_type && MEDIA_EXT_MAP[msg.media_mime_type]) || "bin";
    const safeId = msg.message_id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const storagePath = `${msg.workspace_id}/${safeId}.${ext}`;

    const { error: uploadErr } = await serviceClient.storage
      .from("whatsapp-media")
      .upload(storagePath, blob, {
        contentType: msg.media_mime_type || "application/octet-stream",
        upsert: true,
      });

    if (uploadErr) {
      console.log(`[backfill] upload failed: ${msg.message_id}: ${uploadErr.message}`);
      failed++;
      continue;
    }

    const { data: publicData } = serviceClient.storage
      .from("whatsapp-media")
      .getPublicUrl(storagePath);

    await serviceClient
      .from("whatsapp_messages")
      .update({ media_url: publicData.publicUrl })
      .eq("id", msg.id);

    console.log(`[backfill] success: ${msg.message_id} via ${downloadMethod} (${blob.size} bytes)`);
    success++;
  }

  return new Response(
    JSON.stringify({ ok: true, total: needsDownload.length, success, failed }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
