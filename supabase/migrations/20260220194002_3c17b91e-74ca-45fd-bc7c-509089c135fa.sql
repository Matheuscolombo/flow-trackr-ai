
-- ══════════════════════════════════════════════════════════════════════════════
-- SENTINEL — Schema inicial completo
-- Tabelas: workspaces, leads, sale_events, funnels, funnel_stages,
--          stage_transition_rules, lead_funnel_stages, lead_events
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── EXTENSÕES ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── WORKSPACES ───────────────────────────────────────────────────────────────
CREATE TABLE public.workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  owner_id    UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_all" ON public.workspaces
  USING (owner_id = auth.uid());

-- ─── CAMPAIGNS ────────────────────────────────────────────────────────────────
CREATE TABLE public.campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_workspace_access" ON public.campaigns
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- ─── FUNNELS ──────────────────────────────────────────────────────────────────
CREATE TABLE public.funnels (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id    UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  webhook_token  TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funnel_workspace_access" ON public.funnels
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- ─── FUNNEL STAGES ────────────────────────────────────────────────────────────
CREATE TABLE public.funnel_stages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id    UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  order_index  INT NOT NULL DEFAULT 0,
  color        TEXT NOT NULL DEFAULT '#3B82F6',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funnel_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funnel_stage_workspace_access" ON public.funnel_stages
  USING (funnel_id IN (
    SELECT id FROM public.funnels
    WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  ));

-- ─── STAGE TRANSITION RULES ───────────────────────────────────────────────────
CREATE TABLE public.stage_transition_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id      UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  event_name     TEXT NOT NULL,
  from_stage_id  UUID REFERENCES public.funnel_stages(id) ON DELETE CASCADE,
  to_stage_id    UUID NOT NULL REFERENCES public.funnel_stages(id) ON DELETE CASCADE,
  priority       INT NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stage_transition_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "str_workspace_access" ON public.stage_transition_rules
  USING (funnel_id IN (
    SELECT id FROM public.funnels
    WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  ));

-- ─── LEADS ────────────────────────────────────────────────────────────────────
CREATE TABLE public.leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone         TEXT,
  name          TEXT,
  email         TEXT,
  source        TEXT NOT NULL DEFAULT 'manual',  -- n8n, zapier, api, manual, eduzz, hotmart, etc.

  -- Atribuição de tráfego
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_content   TEXT,
  utm_term      TEXT,
  referral_source TEXT,
  device        TEXT,
  city          TEXT,
  region        TEXT,
  country       TEXT,
  page_url      TEXT,
  form_id       TEXT,
  converted_at  TIMESTAMPTZ,

  -- Metadados livres (JSON para campos extras de webhook)
  metadata      JSONB NOT NULL DEFAULT '{}',

  -- Flag: lead comprou mas nunca entrou num funil de captura
  is_ghost      BOOLEAN NOT NULL DEFAULT false,

  -- Campos calculados/cacheados de vendas (atualizados ao importar)
  total_revenue       NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase_count      INT NOT NULL DEFAULT 0,
  first_purchase_at   TIMESTAMPTZ,
  last_purchase_at    TIMESTAMPTZ,
  is_subscriber       BOOLEAN NOT NULL DEFAULT false,
  ltv_days            INT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para cruzamento email→telefone e deduplicação
CREATE INDEX idx_leads_email       ON public.leads (workspace_id, lower(email));
CREATE INDEX idx_leads_phone       ON public.leads (workspace_id, phone);
CREATE INDEX idx_leads_workspace   ON public.leads (workspace_id);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_workspace_access" ON public.leads
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

CREATE POLICY "leads_workspace_insert" ON public.leads
  FOR INSERT WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

CREATE POLICY "leads_workspace_update" ON public.leads
  FOR UPDATE USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- ─── LEAD FUNNEL STAGES (posição do lead em cada funil) ──────────────────────
CREATE TABLE public.lead_funnel_stages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  funnel_id         UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  stage_id          UUID NOT NULL REFERENCES public.funnel_stages(id) ON DELETE CASCADE,
  entered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_stage_id UUID REFERENCES public.funnel_stages(id),
  moved_by          TEXT NOT NULL DEFAULT 'webhook',  -- webhook | manual
  source            TEXT NOT NULL DEFAULT 'webhook',
  page_url          TEXT,
  converted_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id, funnel_id)
);

ALTER TABLE public.lead_funnel_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lfs_workspace_access" ON public.lead_funnel_stages
  USING (lead_id IN (
    SELECT id FROM public.leads
    WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  ));

-- ─── LEAD EVENTS ──────────────────────────────────────────────────────────────
CREATE TABLE public.lead_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id        UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  lead_id          UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_name       TEXT NOT NULL,
  source           TEXT NOT NULL DEFAULT 'webhook',
  timestamp_event  TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_raw      JSONB NOT NULL DEFAULT '{}',
  idempotency_key  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_events_lead   ON public.lead_events (lead_id);
CREATE INDEX idx_lead_events_funnel ON public.lead_events (funnel_id);

ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "le_workspace_access" ON public.lead_events
  USING (funnel_id IN (
    SELECT id FROM public.funnels
    WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
  ));

