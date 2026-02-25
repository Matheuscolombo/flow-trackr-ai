import { getConversionRate } from "@/data/mock";
import type { FunnelMetrics } from "@/types";
import { ArrowDown, Clock } from "lucide-react";

interface FunnelChartProps {
  metrics: FunnelMetrics[];
}

function formatTime(seconds: number): string {
  if (seconds === 0) return "—";
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  return `${hours}h`;
}

export function FunnelChart({ metrics }: FunnelChartProps) {
  if (!metrics.length) return null;

  const maxLeads = Math.max(...metrics.map((m) => m.total_leads));

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Funil de Conversão</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Distribuição de leads por etapa</p>
        </div>
      </div>

      <div className="flex items-end gap-2 h-48">
        {metrics.map((stage, idx) => {
          const nextStage = metrics[idx + 1];
          const barHeight = maxLeads > 0 ? (stage.total_leads / maxLeads) * 100 : 0;
          const convRate = nextStage
            ? getConversionRate(stage.total_leads, nextStage.total_leads)
            : null;
          const dropRate = 100 - (convRate ?? 100);

          return (
            <div key={stage.stage_id} className="flex-1 flex flex-col items-center gap-1">
              {/* Conversion arrow */}
              {idx > 0 && (
                <div className="absolute" />
              )}
              {/* Bar */}
              <div className="w-full flex flex-col justify-end" style={{ height: "100%" }}>
                <div className="relative group">
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 bg-popover border border-border rounded-md px-3 py-2 text-xs shadow-xl whitespace-nowrap">
                    <p className="font-semibold text-foreground">{stage.stage_name}</p>
                    <p className="text-muted-foreground">{stage.total_leads} leads</p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Tempo médio: {formatTime(stage.avg_time_seconds)}
                    </p>
                    {convRate !== null && (
                      <p className="text-sentinel-critical flex items-center gap-1">
                        <ArrowDown className="w-3 h-3" /> Abandono: {dropRate.toFixed(1)}%
                      </p>
                    )}
                  </div>

                  <div
                    className="w-full rounded-t-sm transition-all duration-300 hover:opacity-80 cursor-pointer"
                    style={{
                      height: `${Math.max(barHeight, 8)}%`,
                      minHeight: "20px",
                      background: `linear-gradient(180deg, hsl(217 100% 65%), hsl(217 100% 45%))`,
                      opacity: 1 - idx * 0.12,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stage labels + conversion rates */}
      <div className="flex gap-2 mt-3">
        {metrics.map((stage, idx) => {
          const nextStage = metrics[idx + 1];
          const convRate = nextStage
            ? getConversionRate(stage.total_leads, nextStage.total_leads)
            : null;

          return (
            <div key={stage.stage_id} className="flex-1 flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground text-center leading-tight truncate w-full text-center">
                {stage.stage_name}
              </span>
              <span className="text-xs font-bold text-foreground tabular-nums">
                {stage.total_leads}
              </span>
              {convRate !== null && (
                <div className="flex items-center gap-0.5 mt-1">
                  <ArrowDown className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-sentinel-success">{convRate}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
