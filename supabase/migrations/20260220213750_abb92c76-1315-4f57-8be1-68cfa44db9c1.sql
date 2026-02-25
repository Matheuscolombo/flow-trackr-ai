
CREATE OR REPLACE FUNCTION public.get_leads_metrics()
RETURNS TABLE(total_leads bigint, total_buyers bigint, multi_buyers bigint, total_revenue numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint                                    AS total_leads,
    COUNT(*) FILTER (WHERE purchase_count >= 1)::bigint AS total_buyers,
    COUNT(*) FILTER (WHERE purchase_count >= 2)::bigint AS multi_buyers,
    COALESCE(SUM(total_revenue), 0)                    AS total_revenue
  FROM public.leads
  WHERE workspace_id IN (
    SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  );
$$;
