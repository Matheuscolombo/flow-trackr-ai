
CREATE OR REPLACE FUNCTION public.get_funnel_signup_stats(p_funnel_id uuid)
RETURNS TABLE(total_signups bigint, unique_leads bigint, duplicate_signups bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    SUM(l.signup_count)::bigint AS total_signups,
    COUNT(DISTINCT lfs.lead_id)::bigint AS unique_leads,
    (SUM(l.signup_count) - COUNT(DISTINCT lfs.lead_id))::bigint AS duplicate_signups
  FROM public.lead_funnel_stages lfs
  JOIN public.leads l ON l.id = lfs.lead_id
  WHERE lfs.funnel_id = p_funnel_id;
$$;