-- ─── SALE EVENTS ──────────────────────────────────────────────────────────────
CREATE TABLE public.sale_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id               UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  platform              TEXT NOT NULL,             -- 'eduzz' | 'hotmart'
  external_invoice_id   TEXT NOT NULL,

  -- Produto
  product_name          TEXT NOT NULL,
  offer_name            TEXT,

  -- Valores
  gross_value           NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_value             NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'BRL',
  installments          INT NOT NULL DEFAULT 1,
  payment_method        TEXT,                      -- Pix, Credito, Boleto, Débito
  card_brand            TEXT,

  -- Status
  status                TEXT NOT NULL DEFAULT 'paid', -- paid | refunded | pending | authorized
  is_subscription       BOOLEAN NOT NULL DEFAULT false,
  is_bump               BOOLEAN NOT NULL DEFAULT false,
  subscription_contract TEXT,                      -- ID do contrato Eduzz para agrupamento

  -- Datas
  sale_created_at       TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,

  -- Atribuição
  affiliate             TEXT,

  -- UTMs (Eduzz — simples)
  utm_source            TEXT,
  utm_campaign          TEXT,
  utm_content           TEXT,

  -- Hotmart extra (mídia paga granular)
  ad_name               TEXT,                      -- "AD1 - Amora" (sem o ID Meta)
  ad_set_name           TEXT,
  campaign_name         TEXT,
  placement             TEXT,                      -- Instagram_Feed, Instagram_Reels, FB

  -- Dados brutos do comprador para cruzamento posterior
  buyer_email           TEXT,
  buyer_phone           TEXT,
  buyer_name            TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_sale_events_lead       ON public.sale_events (lead_id);
CREATE INDEX idx_sale_events_workspace  ON public.sale_events (workspace_id);
CREATE INDEX idx_sale_events_platform   ON public.sale_events (platform);
CREATE INDEX idx_sale_events_utm        ON public.sale_events (utm_content);
CREATE INDEX idx_sale_events_ad         ON public.sale_events (ad_name);
CREATE UNIQUE INDEX idx_sale_events_dedup ON public.sale_events (workspace_id, platform, external_invoice_id);

ALTER TABLE public.sale_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "se_workspace_access" ON public.sale_events
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

CREATE POLICY "se_workspace_insert" ON public.sale_events
  FOR INSERT WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- ─── SENTINEL ALERTS ──────────────────────────────────────────────────────────
CREATE TABLE public.sentinel_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  funnel_id       UUID REFERENCES public.funnels(id) ON DELETE CASCADE,
  stage_id        UUID REFERENCES public.funnel_stages(id) ON DELETE SET NULL,
  alert_type      TEXT NOT NULL,
  level           TEXT NOT NULL DEFAULT 'info',
  title           TEXT NOT NULL,
  description     TEXT,
  threshold_value NUMERIC,
  actual_value    NUMERIC,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sentinel_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_workspace_access" ON public.sentinel_alerts
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

-- ─── TRIGGER: updated_at automático ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_workspaces_updated_at   BEFORE UPDATE ON public.workspaces        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_campaigns_updated_at    BEFORE UPDATE ON public.campaigns         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_funnels_updated_at      BEFORE UPDATE ON public.funnels           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_leads_updated_at        BEFORE UPDATE ON public.leads             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_lfs_updated_at          BEFORE UPDATE ON public.lead_funnel_stages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── FUNÇÃO: recalcular campos agregados do lead após nova venda ──────────────
CREATE OR REPLACE FUNCTION public.recalculate_lead_sales_stats(p_lead_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.leads SET
    total_revenue     = COALESCE((SELECT SUM(net_value)   FROM public.sale_events WHERE lead_id = p_lead_id AND status = 'paid'), 0),
    purchase_count    = COALESCE((SELECT COUNT(*)          FROM public.sale_events WHERE lead_id = p_lead_id AND status = 'paid'), 0),
    first_purchase_at = (SELECT MIN(paid_at)               FROM public.sale_events WHERE lead_id = p_lead_id AND status = 'paid'),
    last_purchase_at  = (SELECT MAX(paid_at)               FROM public.sale_events WHERE lead_id = p_lead_id AND status = 'paid'),
    is_subscriber     = EXISTS (SELECT 1                   FROM public.sale_events WHERE lead_id = p_lead_id AND status = 'paid' AND is_subscription = true),
    ltv_days          = (
      SELECT EXTRACT(DAY FROM MAX(paid_at) - MIN(paid_at))::INT
      FROM public.sale_events WHERE lead_id = p_lead_id AND status = 'paid'
    ),
    updated_at = now()
  WHERE id = p_lead_id;
END;
$$;

-- ─── TRIGGER: atualizar stats do lead quando sale_event é inserido/atualizado ─
CREATE OR REPLACE FUNCTION public.trg_sale_event_update_lead_stats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    PERFORM public.recalculate_lead_sales_stats(NEW.lead_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sale_event_after_insert
  AFTER INSERT OR UPDATE ON public.sale_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_sale_event_update_lead_stats();
