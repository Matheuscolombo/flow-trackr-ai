import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normEmail(email: string): string {
  return (email || "").toLowerCase().trim();
}

function normPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  if (digits.length === 12 && digits.startsWith("55")) return `+${digits}`;
  return `+55${digits.slice(-11)}`;
}

function detectSeparator(firstLine: string): string {
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseCSV(text: string, sep: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const rawHeader = lines[0].replace(/^\uFEFF/, "");
  const headers = rawHeader.split(sep).map((h) => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map((line) => {
    const values = line.split(sep).map((v) => v.replace(/^"|"$/g, "").trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

const SYNONYMS: Record<string, string[]> = {
  nome: ["nome", "name", "nome completo", "full_name", "customer_name", "nome do lead"],
  email: ["email", "e-mail", "e-mail do lead", "customer_email"],
  telefone: ["telefone", "phone", "fone", "celular", "whatsapp", "mobile"],
};

function findField(headers: string[], fieldKey: string): string | null {
  const synonyms = SYNONYMS[fieldKey] || [];
  for (const header of headers) {
    const h = header.toLowerCase().trim();
    if (synonyms.some((s) => h === s)) return header;
  }
  for (const header of headers) {
    const h = header.toLowerCase().trim();
    if (synonyms.some((s) => s.length >= 4 && (h.includes(s) || s.includes(h)))) return header;
  }
  return null;
}

function getFieldValue(row: Record<string, string>, fieldKey: string, overrides: Record<string, string> | null, headers: string[]): string {
  if (overrides && overrides[fieldKey]) return row[overrides[fieldKey]] || "";
  const header = findField(headers, fieldKey);
  return header ? (row[header] || "") : "";
}

// ─── Shared: authenticate + get workspace ────────────────────────────────────

async function authenticateAndGetWorkspace(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Unauthorized");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Unauthorized");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!workspace) throw new Error("Workspace not found");

  return { supabase, workspaceId: workspace.id };
}

// ─── Mode: event_only ────────────────────────────────────────────────────────

async function handleEventOnly(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  body: Record<string, unknown>
) {
  const { csvText, fieldOverrides, eventName, campaignId, tagIds } = body as {
    csvText: string;
    fieldOverrides?: Record<string, string>;
    eventName: string;
    campaignId?: string;
    tagIds?: string[];
  };

  if (!csvText || !eventName) {
    return new Response(JSON.stringify({ error: "csvText e eventName são obrigatórios" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const overrides = fieldOverrides && typeof fieldOverrides === "object" ? fieldOverrides : null;
  const firstLine = csvText.split(/\r?\n/)[0]?.replace(/^\uFEFF/, "") || "";
  const sep = detectSeparator(firstLine);
  const rows = parseCSV(csvText, sep);
  const headers = firstLine.split(sep).map((h: string) => h.replace(/^"|"$/g, "").trim());

  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "CSV vazio" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build existing contacts index
  const { data: existingLeads } = await supabase
    .from("leads")
    .select("id, email, phone")
    .eq("workspace_id", workspaceId);

  const emailIndex: Record<string, string> = {};
  const phoneIndex: Record<string, string> = {};
  (existingLeads || []).forEach((l: { id: string; email: string | null; phone: string | null }) => {
    if (l.email) emailIndex[normEmail(l.email)] = l.id;
    if (l.phone) phoneIndex[normPhone(l.phone)] = l.id;
  });

  // If campaignId provided, get funnels in that campaign
  let campaignFunnelIds: Set<string> | null = null;
  if (campaignId) {
    const { data: campaignFunnels } = await supabase
      .from("funnels")
      .select("id")
      .eq("campaign_id", campaignId);
    campaignFunnelIds = new Set((campaignFunnels || []).map((f: { id: string }) => f.id));
  }

  // Pre-fetch all stage_transition_rules for relevant funnels
  let transitionRules: { funnel_id: string; event_name: string; from_stage_id: string | null; to_stage_id: string }[] = [];
  {
    const q = supabase
      .from("stage_transition_rules")
      .select("funnel_id, event_name, from_stage_id, to_stage_id")
      .eq("event_name", eventName)
      .order("priority", { ascending: true });
    const { data } = await q;
    transitionRules = data || [];
  }

  let found = 0;
  let notFound = 0;
  let noContact = 0;
  let eventsCreated = 0;
  const seenContacts = new Set<string>();
  const eventRows: Record<string, unknown>[] = [];
  const tagRows: Record<string, unknown>[] = [];
  const stageUpdates: { leadId: string; funnelId: string; toStageId: string; fromStageId: string }[] = [];

  for (const row of rows) {
    const email = normEmail(getFieldValue(row, "email", overrides, headers));
    const phone = normPhone(getFieldValue(row, "telefone", overrides, headers));

    if (!email && !phone) { noContact++; continue; }
    if (email && !email.includes("@")) { noContact++; continue; }

    const contactKey = phone || email;
    if (seenContacts.has(contactKey)) continue;
    seenContacts.add(contactKey);

    const leadId = (email && emailIndex[email]) || (phone && phoneIndex[phone]) || null;
    if (!leadId) { notFound++; continue; }

    // Get positions for this lead
    const { data: positions } = await supabase
      .from("lead_funnel_stages")
      .select("funnel_id, stage_id")
      .eq("lead_id", leadId);

    const filteredPositions = (positions || []).filter((p: { funnel_id: string }) =>
      !campaignFunnelIds || campaignFunnelIds.has(p.funnel_id)
    );

    if (filteredPositions.length === 0) { notFound++; continue; }

    found++;

    for (const pos of filteredPositions) {
      eventRows.push({
        lead_id: leadId,
        funnel_id: pos.funnel_id,
        event_name: eventName,
        source: "import",
        payload_raw: {},
        timestamp_event: new Date().toISOString(),
      });
      eventsCreated++;

      // Check transition rules
      const rule = transitionRules.find(
        (r) => r.funnel_id === pos.funnel_id && (r.from_stage_id === null || r.from_stage_id === pos.stage_id)
      );
      if (rule) {
        stageUpdates.push({
          leadId,
          funnelId: pos.funnel_id,
          toStageId: rule.to_stage_id,
          fromStageId: pos.stage_id,
        });
      }
    }

    // Tags
    if (tagIds && Array.isArray(tagIds)) {
      for (const tagId of tagIds) {
        tagRows.push({ lead_id: leadId, tag_id: tagId });
      }
    }
  }

  // Insert events in chunks
  const CHUNK = 300;
  for (let i = 0; i < eventRows.length; i += CHUNK) {
    await supabase.from("lead_events").insert(eventRows.slice(i, i + CHUNK));
  }

  // Apply stage transitions
  for (const upd of stageUpdates) {
    await supabase
      .from("lead_funnel_stages")
      .update({
        stage_id: upd.toStageId,
        previous_stage_id: upd.fromStageId,
        moved_by: "import",
        updated_at: new Date().toISOString(),
      })
      .eq("lead_id", upd.leadId)
      .eq("funnel_id", upd.funnelId);
  }

  // Insert tags
  if (tagRows.length > 0) {
    for (let i = 0; i < tagRows.length; i += CHUNK) {
      await supabase
        .from("lead_tags")
        .upsert(tagRows.slice(i, i + CHUNK), { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
    }
  }

  console.log(`[import-leads:event_only] found=${found} notFound=${notFound} noContact=${noContact} eventsCreated=${eventsCreated} transitions=${stageUpdates.length}`);

  return new Response(
    JSON.stringify({ ok: true, found, not_found: notFound, no_contact: noContact, events_created: eventsCreated }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ─── Mode: funnel (default) ──────────────────────────────────────────────────

async function handleFunnelImport(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  body: Record<string, unknown>
) {
  const { csvText, fieldOverrides, funnelId, stageId, tagIds } = body as {
    csvText: string;
    fieldOverrides?: Record<string, string>;
    funnelId: string;
    stageId: string;
    tagIds?: string[];
  };

  if (!csvText || !funnelId || !stageId) {
    return new Response(JSON.stringify({ error: "csvText, funnelId e stageId são obrigatórios" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const overrides = fieldOverrides && typeof fieldOverrides === "object" ? fieldOverrides : null;
  const firstLine = csvText.split(/\r?\n/)[0]?.replace(/^\uFEFF/, "") || "";
  const sep = detectSeparator(firstLine);
  const rows = parseCSV(csvText, sep);
  const headers = firstLine.split(sep).map((h: string) => h.replace(/^"|"$/g, "").trim());

  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "CSV vazio" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build existing contacts index
  const { data: existingLeads } = await supabase
    .from("leads")
    .select("id, email, phone")
    .eq("workspace_id", workspaceId);

  const emailIndex: Record<string, string> = {};
  const phoneIndex: Record<string, string> = {};
  (existingLeads || []).forEach((l: { id: string; email: string | null; phone: string | null }) => {
    if (l.email) emailIndex[normEmail(l.email)] = l.id;
    if (l.phone) phoneIndex[normPhone(l.phone)] = l.id;
  });

  const { data: existingPositions } = await supabase
    .from("lead_funnel_stages")
    .select("lead_id")
    .eq("funnel_id", funnelId);

  const existingInFunnel = new Set((existingPositions || []).map((p: { lead_id: string }) => p.lead_id));

  let imported = 0;
  let duplicates = 0;
  let noContact = 0;
  const newLeads: Record<string, unknown>[] = [];
  const lfsRows: Record<string, unknown>[] = [];
  const tagRows: Record<string, unknown>[] = [];
  const seenContacts = new Set<string>();

  for (const row of rows) {
    const email = normEmail(getFieldValue(row, "email", overrides, headers));
    const phone = normPhone(getFieldValue(row, "telefone", overrides, headers));
    const name = getFieldValue(row, "nome", overrides, headers) || null;

    if (!email && !phone) { noContact++; continue; }
    if (email && !email.includes("@")) { noContact++; continue; }

    const contactKey = phone || email;
    if (seenContacts.has(contactKey)) { duplicates++; continue; }
    seenContacts.add(contactKey);

    let leadId = (email && emailIndex[email]) || (phone && phoneIndex[phone]) || null;

    if (leadId) {
      if (existingInFunnel.has(leadId)) { duplicates++; continue; }
    } else {
      newLeads.push({
        workspace_id: workspaceId,
        name: name || phone || email,
        email: email || null,
        phone: phone || null,
        source: "import",
        imported_at: new Date().toISOString(),
        metadata: { imported: true },
      });
    }
    imported++;
  }

  // Insert new leads in chunks
  const CHUNK = 300;
  for (let i = 0; i < newLeads.length; i += CHUNK) {
    const chunk = newLeads.slice(i, i + CHUNK);
    const { data: created } = await supabase
      .from("leads")
      .insert(chunk)
      .select("id, email, phone");

    (created || []).forEach((l: { id: string; email: string | null; phone: string | null }) => {
      if (l.email) emailIndex[normEmail(l.email)] = l.id;
      if (l.phone) phoneIndex[normPhone(l.phone)] = l.id;
    });
  }

  // Build LFS and tag rows
  const seenContacts2 = new Set<string>();
  for (const row of rows) {
    const email = normEmail(getFieldValue(row, "email", overrides, headers));
    const phone = normPhone(getFieldValue(row, "telefone", overrides, headers));

    if (!email && !phone) continue;
    if (email && !email.includes("@")) continue;

    const contactKey = phone || email;
    if (seenContacts2.has(contactKey)) continue;
    seenContacts2.add(contactKey);

    const leadId = (email && emailIndex[email]) || (phone && phoneIndex[phone]) || null;
    if (!leadId) continue;
    if (existingInFunnel.has(leadId)) continue;

    lfsRows.push({
      lead_id: leadId,
      funnel_id: funnelId,
      stage_id: stageId,
      moved_by: "import",
      source: "import",
      entered_at: new Date().toISOString(),
    });

    if (tagIds && Array.isArray(tagIds)) {
      for (const tagId of tagIds) {
        tagRows.push({ lead_id: leadId, tag_id: tagId });
      }
    }
  }

  for (let i = 0; i < lfsRows.length; i += CHUNK) {
    await supabase
      .from("lead_funnel_stages")
      .upsert(lfsRows.slice(i, i + CHUNK), { onConflict: "lead_id,funnel_id", ignoreDuplicates: true });
  }

  if (tagRows.length > 0) {
    for (let i = 0; i < tagRows.length; i += CHUNK) {
      await supabase
        .from("lead_tags")
        .upsert(tagRows.slice(i, i + CHUNK), { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
    }
  }

  console.log(`[import-leads:funnel] imported=${imported} duplicates=${duplicates} noContact=${noContact}`);

  return new Response(
    JSON.stringify({ ok: true, imported, duplicates, no_contact: noContact }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, workspaceId } = await authenticateAndGetWorkspace(req);
    const body = await req.json();
    const mode = body.mode || "funnel";

    if (mode === "event_only") {
      return await handleEventOnly(supabase, workspaceId, body);
    }

    return await handleFunnelImport(supabase, workspaceId, body);
  } catch (err) {
    const msg = String(err);
    const status = msg.includes("Unauthorized") ? 401 : msg.includes("not found") ? 404 : 500;
    console.error("[import-leads] error:", err);
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
