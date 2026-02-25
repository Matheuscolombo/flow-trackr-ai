CREATE OR REPLACE FUNCTION public.get_funnel_buyer_stats(p_funnel_id uuid)
RETURNS TABLE(single_buyers bigint, multi_buyers bigint, total_buyers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE l.purchase_count = 1)::bigint  AS single_buyers,
    COUNT(*) FILTER (WHERE l.purchase_count >= 2)::bigint AS multi_buyers,
    COUNT(*)::bigint                                       AS total_buyers
  FROM (
    SELECT DISTINCT lead_id
    FROM public.lead_funnel_stages
    WHERE funnel_id = p_funnel_id
  ) lfs
  JOIN public.leads l ON l.id = lfs.lead_id;
$$;