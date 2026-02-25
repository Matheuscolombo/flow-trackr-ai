
CREATE OR REPLACE FUNCTION public.get_sales_breakdown(p_workspace_id uuid)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'by_payment_method', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          COALESCE(payment_method, 'Desconhecido') AS payment_method,
          COUNT(*)::bigint AS sale_count,
          SUM(net_value) AS total_revenue,
          ROUND(AVG(net_value), 2) AS avg_ticket
        FROM public.sale_events
        WHERE workspace_id = p_workspace_id AND status = 'paid'
        GROUP BY payment_method
        ORDER BY total_revenue DESC
      ) t
    ),
    'by_installments', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          installments,
          COUNT(*)::bigint AS sale_count,
          SUM(net_value) AS total_revenue,
          ROUND(AVG(net_value), 2) AS avg_ticket
        FROM public.sale_events
        WHERE workspace_id = p_workspace_id AND status = 'paid'
        GROUP BY installments
        ORDER BY sale_count DESC
      ) t
    ),
    'by_utm_medium', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          COALESCE(utm_medium, 'Direto / Sem UTM') AS utm_medium,
          COUNT(*)::bigint AS sale_count,
          SUM(net_value) AS total_revenue
        FROM public.sale_events
        WHERE workspace_id = p_workspace_id AND status = 'paid'
        GROUP BY utm_medium
        ORDER BY total_revenue DESC
      ) t
    ),
    'by_utm_content', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          utm_content,
          COUNT(*)::bigint AS sale_count,
          SUM(net_value) AS total_revenue
        FROM public.sale_events
        WHERE workspace_id = p_workspace_id AND status = 'paid' AND utm_content IS NOT NULL
        GROUP BY utm_content
        ORDER BY total_revenue DESC
        LIMIT 50
      ) t
    )
  );
$$;
