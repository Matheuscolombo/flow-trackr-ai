
-- ═══════════════════════════════════════════════════════
-- Tabela: tags
-- ═══════════════════════════════════════════════════════
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366F1',
  scope text NOT NULL DEFAULT 'global',
  funnel_id uuid REFERENCES public.funnels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name, scope, funnel_id)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_workspace_access" ON public.tags FOR ALL
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

CREATE POLICY "tags_workspace_insert" ON public.tags FOR INSERT
  WITH CHECK (workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()));

CREATE TRIGGER set_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════
-- Tabela: lead_tags
-- ═══════════════════════════════════════════════════════
CREATE TABLE public.lead_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, tag_id)
);

ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lt_workspace_access" ON public.lead_tags FOR ALL
  USING (lead_id IN (SELECT id FROM public.leads WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())));

CREATE POLICY "lt_workspace_insert" ON public.lead_tags FOR INSERT
  WITH CHECK (lead_id IN (SELECT id FROM public.leads WHERE workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())));

-- Índices
CREATE INDEX idx_tags_workspace ON public.tags(workspace_id);
CREATE INDEX idx_tags_funnel ON public.tags(funnel_id) WHERE funnel_id IS NOT NULL;
CREATE INDEX idx_lead_tags_lead ON public.lead_tags(lead_id);
CREATE INDEX idx_lead_tags_tag ON public.lead_tags(tag_id);
