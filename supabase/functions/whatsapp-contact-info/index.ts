import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Generate phone variant with/without 9th digit for Brazilian numbers.
 * 13-digit (55+DDD+9+8digits) ↔ 12-digit (55+DDD+8digits)
 */
function phoneVariant(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    // Remove 9th digit: 55 XX 9 XXXX XXXX → 55 XX XXXX XXXX
    return `+${digits.slice(0, 4)}${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    // Add 9th digit: 55 XX XXXX XXXX → 55 XX 9 XXXX XXXX
    return `+${digits.slice(0, 4)}9${digits.slice(4)}`;
  }
  return null;
}

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

    const url = new URL(req.url);
    const instanceId = url.searchParams.get("instance_id");
    const phone = url.searchParams.get("phone");

    if (!instanceId || !phone) {
      return new Response(JSON.stringify({ error: "Missing instance_id or phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get instance (verify ownership)
    const { data: instance } = await serviceClient
      .from("whatsapp_instances")
      .select("id, workspace_id, server_url, api_token")
      .eq("id", instanceId)
      .maybeSingle();

    if (!instance) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify workspace ownership
    const { data: workspace } = await serviceClient
      .from("workspaces")
      .select("id")
      .eq("id", instance.workspace_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!workspace) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call UAZAPI /chat/details
    const baseUrl = instance.server_url || Deno.env.get("UAZAPI_URL");
    const token = instance.api_token || Deno.env.get("UAZAPI_API_KEY");

    if (!baseUrl || !token) {
      return new Response(JSON.stringify({ error: "UAZAPI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize phone for UAZAPI (just digits)
    const phoneDigits = phone.replace(/\D/g, "");

    console.log(`[contact-info] fetching details for ${phoneDigits} from ${baseUrl}`);

    const detailsRes = await fetch(`${baseUrl}/chat/details`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({ number: phoneDigits, preview: true }),
    });

    let contactData: Record<string, unknown> = {};
    if (detailsRes.ok) {
      contactData = await detailsRes.json();
      console.log(`[contact-info] got details:`, JSON.stringify(contactData).slice(0, 300));
    } else {
      console.log(`[contact-info] /chat/details failed: ${detailsRes.status}`);
    }

    // Extract useful fields
    const waName = (contactData.wa_name as string) ||
      (contactData.wa_contactName as string) ||
      (contactData.pushName as string) ||
      (contactData.name as string) || null;

    const imagePreview = (contactData.imagePreview as string) ||
      (contactData.profilePicUrl as string) ||
      (contactData.imgUrl as string) || null;

    // Update lead if exists
    const phoneNorm = phone.startsWith("+") ? phone : `+${phoneDigits}`;
    const variant = phoneVariant(phoneNorm);
    
    let lead = null;
    const { data: leadExact } = await serviceClient
      .from("leads")
      .select("id, name, profile_pic_url")
      .eq("workspace_id", instance.workspace_id)
      .eq("phone", phoneNorm)
      .maybeSingle();

    lead = leadExact;

    if (!lead && variant) {
      const { data: leadVar } = await serviceClient
        .from("leads")
        .select("id, name, profile_pic_url")
        .eq("workspace_id", instance.workspace_id)
        .eq("phone", variant)
        .maybeSingle();
      lead = leadVar;
    }

    if (lead) {
      const updates: Record<string, unknown> = {};
      if (imagePreview && !lead.profile_pic_url) updates.profile_pic_url = imagePreview;
      if (waName && !lead.name) updates.name = waName;

      if (Object.keys(updates).length > 0) {
        await serviceClient.from("leads").update(updates).eq("id", lead.id);
        console.log(`[contact-info] updated lead ${lead.id}:`, updates);
      }
    }

    return new Response(JSON.stringify({
      wa_name: waName,
      image_preview: imagePreview,
      phone: phoneNorm,
      lead_id: lead?.id || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[whatsapp-contact-info] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
