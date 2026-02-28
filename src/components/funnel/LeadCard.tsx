import { Clock, ExternalLink, GitBranch, UserPlus } from "lucide-react";
import type { Lead } from "@/types";
import { Badge } from "@/components/ui/badge";

const sourceColors: Record<string, string> = {
  n8n: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  zapier: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  api: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  manual: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  typebot: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  webhook: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

function formatTime(hours: number): string {
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface LeadCardProps {
  lead: Lead;
  funnelId?: string;
  onClick: (lead: Lead) => void;
}

export function LeadCard({ lead, funnelId, onClick }: LeadCardProps) {
  const initials = lead.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  // Posição específica deste funil (para mostrar tempo correto no kanban)
  const posForThisFunnel = funnelId
    ? lead.funnel_positions.find((p) => p.funnel_id === funnelId)
    : lead.funnel_positions[lead.funnel_positions.length - 1];

  const timeInStage = posForThisFunnel?.time_in_stage_hours ?? lead.time_in_stage_hours;
  const source = posForThisFunnel?.source ?? lead.source;

  // Outros funis que este lead também participa (além do atual)
  const otherFunnels = lead.funnel_positions.filter((p) => p.funnel_id !== funnelId);

  const hasRevenue = (lead.total_revenue ?? 0) > 0;
  const isMultiBuyer = (lead.purchase_count ?? 0) >= 2;

  return (
    <div
      onClick={() => onClick(lead)}
      className="bg-card border border-border rounded-md p-3 cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-all group"
    >
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-primary">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs font-medium text-foreground truncate">{lead.name}</p>
            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
          </div>
          <p className="text-[10px] text-muted-foreground truncate">{lead.phone}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <Badge
          className={`text-[9px] px-1.5 py-0 h-4 border font-medium ${
            sourceColors[source] || sourceColors.api
          }`}
          variant="outline"
        >
          {source}
        </Badge>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="w-2.5 h-2.5" />
          <span>{formatTime(timeInStage)}</span>
        </div>
      </div>

      {/* Valor da compra */}
      {hasRevenue && (
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-sentinel-success tabular-nums">
            {formatCurrency(lead.total_revenue)}
          </span>
          {isMultiBuyer && (
            <span className="text-[9px] font-bold text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">
              ×{lead.purchase_count}
            </span>
          )}
        </div>
      )}

      {/* Indicador de cadastros repetidos */}
      {(lead.signup_count ?? 1) > 1 && (
        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-yellow-400">
          <UserPlus className="w-2.5 h-2.5" />
          <span className="font-semibold">{lead.signup_count}x cadastros</span>
        </div>
      )}

      {/* Indicador discreto de multi-funil */}
      {otherFunnels.length > 0 && (
        <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground/70">
          <GitBranch className="w-2.5 h-2.5" />
          <span>também em +{otherFunnels.length} {otherFunnels.length === 1 ? "funil" : "funis"}</span>
        </div>
      )}
    </div>
  );
}
