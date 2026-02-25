
-- get_campaign_stats: retorna métricas por funil da campanha
CREATE OR REPLACE FUNCTION public.get_campaign_stats(p_campaign_id uuid)
RETURNS TABLE(
  funnel_id uuid,
  funnel_name text,
  is_active boolean,
  stage_count bigint,
  lead_count bigint,
  buyer_count bigint,
  total_revenue numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    f.id AS funnel_id,
    f.name AS funnel_name,
    f.is_active,
    (SELECT COUNT(*) FROM public.funnel_stages fs WHERE fs.funnel_id = f.id) AS stage_count,
    COUNT(DISTINCT lfs.lead_id) AS lead_count,
    COUNT(DISTINCT lfs.lead_id) FILTER (WHERE l.purchase_count >= 1) AS buyer_count,
    COALESCE(SUM(l.total_revenue), 0) AS total_revenue
  FROM public.funnels f
  LEFT JOIN public.lead_funnel_stages lfs ON lfs.funnel_id = f.id
  LEFT JOIN public.leads l ON l.id = lfs.lead_id
  WHERE f.campaign_id = p_campaign_id
  GROUP BY f.id, f.name, f.is_active;
$$;

-- get_campaign_creatives: agrega dados de atribuição dos leads da campanha
CREATE OR REPLACE FUNCTION public.get_campaign_creatives(p_campaign_id uuid)
RETURNS TABLE(
  utm_content text,
  utm_source text,
  device text,
  city text,
  lead_count bigint,
  buyer_count bigint,
  total_revenue numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    l.utm_content,
    l.utm_source,
    l.device,
    l.city,
    COUNT(*)::bigint AS lead_count,
    COUNT(*) FILTER (WHERE l.purchase_count >= 1)::bigint AS buyer_count,
    COALESCE(SUM(l.total_revenue), 0) AS total_revenue
  FROM public.leads l
  WHERE l.id IN (
    SELECT DISTINCT lfs.lead_id
    FROM public.lead_funnel_stages lfs
    JOIN public.funnels f ON f.id = lfs.funnel_id
    WHERE f.campaign_id = p_campaign_id
  )
  GROUP BY l.utm_content, l.utm_source, l.device, l.city;
$$;

-- get_campaign_revenue: dados de receita por produto da campanha
CREATE OR REPLACE FUNCTION public.get_campaign_revenue(p_campaign_id uuid)
RETURNS TABLE(
  product_name text,
  platform text,
  sale_count bigint,
  total_net numeric,
  total_gross numeric,
  has_subscription boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    se.product_name,
    se.platform,
    COUNT(*)::bigint AS sale_count,
    SUM(se.net_value) AS total_net,
    SUM(se.gross_value) AS total_gross,
    bool_or(se.is_subscription) AS has_subscription
  FROM public.sale_events se
  WHERE se.status = 'paid'
    AND se.lead_id IN (
      SELECT DISTINCT lfs.lead_id
      FROM public.lead_funnel_stages lfs
      JOIN public.funnels f ON f.id = lfs.funnel_id
      WHERE f.campaign_id = p_campaign_id
    )
  GROUP BY se.product_name, se.platform
  ORDER BY total_net DESC;
$$;
