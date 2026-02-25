
-- 1. Criar tabela product_mappings
CREATE TABLE public.product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, platform, external_name)
);

-- RLS
ALTER TABLE public.product_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_workspace_access" ON public.product_mappings
  FOR ALL USING (workspace_id IN (
    SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  ));

CREATE POLICY "pm_workspace_insert" ON public.product_mappings
  FOR INSERT WITH CHECK (workspace_id IN (
    SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  ));

-- 2. Tornar platform/external_id nullable em products
ALTER TABLE public.products ALTER COLUMN platform DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN external_id DROP NOT NULL;

-- 3. Nova RPC get_all_product_stats (sem filtro numerico)
CREATE OR REPLACE FUNCTION public.get_all_product_stats(p_workspace_id uuid)
RETURNS TABLE(product_name text, platform text, total_sales bigint, total_revenue numeric, has_subscription boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    se.product_name,
    se.platform,
    COUNT(*)::bigint          AS total_sales,
    SUM(se.net_value)         AS total_revenue,
    bool_or(se.is_subscription) AS has_subscription
  FROM public.sale_events se
  WHERE se.workspace_id = p_workspace_id
  GROUP BY se.product_name, se.platform
  ORDER BY total_revenue DESC;
$$;
