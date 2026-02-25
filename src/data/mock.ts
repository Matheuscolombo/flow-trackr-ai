import type {
  Funnel,
  Lead,
  LeadEvent,
  LeadFunnelPosition,
  SentinelAlert,
  FunnelMetrics,
  DashboardMetrics,
  LeadSource,
  Campaign,
  SaleEvent,
} from "@/types";

// ─── FUNNELS ──────────────────────────────────────────────────────────────────

export const mockFunnels: Funnel[] = [
  {
    id: "fnl-001",
    workspace_id: "ws-001",
    campaign_id: "cmp-001",
    name: "Captação Imóveis SP",
    description: "Funil principal de captação de leads imobiliários em São Paulo",
    webhook_token: "eyJhbGci-a1b2c3d4-e5f6g7h8-imov-sp",
    is_active: true,
    created_at: "2024-11-15T09:00:00Z",
    total_leads: 142,
    conversion_rate: 18.3,
    stages: [
      { id: "stg-001", funnel_id: "fnl-001", name: "Lead Novo", order_index: 0, color: "#3B82F6", created_at: "2024-11-15T09:00:00Z" },
      { id: "stg-002", funnel_id: "fnl-001", name: "Contato Feito", order_index: 1, color: "#8B5CF6", created_at: "2024-11-15T09:00:00Z" },
      { id: "stg-003", funnel_id: "fnl-001", name: "Visita Agendada", order_index: 2, color: "#F59E0B", created_at: "2024-11-15T09:00:00Z" },
      { id: "stg-004", funnel_id: "fnl-001", name: "Proposta Enviada", order_index: 3, color: "#EC4899", created_at: "2024-11-15T09:00:00Z" },
      { id: "stg-005", funnel_id: "fnl-001", name: "Fechado", order_index: 4, color: "#10B981", created_at: "2024-11-15T09:00:00Z" },
    ],
    rules: [
      { id: "rul-001", funnel_id: "fnl-001", event_name: "lead_created", from_stage_id: null, to_stage_id: "stg-001", priority: 1, created_at: "2024-11-15T09:00:00Z" },
      { id: "rul-002", funnel_id: "fnl-001", event_name: "first_contact", from_stage_id: "stg-001", to_stage_id: "stg-002", priority: 1, created_at: "2024-11-15T09:00:00Z" },
      { id: "rul-003", funnel_id: "fnl-001", event_name: "visit_scheduled", from_stage_id: "stg-002", to_stage_id: "stg-003", priority: 1, created_at: "2024-11-15T09:00:00Z" },
      { id: "rul-004", funnel_id: "fnl-001", event_name: "proposal_sent", from_stage_id: "stg-003", to_stage_id: "stg-004", priority: 1, created_at: "2024-11-15T09:00:00Z" },
      { id: "rul-005", funnel_id: "fnl-001", event_name: "deal_closed", from_stage_id: "stg-004", to_stage_id: "stg-005", priority: 1, created_at: "2024-11-15T09:00:00Z" },
    ],
  },
  {
    id: "fnl-002",
    workspace_id: "ws-001",
    campaign_id: "cmp-001",
    name: "SDR Outbound B2B",
    description: "Prospecção ativa de empresas via cold call e LinkedIn",
    webhook_token: "eyJhbGci-b2c3d4e5-f6g7h8i9-sdr-b2b",
    is_active: true,
    created_at: "2024-12-01T10:00:00Z",
    total_leads: 87,
    conversion_rate: 12.6,
    stages: [
      { id: "stg-006", funnel_id: "fnl-002", name: "Prospectado", order_index: 0, color: "#3B82F6", created_at: "2024-12-01T10:00:00Z" },
      { id: "stg-007", funnel_id: "fnl-002", name: "Qualificado", order_index: 1, color: "#8B5CF6", created_at: "2024-12-01T10:00:00Z" },
      { id: "stg-008", funnel_id: "fnl-002", name: "Demo Agendada", order_index: 2, color: "#F59E0B", created_at: "2024-12-01T10:00:00Z" },
      { id: "stg-009", funnel_id: "fnl-002", name: "Negociação", order_index: 3, color: "#EC4899", created_at: "2024-12-01T10:00:00Z" },
      { id: "stg-010", funnel_id: "fnl-002", name: "Cliente", order_index: 4, color: "#10B981", created_at: "2024-12-01T10:00:00Z" },
    ],
    rules: [
      { id: "rul-006", funnel_id: "fnl-002", event_name: "prospect_added", from_stage_id: null, to_stage_id: "stg-006", priority: 1, created_at: "2024-12-01T10:00:00Z" },
      { id: "rul-007", funnel_id: "fnl-002", event_name: "lead_qualified", from_stage_id: "stg-006", to_stage_id: "stg-007", priority: 1, created_at: "2024-12-01T10:00:00Z" },
      { id: "rul-008", funnel_id: "fnl-002", event_name: "demo_scheduled", from_stage_id: "stg-007", to_stage_id: "stg-008", priority: 1, created_at: "2024-12-01T10:00:00Z" },
    ],
  },
  {
    id: "fnl-003",
    workspace_id: "ws-001",
    campaign_id: "cmp-002",
    name: "Recuperação de Churn",
    description: "Reativação de clientes inativos há mais de 60 dias",
    webhook_token: "eyJhbGci-c3d4e5f6-g7h8i9j0-churn-rec",
    is_active: false,
    created_at: "2025-01-10T14:00:00Z",
    total_leads: 34,
    conversion_rate: 8.8,
    stages: [
      { id: "stg-011", funnel_id: "fnl-003", name: "Inativo Identificado", order_index: 0, color: "#6B7280", created_at: "2025-01-10T14:00:00Z" },
      { id: "stg-012", funnel_id: "fnl-003", name: "Contato Iniciado", order_index: 1, color: "#3B82F6", created_at: "2025-01-10T14:00:00Z" },
      { id: "stg-013", funnel_id: "fnl-003", name: "Proposta de Retorno", order_index: 2, color: "#F59E0B", created_at: "2025-01-10T14:00:00Z" },
      { id: "stg-014", funnel_id: "fnl-003", name: "Reativado", order_index: 3, color: "#10B981", created_at: "2025-01-10T14:00:00Z" },
    ],
    rules: [],
  },
];

// ─── ATTRIBUTION HELPERS ──────────────────────────────────────────────────────

