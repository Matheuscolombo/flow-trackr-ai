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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { funnel_id } = await req.json();
    if (!funnel_id) throw new Error("funnel_id is required");

    // Verify funnel belongs to user's workspace
    const { data: funnel } = await supabaseAuth
      .from("funnels")
      .select("id, workspace_id")
      .eq("id", funnel_id)
      .single();

    if (!funnel) throw new Error("Funnel not found or access denied");

    // 1. Get all lead_ids in this funnel
    const { data: positions } = await supabaseAdmin
      .from("lead_funnel_stages")
      .select("lead_id")
      .eq("funnel_id", funnel_id);

    const leadIds = [...new Set((positions || []).map((p: any) => p.lead_id))];
    console.log(`[clear-funnel] ${leadIds.length} leads in funnel`);

    if (leadIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No leads to clear" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Delete lead_funnel_stages for this funnel
    const { count: lfsDeleted } = await supabaseAdmin
      .from("lead_funnel_stages")
      .delete({ count: "exact" })
      .eq("funnel_id", funnel_id);

    // 3. Delete lead_events for this funnel
    const { count: eventsDeleted } = await supabaseAdmin
      .from("lead_events")
      .delete({ count: "exact" })
      .eq("funnel_id", funnel_id);

    // 4. Find orphan leads (no remaining positions in any funnel)
    const orphanIds: string[] = [];
    const CHUNK = 200;
    for (let i = 0; i < leadIds.length; i += CHUNK) {
      const chunk = leadIds.slice(i, i + CHUNK);
      const { data: remaining } = await supabaseAdmin
        .from("lead_funnel_stages")
        .select("lead_id")
        .in("lead_id", chunk);

      const hasPosition = new Set((remaining || []).map((r: any) => r.lead_id));
      for (const lid of chunk) {
        if (!hasPosition.has(lid)) orphanIds.push(lid);
      }
    }

    console.log(`[clear-funnel] ${orphanIds.length} orphan leads to delete`);

    // 5. Delete lead_tags and leads for orphans
    let tagsDeleted = 0;
    let leadsDeleted = 0;
    for (let i = 0; i < orphanIds.length; i += CHUNK) {
      const chunk = orphanIds.slice(i, i + CHUNK);
      
      // Also delete any remaining lead_events for orphans (from other funnels, unlikely but safe)
      await supabaseAdmin
        .from("lead_events")
        .delete()
        .in("lead_id", chunk);

      const { count: tc } = await supabaseAdmin
        .from("lead_tags")
        .delete({ count: "exact" })
        .in("lead_id", chunk);
      tagsDeleted += tc || 0;

      // Delete sale_events references (set lead_id to null)
      await supabaseAdmin
        .from("sale_events")
        .update({ lead_id: null })
        .in("lead_id", chunk);

      const { count: lc } = await supabaseAdmin
        .from("leads")
        .delete({ count: "exact" })
        .in("id", chunk);
      leadsDeleted += lc || 0;
    }

    const result = {
      ok: true,
      funnel_id,
      total_leads_in_funnel: leadIds.length,
      lfs_deleted: lfsDeleted,
      events_deleted: eventsDeleted,
      orphan_leads_deleted: leadsDeleted,
      orphan_tags_deleted: tagsDeleted,
      leads_kept: leadIds.length - orphanIds.length,
    };

    console.log("[clear-funnel] result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = String(err);
    console.error("[clear-funnel] error:", err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: msg.includes("Unauthorized") ? 401 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
