import { useState } from "react";
import type { SentinelAlert, AlertLevel } from "@/types";
import { AlertTriangle, Info, XCircle, Check, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const levelConfig: Record<AlertLevel, { icon: React.ElementType; color: string; label: string }> = {
  critical: { icon: XCircle, color: "text-sentinel-critical", label: "Crítico" },
  warning: { icon: AlertTriangle, color: "text-sentinel-warning", label: "Atenção" },
  info: { icon: Info, color: "text-sentinel-info", label: "Info" },
};

const levelBadgeClass: Record<AlertLevel, string> = {
  critical: "bg-sentinel-critical/15 text-sentinel-critical border-sentinel-critical/30",
  warning: "bg-sentinel-warning/15 text-sentinel-warning border-sentinel-warning/30",
  info: "bg-sentinel-info/15 text-sentinel-info border-sentinel-info/30",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface AlertCardProps {
  alert: SentinelAlert;
  onMarkRead: (id: string) => void;
}

export function AlertCard({ alert, onMarkRead }: AlertCardProps) {
  const config = levelConfig[alert.level];
  const Icon = config.icon;

  return (
    <div
      className={`bg-card border rounded-lg p-4 transition-all ${
        alert.is_read
          ? "border-border opacity-60"
          : "border-border hover:border-primary/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                className={`text-[9px] px-1.5 py-0 h-4 border font-medium ${levelBadgeClass[alert.level]}`}
                variant="outline"
              >
                {config.label}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{alert.funnel_name}</span>
              {alert.stage_name && (
                <>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">{alert.stage_name}</span>
                </>
              )}
            </div>
            {!alert.is_read && (
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => onMarkRead(alert.id)}
                title="Marcar como lido"
              >
                <Check className="w-3 h-3" />
              </Button>
            )}
          </div>

          <h4 className="text-xs font-semibold text-foreground mt-1.5">{alert.title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{alert.description}</p>

          <div className="flex items-center gap-4 mt-2">
            <div className="text-[10px] text-muted-foreground">
              Esperado:{" "}
              <span className="text-foreground font-medium">{alert.threshold_value}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Atual:{" "}
              <span className={`font-medium ${config.color}`}>{alert.actual_value}</span>
            </div>
            <div className="text-[10px] text-muted-foreground ml-auto">
              {formatDate(alert.created_at)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AlertsPanelProps {
  alerts: SentinelAlert[];
  compact?: boolean;
  showFilters?: boolean;
}

export function AlertsPanel({ alerts, compact = false, showFilters = false }: AlertsPanelProps) {
  const [localAlerts, setLocalAlerts] = useState(alerts);
  const [levelFilter, setLevelFilter] = useState<AlertLevel | "all">("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const markRead = (id: string) => {
    setLocalAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
    );
  };

  const filtered = localAlerts
    .filter((a) => levelFilter === "all" || a.level === levelFilter)
    .filter((a) => !showUnreadOnly || !a.is_read)
    .slice(0, compact ? 3 : undefined);

  const unreadCount = localAlerts.filter((a) => !a.is_read).length;

  return (
    <div className="flex flex-col gap-3">
      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          {(["all", "critical", "warning", "info"] as const).map((lvl) => (
            <Button
              key={lvl}
              size="sm"
              variant={levelFilter === lvl ? "default" : "ghost"}
              className="h-6 text-[10px] px-2"
              onClick={() => setLevelFilter(lvl)}
            >
              {lvl === "all" ? `Todos (${localAlerts.length})` : lvl}
            </Button>
          ))}
          <Button
            size="sm"
            variant={showUnreadOnly ? "default" : "ghost"}
            className="h-6 text-[10px] px-2 ml-auto"
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          >
            Não lidos ({unreadCount})
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">Nenhum alerta encontrado.</p>
        </div>
      ) : (
        filtered.map((alert) => (
          <AlertCard key={alert.id} alert={alert} onMarkRead={markRead} />
        ))
      )}
    </div>
  );
}