const nullAttr = {
  utm_source: null, utm_medium: null, utm_campaign: null,
  utm_content: null, utm_term: null, referral_source: null,
  device: null as "Mobile" | "Desktop" | "Tablet" | null,
  city: null, region: null, country: null,
  page_url: null, form_id: null, converted_at: null,
};

const fbAttr = (content: string, city: string, region: string, device: "Mobile" | "Desktop" = "Mobile") => ({
  utm_source: "facebook", utm_medium: "cpc", utm_campaign: "desafio-protocolo-nov",
  utm_content: content, utm_term: null, referral_source: "https://l.facebook.com/",
  device, city, region, country: "BR",
  page_url: "https://cursosmatheuscolombo.com.br/odesafio",
  form_id: "908644_1", converted_at: null,
});

const igAttr = (content: string, city: string, region: string) => ({
  ...fbAttr(content, city, region), utm_source: "instagram",
});

const ggAttr = (content: string, city: string, region: string, term: string) => ({
  utm_source: "google", utm_medium: "cpc", utm_campaign: "desafio-protocolo-nov",
  utm_content: content, utm_term: term, referral_source: null,
  device: "Desktop" as const, city, region, country: "BR",
  page_url: "https://cursosmatheuscolombo.com.br/odesafio",
  form_id: "908644_2", converted_at: null,
});

// ─── LEAD FUNNEL POSITION BUILDER ────────────────────────────────────────────

let _posId = 1;
function pos(
  leadId: string,
  funnelId: string,
  funnelName: string,
  stageId: string,
  stageName: string,
  enteredAt: string,
  timeInStageHours: number,
  source: LeadSource = "n8n",
  movedBy: "webhook" | "manual" = "webhook",
  pageUrl: string | null = null,
  convertedAt: string | null = null,
): LeadFunnelPosition {
  return {
    id: `lfp-${String(_posId++).padStart(3, "0")}`,
    lead_id: leadId,
    funnel_id: funnelId,
    funnel_name: funnelName,
    current_stage_id: stageId,
    current_stage_name: stageName,
    entered_at: enteredAt,
    converted_at: convertedAt,
    page_url: pageUrl,
    time_in_stage_hours: timeInStageHours,
    source,
    moved_by: movedBy,
  };
}

// ─── LEAD BUILDER ─────────────────────────────────────────────────────────────

function mkLead(
  partial: Omit<Lead, "primary_funnel_id" | "primary_funnel_name" | "primary_stage_id" | "primary_stage_name" | "time_in_stage_hours" | "funnel_name" | "current_stage_name">
): Lead {
  const primary = partial.funnel_positions[partial.funnel_positions.length - 1];
  return {
    ...partial,
    primary_funnel_id: primary?.funnel_id ?? "",
    primary_funnel_name: primary?.funnel_name ?? "",
    primary_stage_id: primary?.current_stage_id ?? "",
    primary_stage_name: primary?.current_stage_name ?? "",
    time_in_stage_hours: primary?.time_in_stage_hours ?? 0,
    // aliases para compatibilidade legada com drawer/kanban
    funnel_name: primary?.funnel_name ?? "",
    current_stage_name: primary?.current_stage_name ?? "",
  };
}

// ─── LEADS ────────────────────────────────────────────────────────────────────
//
// Arquitetura: cada Lead é uma PESSOA única, identificada por telefone.
// Suas posições em cada funil ficam em funnel_positions[].
//
// Exemplo de cenário multi-funil (Fátima):
//   Lead ld-001 → positions em fnl-base + fnl-fria + fnl-grupo
//   Ela aparece UMA VEZ na tabela de leads, com 3 badges de funis.

