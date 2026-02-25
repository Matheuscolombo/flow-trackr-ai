import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlertsPanel } from "@/components/alerts/AlertsPanel";
import { SalesBreakdown } from "@/components/insights/SalesBreakdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SentinelAlert } from "@/types";

const InsightsPage = () => {
  const { workspaceId } = useAuth();

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["sentinel-alerts", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sentinel_alerts")
        .select("*, funnels(name), funnel_stages(name)")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row): SentinelAlert => ({
        id: row.id,
        workspace_id: row.workspace_id,
        funnel_id: row.funnel_id ?? "",
        funnel_name: (row.funnels as any)?.name ?? "—",
        stage_id: row.stage_id,
        stage_name: (row.funnel_stages as any)?.name ?? null,
        alert_type: row.alert_type as SentinelAlert["alert_type"],
        level: row.level as SentinelAlert["level"],
        title: row.title,
        description: row.description ?? "",
        threshold_value: row.threshold_value ?? 0,
        actual_value: row.actual_value ?? 0,
        is_read: row.is_read,
        created_at: row.created_at,
      }));
    },
  });

  const unread = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-bold text-foreground">Insights</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Motor de anomalias e analytics de vendas
              {unread > 0 && (
                <>
                  {" · "}
                  <span className="text-sentinel-critical font-medium">{unread} não lidos</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="analytics">Analytics de Vendas</TabsTrigger>
            <TabsTrigger value="alertas">
              Alertas{unread > 0 ? ` (${unread})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <SalesBreakdown />
          </TabsContent>

          <TabsContent value="alertas">
            {alertsLoading ? (
              <p className="text-sm text-muted-foreground">Carregando alertas...</p>
            ) : (
              <AlertsPanel alerts={alerts} showFilters={true} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default InsightsPage;
