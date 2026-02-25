import { TrendingUp, TrendingDown, Users, Percent, Zap, UserPlus } from "lucide-react";
import type { DashboardMetrics } from "@/types";

interface MetricsBarProps {
  metrics: DashboardMetrics;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  delta: number;
  icon: React.ElementType;
  format?: "number" | "percent";
}

function MetricCard({ label, value, delta, icon: Icon, format = "number" }: MetricCardProps) {
  const isPositive = delta >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? "text-sentinel-success" : "text-sentinel-critical";

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-md bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />
          <span>{Math.abs(delta)}%</span>
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground tabular-nums">
          {format === "percent" ? `${value}%` : value.toLocaleString("pt-BR")}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function MetricsBar({ metrics }: MetricsBarProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Leads Ativos Totais"
        value={metrics.total_active_leads}
        delta={metrics.total_active_leads_delta}
        icon={Users}
      />
      <MetricCard
        label="Taxa de Conversão Geral"
        value={metrics.overall_conversion_rate}
        delta={metrics.conversion_rate_delta}
        icon={Percent}
        format="percent"
      />
      <MetricCard
        label="Eventos Hoje"
        value={metrics.events_today}
        delta={metrics.events_today_delta}
        icon={Zap}
      />
      <MetricCard
        label="Leads Novos Hoje"
        value={metrics.new_leads_today}
        delta={metrics.new_leads_today_delta}
        icon={UserPlus}
      />
    </div>
  );
}