export const mockLeads: Lead[] = [
  // ── ld-001: Ana Beatriz — apenas fnl-001 ──────────────────────────────────
  mkLead({
    id: "ld-001", workspace_id: "ws-001",
    phone: "+5511999990001", name: "Ana Beatriz Costa", email: "ana.costa@email.com",
    attribution: { ...ggAttr("video-dor-v3", "São Paulo", "São Paulo", "protocolo saude"), converted_at: "2025-02-18T08:00:00Z" },
    metadata: {}, created_at: "2025-02-18T08:00:00Z",
    source: "n8n",
    funnel_positions: [
      pos("ld-001", "fnl-001", "Captação Imóveis SP", "stg-001", "Lead Novo", "2025-02-18T08:00:00Z", 2, "n8n"),
    ],
  }),

  // ── ld-002: Carlos Eduardo — fnl-001 + fnl-002 (multi-funil) ─────────────
  mkLead({
    id: "ld-002", workspace_id: "ws-001",
    phone: "+5511999990002", name: "Carlos Eduardo Melo", email: "carlos.melo@email.com",
    attribution: { ...fbAttr("carrossel-beneficios-v1", "Campinas", "São Paulo"), converted_at: "2025-02-17T10:30:00Z" },
    metadata: {}, created_at: "2025-02-17T10:30:00Z",
    source: "zapier",
    funnel_positions: [
      pos("ld-002", "fnl-001", "Captação Imóveis SP", "stg-002", "Contato Feito", "2025-02-17T10:30:00Z", 18, "zapier"),
      pos("ld-002", "fnl-002", "SDR Outbound B2B",   "stg-007", "Qualificado",   "2025-02-18T08:00:00Z", 5,  "n8n"),
    ],
  }),

  // ── ld-003: Fernanda — fnl-001 ───────────────────────────────────────────
  mkLead({
    id: "ld-003", workspace_id: "ws-001",
    phone: "+5511999990003", name: "Fernanda Oliveira", email: "fernanda.o@email.com",
    attribution: { ...igAttr("imagem-estatica-v2", "Belo Horizonte", "Minas Gerais"), converted_at: "2025-02-16T14:00:00Z" },
    metadata: {}, created_at: "2025-02-16T14:00:00Z",
    source: "n8n",
    funnel_positions: [
      pos("ld-003", "fnl-001", "Captação Imóveis SP", "stg-003", "Visita Agendada", "2025-02-16T14:00:00Z", 48, "n8n"),
    ],
  }),

  // ── ld-004: Roberto — fnl-001 ─────────────────────────────────────────────
  mkLead({
    id: "ld-004", workspace_id: "ws-001",
    phone: "+5511999990004", name: "Roberto Silva Jr.", email: "roberto.silva@empresa.com",
    attribution: { ...fbAttr("video-dor-v3", "São Paulo", "São Paulo", "Desktop"), converted_at: "2025-02-15T09:15:00Z" },
    metadata: {}, created_at: "2025-02-15T09:15:00Z",
    source: "api",
    funnel_positions: [
      pos("ld-004", "fnl-001", "Captação Imóveis SP", "stg-004", "Proposta Enviada", "2025-02-15T09:15:00Z", 72, "api"),
    ],
  }),

  // ── ld-005: Mariana — fnl-001 ─────────────────────────────────────────────
  mkLead({
    id: "ld-005", workspace_id: "ws-001",
    phone: "+5511999990005", name: "Mariana Ferreira", email: "mariana.f@email.com",
    attribution: { ...nullAttr, device: "Mobile", city: "Curitiba", region: "Paraná", country: "BR", converted_at: "2025-02-10T11:00:00Z" },
    metadata: {}, created_at: "2025-02-10T11:00:00Z",
    source: "n8n",
    funnel_positions: [
      pos("ld-005", "fnl-001", "Captação Imóveis SP", "stg-005", "Fechado", "2025-02-10T11:00:00Z", 240, "n8n"),
    ],
  }),

  // ── ld-006: Pedro — fnl-001 ───────────────────────────────────────────────
  mkLead({
    id: "ld-006", workspace_id: "ws-001",
    phone: "+5511999990006", name: "Pedro Henrique Souza", email: "pedro.souza@email.com",
    attribution: { ...fbAttr("carrossel-beneficios-v1", "Arcos", "Minas Gerais"), converted_at: "2025-02-18T07:45:00Z" },
    metadata: {}, created_at: "2025-02-18T07:45:00Z",
    source: "typebot",
    funnel_positions: [
      pos("ld-006", "fnl-001", "Captação Imóveis SP", "stg-001", "Lead Novo", "2025-02-18T07:45:00Z", 3, "typebot"),
    ],
  }),

  // ── ld-007: Juliana — fnl-001 + fnl-003 ──────────────────────────────────
  mkLead({
    id: "ld-007", workspace_id: "ws-001",
    phone: "+5511999990007", name: "Juliana Mendes", email: "juliana.m@email.com",
    attribution: { ...igAttr("video-dor-v3", "São Paulo", "São Paulo"), converted_at: "2025-02-17T16:20:00Z" },
    metadata: {}, created_at: "2025-02-17T16:20:00Z",
    source: "zapier",
    funnel_positions: [
      pos("ld-007", "fnl-001", "Captação Imóveis SP", "stg-002", "Contato Feito", "2025-02-17T16:20:00Z", 12, "zapier"),
      pos("ld-007", "fnl-003", "Recuperação de Churn", "stg-012", "Contato Iniciado", "2025-02-18T10:00:00Z", 4, "n8n"),
    ],
  }),

  // ── ld-008: Thiago — fnl-001 ──────────────────────────────────────────────
  mkLead({
    id: "ld-008", workspace_id: "ws-001",
    phone: "+5511999990008", name: "Thiago Almeida", email: "thiago.a@email.com",
    attribution: { ...ggAttr("imagem-estatica-v2", "Campinas", "São Paulo", "saude natural"), converted_at: "2025-02-16T08:30:00Z" },
    metadata: {}, created_at: "2025-02-16T08:30:00Z",
    source: "n8n",
    funnel_positions: [
      pos("ld-008", "fnl-001", "Captação Imóveis SP", "stg-003", "Visita Agendada", "2025-02-16T08:30:00Z", 36, "n8n"),
    ],
  }),

  // ── ld-009: Luciana — fnl-002 ─────────────────────────────────────────────
  mkLead({
    id: "ld-009", workspace_id: "ws-001",
    phone: "+5511999990009", name: "Luciana Barbosa", email: "luciana.b@techcorp.com",
    attribution: { ...fbAttr("video-dor-v3", "São Paulo", "São Paulo"), converted_at: "2025-02-18T09:00:00Z" },
    metadata: { company: "TechCorp" }, created_at: "2025-02-18T09:00:00Z",
    source: "api",
    funnel_positions: [
      pos("ld-009", "fnl-002", "SDR Outbound B2B", "stg-006", "Prospectado", "2025-02-18T09:00:00Z", 1, "api"),
    ],
  }),

  // ── ld-010: Alexandre — fnl-002 ───────────────────────────────────────────
  mkLead({
    id: "ld-010", workspace_id: "ws-001",
    phone: "+5511999990010", name: "Alexandre Nunes", email: "alex.nunes@startup.io",
    attribution: { ...igAttr("carrossel-beneficios-v1", "Belo Horizonte", "Minas Gerais"), converted_at: "2025-02-17T14:00:00Z" },
    metadata: { company: "StartupIO" }, created_at: "2025-02-17T14:00:00Z",
    source: "manual",
    funnel_positions: [
      pos("ld-010", "fnl-002", "SDR Outbound B2B", "stg-007", "Qualificado", "2025-02-17T14:00:00Z", 20, "manual", "manual"),
    ],
  }),

  // ── ld-011: Patricia — fnl-002 ────────────────────────────────────────────
  mkLead({
    id: "ld-011", workspace_id: "ws-001",
    phone: "+5511999990011", name: "Patricia Lima", email: "p.lima@bigcorp.com",
    attribution: { ...fbAttr("video-dor-v3", "Curitiba", "Paraná", "Desktop"), converted_at: "2025-02-15T11:00:00Z" },
    metadata: { company: "BigCorp" }, created_at: "2025-02-15T11:00:00Z",
    source: "webhook",
    funnel_positions: [
      pos("ld-011", "fnl-002", "SDR Outbound B2B", "stg-008", "Demo Agendada", "2025-02-15T11:00:00Z", 60, "webhook"),
    ],
  }),

  // ── ld-012: Marcos — fnl-002 ──────────────────────────────────────────────
  mkLead({
    id: "ld-012", workspace_id: "ws-001",
    phone: "+5511999990012", name: "Marcos Vinícius", email: "mv@empresa.com.br",
    attribution: { ...nullAttr, device: "Mobile", city: "São Paulo", region: "São Paulo", country: "BR", converted_at: "2025-02-14T10:00:00Z" },
    metadata: {}, created_at: "2025-02-14T10:00:00Z",
    source: "api",
    funnel_positions: [
      pos("ld-012", "fnl-002", "SDR Outbound B2B", "stg-009", "Negociação", "2025-02-14T10:00:00Z", 96, "api"),
    ],
  }),

  // ── ld-013: Camila — fnl-002 ──────────────────────────────────────────────
  mkLead({
    id: "ld-013", workspace_id: "ws-001",
    phone: "+5511999990013", name: "Camila Rodrigues", email: "camila.r@corp.com",
    attribution: { ...ggAttr("imagem-estatica-v2", "Campinas", "São Paulo", "protocolo antidoencas"), converted_at: "2025-02-01T09:00:00Z" },
    metadata: {}, created_at: "2025-02-01T09:00:00Z",
    source: "n8n",
    funnel_positions: [
      pos("ld-013", "fnl-002", "SDR Outbound B2B", "stg-010", "Cliente", "2025-02-01T09:00:00Z", 408, "n8n"),
    ],
  }),

  // ── ld-014: Rafael — fnl-002 ──────────────────────────────────────────────
  mkLead({
    id: "ld-014", workspace_id: "ws-001",
    phone: "+5511999990014", name: "Rafael Torres", email: "rafael.t@email.com",
    attribution: { ...igAttr("carrossel-beneficios-v1", "São Paulo", "São Paulo"), converted_at: "2025-02-18T06:30:00Z" },
    metadata: {}, created_at: "2025-02-18T06:30:00Z",
    source: "zapier",
    funnel_positions: [
      pos("ld-014", "fnl-002", "SDR Outbound B2B", "stg-006", "Prospectado", "2025-02-18T06:30:00Z", 5, "zapier"),
    ],
  }),

  // ── ld-015: Isabela — fnl-002 ─────────────────────────────────────────────
  mkLead({
    id: "ld-015", workspace_id: "ws-001",
    phone: "+5511999990015", name: "Isabela Campos", email: "isa.campos@email.com",
    attribution: { ...fbAttr("carrossel-beneficios-v1", "Belo Horizonte", "Minas Gerais"), converted_at: "2025-02-17T13:00:00Z" },
    metadata: {}, created_at: "2025-02-17T13:00:00Z",
    source: "api",
    funnel_positions: [
      pos("ld-015", "fnl-002", "SDR Outbound B2B", "stg-006", "Prospectado", "2025-02-17T13:00:00Z", 22, "api"),
    ],
  }),

  // ── ld-016: Fátima — EXEMPLO MULTI-FUNIL REAL (3 funis) ─────────────────
  // Jornada completa: base → cadastro página fria → confirmou grupo → lives → checkout → pagou
  // Aparece UMA VEZ na tabela de leads, com 3 badges e 🔥 Alta atividade.
  mkLead({
    id: "ld-016", workspace_id: "ws-001",
    phone: "+5535988752203", name: "Fátima Figueiredo", email: "cfatimacfigueiredo@gmail.com",
    attribution: {
      utm_source: "facebook", utm_medium: "cpc", utm_campaign: "desafio-protocolo-nov",
      utm_content: "video-dor-v3", utm_term: null,
      referral_source: "https://l.facebook.com/",
      device: "Mobile", city: "Arcos", region: "Minas Gerais", country: "BR",
      page_url: "https://www.cursosmatheuscolombo.com.br/odesafio",
      form_id: "908644_1_177093874043610537",
      converted_at: "2026-02-17T14:00:00Z",
    },
    metadata: {}, created_at: "2026-02-15T09:00:00Z",
    source: "webhook",
    funnel_positions: [
      pos("ld-016", "fnl-001", "Captação Imóveis SP",  "stg-001", "Lead Novo",        "2026-02-15T09:00:00Z", 120, "manual",  "manual",  null, null),
      pos("ld-016", "fnl-002", "SDR Outbound B2B",     "stg-007", "Qualificado",       "2026-02-17T14:00:00Z",  72, "webhook", "webhook", "https://cursosmatheuscolombo.com.br/odesafio",  "2026-02-17T14:00:00Z"),
      pos("ld-016", "fnl-003", "Recuperação de Churn", "stg-012", "Contato Iniciado",  "2026-02-20T15:25:00Z",   1, "webhook", "webhook", "https://cursosmatheuscolombo.com.br/grupo",     "2026-02-20T15:25:44Z"),
    ],
  }),
];

