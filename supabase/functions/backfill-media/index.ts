import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MEDIA_EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/opus": "opus",
  "audio/ogg; codecs=opus": "ogg",
  "video/mp4": "mp4", "video/3gpp": "3gp",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

function shortMessageId(fullId: string): string {
  const parts = fullId.split(":");
  return parts.length > 1 ? parts[parts.length - 1] : fullId;
}

function isValidMediaResponse(res: Response): boolean {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("text/html") || ct.includes("text/plain")) return false;
  return true;
}

async function extractBlobFromResponse(
  res: Response,
  mimeType: string | null,
): Promise<Blob | null> {
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  if (ct.includes("application/json")) {
    const json = await res.json();
    // UAZAPI v2 returns base64Data and/or fileURL
    const base64 = json.base64Data || json.base64 || json.data || json.media;
    if (base64 && typeof base64 === "string") {
      const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const blob = new Blob([binary], { type: mimeType || "application/octet-stream" });
      if (blob.size > 0 && blob.size < 20 * 1024 * 1024) return blob;
    }
    const dlUrl = json.fileURL || json.url || json.mediaUrl || json.fileUrl;
    if (dlUrl && typeof dlUrl === "string") {
      const dlRes = await fetch(dlUrl, { redirect: "follow" });
      if (dlRes.ok && isValidMediaResponse(dlRes)) {
        const blob = await dlRes.blob();
        if (blob.size > 0 && blob.size < 20 * 1024 * 1024) return blob;
      }
    }
    return null;
  }

  if (ct.includes("text/html") || ct.includes("text/plain")) return null;

  const blob = await res.blob();
  if (blob.size > 0 && blob.size < 20 * 1024 * 1024) return blob;
  return null;
}

async function tryDownload(
  creds: { server_url: string; api_token: string },
  messageId: string,
  mediaUrl: string | null,
  mimeType: string | null,
): Promise<{ blob: Blob; method: string } | null> {
  const shortId = shortMessageId(messageId);

  const attempts: Array<{ label: string; fn: () => Promise<Response> }> = [
    {
      label: "POST /chat/downloadMediaMessage (shortId)",
      fn: () => fetch(`${creds.server_url}/chat/downloadMediaMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": creds.api_token },
        body: JSON.stringify({ messageId: shortId }),
      }),
    },
    {
      label: "GET /chat/downloadMediaMessage?messageId (shortId)",
      fn: () => fetch(`${creds.server_url}/chat/downloadMediaMessage?messageId=${encodeURIComponent(shortId)}`, {
        method: "GET",
        headers: { "token": creds.api_token },
      }),
    },
    {
      label: "POST /chat/downloadMediaMessage (fullId)",
      fn: () => fetch(`${creds.server_url}/chat/downloadMediaMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": creds.api_token },
        body: JSON.stringify({ messageId }),
      }),
    },
    {
      label: "GET /chat/downloadMediaMessage/shortId",
      fn: () => fetch(`${creds.server_url}/chat/downloadMediaMessage/${encodeURIComponent(shortId)}`, {
        method: "GET",
        headers: { "token": creds.api_token },
      }),
    },
    {
      label: "POST /message/downloadMedia (shortId)",
      fn: () => fetch(`${creds.server_url}/message/downloadMedia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": creds.api_token },
        body: JSON.stringify({ messageId: shortId }),
      }),
    },
  ];

  for (const attempt of attempts) {
    try {
      console.log(`[backfill] trying: ${attempt.label}`);
      const res = await attempt.fn();
      console.log(`[backfill] ${attempt.label}: ${res.status} ${res.headers.get("content-type")}`);

      if (res.ok) {
        const blob = await extractBlobFromResponse(res, mimeType);
        if (blob) {
          return { blob, method: attempt.label };
        }
      }
    } catch (e) {
      console.log(`[backfill] ${attempt.label} error: ${e}`);
    }
  }

  // CDN fallback
  if (mediaUrl) {
    try {
      // Strip cache-buster params to get clean URL
      const cleanUrl = mediaUrl.split("?")[0];
      const res = await fetch(cleanUrl, { redirect: "follow" });
      if (res.ok && isValidMediaResponse(res)) {
        const blob = await res.blob();
        if (blob.size > 0 && blob.size < 20 * 1024 * 1024) {
          return { blob, method: "cdn-direct" };
        }
      }
    } catch { /* continue */ }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Find all media messages
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

  const needsDownload = messages || [];

  // Get instance credentials
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
  const results: Array<{ id: string; status: string; method?: string; size?: number }> = [];

  for (const msg of needsDownload) {
    const creds = msg.instance_id ? instanceMap[msg.instance_id] : null;

    if (!creds) {
      console.log(`[backfill] skip ${msg.message_id}: no credentials`);
      failed++;
      results.push({ id: msg.message_id, status: "no_credentials" });
      continue;
    }

    // Delete existing corrupted file first
    const safeId = msg.message_id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const ext = (msg.media_mime_type && MEDIA_EXT_MAP[msg.media_mime_type]) || "bin";
    const storagePath = `${msg.workspace_id}/${safeId}.${ext}`;

    await serviceClient.storage.from("whatsapp-media").remove([storagePath]);

    const result = await tryDownload(creds, msg.message_id, msg.media_url, msg.media_mime_type);

    if (!result) {
      console.log(`[backfill] FAILED: ${msg.message_id}`);
      failed++;
      results.push({ id: msg.message_id, status: "download_failed" });
      continue;
    }

    const { blob, method } = result;

    const { error: uploadErr } = await serviceClient.storage
      .from("whatsapp-media")
      .upload(storagePath, blob, {
        contentType: msg.media_mime_type || "application/octet-stream",
        upsert: true,
      });

    if (uploadErr) {
      console.log(`[backfill] upload failed: ${msg.message_id}: ${uploadErr.message}`);
      failed++;
      results.push({ id: msg.message_id, status: "upload_failed" });
      continue;
    }

    const { data: publicData } = serviceClient.storage
      .from("whatsapp-media")
      .getPublicUrl(storagePath);

    const freshUrl = `${publicData.publicUrl}?v=${Date.now()}`;

    await serviceClient
      .from("whatsapp_messages")
      .update({ media_url: freshUrl })
      .eq("id", msg.id);

    console.log(`[backfill] SUCCESS: ${msg.message_id} via ${method} (${blob.size} bytes)`);
    success++;
    results.push({ id: msg.message_id, status: "success", method, size: blob.size });
  }

  return new Response(
    JSON.stringify({ ok: true, total: needsDownload.length, success, failed, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
