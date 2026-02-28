export type AlertLevel = "info" | "warning" | "critical";
export type AlertType = "conversion_drop" | "volume_drop" | "time_exceeded" | "spike" | "stale";
export type LeadSource = "n8n" | "zapier" | "api" | "manual" | "typebot" | "webhook" | "eduzz" | "hotmart";
export type SalePlatform = "eduzz" | "hotmart";

export interface SaleEvent {
  id: string;
  lead_id: string;
  platform: SalePlatform;
  external_invoice_id: string;

  // Produto
  product_name: string;
  offer_name: string;

  // Valores
  gross_value: number;
  net_value: number;
  currency: "BRL" | "EUR";
  installments: number;
  payment_method: "Pix" | "Credito" | "Boleto" | "Débito";
  card_brand: string | null;

  // Status
  status: "paid" | "refunded" | "pending" | "authorized";
  is_subscription: boolean;
  is_bump: boolean;
  subscription_contract: string | null; // contrato Eduzz para agregar mensalidades

  // Datas
  created_at: string;
  sale_created_at: string | null;
  paid_at: string | null;

  // Atribuição
  affiliate: string | null;

  // UTMs (Eduzz)
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;

  // Hotmart extra
  ad_name: string | null;
  ad_set_name: string | null;
  campaign_name: string | null;
  placement: string | null;
}
export type MovedBy = "webhook" | "manual";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface FunnelStage {
  id: string;
  funnel_id: string;
  name: string;
  order_index: number;
  color: string;
  page_url: string | null;
  created_at: string;
}

export interface StageTransitionRule {
  id: string;
  funnel_id: string;
  event_name: string;
  from_stage_id: string | null;
  to_stage_id: string;
  priority: number;
  created_at: string;
}

export interface Funnel {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  webhook_token: string;
  is_active: boolean;
  campaign_id: string | null;
  created_at: string;
  stages: FunnelStage[];
  rules: StageTransitionRule[];
  total_leads: number;
  conversion_rate: number;
}

export interface LeadAttribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referral_source: string | null;
  device: "Mobile" | "Desktop" | "Tablet" | null;
  city: string | null;
  region: string | null;
  country: string | null;
  page_url: string | null;
  form_id: string | null;
  converted_at: string | null;
}

/**
 * Posição de um lead em um funil específico.
 * A mesma pessoa (Lead) pode ter N LeadFunnelPositions em N funis diferentes.
 * Isso é a separação correta: identidade × posição.
 */
export interface LeadFunnelPosition {
  id: string;
  lead_id: string;
  funnel_id: string;
  funnel_name: string;
  current_stage_id: string;
  current_stage_name: string;
  entered_at: string;
  converted_at: string | null;   // timestamp exato da conversão nesta página
  page_url: string | null;       // página específica onde converteu neste funil
  time_in_stage_hours: number;
  moved_by: MovedBy;
  source: LeadSource;
}

/**
 * Identidade global do lead — uma entrada por pessoa, deduplica por telefone+workspace.
 * NÃO contém funil nem etapa diretamente. Esses dados ficam em funnel_positions[].
 */
export interface Lead {
  id: string;
  workspace_id: string;
  phone: string;
  name: string;
  email: string;
  source: LeadSource;           // fonte primária (primeiro contato)
  attribution: LeadAttribution;
  metadata: Record<string, unknown>;
  created_at: string;

  // Posições em cada funil que o lead participa
  funnel_positions: LeadFunnelPosition[];

  // Campos de conveniência derivados da posição mais recente/relevante
  // Mantidos para compatibilidade com componentes que esperam campos flat
  primary_funnel_id: string;
  primary_funnel_name: string;
  primary_stage_id: string;
  primary_stage_name: string;
  time_in_stage_hours: number;  // do funil primário

  // Legado — mantido para LeadTimeline drawer
  funnel_name: string;
  current_stage_name: string;

  // ── Dados financeiros (enriquecidos via importação de vendas) ──────────────
  sales?: SaleEvent[];
  total_revenue?: number;
  first_purchase_at?: string | null;
  last_purchase_at?: string | null;
  purchase_count?: number;
  is_subscriber?: boolean;
  ltv_days?: number | null;
  imported_at?: string | null;
  signup_count?: number;
  last_signup_at?: string | null;
}

export interface LeadEvent {
  id: string;
  funnel_id: string;
  lead_id: string;
  event_name: string;
  source: LeadSource;
  timestamp_event: string;
  payload_raw: Record<string, unknown>;
  idempotency_key: string;
  created_at: string;
}

export interface LeadFunnelStage {
  id: string;
  lead_id: string;
  funnel_id: string;
  stage_id: string;
  entered_at: string;
  previous_stage_id: string | null;
  moved_by: MovedBy;
  updated_at: string;
}

export interface FunnelMetrics {
  id: string;
  funnel_id: string;
  stage_id: string;
  stage_name: string;
  date: string;
  total_leads: number;
  entries: number;
  exits: number;
  conversions: number;
  avg_time_seconds: number;
  updated_at: string;
}

export interface SentinelAlert {
  id: string;
  workspace_id: string;
  funnel_id: string;
  funnel_name: string;
  stage_id: string | null;
  stage_name: string | null;
  alert_type: AlertType;
  level: AlertLevel;
  title: string;
  description: string;
  threshold_value: number;
  actual_value: number;
  is_read: boolean;
  created_at: string;
}

export interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  funnels: Funnel[];
  total_leads: number;
  overall_conversion: number;
}

export interface DashboardMetrics {
  total_active_leads: number;
  overall_conversion_rate: number;
  events_today: number;
  new_leads_today: number;
  total_active_leads_delta: number;
  conversion_rate_delta: number;
  events_today_delta: number;
  new_leads_today_delta: number;
}