// ─── EVENTS ───────────────────────────────────────────────────────────────────

export const mockEvents: LeadEvent[] = [
  {
    id: "evt-001", funnel_id: "fnl-001", lead_id: "ld-003",
    event_name: "lead_created", source: "n8n",
    timestamp_event: "2025-02-16T14:00:00Z",
    payload_raw: { phone: "+5511999990003", name: "Fernanda Oliveira", utm_source: "instagram", utm_campaign: "imoveis-sp-mar" },
    idempotency_key: "n8n-ld003-001", created_at: "2025-02-16T14:00:05Z",
  },
  {
    id: "evt-002", funnel_id: "fnl-001", lead_id: "ld-003",
    event_name: "first_contact", source: "n8n",
    timestamp_event: "2025-02-16T16:30:00Z",
    payload_raw: { channel: "whatsapp", agent: "João Silva", response_time_min: 25 },
    idempotency_key: "n8n-ld003-002", created_at: "2025-02-16T16:30:10Z",
  },
  {
    id: "evt-003", funnel_id: "fnl-001", lead_id: "ld-003",
    event_name: "visit_scheduled", source: "zapier",
    timestamp_event: "2025-02-17T09:00:00Z",
    payload_raw: { date: "2025-02-20", time: "14:00", property_id: "prop-00482", address: "Av. Paulista, 1500" },
    idempotency_key: "zap-ld003-003", created_at: "2025-02-17T09:00:05Z",
  },
  {
    id: "evt-004", funnel_id: "fnl-001", lead_id: "ld-004",
    event_name: "lead_created", source: "api",
    timestamp_event: "2025-02-15T09:15:00Z",
    payload_raw: { phone: "+5511999990004", name: "Roberto Silva Jr.", origin: "portais_imoveis" },
    idempotency_key: "api-ld004-001", created_at: "2025-02-15T09:15:03Z",
  },
  {
    id: "evt-005", funnel_id: "fnl-001", lead_id: "ld-004",
    event_name: "first_contact", source: "n8n",
    timestamp_event: "2025-02-15T11:00:00Z",
    payload_raw: { channel: "phone", duration_min: 8 },
    idempotency_key: "n8n-ld004-002", created_at: "2025-02-15T11:00:08Z",
  },
  {
    id: "evt-006", funnel_id: "fnl-001", lead_id: "ld-004",
    event_name: "visit_scheduled", source: "zapier",
    timestamp_event: "2025-02-16T10:00:00Z",
    payload_raw: { date: "2025-02-18", time: "10:00", property_id: "prop-00109" },
    idempotency_key: "zap-ld004-003", created_at: "2025-02-16T10:00:02Z",
  },
  {
    id: "evt-007", funnel_id: "fnl-001", lead_id: "ld-004",
    event_name: "proposal_sent", source: "n8n",
    timestamp_event: "2025-02-18T15:00:00Z",
    payload_raw: { proposal_id: "prop-doc-0042", value: 850000, financing: true },
    idempotency_key: "n8n-ld004-004", created_at: "2025-02-18T15:00:06Z",
  },
  // ── Fátima (ld-016) — jornada completa do desafio ────────────────────────
  {
    id: "evt-008", funnel_id: "fnl-001", lead_id: "ld-016",
    event_name: "base_importado", source: "manual",
    timestamp_event: "2026-02-15T09:00:00Z",
    payload_raw: { origem: "base_fevereiro_2026", total_base: 10000, etapa_inicial: "Lead Novo" },
    idempotency_key: "manual-ld016-001", created_at: "2026-02-15T09:00:02Z",
  },
  {
    id: "evt-009", funnel_id: "fnl-002", lead_id: "ld-016",
    event_name: "pagina_cadastro", source: "webhook",
    timestamp_event: "2026-02-17T14:00:00Z",
    payload_raw: {
      page_url: "https://cursosmatheuscolombo.com.br/odesafio",
      utm_source: "facebook", utm_content: "video-dor-v3",
      Dispositivo: "Mobile", Cidade_do_usuario: "Arcos",
      Referral_Source: "https://l.facebook.com/",
      Id_do_formulario: "908644_1_177093874043610537",
      Data_da_conversao: "2026-02-17 14:00:00",
    },
    idempotency_key: "wh-ld016-002", created_at: "2026-02-17T14:00:03Z",
  },
  {
    id: "evt-010", funnel_id: "fnl-003", lead_id: "ld-016",
    event_name: "grupo_confirmado", source: "webhook",
    timestamp_event: "2026-02-20T15:25:44Z",
    payload_raw: { group_id: "grp-desafio-fev26", group_name: "Desafio Protocolo Fev/26", confirmed_by: "click_link" },
    idempotency_key: "wh-ld016-003", created_at: "2026-02-20T15:25:46Z",
  },
  {
    id: "evt-011", funnel_id: "fnl-002", lead_id: "ld-016",
    event_name: "mensagem_api_enviada", source: "api",
    timestamp_event: "2026-02-21T08:00:00Z",
    payload_raw: { canal: "whatsapp", template: "lembrete_live_1", status: "entregue" },
    idempotency_key: "api-ld016-004", created_at: "2026-02-21T08:00:02Z",
  },
  {
    id: "evt-012", funnel_id: "fnl-002", lead_id: "ld-016",
    event_name: "live_assistida", source: "n8n",
    timestamp_event: "2026-02-22T20:00:00Z",
    payload_raw: { live: 1, titulo: "Protocolo Antiinflamatório — Aula 1", watch_time_min: 52, plataforma: "youtube", assitiu_ate_fim: true },
    idempotency_key: "n8n-ld016-005", created_at: "2026-02-22T20:00:10Z",
  },
  {
    id: "evt-013", funnel_id: "fnl-002", lead_id: "ld-016",
    event_name: "live_assistida", source: "n8n",
    timestamp_event: "2026-02-24T20:00:00Z",
    payload_raw: { live: 2, titulo: "Jejum e Metabolismo — Aula 2", watch_time_min: 67, plataforma: "youtube", assitiu_ate_fim: true },
    idempotency_key: "n8n-ld016-006", created_at: "2026-02-24T20:00:08Z",
  },
  {
    id: "evt-014", funnel_id: "fnl-002", lead_id: "ld-016",
    event_name: "live_assistida", source: "n8n",
    timestamp_event: "2026-02-26T20:00:00Z",
    payload_raw: { live: 3, titulo: "Suplementação Inteligente — Aula 3 + Abertura de Vendas", watch_time_min: 89, plataforma: "youtube", assitiu_ate_fim: true },
    idempotency_key: "n8n-ld016-007", created_at: "2026-02-26T20:00:11Z",
  },
  {
    id: "evt-015", funnel_id: "fnl-002", lead_id: "ld-016",
    event_name: "checkout_acessado", source: "webhook",
    timestamp_event: "2026-02-26T21:14:00Z",
    payload_raw: { produto: "protocolo-saude-premium", valor: 297, moeda: "BRL", checkout_id: "chk-00821" },
    idempotency_key: "wh-ld016-008", created_at: "2026-02-26T21:14:02Z",
  },
  {
    id: "evt-016", funnel_id: "fnl-002", lead_id: "ld-016",
    event_name: "pix_gerado", source: "webhook",
    timestamp_event: "2026-02-26T21:16:33Z",
    payload_raw: { txid: "E0000000020260226211633abc1", valor: 297, expiracao_min: 30, checkout_id: "chk-00821" },
    idempotency_key: "wh-ld016-009", created_at: "2026-02-26T21:16:35Z",
  },
  {
    id: "evt-017", funnel_id: "fnl-002", lead_id: "ld-016",
    event_name: "pagamento_confirmado", source: "webhook",
    timestamp_event: "2026-02-26T21:22:10Z",
    payload_raw: { metodo: "pix", valor: 297, order_id: "ord-00821", produto: "protocolo-saude-premium", status: "aprovado" },
    idempotency_key: "wh-ld016-010", created_at: "2026-02-26T21:22:12Z",
  },
  {
    id: "evt-018", funnel_id: "fnl-002", lead_id: "ld-016",
    event_name: "upsell_pix_gerado", source: "webhook",
    timestamp_event: "2026-02-26T21:22:45Z",
    payload_raw: { txid: "E0000000020260226212245abc2", valor: 997, produto: "mentoria-vip-anual", expiracao_min: 15, checkout_id: "chk-00822" },
    idempotency_key: "wh-ld016-011", created_at: "2026-02-26T21:22:47Z",
  },
];

