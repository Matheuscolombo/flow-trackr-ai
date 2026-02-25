import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MetricsBar } from "@/components/metrics/MetricsBar";
import { AlertsPanel } from "@/components/alerts/AlertsPanel";
import { Upload, GitBranch, Users, DollarSign, TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  totalLeads: number;
  totalRevenue: number;
  totalBuyers: number;
  totalSales: number;
  totalFunnels: number;
}

import type { SentinelAlert } from "@/types";

const Index = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<SentinelAlert[]>([]);
  const [hasFunnels, setHasFunnels] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [metricsRes, funnelsRes, alertsRes, salesCountRes] = await Promise.all([
        supabase.rpc("get_leads_metrics"),
        supabase.from("funnels").select("id", { count: "exact", head: true }),
        supabase.from("sentinel_alerts").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("sale_events").select("id", { count: "exact", head: true }).eq("status", "paid"),
      ]);

      const totalFunnels = funnelsRes.count || 0;
      const totalSales = salesCountRes.count || 0;
      const m = Array.isArray(metricsRes.data) ? metricsRes.data[0] : metricsRes.data;
      const totalLeads = Number(m?.total_leads ?? 0);
      const totalRevenue = Number(m?.total_revenue ?? 0);
      const totalBuyers = Number(m?.total_buyers ?? 0);

      setStats({ totalLeads, totalRevenue, totalBuyers, totalSales, totalFunnels });
      setHasFunnels(totalFunnels > 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAlerts((alertsRes.data || []) as any);
      setLoading(false);
    }
    load();
  }, []);

  const unreadAlerts = alerts.filter((a) => !a.is_read);

  const metricsData = stats
    ? [
        {
          label: "Total de Leads",
          value: stats.totalLeads.toLocaleString("pt-BR"),
          icon: "users" as const,
          trend: null,
        },
        {
          label: "Compradores",
          value: stats.totalBuyers.toLocaleString("pt-BR"),
          icon: "credit-card" as const,
          trend: null,
        },
        {
          label: "Receita Total",
          value: `R$ ${stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          icon: "dollar" as const,
          trend: null,
        },
        {
          label: "Funis Ativos",
          value: stats.totalFunnels.toLocaleString("pt-BR"),
          icon: "funnel" as const,
          trend: null,
        },
      ]
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Visão geral do workspace</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : hasFunnels === false ? (
          /* Empty state — workspace still empty */
          <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <GitBranch className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-1">Workspace pronto</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Importe suas planilhas de vendas (Eduzz / Hotmart) para popular a plataforma com seus dados reais.
              A estrutura "Base Histórica" será criada automaticamente.
            </p>
            <div className="flex flex-col gap-2 w-full">
              <Link to="/leads">
                <Button className="w-full h-9 text-xs gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  Importar Vendas
                </Button>
              </Link>
              <Link to="/funnels/new">
                <Button variant="outline" className="w-full h-9 text-xs gap-2">
                  <GitBranch className="w-3.5 h-3.5" />
                  Criar primeiro funil
                </Button>
              </Link>
            </div>

            {/* Mini quick-stats even when empty */}
            <div className="grid grid-cols-3 gap-3 mt-8 w-full">
              {[
                { label: "Leads", value: "0", icon: Users },
                { label: "Receita", value: "R$ 0", icon: DollarSign },
                { label: "Funis", value: "0", icon: TrendingUp },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-card border border-border rounded-lg p-3 text-center">
                  <Icon className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-sm font-bold text-foreground">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* KPI bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {stats && [
                { label: "Total de Vendas", value: stats.totalSales.toLocaleString("pt-BR"), icon: DollarSign, color: "text-sentinel-success" },
                { label: "Leads", value: stats.totalLeads.toLocaleString("pt-BR"), icon: Users, color: "text-primary" },
                { label: "Receita Total (líquido)", value: `R$ ${stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-sentinel-success" },
                { label: "Funis Ativos", value: stats.totalFunnels.toLocaleString("pt-BR"), icon: GitBranch, color: "text-primary" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Alertas Recentes</h3>
                  {unreadAlerts.length > 0 && (
                    <span className="text-[10px] font-bold text-sentinel-critical bg-sentinel-critical/15 border border-sentinel-critical/30 px-1.5 py-0.5 rounded-full">
                      {unreadAlerts.length} novos
                    </span>
                  )}
                </div>
                <AlertsPanel alerts={alerts} compact={true} />
              </div>
            )}

            {/* CTA to import if no leads */}
            {stats && stats.totalLeads === 0 && (
              <div className="bg-card border border-border border-dashed rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground mb-1">Nenhum lead importado ainda</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Vá para Leads → Importar Vendas para carregar suas planilhas da Eduzz e Hotmart.
                </p>
                <Link to="/leads">
                  <Button size="sm" className="h-8 text-xs gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    Ir para Importação
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
