import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-funnel-token",
};

function normPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  if (digits.length === 12 && digits.startsWith("55")) return `+${digits}`;
  return `+55${digits.slice(-11)}`;
}

function normEmail(email: string): string {
  return (email || "").toLowerCase().trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get token from header or URL path
    const token = req.headers.get("x-funnel-token") || "";
    if (!token) {
      return new Response(JSON.stringify({ error: "x-funnel-token header required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token against funnels
    const { data: funnel, error: funnelErr } = await serviceClient
      .from("funnels")
      .select("id, workspace_id")
      .eq("webhook_token", token)
      .eq("is_active", true)
      .single();

    if (funnelErr || !funnel) {
      return new Response(JSON.stringify({ error: "Invalid or inactive funnel token" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { event, phone: rawPhone, email: rawEmail, name, idempotency_key, metadata } = body;

    const phone = normPhone(rawPhone || "");
    const email = normEmail(rawEmail || "");

    if (!phone && !email) {
      return new Response(JSON.stringify({ error: "phone or email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency check
    if (idempotency_key) {
      const { data: existing } = await serviceClient
        .from("lead_events")
        .select("id")
        .eq("idempotency_key", idempotency_key)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ ok: true, action: "idempotent_skip" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Find or create lead
    let leadId: string | null = null;

    if (phone) {
      const { data: byPhone } = await serviceClient
        .from("leads")
        .select("id")
        .eq("workspace_id", funnel.workspace_id)
        .eq("phone", phone)
        .maybeSingle();
      if (byPhone) leadId = byPhone.id;
    }

    if (!leadId && email) {
      const { data: byEmail } = await serviceClient
        .from("leads")
        .select("id")
        .eq("workspace_id", funnel.workspace_id)
        .eq("email", email)
        .maybeSingle();
      if (byEmail) leadId = byEmail.id;
    }

    if (!leadId) {
      const { data: newLead } = await serviceClient
        .from("leads")
        .insert({
          workspace_id: funnel.workspace_id,
          phone: phone || null,
          email: email || null,
          name: name || phone || email,
          source: "webhook",
          metadata: metadata || {},
          utm_source: metadata?.utm_source || null,
          utm_campaign: metadata?.utm_campaign || null,
          utm_content: metadata?.utm_content || null,
          utm_medium: metadata?.utm_medium || null,
        })
        .select("id")
        .single();

      if (!newLead) {
        return new Response(JSON.stringify({ error: "Failed to create lead" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      leadId = newLead.id;
    }

    // Find transition rule for this event
    const eventName = event || "lead_created";

    const { data: rules } = await serviceClient
      .from("stage_transition_rules")
      .select("id, from_stage_id, to_stage_id")
      .eq("funnel_id", funnel.id)
      .eq("event_name", eventName)
      .order("priority", { ascending: true });

    let targetStageId: string | null = null;

    if (rules && rules.length > 0) {
      // Get current position
      const { data: currentPos } = await serviceClient
        .from("lead_funnel_stages")
        .select("stage_id")
        .eq("lead_id", leadId)
        .eq("funnel_id", funnel.id)
        .maybeSingle();

      const currentStageId = currentPos?.stage_id || null;

      for (const rule of rules) {
        if (rule.from_stage_id === null || rule.from_stage_id === currentStageId) {
          targetStageId = rule.to_stage_id;
          break;
        }
      }
    }

    if (targetStageId) {
      // Get current position for previous_stage_id
      const { data: currentPos } = await serviceClient
        .from("lead_funnel_stages")
        .select("stage_id")
        .eq("lead_id", leadId)
        .eq("funnel_id", funnel.id)
        .maybeSingle();

      await serviceClient
        .from("lead_funnel_stages")
        .upsert({
          lead_id: leadId,
          funnel_id: funnel.id,
          stage_id: targetStageId,
          previous_stage_id: currentPos?.stage_id || null,
          moved_by: "webhook",
          source: "webhook",
          entered_at: new Date().toISOString(),
        }, { onConflict: "lead_id,funnel_id" });
    }

    // Log the event
    await serviceClient
      .from("lead_events")
      .insert({
        funnel_id: funnel.id,
        lead_id: leadId,
        event_name: eventName,
        source: "webhook",
        idempotency_key: idempotency_key || null,
        payload_raw: body,
        timestamp_event: body.timestamp || new Date().toISOString(),
      });

    console.log(`[webhook-lead] funnel=${funnel.id} lead=${leadId} event=${eventName} stage=${targetStageId}`);

    return new Response(
      JSON.stringify({ ok: true, lead_id: leadId, stage_id: targetStageId, action: targetStageId ? "moved" : "no_rule" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[webhook-lead] error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