// ─── ALERTS ───────────────────────────────────────────────────────────────────

export const mockAlerts: SentinelAlert[] = [
  {
    id: "alt-001", workspace_id: "ws-001", funnel_id: "fnl-001", funnel_name: "Captação Imóveis SP",
    stage_id: "stg-003", stage_name: "Visita Agendada",
    alert_type: "conversion_drop", level: "critical",
    title: "Queda crítica na conversão de Visita → Proposta",
    description: "Taxa de conversão caiu 41% em relação à média dos últimos 7 dias nesta etapa.",
    threshold_value: 35, actual_value: 12.4,
    is_read: false, created_at: "2025-02-20T07:30:00Z",
  },
  {
    id: "alt-002", workspace_id: "ws-001", funnel_id: "fnl-001", funnel_name: "Captação Imóveis SP",
    stage_id: null, stage_name: null,
    alert_type: "volume_drop", level: "warning",
    title: "Volume de novos leads abaixo da média",
    description: "Apenas 4 leads novos hoje. Média esperada: 12 leads/dia.",
    threshold_value: 12, actual_value: 4,
    is_read: false, created_at: "2025-02-20T06:00:00Z",
  },
  {
    id: "alt-003", workspace_id: "ws-001", funnel_id: "fnl-002", funnel_name: "SDR Outbound B2B",
    stage_id: "stg-009", stage_name: "Negociação",
    alert_type: "time_exceeded", level: "warning",
    title: "Leads parados em Negociação há mais de 5 dias",
    description: "3 leads estão na etapa de Negociação há mais de 5 dias sem movimentação.",
    threshold_value: 120, actual_value: 216,
    is_read: true, created_at: "2025-02-19T14:00:00Z",
  },
  {
    id: "alt-004", workspace_id: "ws-001", funnel_id: "fnl-001", funnel_name: "Captação Imóveis SP",
    stage_id: "stg-001", stage_name: "Lead Novo",
    alert_type: "spike", level: "info",
    title: "Pico de entradas em Lead Novo",
    description: "Volume 2.3x acima da média. Possível campanha ativa ou bot.",
    threshold_value: 15, actual_value: 34,
    is_read: false, created_at: "2025-02-18T20:00:00Z",
  },
  {
    id: "alt-005", workspace_id: "ws-001", funnel_id: "fnl-002", funnel_name: "SDR Outbound B2B",
    stage_id: "stg-006", stage_name: "Prospectado",
    alert_type: "stale", level: "info",
    title: "Leads inativos em Prospectado",
    description: "7 leads não tiveram nenhum evento nos últimos 3 dias.",
    threshold_value: 72, actual_value: 96,
    is_read: true, created_at: "2025-02-17T08:00:00Z",
  },
];

