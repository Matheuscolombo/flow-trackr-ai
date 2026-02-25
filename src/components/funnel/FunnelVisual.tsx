import { useMemo } from "react";
import type { FunnelStage } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface StageCount {
  stage_id: string;
  count: number;
}

interface FunnelVisualProps {
  stages: FunnelStage[];
  stageCounts: StageCount[];
  funnelId: string;
  /** Real buyer stats from leads table (purchase_count-based) */
  leadsBuyerStats?: { singleBuyers: number; multiBuyers: number } | null;
}

export function FunnelVisual({ stages, stageCounts, funnelId, leadsBuyerStats }: FunnelVisualProps) {
  const maxCount = useMemo(() => {
    const vals = stageCounts.map((s) => s.count);
    return Math.max(...vals, 1);
  }, [stageCounts]);

  const totalFirst = stageCounts.find((s) => s.stage_id === stages[0]?.id)?.count ?? 0;

  // Entries per day query
  const { data: entriesPerDay } = useQuery({
    queryKey: ["funnel-entries-per-day", funnelId],
    queryFn: async () => {
      // Get entries grouped by day for the last 30 days
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data } = await supabase
        .from("lead_funnel_stages")
        .select("entered_at, stage_id")
        .eq("funnel_id", funnelId)
        .gte("entered_at", since.toISOString())
        .order("entered_at", { ascending: true });

      if (!data) return [];

      // Group by day
      const byDay: Record<string, number> = {};
      data.forEach((row) => {
        const day = row.entered_at.slice(0, 10);
        byDay[day] = (byDay[day] ?? 0) + 1;
      });

      return Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));
    },
    staleTime: 60_000,
  });

  const chartMax = useMemo(() => {
    if (!entriesPerDay || entriesPerDay.length === 0) return 1;
    return Math.max(...entriesPerDay.map((d) => d.count), 1);
  }, [entriesPerDay]);

  return (
    <div className="space-y-6">
      {/* Funnel visual */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Funil de Conversão</h3>
        <div className="flex flex-col gap-1.5">
          {stages.map((stage, i) => {
            const count = stageCounts.find((s) => s.stage_id === stage.id)?.count ?? 0;
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const convFromFirst = totalFirst > 0 && i > 0 ? (count / totalFirst) * 100 : null;
            const prevCount = i > 0 ? (stageCounts.find((s) => s.stage_id === stages[i - 1].id)?.count ?? 0) : null;
            const convFromPrev = prevCount !== null && prevCount > 0 ? (count / prevCount) * 100 : null;

            return (
              <div key={stage.id} className="relative group">
                {/* Arrow connector */}
                {i > 0 && (
                  <div className="flex items-center justify-center mb-1">
                    <div className="flex flex-col items-center">
                      <div className="w-px h-3 bg-border" />
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {convFromPrev !== null && (
                          <span className="bg-muted px-1.5 py-0.5 rounded tabular-nums font-medium">
                            ↓ {convFromPrev.toFixed(1)}% da etapa anterior
                          </span>
                        )}
                        {convFromFirst !== null && (
                          <span className="bg-muted/60 px-1.5 py-0.5 rounded tabular-nums text-muted-foreground/70">
                            {convFromFirst.toFixed(1)}% do topo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage bar */}
                <div
                  className="flex items-center gap-3 rounded-lg px-4 py-3 transition-all"
                  style={{
                    background: `${stage.color}18`,
                    borderLeft: `3px solid ${stage.color}`,
                    width: `${Math.max(pct, 15)}%`,
                    minWidth: "280px",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="text-xs font-medium text-foreground">{stage.name}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      {count.toLocaleString("pt-BR")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">leads</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real buyer stats vs stage counts */}
      {leadsBuyerStats && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Compradores Reais vs. Etapas do Funil
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Contagem real baseada em vendas pagas na base de leads · Etapas podem divergir se o webhook não moveu todos
          </p>
          <div className="grid grid-cols-2 gap-3">
            {/* Real stats */}
            <div className="bg-background border border-border rounded-lg p-4">
              <p className="text-[10px] text-muted-foreground uppercase font-medium mb-2">Dados reais dos leads</p>
              <div className="space-y-2">
                <div>
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    {(leadsBuyerStats.singleBuyers + leadsBuyerStats.multiBuyers).toLocaleString("pt-BR")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">compradores únicos totais</p>
                </div>
                <div className="flex gap-3 mt-2">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(142 71% 45%)" }} />
                    <div>
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {leadsBuyerStats.singleBuyers.toLocaleString("pt-BR")}
                      </p>
                      <p className="text-[10px] text-muted-foreground">1 compra</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "hsl(38 92% 50%)" }} />
                    <div>
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {leadsBuyerStats.multiBuyers.toLocaleString("pt-BR")}
                      </p>
                      <p className="text-[10px] text-muted-foreground">2+ compras</p>
                    </div>
                  </div>
                </div>
                {leadsBuyerStats.singleBuyers + leadsBuyerStats.multiBuyers > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {((leadsBuyerStats.multiBuyers / (leadsBuyerStats.singleBuyers + leadsBuyerStats.multiBuyers)) * 100).toFixed(1)}% são multi-compradores
                  </p>
                )}
              </div>
            </div>

            {/* Stage counts */}
            <div className="bg-background border border-border rounded-lg p-4">
              <p className="text-[10px] text-muted-foreground uppercase font-medium mb-2">Por etapa do funil</p>
              <div className="space-y-2">
                {stages.map((stage) => {
                  const count = stageCounts.find((s) => s.stage_id === stage.id)?.count ?? 0;
                  return (
                    <div key={stage.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                        <span className="text-[11px] text-muted-foreground">{stage.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-foreground tabular-nums">
                        {count.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Entries per day chart */}
      {entriesPerDay && entriesPerDay.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Entradas por Dia</h3>
          <p className="text-xs text-muted-foreground mb-4">Últimos 30 dias — todas as etapas</p>
          <div className="flex items-end gap-1 h-24">
            {entriesPerDay.map(({ date, count }) => {
              const h = chartMax > 0 ? (count / chartMax) * 100 : 0;
              const shortDate = date.slice(5); // MM-DD
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-0.5 group/bar">
                  <div className="relative flex-1 flex items-end w-full">
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${Math.max(h, 4)}%`,
                        backgroundColor: "hsl(var(--primary) / 0.7)",
                      }}
                      title={`${shortDate}: ${count.toLocaleString("pt-BR")} entradas`}
                    />
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover/bar:block bg-popover border border-border rounded px-1.5 py-0.5 text-[9px] text-foreground whitespace-nowrap z-10">
                      {date}: {count.toLocaleString("pt-BR")}
                    </div>
                  </div>
                  {entriesPerDay.length <= 14 && (
                    <span className="text-[8px] text-muted-foreground/60">{shortDate}</span>
                  )}
                </div>
              );
            })}
          </div>
          {entriesPerDay.length > 14 && (
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-muted-foreground/60">{entriesPerDay[0]?.date}</span>
              <span className="text-[9px] text-muted-foreground/60">{entriesPerDay[entriesPerDay.length - 1]?.date}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
