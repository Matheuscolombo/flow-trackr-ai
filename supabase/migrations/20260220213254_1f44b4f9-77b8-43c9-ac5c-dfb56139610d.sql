
CREATE OR REPLACE FUNCTION public.recalculate_leads_batch(p_lead_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.leads SET
    total_revenue     = COALESCE((SELECT SUM(net_value)   FROM public.sale_events WHERE lead_id = leads.id AND status = 'paid'), 0),
    purchase_count    = COALESCE((SELECT COUNT(*)          FROM public.sale_events WHERE lead_id = leads.id AND status = 'paid'), 0),
    first_purchase_at = (SELECT MIN(paid_at)               FROM public.sale_events WHERE lead_id = leads.id AND status = 'paid'),
    last_purchase_at  = (SELECT MAX(paid_at)               FROM public.sale_events WHERE lead_id = leads.id AND status = 'paid'),
    is_subscriber     = EXISTS (SELECT 1                   FROM public.sale_events WHERE lead_id = leads.id AND status = 'paid' AND is_subscription = true),
    ltv_days          = (
      SELECT EXTRACT(DAY FROM MAX(paid_at) - MIN(paid_at))::INT
      FROM public.sale_events WHERE lead_id = leads.id AND status = 'paid'
    ),
    updated_at = now()
  WHERE id = ANY(p_lead_ids);
END;
$$;