// ─── FUNNEL METRICS ───────────────────────────────────────────────────────────

export const mockFunnelMetrics: FunnelMetrics[] = [
  { id: "met-001", funnel_id: "fnl-001", stage_id: "stg-001", stage_name: "Lead Novo", date: "2025-02-20", total_leads: 62, entries: 8, exits: 14, conversions: 14, avg_time_seconds: 7200, updated_at: "2025-02-20T08:00:00Z" },
  { id: "met-002", funnel_id: "fnl-001", stage_id: "stg-002", stage_name: "Contato Feito", date: "2025-02-20", total_leads: 41, entries: 14, exits: 9, conversions: 9, avg_time_seconds: 86400, updated_at: "2025-02-20T08:00:00Z" },
  { id: "met-003", funnel_id: "fnl-001", stage_id: "stg-003", stage_name: "Visita Agendada", date: "2025-02-20", total_leads: 22, entries: 9, exits: 4, conversions: 4, avg_time_seconds: 172800, updated_at: "2025-02-20T08:00:00Z" },
  { id: "met-004", funnel_id: "fnl-001", stage_id: "stg-004", stage_name: "Proposta Enviada", date: "2025-02-20", total_leads: 11, entries: 4, exits: 3, conversions: 3, avg_time_seconds: 259200, updated_at: "2025-02-20T08:00:00Z" },
  { id: "met-005", funnel_id: "fnl-001", stage_id: "stg-005", stage_name: "Fechado", date: "2025-02-20", total_leads: 6, entries: 3, exits: 0, conversions: 3, avg_time_seconds: 0, updated_at: "2025-02-20T08:00:00Z" },
];

// ─── DASHBOARD METRICS ────────────────────────────────────────────────────────

export const mockDashboardMetrics: DashboardMetrics = {
  total_active_leads: 263,
  overall_conversion_rate: 15.8,
  events_today: 47,
  new_leads_today: 12,
  total_active_leads_delta: 8.2,
  conversion_rate_delta: -2.1,
  events_today_delta: 14.3,
  new_leads_today_delta: -33.3,
};

// ─── CAMPAIGNS ────────────────────────────────────────────────────────────────

export const mockCampaigns: Campaign[] = [
  {
    id: "cmp-001",
    workspace_id: "ws-001",
    name: "Desafio Protocolo Antidoenças",
    description: "Lançamento do desafio de saúde com múltiplas páginas de captação",
    is_active: true,
    created_at: "2024-11-01T09:00:00Z",
    funnels: [],
    total_leads: 229,
    overall_conversion: 15.9,
  },
  {
    id: "cmp-002",
    workspace_id: "ws-001",
    name: "Reativação Base",
    description: "Campanha de reativação de clientes inativos há mais de 60 dias",
    is_active: false,
    created_at: "2025-01-05T10:00:00Z",
    funnels: [],
    total_leads: 34,
    overall_conversion: 8.8,
  },
];

mockCampaigns[0].funnels = mockFunnels.filter((f) => f.campaign_id === "cmp-001");
mockCampaigns[1].funnels = mockFunnels.filter((f) => f.campaign_id === "cmp-002");

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Retorna leads agrupados por etapa para um funil específico.
 * Usa funnel_positions[] — cada lead pode aparecer em múltiplos funis,
 * mas no kanban só mostramos a posição daquele funil específico.
 */
