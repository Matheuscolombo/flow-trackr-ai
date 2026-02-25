import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function parseCurrency(v: string): number {
  if (!v) return 0;
  return parseFloat(v.replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
}

/** Detecta separador automático: usa o que gera mais colunas na primeira linha */
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

// ─── Synonym dictionaries ────────────────────────────────────────────────────
// For each internal field, list all possible header names (lowercase, trimmed)

const SYNONYMS: Record<string, string[]> = {
  email: ["e-mail do cliente", "email do cliente", "e-mail do comprador", "email do comprador", "buyer_email", "customer_email", "cliente / e-mail", "e-mail", "email"],
  nome: ["nome do cliente", "nome do comprador", "buyer_name", "customer_name", "nome completo", "customer name", "buyer name", "cliente", "nome"],
  telefone: ["telefone completo do cliente", "telefone do cliente", "buyer_phone", "customer_phone", "cliente / fones", "telefone", "fone", "phone", "celular", "whatsapp", "fones"],
  gross_value: ["valor da venda", "valor do pedido", "gross_value", "amount", "valor bruto", "amount_paid", "valor do item", "valor"],
  net_value: ["ganho líquido", "ganho liquido", "valor líquido", "net_value", "net_amount", "valor liquidado", "valor liquido", "valor líquidado"],
  produto: ["nome do produto", "produto", "product", "product_name", "item", "product name", "título do produto", "titulo do produto", "título", "titulo"],
  paid_at: ["data de pagamento", "data de aprovação", "paid_at", "approved_date", "data da compra", "data aprovação", "data de aprovacao", "data pagamento", "data da transação", "data da transacao"],
  created_at: ["data de criação", "data de criacao", "created_at", "sale_created_at", "data do pedido", "data pedido", "data da venda"],
  status: ["status", "status da compra", "status da venda", "transaction_status", "situação", "situacao"],
  external_id: ["fatura", "número do pedido", "numero do pedido", "order_id", "transaction_id", "pedido", "id do pedido", "id", "ordem"],
  utm_source: ["utm source", "utm_source", "origem", "source", "utmsource"],
  utm_campaign: ["utm campaign", "utm_campaign", "campanha", "campaign", "utmcampaign"],
  utm_content: ["utm content", "utm_content", "conteúdo", "utmcontent"],
  utm_medium: ["utm medium", "utm_medium", "utmmedium"],
  utm_term: ["utm term", "utm_term", "utmterm"],
  src: ["src", "source_id"],
  sck: ["sck", "checkout_source"],
  ad_set_name: ["ad set name", "ad_set_name", "conjunto de anuncios", "adset", "conjunto"],
  campaign_name: ["campaign name", "campaign_name", "nome da campanha"],
  payment_method: ["método de pagamento", "metodo de pagamento", "payment_method", "tipo de pagamento", "forma de pagamento", "payment type"],
  installments: ["parcelas", "installments", "nº parcelas", "n parcelas", "numero de parcelas", "quantidade de parcelas"],
  affiliate: ["afiliado", "affiliate", "afiliado principal"],
  offer_name: ["oferta", "offer", "nome da oferta", "offer_name"],
  is_subscription: ["recorrência", "recorrencia", "assinatura", "subscription", "contrato"],
  is_bump: ["bump", "order bump"],
  card_brand: ["bandeira", "card_brand", "bandeira do cartão"],
  placement: ["channel", "canal", "placement"],
};

/** Find the header in the CSV row that matches a given field by synonyms.
 *  Priority: exact match > includes match. More specific synonyms are listed first. */
function findField(headers: string[], fieldKey: string): string | null {
  const synonyms = SYNONYMS[fieldKey] || [];
  // 1st pass: exact match
  for (const header of headers) {
    const h = header.toLowerCase().trim();
    if (synonyms.some((s) => h === s)) return header;
  }
  // 2nd pass: includes (but only if synonym length >= 5 to avoid false positives)
  for (const header of headers) {
    const h = header.toLowerCase().trim();
    if (synonyms.some((s) => s.length >= 5 && (h.includes(s) || s.includes(h)))) return header;
  }
  return null;
}

/** Detect platform from headers without blocking */
function detectPlatformFromHeaders(headers: string[]): string {
  const lh = headers.map((h) => h.toLowerCase());
  if (lh.some((h) => h.includes("fatura"))) return "eduzz";
  if (lh.some((h) => h.includes("número do pedido") || h.includes("numero do pedido"))) return "hotmart";
  if (lh.some((h) => h === "pedido") && lh.some((h) => h.includes("valor bruto"))) return "ticto";
  if (lh.some((h) => h === "transaction_id")) return "guru";
  if (lh.some((h) => h === "order_id") && lh.some((h) => h.includes("customer"))) return "kiwify";
  return "other";
}

/** Map raw status string to internal status */
function mapStatus(raw: string): "paid" | "refunded" | "pending" {
  const s = (raw || "").toLowerCase().trim();
  if (!s) return "paid"; // conservative: assume paid if empty
  const paid = ["pago", "paga", "paid", "approved", "complete", "completo", "aprovado", "aprovada", "autorizada", "autorizado", "authorized"];
  const refunded = ["reembolso", "refunded", "reembolsado", "estornado", "cancelled", "cancelado", "reembolsada", "chargeback"];
  const pending = ["pendente", "pending", "waiting_payment", "aguardando"];
  if (paid.some((p) => s.includes(p))) return "paid";
  if (refunded.some((r) => s.includes(r))) return "refunded";
  if (pending.some((p) => s.includes(p))) return "pending";
  return "paid"; // default: paid
}

/** Parse Brazilian or ISO date string to ISO format */
function parseDate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Try dd/mm/yyyy HH:MM or dd/mm/yyyy
  const parts = trimmed.split(" ");
  const dateParts = parts[0].split("/");
  if (dateParts.length === 3) {
    return `${dateParts[2]}-${dateParts[1].padStart(2, "0")}-${dateParts[0].padStart(2, "0")}T${parts[1] || "00:00:00"}`;
  }
  // Already ISO or close enough
  return trimmed || null;
}

