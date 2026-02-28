
-- Update get_leads_metrics to sum revenue directly from sale_events (captures orphan sales too)
CREATE OR REPLACE FUNCTION public.get_leads_metrics()
 RETURNS TABLE(total_leads bigint, total_buyers bigint, multi_buyers bigint, total_revenue numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH lead_stats AS (
    SELECT
      COUNT(*)::bigint                                    AS total_leads,
      COUNT(*) FILTER (WHERE purchase_count >= 1)::bigint AS total_buyers,
      COUNT(*) FILTER (WHERE purchase_count >= 2)::bigint AS multi_buyers
    FROM public.leads
    WHERE workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  ),
  sale_stats AS (
    SELECT COALESCE(SUM(net_value), 0) AS total_revenue
    FROM public.sale_events
    WHERE status = 'paid'
      AND workspace_id IN (
        SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      )
  )
  SELECT
    ls.total_leads,
    ls.total_buyers,
    ls.multi_buyers,
    ss.total_revenue
  FROM lead_stats ls, sale_stats ss;
$function$;