export function getLeadsByStage(funnelId: string) {
  const funnel = mockFunnels.find((f) => f.id === funnelId);
  if (!funnel) return {};

  const byStage: Record<string, Lead[]> = {};
  funnel.stages.forEach((s) => { byStage[s.id] = []; });

  mockLeads.forEach((lead) => {
    const pos = lead.funnel_positions.find((p) => p.funnel_id === funnelId);
    if (pos) {
      if (!byStage[pos.current_stage_id]) byStage[pos.current_stage_id] = [];
      byStage[pos.current_stage_id].push(lead);
    }
  });

  return byStage;
}

/**
 * Retorna os eventos de um lead, ordenados por timestamp.
 */
export function getLeadEvents(leadId: string): LeadEvent[] {
  return mockEvents.filter((e) => e.lead_id === leadId).sort(
    (a, b) => new Date(a.timestamp_event).getTime() - new Date(b.timestamp_event).getTime()
  );
}

export function getConversionRate(from: number, to: number): number {
  if (from === 0) return 0;
  return Math.round((to / from) * 100 * 10) / 10;
}

// ─── MOCK SALES (Eduzz + Hotmart) ─────────────────────────────────────────────

export const mockSales: SaleEvent[] = [
  // ── EDUZZ: Fátima (ld-016) — 3 compras ao longo do tempo ─────────────────
  {
    id: "sale-001", lead_id: "ld-016", platform: "eduzz",
    external_invoice_id: "edz-000001",
    product_name: "Manual das Ervas para Dores", offer_name: "Oferta Base",
    gross_value: 19.90, net_value: 14.50, currency: "BRL",
    installments: 1, payment_method: "Pix", card_brand: null,
    status: "paid", is_subscription: false, is_bump: false, subscription_contract: null,
    created_at: "2024-11-10T09:00:00Z", sale_created_at: null, paid_at: "2024-11-10T09:05:22Z",
    affiliate: null,
    utm_source: "instagram", utm_campaign: "black-novembro-24", utm_content: "link_in_bio",
    ad_name: null, ad_set_name: null, campaign_name: null, placement: null,
  },
  {
    id: "sale-002", lead_id: "ld-016", platform: "eduzz",
    external_invoice_id: "edz-000842",
    product_name: "Curso Mestre das Tinturas", offer_name: "Oferta Base",
    gross_value: 197.00, net_value: 163.00, currency: "BRL",
    installments: 1, payment_method: "Credito", card_brand: "Visa",
    status: "paid", is_subscription: false, is_bump: false, subscription_contract: null,
    created_at: "2025-04-01T14:00:00Z", sale_created_at: null, paid_at: "2025-04-01T14:02:11Z",
    affiliate: null,
    utm_source: "facebook", utm_campaign: "camp29-tinturas", utm_content: "ad2ouro",
    ad_name: null, ad_set_name: null, campaign_name: null, placement: null,
  },
  {
    id: "sale-003", lead_id: "ld-016", platform: "eduzz",
    external_invoice_id: "edz-001200",
    product_name: "Revistas do Erveiro", offer_name: "Assinatura Mensal",
    gross_value: 29.90, net_value: 24.50, currency: "BRL",
    installments: 1, payment_method: "Credito", card_brand: "Mastercard",
    status: "paid", is_subscription: true, is_bump: false, subscription_contract: "ctr-0422",
    created_at: "2025-08-04T10:00:00Z", sale_created_at: null, paid_at: "2025-08-04T10:00:00Z",
    affiliate: null,
    utm_source: "organic", utm_campaign: null, utm_content: null,
    ad_name: null, ad_set_name: null, campaign_name: null, placement: null,
  },
  {
    id: "sale-004", lead_id: "ld-016", platform: "eduzz",
    external_invoice_id: "edz-001500",
    product_name: "Revistas do Erveiro", offer_name: "Assinatura Mensal",
    gross_value: 29.90, net_value: 24.50, currency: "BRL",
    installments: 1, payment_method: "Credito", card_brand: "Mastercard",
    status: "paid", is_subscription: true, is_bump: false, subscription_contract: "ctr-0422",
    created_at: "2025-09-04T10:00:00Z", sale_created_at: null, paid_at: "2025-09-04T10:00:00Z",
    affiliate: null,
    utm_source: "organic", utm_campaign: null, utm_content: null,
    ad_name: null, ad_set_name: null, campaign_name: null, placement: null,
  },
  {
    id: "sale-005", lead_id: "ld-016", platform: "eduzz",
    external_invoice_id: "edz-001800",
    product_name: "Revistas do Erveiro", offer_name: "Assinatura Mensal",
    gross_value: 29.90, net_value: 24.50, currency: "BRL",
    installments: 1, payment_method: "Credito", card_brand: "Mastercard",
    status: "paid", is_subscription: true, is_bump: false, subscription_contract: "ctr-0422",
    created_at: "2025-10-04T10:00:00Z", sale_created_at: null, paid_at: "2025-10-04T10:00:00Z",
    affiliate: null,
    utm_source: "organic", utm_campaign: null, utm_content: null,
    ad_name: null, ad_set_name: null, campaign_name: null, placement: null,
  },

  // ── EDUZZ: Ana Beatriz (ld-001) — compradora rápida ──────────────────────
  {
    id: "sale-006", lead_id: "ld-001", platform: "eduzz",
    external_invoice_id: "edz-002100",
    product_name: "Despertar da Vida Plena", offer_name: "Oferta Base",
    gross_value: 27.00, net_value: 20.70, currency: "BRL",
    installments: 1, payment_method: "Pix", card_brand: null,
    status: "paid", is_subscription: false, is_bump: false, subscription_contract: null,
    created_at: "2025-02-20T12:00:00Z", sale_created_at: null, paid_at: "2025-02-20T12:03:44Z",
    affiliate: null,
    utm_source: "google", utm_campaign: "desafio-protocolo-nov", utm_content: "video-dor-v3",
    ad_name: null, ad_set_name: null, campaign_name: null, placement: null,
  },

  // ── HOTMART: Carlos (ld-002) — comprou via Instagram Reels ───────────────
  {
    id: "sale-007", lead_id: "ld-002", platform: "hotmart",
    external_invoice_id: "hot-HP00001234",
    product_name: "Tinturas de Ervas Medicinais", offer_name: "Checkout Principal",
    gross_value: 47.00, net_value: 37.60, currency: "BRL",
    installments: 1, payment_method: "Pix", card_brand: null,
    status: "paid", is_subscription: false, is_bump: true, subscription_contract: null,
    created_at: "2025-03-15T18:00:00Z", sale_created_at: null, paid_at: "2025-03-15T18:04:22Z",
    affiliate: null,
    utm_source: null, utm_campaign: null, utm_content: null,
    ad_name: "AD1 - Amora", ad_set_name: "CAMP53 [Guia Tinturas] Conjunto de anúncios",
    campaign_name: "CAMP53 [Guia Tinturas] Campanha", placement: "Instagram_Reels",
  },

  // ── HOTMART: Fernanda (ld-003) — comprou via Facebook ────────────────────
  {
    id: "sale-008", lead_id: "ld-003", platform: "hotmart",
    external_invoice_id: "hot-HP00002201",
    product_name: "Tinturas de Ervas Medicinais", offer_name: "Checkout Principal",
    gross_value: 47.00, net_value: 37.60, currency: "BRL",
    installments: 1, payment_method: "Credito", card_brand: "Mastercard",
    status: "paid", is_subscription: false, is_bump: false, subscription_contract: null,
    created_at: "2025-05-10T10:00:00Z", sale_created_at: null, paid_at: "2025-05-10T10:01:55Z",
    affiliate: null,
    utm_source: null, utm_campaign: null, utm_content: null,
    ad_name: "AD2 - Depoimento", ad_set_name: "CAMP47 [Tinturas] Conjunto Depoimentos",
    campaign_name: "CAMP47 [Tinturas] Campanha", placement: "FB",
  },

  // ── EDUZZ: Mariana (ld-005) — multi-compradora + assinante ───────────────
  {
    id: "sale-009", lead_id: "ld-005", platform: "eduzz",
    external_invoice_id: "edz-003100",
    product_name: "Manual das Ervas para Dores", offer_name: "Oferta Base",
    gross_value: 19.90, net_value: 14.50, currency: "BRL",
    installments: 1, payment_method: "Pix", card_brand: null,
    status: "paid", is_subscription: false, is_bump: false, subscription_contract: null,
    created_at: "2024-10-15T11:00:00Z", sale_created_at: null, paid_at: "2024-10-15T11:02:10Z",
    affiliate: null,
    utm_source: "facebook", utm_campaign: "camp29-tinturas", utm_content: "ad2ouro",
    ad_name: null, ad_set_name: null, campaign_name: null, placement: null,
  },
  {
    id: "sale-010", lead_id: "ld-005", platform: "eduzz",
    external_invoice_id: "edz-004200",
    product_name: "Limpeza Energética", offer_name: "Oferta Especial",
    gross_value: 74.90, net_value: 60.10, currency: "BRL",
    installments: 2, payment_method: "Credito", card_brand: "Visa",
    status: "paid", is_subscription: false, is_bump: false, subscription_contract: null,
    created_at: "2025-01-20T15:00:00Z", sale_created_at: null, paid_at: "2025-01-20T15:03:00Z",
    affiliate: "daniela modanese",
    utm_source: "instagram", utm_campaign: "black-novembro-24", utm_content: "ad1",
    ad_name: null, ad_set_name: null, campaign_name: null, placement: null,
  },
  {
    id: "sale-011", lead_id: "ld-005", platform: "eduzz",
    external_invoice_id: "edz-005000",
    product_name: "Revistas do Erveiro", offer_name: "Assinatura Mensal",
    gross_value: 29.90, net_value: 24.50, currency: "BRL",
    installments: 1, payment_method: "Credito", card_brand: "Visa",
    status: "paid", is_subscription: true, is_bump: false, subscription_contract: "ctr-0511",
    created_at: "2025-02-10T11:00:00Z", sale_created_at: null, paid_at: "2025-02-10T11:00:00Z",
    affiliate: null,
    utm_source: "organic", utm_campaign: null, utm_content: null,
    ad_name: null, ad_set_name: null, campaign_name: null, placement: null,
  },

  // ── HOTMART: Roberto (ld-004) — comprou via Instagram Feed ───────────────
  {
    id: "sale-012", lead_id: "ld-004", platform: "hotmart",
    external_invoice_id: "hot-HP00003300",
    product_name: "Tinturas de Ervas Medicinais", offer_name: "Checkout Principal",
    gross_value: 47.00, net_value: 37.60, currency: "BRL",
    installments: 1, payment_method: "Pix", card_brand: null,
    status: "paid", is_subscription: false, is_bump: false, subscription_contract: null,
    created_at: "2025-06-01T09:30:00Z", sale_created_at: null, paid_at: "2025-06-01T09:32:44Z",
    affiliate: null,
    utm_source: null, utm_campaign: null, utm_content: null,
    ad_name: "AD3 - Dor nas Articulações", ad_set_name: "CAMP53 [Guia Tinturas] Conjunto de anúncios",
    campaign_name: "CAMP53 [Guia Tinturas] Campanha", placement: "Instagram_Feed",
  },
];