/** Map payment method string to normalized value */
function mapPaymentMethod(raw: string): string {
  const s = (raw || "").toLowerCase();
  if (s.includes("pix")) return "Pix";
  if (s.includes("credit") || s.includes("crédito") || s.includes("credito")) return "Credito";
  if (s.includes("boleto")) return "Boleto";
  if (s.includes("débito") || s.includes("debito") || s.includes("debit")) return "Débito";
  return raw || "Pix";
}

/** Universal row parser using synonym-based field detection */
function parseUniversalRow(row: Record<string, string>, headers: string[], platform: string, idx: number, overrides?: Record<string, string> | null) {
  const get = (fieldKey: string): string => {
    // If user provided an override for this field, use it directly
    if (overrides && overrides[fieldKey]) {
      return row[overrides[fieldKey]] || "";
    }
    const header = findField(headers, fieldKey);
    return header ? (row[header] || "") : "";
  };

  const email = normEmail(get("email"));
  const phone = normPhone(get("telefone"));
  const rawStatus = get("status");
  const status = mapStatus(rawStatus);

  const rawPaidAt = get("paid_at");
  const rawCreatedAt = get("created_at") || rawPaidAt;

  // Generate external_id: prefer detected field, fallback to platform-idx
  const rawExternalId = get("external_id");
  const external_invoice_id = rawExternalId || `${platform}-${idx}`;

  // Subscription / bump detection
  const rawSubscription = get("is_subscription");
  const is_subscription = !!(rawSubscription && rawSubscription.trim() && rawSubscription.toLowerCase() !== "false" && rawSubscription !== "0");

  const rawBump = get("is_bump");
  const is_bump = rawBump ? rawBump.toLowerCase() === "sim" || rawBump.toLowerCase() === "yes" || rawBump === "1" : false;

  return {
    email,
    phone,
    buyer_name: get("nome") || "Comprador",
    platform,
    external_invoice_id,
    product_name: get("produto") || "Produto",
    offer_name: get("offer_name") || "",
    gross_value: parseCurrency(get("gross_value")),
    net_value: parseCurrency(get("net_value")) || parseCurrency(get("gross_value")),
    currency: "BRL",
    installments: parseInt(get("installments") || "1") || 1,
    payment_method: mapPaymentMethod(get("payment_method")),
    card_brand: get("card_brand") || null,
    status,
    is_subscription,
    is_bump,
    subscription_contract: is_subscription ? (get("is_subscription") || null) : null,
    sale_created_at: parseDate(rawCreatedAt),
    paid_at: parseDate(rawPaidAt),
    affiliate: get("affiliate") || null,
    utm_source: get("utm_source") || null,
    utm_campaign: get("utm_campaign") || null,
    utm_content: get("utm_content") || null,
    utm_medium: get("utm_medium") || null,
    utm_term: get("utm_term") || null,
    src: get("src") || null,
    sck: get("sck") || null,
    ad_name: get("ad_name") ? get("ad_name").split("|")[0].trim() : null,
    ad_set_name: get("ad_set_name") ? get("ad_set_name").split("|")[0].trim() : null,
    campaign_name: get("campaign_name") ? get("campaign_name").split("|")[0].trim() : null,
    placement: get("placement") || null,
  };
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!workspace) {
      return new Response(JSON.stringify({ error: "Workspace not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceId = workspace.id;

    const { csvText, fieldOverrides } = await req.json();
    if (!csvText || typeof csvText !== "string") {
      return new Response(JSON.stringify({ error: "csvText required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // fieldOverrides: Record<string, string> | undefined
    // When present, maps internal field keys to CSV header names directly
    const overrides: Record<string, string> | null = fieldOverrides && typeof fieldOverrides === "object" ? fieldOverrides : null;

    // ── Detect separator and parse ────────────────────────────────────────────
    const firstLine = csvText.split(/\r?\n/)[0]?.replace(/^\uFEFF/, "") || "";
    const sep = detectSeparator(firstLine);
    const rows = parseCSV(csvText, sep);

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "CSV vazio ou sem linhas válidas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Detect platform from headers (no blocking — just for metadata)
    const headers = firstLine.split(sep).map((h) => h.replace(/^"|"$/g, "").trim());
    const platform = detectPlatformFromHeaders(headers);

    console.log(`[import-sales] platform=${platform} sep=${sep === ";" ? "semicolon" : "comma"} rows=${rows.length} workspace=${workspaceId}`);

    // ── Build email/phone index from existing leads ───────────────────────────
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("id, email, phone")
      .eq("workspace_id", workspaceId);

    const emailIndex: Record<string, string> = {};
    const phoneIndex: Record<string, string> = {};
    (existingLeads || []).forEach((l) => {
      if (l.email) emailIndex[normEmail(l.email)] = l.id;
      if (l.phone) phoneIndex[normPhone(l.phone)] = l.id;
    });

    // ── Process rows ──────────────────────────────────────────────────────────
    const salesToInsert: Record<string, unknown>[] = [];
    // Ghost map: keyed by email or phone to avoid duplicates
    const ghostMap = new Map<string, Record<string, unknown>>();
    const leadsToEnrich = new Set<string>();

    let enriched = 0;
    let ghosts = 0;
    let ignored = 0;
    let noContact = 0; // lines without email/phone
    let duplicates = 0;
    let totalRevenue = 0;
    let insertedPaid = 0;
    let insertedRefunded = 0;
    let insertedPending = 0;

    const seenInvoices = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const parsed = parseUniversalRow(row, headers, platform, i, overrides);

      // Require at least email or phone to process
      if (!parsed.email && !parsed.phone) { noContact++; ignored++; continue; }

      // Dedup within batch
      const dedupeKey = `${platform}:${parsed.external_invoice_id}`;
      if (seenInvoices.has(dedupeKey)) { duplicates++; continue; }
      seenInvoices.add(dedupeKey);

      const emailKey = normEmail(parsed.email);
      const phoneKey = normPhone(parsed.phone);
      let leadId: string | null =
        (emailKey && emailIndex[emailKey]) ||
        (phoneKey && phoneIndex[phoneKey]) ||
        null;

      if (leadId) {
        enriched++;
        leadsToEnrich.add(leadId);
      } else {
        // Deduplicate ghosts: only create one ghost per unique email/phone
        const ghostKey = emailKey || phoneKey;
        if (!ghostMap.has(ghostKey)) {
          ghostMap.set(ghostKey, {
            workspace_id: workspaceId,
            email: parsed.email || null,
            phone: parsed.phone || null,
            name: parsed.buyer_name || "Comprador Externo",
            source: platform,
            country: "BR",
            is_ghost: true,
            imported_at: new Date().toISOString(),
            metadata: { imported: true, ghost: true, platform },
          });
          ghosts++;
        }
      }

      const saleRecord = {
        workspace_id: workspaceId,
        lead_id: leadId,
        platform: parsed.platform,
        external_invoice_id: parsed.external_invoice_id,
        product_name: parsed.product_name,
        offer_name: parsed.offer_name,
        gross_value: parsed.gross_value,
        net_value: parsed.net_value,
        currency: parsed.currency,
        installments: parsed.installments,
        payment_method: parsed.payment_method,
        card_brand: parsed.card_brand,
        status: parsed.status,
        is_subscription: parsed.is_subscription,
        is_bump: parsed.is_bump,
        subscription_contract: parsed.subscription_contract,
        sale_created_at: parsed.sale_created_at,
        paid_at: parsed.paid_at,
        affiliate: parsed.affiliate,
        utm_source: parsed.utm_source,
        utm_campaign: parsed.utm_campaign,
        utm_content: parsed.utm_content,
        utm_medium: parsed.utm_medium,
        utm_term: parsed.utm_term,
        src: parsed.src,
        sck: parsed.sck,
        ad_name: parsed.ad_name,
        ad_set_name: parsed.ad_set_name,
        campaign_name: parsed.campaign_name,
        placement: parsed.placement,
        buyer_email: parsed.email || null,
        buyer_phone: parsed.phone || null,
        buyer_name: parsed.buyer_name || null,
      };

      salesToInsert.push(saleRecord);
      if (parsed.status === "paid") totalRevenue += parsed.net_value;
      if (parsed.status === "paid") insertedPaid++;
      else if (parsed.status === "refunded") insertedRefunded++;
      else if (parsed.status === "pending") insertedPending++;
    }

    // ── Insert ghost leads first (deduplicated) ────────────────────────────────
    const ghostsToInsert = [...ghostMap.values()];
    if (ghostsToInsert.length > 0) {
      // Use service client to check for existing leads with same email before inserting
      const serviceClientForGhosts = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Check which ghost emails already exist in DB (from previous imports)
      const ghostEmails = ghostsToInsert.map((g) => g.email as string).filter(Boolean);
      const ghostPhones = ghostsToInsert.map((g) => g.phone as string).filter(Boolean);

      const { data: existingByEmail } = ghostEmails.length > 0
        ? await serviceClientForGhosts.from("leads").select("id, email, phone").eq("workspace_id", workspaceId).in("email", ghostEmails)
        : { data: [] };

      // Index existing leads found
      (existingByEmail || []).forEach((l) => {
        if (l.email) emailIndex[normEmail(l.email)] = l.id;
        if (l.phone) phoneIndex[normPhone(l.phone)] = l.id;
        leadsToEnrich.add(l.id);
      });

      // Filter out ghosts that already exist
      const trulyNewGhosts = ghostsToInsert.filter((g) => {
        const ek = normEmail((g.email as string) || "");
        if (ek && emailIndex[ek]) return false;
        const pk = normPhone((g.phone as string) || "");
        if (pk && phoneIndex[pk]) return false;
        return true;
      });

      // Adjust ghost count
      ghosts = trulyNewGhosts.length;
      enriched += (ghostsToInsert.length - trulyNewGhosts.length);

      const GHOST_CHUNK = 200;
      for (let i = 0; i < trulyNewGhosts.length; i += GHOST_CHUNK) {
        const chunk = trulyNewGhosts.slice(i, i + GHOST_CHUNK);
        const { data: createdGhosts } = await supabase
          .from("leads")
          .insert(chunk)
          .select("id, email, phone");

        (createdGhosts || []).forEach((g) => {
          if (g.email) emailIndex[normEmail(g.email)] = g.id;
          if (g.phone) phoneIndex[normPhone(g.phone)] = g.id;
          leadsToEnrich.add(g.id);
        });
      }
    }

    // ── Re-link sales with no lead_id (ghosts just created) ──────────────────
    salesToInsert.forEach((sale) => {
      if (!sale.lead_id) {
        const emailKey = normEmail((sale.buyer_email as string) || "");
        const phoneKey = normPhone((sale.buyer_phone as string) || "");
        sale.lead_id =
          (emailKey && emailIndex[emailKey]) ||
          (phoneKey && phoneIndex[phoneKey]) ||
          null;
        if (sale.lead_id) leadsToEnrich.add(sale.lead_id as string);
      }
    });

    // ── Insert sales ──────────────────────────────────────────────────────────
    let inserted = 0;
    const CHUNK = 500;
    for (let i = 0; i < salesToInsert.length; i += CHUNK) {
      const chunk = salesToInsert.slice(i, i + CHUNK);
      const { error: insertError, count } = await supabase
        .from("sale_events")
        .upsert(chunk, {
          onConflict: "workspace_id,platform,external_invoice_id",
          ignoreDuplicates: true,
        });

      if (insertError) {
        console.error("[import-sales] insert error:", insertError);
      } else {
        inserted += count || chunk.length;
      }
    }

    // ── Vincular leads ao funil "Base de Compradores" ─────────────────────────
    // Tenta pelo nome novo, depois pelo nome antigo (migração suave)
    let baseHistoricaFunnel: { id: string; funnel_stages: { id: string; name: string }[] } | null = null;

    const { data: newFunnel } = await supabase
      .from("funnels")
      .select("id, funnel_stages(id, name)")
      .eq("workspace_id", workspaceId)
      .eq("name", "Base de Compradores")
      .maybeSingle();

    if (newFunnel) {
      baseHistoricaFunnel = newFunnel as typeof baseHistoricaFunnel;
    } else {
      // Try old name
      const { data: oldFunnel } = await supabase
        .from("funnels")
        .select("id, funnel_stages(id, name)")
        .eq("workspace_id", workspaceId)
        .eq("name", "Importações Eduzz & Hotmart")
        .maybeSingle();
      if (oldFunnel) baseHistoricaFunnel = oldFunnel as typeof baseHistoricaFunnel;
    }

    if (baseHistoricaFunnel) {
      const stages = (baseHistoricaFunnel.funnel_stages || []) as { id: string; name: string }[];

      // Find "Compradores" stage (new), fallback to old stage names
      const stageCompradores =
        stages.find((s) => s.name === "Compradores") ||
        stages.find((s) => s.name === "Comprador Eduzz") ||
        stages[0];

      const stageMulti =
        stages.find((s) => s.name === "Multi-compradores") ||
        stages.find((s) => s.name === "Ambas Plataformas");

      if (stageCompradores) {
        const lfsRows: Record<string, unknown>[] = [];
        const processedLeads = new Set<string>();

        // Map lead → earliest paid_at from this batch
        const firstPurchase: Record<string, string | null> = {};
        for (const sale of salesToInsert) {
          if (sale.lead_id && typeof sale.lead_id === "string") {
            const paidAt = (sale.paid_at as string | null) || null;
            if (!firstPurchase[sale.lead_id] || (paidAt && paidAt < firstPurchase[sale.lead_id]!)) {
              firstPurchase[sale.lead_id as string] = paidAt;
            }
          }
        }

        // Collect all unique lead IDs from this import
        const allLeadIds = new Set<string>();
        for (const sale of salesToInsert) {
          if (sale.lead_id && typeof sale.lead_id === "string") {
            allLeadIds.add(sale.lead_id);
          }
        }

        // All go to "Compradores" — Multi-compradores is updated separately by recalc
        for (const leadId of allLeadIds) {
          if (processedLeads.has(leadId)) continue;
          processedLeads.add(leadId);
          lfsRows.push({
            lead_id: leadId,
            funnel_id: baseHistoricaFunnel.id,
            stage_id: stageCompradores.id,
            moved_by: "import",
            source: platform,
            entered_at: firstPurchase[leadId] || new Date().toISOString(),
          });
        }

        if (lfsRows.length > 0) {
          const LFS_CHUNK = 500;
          for (let i = 0; i < lfsRows.length; i += LFS_CHUNK) {
            const chunk = lfsRows.slice(i, i + LFS_CHUNK);
            const { error: lfsError } = await supabase
              .from("lead_funnel_stages")
              .upsert(chunk, { onConflict: "lead_id,funnel_id", ignoreDuplicates: true });
            if (lfsError) console.error("[import-sales] lfs upsert error:", lfsError);
          }

          // After linking, update multi-compradores: leads with purchase_count >= 2
          if (stageMulti) {
            const allLeadIdArr = [...allLeadIds];
            const { data: multiLeads } = await supabase
              .from("leads")
              .select("id, purchase_count")
              .in("id", allLeadIdArr)
              .gte("purchase_count", 2);

            if (multiLeads && multiLeads.length > 0) {
              const multiRows = multiLeads.map((l) => ({
                lead_id: l.id,
                funnel_id: baseHistoricaFunnel!.id,
                stage_id: stageMulti.id,
                moved_by: "import",
                source: "system",
                entered_at: new Date().toISOString(),
              }));
              await supabase
                .from("lead_funnel_stages")
                .upsert(multiRows, { onConflict: "lead_id,funnel_id" });
            }
          }

          console.log(`[import-sales] vinculou ${lfsRows.length} leads ao funil Base de Compradores`);
        }
      }
    } else {
      console.warn("[import-sales] funil 'Base de Compradores' não encontrado — leads não vinculados ao funil");
    }

    // ── Recalculate stats for all processed leads (batch UPDATE) ─────────────
    const allLeadsToRecalc = [...leadsToEnrich];
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (allLeadsToRecalc.length > 0) {
      // Single batch update instead of N individual RPC calls
      const RECALC_CHUNK = 1000;
      for (let i = 0; i < allLeadsToRecalc.length; i += RECALC_CHUNK) {
        const chunk = allLeadsToRecalc.slice(i, i + RECALC_CHUNK);
        await serviceClient.rpc("recalculate_leads_batch", { p_lead_ids: chunk });
      }

      // Ajustar created_at dos ghost leads para first_purchase_at (data real do primeiro evento)
      // Since we can't do column references in PostgREST, we do it per-lead
      const { data: ghostLeadsToFix } = await serviceClient
        .from("leads")
        .select("id, first_purchase_at")
        .eq("is_ghost", true)
        .in("id", allLeadsToRecalc)
        .not("first_purchase_at", "is", null);

      if (ghostLeadsToFix && ghostLeadsToFix.length > 0) {
        for (const gl of ghostLeadsToFix) {
          await serviceClient
            .from("leads")
            .update({ created_at: gl.first_purchase_at })
            .eq("id", gl.id);
        }
      }
    }

    // After recalc, update multi-compradores with updated purchase_count
    if (baseHistoricaFunnel && allLeadsToRecalc.length > 0) {
      const stages = (baseHistoricaFunnel.funnel_stages || []) as { id: string; name: string }[];
      const stageMulti = stages.find((s) => s.name === "Multi-compradores") || stages.find((s) => s.name === "Ambas Plataformas");

      if (stageMulti) {
        const { data: multiLeads } = await serviceClient
          .from("leads")
          .select("id, purchase_count")
          .in("id", allLeadsToRecalc)
          .gte("purchase_count", 2);

        if (multiLeads && multiLeads.length > 0) {
          const multiRows = multiLeads.map((l) => ({
            lead_id: l.id,
            funnel_id: baseHistoricaFunnel!.id,
            stage_id: stageMulti.id,
            moved_by: "import",
            source: "system",
            entered_at: new Date().toISOString(),
          }));
          await serviceClient
            .from("lead_funnel_stages")
            .upsert(multiRows, { onConflict: "lead_id,funnel_id" });
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        platform,
        sep,
        total_rows: rows.length,
        enriched,
        ghosts,
        ignored,
        no_contact: noContact,
        duplicates,
        inserted,
        inserted_paid: insertedPaid,
        inserted_refunded: insertedRefunded,
        inserted_pending: insertedPending,
        total_revenue: totalRevenue,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[import-sales] unexpected error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
