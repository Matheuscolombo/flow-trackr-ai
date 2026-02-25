
-- Função que retorna produtos numéricos com métricas agregadas (sem limite de 1000 rows)
CREATE OR REPLACE FUNCTION public.get_numeric_product_stats(p_workspace_id uuid)
RETURNS TABLE (
  product_name  text,
  platform      text,
  total_sales   bigint,
  total_revenue numeric,
  has_subscription boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    se.product_name,
    se.platform,
    COUNT(*)::bigint          AS total_sales,
    SUM(se.net_value)         AS total_revenue,
    bool_or(se.is_subscription) AS has_subscription
  FROM public.sale_events se
  WHERE se.workspace_id = p_workspace_id
    AND se.product_name ~ '^\d+$'
  GROUP BY se.product_name, se.platform
  ORDER BY total_revenue DESC;
$$;