// ─── Índice de vendas por lead ─────────────────────────────────────────────────

const salesByLead: Record<string, SaleEvent[]> = {};
mockSales.forEach((s) => {
  if (!salesByLead[s.lead_id]) salesByLead[s.lead_id] = [];
  salesByLead[s.lead_id].push(s);
});

// Enriquece os leads do mock com dados financeiros calculados
mockLeads.forEach((lead) => {
  const sales = salesByLead[lead.id] || [];
  const paidSales = sales.filter((s) => s.status === "paid");
  if (paidSales.length === 0) return;

  lead.sales = sales;
  lead.purchase_count = paidSales.length;
  lead.total_revenue = paidSales.reduce((acc, s) => acc + s.net_value, 0);
  lead.is_subscriber = paidSales.some((s) => s.is_subscription);

  const dates = paidSales
    .filter((s) => s.paid_at)
    .map((s) => new Date(s.paid_at!).getTime())
    .sort((a, b) => a - b);

  if (dates.length > 0) {
    lead.first_purchase_at = new Date(dates[0]).toISOString();
    lead.last_purchase_at = new Date(dates[dates.length - 1]).toISOString();
    lead.ltv_days = dates.length > 1
      ? Math.round((dates[dates.length - 1] - dates[0]) / 86400000)
      : 0;
  }
});

/**
 * Retorna vendas de um lead específico.
 */
export function getLeadSales(leadId: string): SaleEvent[] {
  return mockSales.filter((s) => s.lead_id === leadId);
}
