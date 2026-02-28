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
  data: ["data de conversão", "data", "date", "created_at", "data_cadastro", "converted_at", "timestamp"],
};

// Truncate timestamp to the minute for dedup (same minute = same signup)
function truncateToMinute(dateStr: string): string {
  if (!dateStr) return "";
  // Handle common formats: "2026-02-18 21:41:44" or ISO
  const d = new Date(dateStr.replace(" ", "T"));
  if (isNaN(d.getTime())) return dateStr.trim(); // fallback to raw string
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// Count distinct signups per contact: dedup by phone+minute, return count and distinct timestamps
function countDistinctSignups(
  rows: Record<string, string>[],
  overrides: Record<string, string> | null,
  headers: string[]
): { contactSignups: Map<string, { count: number; timestamps: string[] }>; noContact: number } {
  // Group rows by contact, collecting unique timestamps
  const contactTimestamps = new Map<string, Set<string>>();
  const contactRawTimestamps = new Map<string, Map<string, string>>(); // minute → raw timestamp
  let noContact = 0;

  for (const row of rows) {
    const email = normEmail(getFieldValue(row, "email", overrides, headers));
    const phone = normPhone(getFieldValue(row, "telefone", overrides, headers));
    if (!email && !phone) { noContact++; continue; }
    if (email && !email.includes("@")) { noContact++; continue; }
    const contactKey = phone || email;

    const rawDate = getFieldValue(row, "data", overrides, headers);
    const minuteKey = truncateToMinute(rawDate);

    if (!contactTimestamps.has(contactKey)) {
      contactTimestamps.set(contactKey, new Set());
      contactRawTimestamps.set(contactKey, new Map());
    }
    contactTimestamps.get(contactKey)!.add(minuteKey);
    if (!contactRawTimestamps.get(contactKey)!.has(minuteKey)) {
      contactRawTimestamps.get(contactKey)!.set(minuteKey, rawDate);
    }
  }

  const contactSignups = new Map<string, { count: number; timestamps: string[] }>();
  for (const [key, minutes] of contactTimestamps.entries()) {
    const rawMap = contactRawTimestamps.get(key)!;
    const timestamps = Array.from(minutes).map((m) => rawMap.get(m) || m).sort();
    contactSignups.set(key, { count: minutes.size, timestamps });
  }

  return { contactSignups, noContact };
}

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

// ─── Shared: paginated lead index builder ────────────────────────────────────

async function buildLeadIndex(supabase: ReturnType<typeof createClient>, workspaceId: string) {
  const emailIndex: Record<string, string> = {};
  const phoneIndex: Record<string, string> = {};
  const PAGE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from("leads")
      .select("id, email, phone")
      .eq("workspace_id", workspaceId)
      .range(offset, offset + PAGE - 1);

    const rows = data || [];
    rows.forEach((l: { id: string; email: string | null; phone: string | null }) => {
      if (l.email) emailIndex[normEmail(l.email)] = l.id;
      if (l.phone) phoneIndex[normPhone(l.phone)] = l.id;
    });

    hasMore = rows.length === PAGE;
    offset += PAGE;
  }

  return { emailIndex, phoneIndex };
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

// ─── Extended synonyms for backfill columns ──────────────────────────────────

const BACKFILL_SYNONYMS: Record<string, string[]> = {
  email: ["seu e-mail", "email", "e-mail", "e-mail do lead", "customer_email"],
  telefone: ["whatsapp com ddd", "whatsapp", "telefone", "phone", "fone", "celular", "mobile"],
  nome: ["nome", "name", "nome completo", "full_name", "customer_name", "nome do lead"],
  device: ["dispositivo", "device"],
  page_url: ["url", "page_url", "pagina", "página"],
  conversion_date: ["data de conversão", "data de conversao", "data_conversao", "conversion_date", "converted_at", "created_at", "data"],
  country: ["país do usuário", "pais do usuario", "country", "país", "pais"],
  region: ["região do usuário", "regiao do usuario", "region", "região", "regiao", "estado"],
  city: ["cidade do usuário", "cidade do usuario", "city", "cidade"],
  referral_source: ["referral source", "referral_source", "origem"],
  form_id: ["id do formulário", "id do formulario", "form_id"],
  utm_source: ["utm source", "utm_source"],
  utm_medium: ["utm medium", "utm_medium"],
  utm_campaign: ["utm campaign", "utm_campaign"],
  utm_content: ["utm content", "utm_content"],
  utm_term: ["utm term", "utm_term"],
};

function findBackfillField(headers: string[], fieldKey: string): string | null {
  const synonyms = BACKFILL_SYNONYMS[fieldKey] || [];
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

function getBackfillValue(row: Record<string, string>, fieldKey: string, headers: string[]): string {
  const header = findBackfillField(headers, fieldKey);
  return header ? (row[header] || "").trim() : "";
}

function cleanUtmValue(val: string): string | null {
  if (!val) return null;
  if (val.startsWith("{") && val.endsWith("}")) return null;
  return val;
}

function safeISODate(val: string | null): string {
  if (!val) return new Date().toISOString();
  const trimmed = val.trim();
  // Try parsing "YYYY-MM-DD HH:mm:ss" by adding T and Z
  const isoAttempt = trimmed.replace(" ", "T");
  const d = new Date(isoAttempt.includes("T") && !isoAttempt.endsWith("Z") ? isoAttempt + "Z" : isoAttempt);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Fallback: try direct parse
  const d2 = new Date(trimmed);
  if (!isNaN(d2.getTime())) return d2.toISOString();
  return new Date().toISOString();
}

// ─── Mode: backfill ──────────────────────────────────────────────────────────

async function handleBackfill(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  body: Record<string, unknown>
) {
  const { csvText, funnelId, stageId, tagIds } = body as {
    csvText: string;
    funnelId: string;
    stageId: string;
    tagIds?: string[];
  };

  if (!csvText || !funnelId || !stageId) {
    return new Response(JSON.stringify({ error: "csvText, funnelId e stageId são obrigatórios" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const firstLine = csvText.split(/\r?\n/)[0]?.replace(/^\uFEFF/, "") || "";
  const sep = detectSeparator(firstLine);
  const rows = parseCSV(csvText, sep);
  const headers = firstLine.split(sep).map((h: string) => h.replace(/^"|"$/g, "").trim());

  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: "CSV vazio" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get funnel name
  const { data: funnelData } = await supabase.from("funnels").select("name").eq("id", funnelId).single();
  const funnelName = funnelData?.name || "Funil";

  // Sort rows by conversion date (chronological order)
  const dateField = findBackfillField(headers, "conversion_date");
  if (dateField) {
    rows.sort((a, b) => {
      const da = new Date(safeISODate(a[dateField] || null)).getTime();
      const db = new Date(safeISODate(b[dateField] || null)).getTime();
      return da - db;
    });
  }

  const { emailIndex, phoneIndex } = await buildLeadIndex(supabase, workspaceId);

  // Check who is already in the funnel
  const { data: existingPositions } = await supabase
    .from("lead_funnel_stages")
    .select("lead_id")
    .eq("funnel_id", funnelId);
  const existingInFunnel = new Set((existingPositions || []).map((p: { lead_id: string }) => p.lead_id));

  // Track occurrences per contact (by phone)
  const contactOccurrences: Record<string, number> = {};

  let created = 0;
  let duplicateRegistrations = 0;
  let noContact = 0;
  let eventsCreated = 0;
  const CHUNK = 300;

  const newLeadsBatch: Record<string, unknown>[] = [];
  const eventsBatch: Record<string, unknown>[] = [];
  const lfsBatch: Record<string, unknown>[] = [];
  const tagBatch: Record<string, unknown>[] = [];
  const signupUpdates: string[] = [];

  for (const row of rows) {
    const email = normEmail(getBackfillValue(row, "email", headers));
    const phone = normPhone(getBackfillValue(row, "telefone", headers));
    const name = getBackfillValue(row, "nome", headers) || null;
    const device = getBackfillValue(row, "device", headers) || null;
    const pageUrl = getBackfillValue(row, "page_url", headers) || null;
    const convDate = getBackfillValue(row, "conversion_date", headers) || null;
    const country = getBackfillValue(row, "country", headers) || null;
    const region = getBackfillValue(row, "region", headers) || null;
    const city = getBackfillValue(row, "city", headers) || null;
    const referralSource = getBackfillValue(row, "referral_source", headers) || null;
    const formId = getBackfillValue(row, "form_id", headers) || null;
    const utmSource = cleanUtmValue(getBackfillValue(row, "utm_source", headers));
    const utmMedium = cleanUtmValue(getBackfillValue(row, "utm_medium", headers));
    const utmCampaign = cleanUtmValue(getBackfillValue(row, "utm_campaign", headers));
    const utmContent = cleanUtmValue(getBackfillValue(row, "utm_content", headers));
    const utmTerm = cleanUtmValue(getBackfillValue(row, "utm_term", headers));

    if (!email && !phone) { noContact++; continue; }
    if (email && !email.includes("@")) { noContact++; continue; }

    const contactKey = phone || email;
    contactOccurrences[contactKey] = (contactOccurrences[contactKey] || 0) + 1;
    const isFirst = contactOccurrences[contactKey] === 1;

    let leadId = (email && emailIndex[email]) || (phone && phoneIndex[phone]) || null;

    const timestamp = safeISODate(convDate);

    const payload = {
      phone, email, name, device, page_url: pageUrl,
      referral_source: referralSource, form_id: formId,
      country, region, city, funnel_name: funnelName,
      utm_source: utmSource, utm_medium: utmMedium,
      utm_campaign: utmCampaign, utm_content: utmContent, utm_term: utmTerm,
    };

    if (!leadId) {
      // New lead — create it
      newLeadsBatch.push({
        workspace_id: workspaceId,
        name: name || phone || email,
        email: email || null,
        phone: phone || null,
        source: "import",
        imported_at: timestamp,
        device, page_url: pageUrl, country, region, city,
        referral_source: referralSource, form_id: formId,
        utm_source: utmSource, utm_medium: utmMedium,
        utm_campaign: utmCampaign, utm_content: utmContent, utm_term: utmTerm,
        metadata: { imported: true, backfill: true },
      });
      created++;
    } else if (!isFirst) {
      // Repeat registration for existing lead
      duplicateRegistrations++;
      signupUpdates.push(leadId);
    }

    // We'll insert events and LFS after creating new leads (need IDs)
  }

  // Insert new leads
  for (let i = 0; i < newLeadsBatch.length; i += CHUNK) {
    const chunk = newLeadsBatch.slice(i, i + CHUNK);
    const { data: createdLeads } = await supabase
      .from("leads")
      .insert(chunk)
      .select("id, email, phone");
    (createdLeads || []).forEach((l: { id: string; email: string | null; phone: string | null }) => {
      if (l.email) emailIndex[normEmail(l.email)] = l.id;
      if (l.phone) phoneIndex[normPhone(l.phone)] = l.id;
    });
  }

  // Second pass: create events and LFS entries
  const contactOccurrences2: Record<string, number> = {};
  for (const row of rows) {
    const email = normEmail(getBackfillValue(row, "email", headers));
    const phone = normPhone(getBackfillValue(row, "telefone", headers));
    if (!email && !phone) continue;
    if (email && !email.includes("@")) continue;

    const contactKey = phone || email;
    contactOccurrences2[contactKey] = (contactOccurrences2[contactKey] || 0) + 1;
    const isFirst = contactOccurrences2[contactKey] === 1;

    const leadId = (email && emailIndex[email]) || (phone && phoneIndex[phone]) || null;
    if (!leadId) continue;

    const name = getBackfillValue(row, "nome", headers) || null;
    const device = getBackfillValue(row, "device", headers) || null;
    const pageUrl = getBackfillValue(row, "page_url", headers) || null;
    const convDate = getBackfillValue(row, "conversion_date", headers) || null;
    const country = getBackfillValue(row, "country", headers) || null;
    const region = getBackfillValue(row, "region", headers) || null;
    const city = getBackfillValue(row, "city", headers) || null;
    const referralSource = getBackfillValue(row, "referral_source", headers) || null;
    const utmSource = cleanUtmValue(getBackfillValue(row, "utm_source", headers));
    const utmMedium = cleanUtmValue(getBackfillValue(row, "utm_medium", headers));
    const utmCampaign = cleanUtmValue(getBackfillValue(row, "utm_campaign", headers));
    const utmContent = cleanUtmValue(getBackfillValue(row, "utm_content", headers));
    const utmTerm = cleanUtmValue(getBackfillValue(row, "utm_term", headers));
    const timestamp = safeISODate(convDate);

    const payload = {
      phone, email, name, device, page_url: pageUrl,
      referral_source: referralSource, country, region, city,
      funnel_name: funnelName,
      utm_source: utmSource, utm_medium: utmMedium,
      utm_campaign: utmCampaign, utm_content: utmContent, utm_term: utmTerm,
    };

    eventsBatch.push({
      lead_id: leadId,
      funnel_id: funnelId,
      event_name: isFirst ? "pagina_cadastro" : "cadastro_repetido",
      source: "import",
      payload_raw: payload,
      timestamp_event: timestamp,
    });
    eventsCreated++;

    // Place in funnel (only first occurrence)
    if (isFirst && !existingInFunnel.has(leadId)) {
      lfsBatch.push({
        lead_id: leadId,
        funnel_id: funnelId,
        stage_id: stageId,
        moved_by: "import",
        source: "import",
        entered_at: timestamp,
      });
      existingInFunnel.add(leadId);
    }

    // Tags (only first occurrence)
    if (isFirst && tagIds && Array.isArray(tagIds)) {
      for (const tagId of tagIds) {
        tagBatch.push({ lead_id: leadId, tag_id: tagId });
      }
    }
  }

  // Insert events
  for (let i = 0; i < eventsBatch.length; i += CHUNK) {
    await supabase.from("lead_events").insert(eventsBatch.slice(i, i + CHUNK));
  }

  // Insert LFS
  for (let i = 0; i < lfsBatch.length; i += CHUNK) {
    await supabase.from("lead_funnel_stages")
      .upsert(lfsBatch.slice(i, i + CHUNK), { onConflict: "lead_id,funnel_id", ignoreDuplicates: true });
  }

  // Insert tags
  if (tagBatch.length > 0) {
    for (let i = 0; i < tagBatch.length; i += CHUNK) {
      await supabase.from("lead_tags")
        .upsert(tagBatch.slice(i, i + CHUNK), { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
    }
  }

  // Update signup_count for duplicates
  const uniqueSignupUpdates = [...new Set(signupUpdates)];
  for (const lid of uniqueSignupUpdates) {
    // Count occurrences for this lead
    const count = Object.entries(contactOccurrences).reduce((acc, [key, cnt]) => {
      const leadForKey = (emailIndex[key] || phoneIndex[key]);
      return leadForKey === lid ? acc + cnt : acc;
    }, 0);
    if (count > 1) {
      await supabase.from("leads").update({
        signup_count: count,
        last_signup_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", lid);
    }
  }

  console.log(`[import-leads:backfill] created=${created} duplicateRegs=${duplicateRegistrations} events=${eventsCreated} noContact=${noContact}`);

  return new Response(
    JSON.stringify({
      ok: true,
      created,
      duplicate_registrations: duplicateRegistrations,
      events_created: eventsCreated,
      no_contact: noContact,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
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

  const { emailIndex, phoneIndex } = await buildLeadIndex(supabase, workspaceId);

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

  const { emailIndex, phoneIndex } = await buildLeadIndex(supabase, workspaceId);

  const { data: existingPositions } = await supabase
    .from("lead_funnel_stages")
    .select("lead_id")
    .eq("funnel_id", funnelId);

  const existingInFunnel = new Set((existingPositions || []).map((p: { lead_id: string }) => p.lead_id));

  // Smart first pass: count distinct signups per contact (dedup by phone+minute)
  const { contactSignups, noContact: noContactFirstPass } = countDistinctSignups(rows, overrides, headers);

  let imported = 0;
  let duplicates = 0;
  let noContact = 0;
  const newLeads: Record<string, unknown>[] = [];
  const lfsRows: Record<string, unknown>[] = [];
  const tagRows: Record<string, unknown>[] = [];
  const seenContacts = new Set<string>();
  const duplicateLeadIds: string[] = [];
  const signupCountByContact = new Map<string, { count: number; timestamps: string[] }>();

  for (const row of rows) {
    const email = normEmail(getFieldValue(row, "email", overrides, headers));
    const phone = normPhone(getFieldValue(row, "telefone", overrides, headers));
    const name = getFieldValue(row, "nome", overrides, headers) || null;

    if (!email && !phone) { noContact++; continue; }
    if (email && !email.includes("@")) { noContact++; continue; }

    const contactKey = phone || email;
    if (seenContacts.has(contactKey)) { duplicates++; continue; }
    seenContacts.add(contactKey);

    const signupData = contactSignups.get(contactKey) || { count: 1, timestamps: [] };
    signupCountByContact.set(contactKey, signupData);

    let leadId = (email && emailIndex[email]) || (phone && phoneIndex[phone]) || null;

    if (leadId) {
      if (existingInFunnel.has(leadId)) {
        duplicates++;
        duplicateLeadIds.push(leadId);
        // Still track signup data for this duplicate so we update signup_count later
        signupCountByContact.set(contactKey, signupData);
        continue;
      }
    } else {
      newLeads.push({
        workspace_id: workspaceId,
        name: name || phone || email,
        email: email || null,
        phone: phone || null,
        source: "import",
        imported_at: new Date().toISOString(),
        metadata: { imported: true },
        signup_count: signupData.count,
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

  // Update signup_count and create lead_events for re-signups
  const allLeadUpdates: { id: string; count: number; timestamps: string[] }[] = [];
  for (const [contactKey, signupData] of signupCountByContact.entries()) {
    const leadId = (emailIndex[contactKey]) || (phoneIndex[contactKey]) || null;
    if (!leadId) continue;
    allLeadUpdates.push({ id: leadId, count: signupData.count, timestamps: signupData.timestamps });
  }
  // Also handle leads already in funnel that weren't in signupCountByContact
  const uniqueDuplicateIds = [...new Set(duplicateLeadIds)];

  let eventsCreated = 0;
  const eventRows: Record<string, unknown>[] = [];
  for (const upd of allLeadUpdates) {
    // Update signup_count
    const lastTs = upd.timestamps.length > 1 ? upd.timestamps[upd.timestamps.length - 1] : null;
    await supabase
      .from("leads")
      .update({
        signup_count: upd.count,
        last_signup_at: lastTs ? new Date(lastTs.replace(" ", "T")).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", upd.id);

    // Create lead_events for each re-signup (skip the first one = original signup)
    if (upd.count > 1) {
      for (let i = 1; i < upd.timestamps.length; i++) {
        const ts = upd.timestamps[i];
        const isoTs = new Date(ts.replace(" ", "T")).toISOString();
        eventRows.push({
          lead_id: upd.id,
          funnel_id: funnelId,
          event_name: "re_signup",
          source: "import",
          timestamp_event: isoTs,
          payload_raw: { signup_number: i + 1, total_signups: upd.count },
          idempotency_key: `re_signup_${upd.id}_${isoTs}`,
        });
      }
    }
  }

  // Batch insert lead_events
  if (eventRows.length > 0) {
    for (let i = 0; i < eventRows.length; i += CHUNK) {
      const { data } = await supabase
        .from("lead_events")
        .upsert(eventRows.slice(i, i + CHUNK), { onConflict: "idempotency_key", ignoreDuplicates: true })
        .select("id");
      eventsCreated += (data || []).length;
    }
  }

  console.log(`[import-leads:funnel] imported=${imported} duplicates=${duplicates} signupEventsCreated=${eventsCreated} noContact=${noContact}`);

  return new Response(
    JSON.stringify({ ok: true, imported, duplicates, signup_events_created: eventsCreated, no_contact: noContact }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ─── Mode: recalculate_signups ───────────────────────────────────────────────
// Re-processes a CSV to update signup_count without importing new leads or positions

async function handleRecalculateSignups(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  body: Record<string, unknown>
) {
  const { csvText, fieldOverrides, funnelId } = body as {
    csvText: string;
    fieldOverrides?: Record<string, string>;
    funnelId?: string;
  };

  if (!csvText) {
    return new Response(JSON.stringify({ error: "csvText é obrigatório" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const overrides = fieldOverrides && typeof fieldOverrides === "object" ? fieldOverrides : null;
  const firstLine = csvText.split(/\r?\n/)[0]?.replace(/^\uFEFF/, "") || "";
  const sep = detectSeparator(firstLine);
  const rows = parseCSV(csvText, sep);
  const headers = firstLine.split(sep).map((h: string) => h.replace(/^"|"$/g, "").trim());

  // Smart dedup: count distinct signups per contact (by phone+minute)
  const { contactSignups, noContact } = countDistinctSignups(rows, overrides, headers);

  const { emailIndex, phoneIndex } = await buildLeadIndex(supabase, workspaceId);

  let updated = 0;
  let eventsCreated = 0;
  const CHUNK = 300;
  const eventRows: Record<string, unknown>[] = [];

  for (const [contactKey, signupData] of contactSignups.entries()) {
    const leadId = emailIndex[contactKey] || phoneIndex[contactKey] || null;
    if (!leadId) continue;

    const lastTs = signupData.timestamps.length > 1 ? signupData.timestamps[signupData.timestamps.length - 1] : null;
    await supabase
      .from("leads")
      .update({
        signup_count: signupData.count,
        last_signup_at: lastTs ? new Date(lastTs.replace(" ", "T")).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);
    if (signupData.count > 1) updated++;

    // Create lead_events for each re-signup (skip first = original signup)
    if (signupData.count > 1 && funnelId) {
      for (let i = 1; i < signupData.timestamps.length; i++) {
        const ts = signupData.timestamps[i];
        const isoTs = new Date(ts.replace(" ", "T")).toISOString();
        eventRows.push({
          lead_id: leadId,
          funnel_id: funnelId,
          event_name: "re_signup",
          source: "import",
          timestamp_event: isoTs,
          payload_raw: { signup_number: i + 1, total_signups: signupData.count },
          idempotency_key: `re_signup_${leadId}_${isoTs}`,
        });
      }
    }
  }

  // Batch insert lead_events
  if (eventRows.length > 0) {
    for (let i = 0; i < eventRows.length; i += CHUNK) {
      const { data } = await supabase
        .from("lead_events")
        .upsert(eventRows.slice(i, i + CHUNK), { onConflict: "idempotency_key", ignoreDuplicates: true })
        .select("id");
      eventsCreated += (data || []).length;
    }
  }

  console.log(`[import-leads:recalculate_signups] total_rows=${rows.length} unique=${contactSignups.size} updated=${updated} events=${eventsCreated} noContact=${noContact}`);

  return new Response(
    JSON.stringify({
      ok: true,
      total_rows: rows.length,
      unique_contacts: contactSignups.size,
      duplicate_signups: Array.from(contactSignups.values()).reduce((s, v) => s + v.count - 1, 0),
      leads_with_multi_signup: updated,
      events_created: eventsCreated,
    }),
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

    if (mode === "backfill") {
      return await handleBackfill(supabase, workspaceId, body);
    }

    if (mode === "recalculate_signups") {
      return await handleRecalculateSignups(supabase, workspaceId, body);
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
