import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface PaymentMethodRow {
  payment_method: string;
  sale_count: number;
  total_revenue: number;
  avg_ticket: number;
}

export interface InstallmentsRow {
  installments: number;
  sale_count: number;
  total_revenue: number;
  avg_ticket: number;
}

export interface UtmMediumRow {
  utm_medium: string;
  sale_count: number;
  total_revenue: number;
}

export interface CreativeRow {
  creative: string;
  campaign: string;
  adset: string;
  placement: string;
  sale_count: number;
  total_revenue: number;
}

interface RawUtmContentRow {
  utm_content: string;
  sale_count: number;
  total_revenue: number;
}

interface SalesBreakdownResponse {
  by_payment_method: PaymentMethodRow[];
  by_installments: InstallmentsRow[];
  by_utm_medium: UtmMediumRow[];
  by_utm_content: RawUtmContentRow[];
}

const EDUZZ_DELIMITER = "hQwK21wXxR";

function parseUtmContent(raw: RawUtmContentRow[]): CreativeRow[] {
  const map = new Map<string, CreativeRow>();

  for (const row of raw) {
    const parts = row.utm_content.split(EDUZZ_DELIMITER);
    // Pattern: source | campaign | adset | ad | placement
    const campaign = parts[1] || "Sem campanha";
    const adset = parts[2] || "Sem adset";
    const creative = parts[3] || row.utm_content; // fallback to raw
    const placement = parts[4] || "—";

    const key = creative;
    const existing = map.get(key);
    if (existing) {
      existing.sale_count += row.sale_count;
      existing.total_revenue += row.total_revenue;
    } else {
      map.set(key, {
        creative,
        campaign,
        adset,
        placement,
        sale_count: row.sale_count,
        total_revenue: row.total_revenue,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total_revenue - a.total_revenue);
}

export function useSalesBreakdown() {
  const { workspaceId } = useAuth();

  return useQuery({
    queryKey: ["sales-breakdown", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_breakdown", {
        p_workspace_id: workspaceId!,
      });
      if (error) throw error;

      const result = data as unknown as SalesBreakdownResponse;

      return {
        byPaymentMethod: result.by_payment_method ?? [],
        byInstallments: result.by_installments ?? [],
        byUtmMedium: result.by_utm_medium ?? [],
        byCreative: parseUtmContent(result.by_utm_content ?? []),
      };
    },
  });
}
