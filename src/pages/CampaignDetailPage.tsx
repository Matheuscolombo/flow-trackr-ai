import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, GitBranch, Users, Trophy, Smartphone, MapPin, Zap, DollarSign, CreditCard, Star, Clock, Loader2, Trash2, Plus, Unlink, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";

const utmSourceColors: Record<string, string> = {
  facebook: "bg-blue-600/15 text-blue-400 border-blue-600/30",
  instagram: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  google: "bg-green-500/15 text-green-400 border-green-500/30",
  organic: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const pieColors = ["hsl(var(--primary))", "hsl(var(--primary) / 0.5)", "hsl(var(--primary) / 0.25)", "hsl(var(--muted-foreground))"];

interface CampaignRow {
  id: string; name: string; description: string | null; is_active: boolean; created_at: string; workspace_id: string;
}
interface FunnelStat {
  funnel_id: string; funnel_name: string; is_active: boolean; stage_count: number; lead_count: number; buyer_count: number; total_revenue: number;
}
interface CreativeRow {
  utm_content: string | null; utm_source: string | null; device: string | null; city: string | null;
  lead_count: number; buyer_count: number; total_revenue: number;
}
interface RevenueRow {
  product_name: string; platform: string; sale_count: number; total_net: number; total_gross: number; has_subscription: boolean;
}

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [funnelStats, setFunnelStats] = useState<FunnelStat[]>([]);
  const [creatives, setCreatives] = useState<CreativeRow[]>([]);
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddFunnel, setShowAddFunnel] = useState(false);
  const [availableFunnels, setAvailableFunnels] = useState<{ id: string; name: string; description: string | null; campaign_id: string | null }[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);

  const refetchAll = async () => {
    if (!id) return;
    const [statsRes, creativesRes, revenueRes] = await Promise.all([
      supabase.rpc("get_campaign_stats", { p_campaign_id: id }),
      supabase.rpc("get_campaign_creatives", { p_campaign_id: id }),
      supabase.rpc("get_campaign_revenue", { p_campaign_id: id }),
    ]);
    if (statsRes.data) setFunnelStats(statsRes.data as FunnelStat[]);
    if (creativesRes.data) setCreatives(creativesRes.data as CreativeRow[]);
    if (revenueRes.data) setRevenue(revenueRes.data as RevenueRow[]);
  };

  const fetchAvailableFunnels = async () => {
    if (!campaign) return;
    setLoadingAvailable(true);
    const { data } = await supabase
      .from("funnels")
      .select("id, name, description, campaign_id")
      .eq("workspace_id", campaign.workspace_id)
      .neq("campaign_id", campaign.id)
      .order("name");
    const { data: unlinked } = await supabase
      .from("funnels")
      .select("id, name, description, campaign_id")
      .eq("workspace_id", campaign.workspace_id)
      .is("campaign_id", null)
      .order("name");
    const merged = [...(data || []), ...(unlinked || [])];
    const unique = Array.from(new Map(merged.map(f => [f.id, f])).values());
    setAvailableFunnels(unique);
    setLoadingAvailable(false);
  };

  const handleAddFunnel = async (funnelId: string) => {
    if (!campaign) return;
    await supabase.from("funnels").update({ campaign_id: campaign.id }).eq("id", funnelId);
    setShowAddFunnel(false);
    await refetchAll();
  };

  const handleUnlinkFunnel = async (funnelId: string) => {
    await supabase.from("funnels").update({ campaign_id: null }).eq("id", funnelId);
    await refetchAll();
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    
    const fetchAll = async () => {
      // Fetch campaign
      const { data: camp, error: campErr } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (campErr || !camp) {
        setError(campErr?.message || "Campanha não encontrada");
        setLoading(false);
        return;
      }
      setCampaign(camp);
      setEditName(camp.name);
      setEditDesc(camp.description || "");

      // Fetch all RPCs in parallel
      const [statsRes, creativesRes, revenueRes] = await Promise.all([
        supabase.rpc("get_campaign_stats", { p_campaign_id: id }),
        supabase.rpc("get_campaign_creatives", { p_campaign_id: id }),
        supabase.rpc("get_campaign_revenue", { p_campaign_id: id }),
      ]);

      if (statsRes.data) setFunnelStats(statsRes.data as FunnelStat[]);
      if (creativesRes.data) setCreatives(creativesRes.data as CreativeRow[]);
      if (revenueRes.data) setRevenue(revenueRes.data as RevenueRow[]);
      setLoading(false);
    };

    fetchAll();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{error || "Campanha não encontrada."}</p>
          <Link to="/campaigns" className="text-xs text-primary hover:underline mt-2 block">
            Voltar para Campanhas
          </Link>
        </div>
      </div>
    );
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const totalLeads = funnelStats.reduce((a, f) => a + f.lead_count, 0);
  const totalBuyers = funnelStats.reduce((a, f) => a + f.buyer_count, 0);
  const totalRevenue = funnelStats.reduce((a, f) => a + Number(f.total_revenue), 0);
  const overallConversion = totalLeads > 0 ? Math.round((totalBuyers / totalLeads) * 1000) / 10 : 0;

  const sortedByConversion = [...funnelStats].sort((a, b) => {
    const convA = a.lead_count > 0 ? a.buyer_count / a.lead_count : 0;
    const convB = b.lead_count > 0 ? b.buyer_count / b.lead_count : 0;
    return convB - convA;
  });

  const chartData = funnelStats.map((f) => ({
    name: f.funnel_name.length > 18 ? f.funnel_name.slice(0, 18) + "…" : f.funnel_name,
    fullName: f.funnel_name,
    leads: f.lead_count,
    id: f.funnel_id,
  }));

  const bestFunnelId = sortedByConversion[0]?.funnel_id;

  // ── Creative aggregations ──────────────────────────────────────────────────
  const creativeRanking = (() => {
    const map: Record<string, { leads: number; buyers: number; revenue: number; devices: Record<string, number>; cities: Record<string, number>; sources: Record<string, number> }> = {};
    creatives.forEach((c) => {
      const key = c.utm_content || "(orgânico / sem criativo)";
      if (!map[key]) map[key] = { leads: 0, buyers: 0, revenue: 0, devices: {}, cities: {}, sources: {} };
      map[key].leads += c.lead_count;
      map[key].buyers += c.buyer_count;
      map[key].revenue += Number(c.total_revenue);
      const dev = c.device || "Desconhecido";
      map[key].devices[dev] = (map[key].devices[dev] || 0) + c.lead_count;
      const city = c.city || "Desconhecida";
      map[key].cities[city] = (map[key].cities[city] || 0) + c.lead_count;
      const src = c.utm_source || "organic";
      map[key].sources[src] = (map[key].sources[src] || 0) + c.lead_count;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].leads - a[1].leads)
      .map(([content, data]) => {
        const topDevice = Object.entries(data.devices).sort((a, b) => b[1] - a[1])[0];
        const topCity = Object.entries(data.cities).sort((a, b) => b[1] - a[1])[0];
        const topSource = Object.entries(data.sources).sort((a, b) => b[1] - a[1])[0];
        const devicePct = topDevice ? Math.round((topDevice[1] / data.leads) * 100) : 0;
        return {
          content,
          leads: data.leads,
          buyers: data.buyers,
          revenue: data.revenue,
          pct: totalLeads > 0 ? Math.round((data.leads / totalLeads) * 100) : 0,
          convRate: data.leads > 0 ? Math.round((data.buyers / data.leads) * 1000) / 10 : 0,
          revenuePerLead: data.leads > 0 ? data.revenue / data.leads : 0,
          topDevice: topDevice ? `${topDevice[0]} ${devicePct}%` : "—",
          topCity: topCity && topCity[0] !== "Desconhecida" ? topCity[0] : "—",
          topSource: topSource ? topSource[0] : "—",
        };
      });
  })();

  const deviceBreakdown = (() => {
    const counts: Record<string, number> = {};
    creatives.forEach((c) => {
      const d = c.device || "Desconhecido";
      counts[d] = (counts[d] || 0) + c.lead_count;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name, value,
        pct: totalLeads > 0 ? Math.round((value / totalLeads) * 100) : 0,
      }));
  })();

  const cityRanking = (() => {
    const map: Record<string, number> = {};
    creatives.forEach((c) => {
      if (!c.city) return;
      map[c.city] = (map[c.city] || 0) + c.lead_count;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([city, leads]) => ({
        city, leads,
        pct: totalLeads > 0 ? Math.round((leads / totalLeads) * 100) : 0,
      }));
  })();

  const sourceBreakdown = (() => {
    const map: Record<string, number> = {};
    creatives.forEach((c) => {
      const src = c.utm_source || "organic";
      map[src] = (map[src] || 0) + c.lead_count;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([source, leads]) => ({
        source, leads,
        pct: totalLeads > 0 ? Math.round((leads / totalLeads) * 100) : 0,
      }));
  })();

  // Revenue creative ranking (sorted by R$/lead)
  const creativeRankingRevenue = creativeRanking
    .filter((c) => c.revenue > 0)
    .sort((a, b) => b.revenuePerLead - a.revenuePerLead);
  const topByRPL = creativeRankingRevenue[0];

  // Revenue total from sale_events
  const totalSaleRevenue = revenue.reduce((a, r) => a + Number(r.total_net), 0);
  const totalGrossRevenue = revenue.reduce((a, r) => a + Number(r.total_gross), 0);
  const totalSaleCount = revenue.reduce((a, r) => a + r.sale_count, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3 mb-1">
          <Link to="/campaigns">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-foreground">{campaign.name}</h1>
            <Badge
              className={`text-[9px] px-1.5 py-0 h-4 border ${
                campaign.is_active
                  ? "bg-sentinel-success/15 text-sentinel-success border-sentinel-success/30"
                  : "bg-muted text-muted-foreground border-border"
              }`}
              variant="outline"
            >
              {campaign.is_active ? "Ativa" : "Inativa"}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground pl-10">{campaign.description}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="overview">
          <TabsList className="mb-5 h-8 text-xs">
            <TabsTrigger value="overview" className="text-xs h-6 px-3">Visão Geral</TabsTrigger>
            <TabsTrigger value="compare" className="text-xs h-6 px-3">Comparar Funis</TabsTrigger>
            <TabsTrigger value="criativos" className="text-xs h-6 px-3">Criativos</TabsTrigger>
            <TabsTrigger value="receita" className="text-xs h-6 px-3">💰 Receita</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs h-6 px-3">Configurações</TabsTrigger>
          </TabsList>

          {/* TAB 1 — Overview */}
          <TabsContent value="overview" className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total de Leads", value: totalLeads.toLocaleString("pt-BR"), icon: Users },
                { label: "Funis Ativos", value: funnelStats.filter(f => f.is_active).length, icon: GitBranch },
                { label: "Conversão Geral", value: `${overallConversion}%`, icon: BarChart3 },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {chartData.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Leads por Funil</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                      formatter={(value: number, _: string, entry: { payload: { fullName: string } }) => [value, entry.payload.fullName]}
                    />
                    <Bar dataKey="leads" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.id}
                          fill={entry.id === bestFunnelId ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Ranking por Conversão</h3>
              <div className="space-y-2">
                {sortedByConversion.map((funnel, i) => {
                  const conv = funnel.lead_count > 0 ? Math.round((funnel.buyer_count / funnel.lead_count) * 1000) / 10 : 0;
                  return (
                    <div key={funnel.funnel_id} className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {i + 1}
                      </span>
                      {i === 0 && <Trophy className="w-3 h-3 text-primary shrink-0" />}
                      <span className="text-xs text-foreground flex-1 truncate">{funnel.funnel_name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min((conv / 30) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-foreground tabular-nums w-10 text-right">
                          {conv}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* TAB 2 — Compare */}
          <TabsContent value="compare">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-muted-foreground font-medium">Funil</th>
                    <th className="text-right px-4 py-3 text-muted-foreground font-medium">Leads</th>
                    <th className="text-right px-4 py-3 text-muted-foreground font-medium">Conversão</th>
                    <th className="text-right px-4 py-3 text-muted-foreground font-medium">Etapas</th>
                    <th className="text-right px-4 py-3 text-muted-foreground font-medium">Receita</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {sortedByConversion.map((funnel) => {
                    const conv = funnel.lead_count > 0 ? Math.round((funnel.buyer_count / funnel.lead_count) * 1000) / 10 : 0;
                    const isBest = funnel.funnel_id === bestFunnelId;
                    return (
                      <tr
                        key={funnel.funnel_id}
                        className={`border-b border-border/50 ${isBest ? "bg-primary/5" : "hover:bg-muted/30"}`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {isBest && <Trophy className="w-3 h-3 text-primary shrink-0" />}
                            <span className={`font-medium ${isBest ? "text-primary" : "text-foreground"}`}>
                              {funnel.funnel_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-foreground">
                          {funnel.lead_count}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={isBest ? "text-primary font-bold" : "text-foreground"}>
                            {conv}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {funnel.stage_count}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">
                          R$ {Number(funnel.total_revenue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link to={`/funnels/${funnel.funnel_id}`}>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground">
                              Abrir
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* TAB 3 — Criativos */}
          <TabsContent value="criativos" className="space-y-5">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Ranking de Criativos</h3>
                <span className="text-xs text-muted-foreground ml-1">por leads captados</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-2.5 text-muted-foreground font-medium">#</th>
                    <th className="text-left px-2 py-2.5 text-muted-foreground font-medium">Criativo</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Leads</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">% Total</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Dispositivo Top</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Cidade Top</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {creativeRanking.map((row, i) => (
                    <tr
                      key={row.content}
                      className={`border-b border-border/50 ${i === 0 ? "bg-primary/5" : "hover:bg-muted/20"}`}
                    >
                      <td className="px-5 py-3">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <span className={`font-mono text-[11px] ${i === 0 ? "text-primary font-semibold" : "text-foreground"}`}>
                          {row.content}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-foreground">
                        {row.leads}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${i === 0 ? "bg-primary" : "bg-primary/50"}`}
                              style={{ width: `${row.pct}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground tabular-nums w-8">{row.pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.topDevice}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.topCity}</td>
                      <td className="px-4 py-3">
                        {row.topSource !== "—" && (
                          <Badge
                            className={`text-[9px] px-1.5 py-0 h-4 border capitalize ${
                              utmSourceColors[row.topSource] || "bg-muted text-muted-foreground border-border"
                            }`}
                            variant="outline"
                          >
                            {row.topSource}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Dispositivos + Cidades */}
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Smartphone className="w-3.5 h-3.5 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Dispositivos</h3>
                </div>
                <div className="flex items-center gap-4">
                  <PieChart width={110} height={110}>
                    <Pie
                      data={deviceBreakdown}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      paddingAngle={2}
                    >
                      {deviceBreakdown.map((_, index) => (
                        <Cell key={index} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }}
                    />
                  </PieChart>
                  <div className="flex-1 space-y-2">
                    {deviceBreakdown.map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: pieColors[i % pieColors.length] }} />
                          <span className="text-xs text-foreground">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground tabular-nums">{item.value}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">({item.pct}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Top 5 Cidades</h3>
                </div>
                <div className="space-y-2.5">
                  {cityRanking.map((item, i) => (
                    <div key={item.city} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold w-3.5 ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {i + 1}
                          </span>
                          <span className="text-xs text-foreground">{item.city}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground tabular-nums">{item.leads}</span>
                          <span className="text-[10px] text-muted-foreground">({item.pct}%)</span>
                        </div>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${i === 0 ? "bg-primary" : "bg-primary/40"}`}
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Fontes */}
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Fontes de Tráfego</h3>
                <span className="text-xs text-muted-foreground ml-1">leads por canal</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {sourceBreakdown.map((item) => (
                  <div key={item.source} className="bg-muted/40 border border-border rounded-lg p-3 space-y-1">
                    <Badge
                      className={`text-[9px] px-1.5 py-0 h-4 border capitalize ${
                        utmSourceColors[item.source] || "bg-muted text-muted-foreground border-border"
                      }`}
                      variant="outline"
                    >
                      {item.source}
                    </Badge>
                    <p className="text-xl font-bold text-foreground tabular-nums">{item.leads}</p>
                    <p className="text-[10px] text-muted-foreground">{item.pct}% dos leads</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* TAB 4 — Receita */}
          <TabsContent value="receita" className="space-y-5">
            {revenue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <DollarSign className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground">Nenhuma venda importada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Importe os CSVs da Eduzz ou Hotmart na página de Leads para ver os dados de receita.
                </p>
              </div>
            ) : (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: "Receita bruta total", value: `R$ ${totalGrossRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign },
                    { label: "Receita líquida total", value: `R$ ${totalSaleRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign },
                    { label: "Vendas processadas", value: totalSaleCount, icon: CreditCard },
                    { label: "Compradores", value: totalBuyers, icon: Star },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ranking Criativos por R$ */}
                {creativeRankingRevenue.length > 0 && (
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Ranking de Criativos por R$</h3>
                      <span className="text-xs text-muted-foreground ml-1">linha dourada = maior R$/lead</span>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-5 py-2.5 text-muted-foreground font-medium">#</th>
                          <th className="text-left px-2 py-2.5 text-muted-foreground font-medium">Criativo</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Leads</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Compradores</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Conversão</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Receita Líq.</th>
                          <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">R$/Lead</th>
                        </tr>
                      </thead>
                      <tbody>
                        {creativeRankingRevenue.map((row, i) => {
                          const isTopRPL = row.content === topByRPL?.content;
                          return (
                            <tr
                              key={row.content}
                              className={`border-b border-border/50 ${isTopRPL ? "bg-amber-500/8" : "hover:bg-muted/20"}`}
                            >
                              <td className="px-5 py-3">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  isTopRPL ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                                }`}>
                                  {i + 1}
                                </span>
                              </td>
                              <td className="px-2 py-3">
                                <div className="flex items-center gap-1.5">
                                  {isTopRPL && <Trophy className="w-3 h-3 text-amber-400 shrink-0" />}
                                  <span className={`font-mono text-[11px] ${isTopRPL ? "text-amber-400 font-semibold" : "text-foreground"}`}>
                                    {row.content}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{row.leads}</td>
                              <td className="px-4 py-3 text-right tabular-nums font-bold text-foreground">{row.buyers}</td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                <span className={isTopRPL ? "text-amber-400 font-semibold" : "text-foreground"}>
                                  {row.convRate}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-bold text-foreground">
                                R$ {row.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                <span className={`font-bold ${isTopRPL ? "text-amber-400" : "text-foreground"}`}>
                                  R$ {row.revenuePerLead.toFixed(2).replace(".", ",")}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Produtos mais vendidos */}
                <div className="bg-card border border-border rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Produtos mais vendidos</h3>
                    <span className="text-xs text-muted-foreground ml-1">nesta campanha</span>
                  </div>
                  <div className="space-y-2">
                    {revenue.map((product, i) => (
                      <div key={product.product_name} className="flex items-center gap-3">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          {i + 1}
                        </span>
                        <span className="text-xs text-foreground flex-1 truncate">{product.product_name}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{product.sale_count} vendas</span>
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${Math.min((Number(product.total_net) / Number(revenue[0].total_net)) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums w-24 text-right">
                            Bruto: R$ {Number(product.total_gross).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs font-bold text-foreground tabular-nums w-28 text-right">
                            Líq: R$ {Number(product.total_net).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* TAB 5 — Settings */}
          <TabsContent value="settings">
            <div className="max-w-xl space-y-4">
              <div className="bg-card border border-border rounded-lg p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Informações</h3>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Nome da campanha</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-9 text-xs px-3 rounded-md border border-border bg-background text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Descrição</label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={3}
                    className="w-full text-xs px-3 py-2 rounded-md border border-border bg-background text-foreground resize-none"
                  />
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    const { error } = await supabase
                      .from("campaigns")
                      .update({ name: editName, description: editDesc })
                      .eq("id", campaign.id);
                    setSaving(false);
                    if (error) {
                      alert("Erro ao salvar: " + error.message);
                    } else {
                      setCampaign({ ...campaign, name: editName, description: editDesc });
                    }
                  }}
                >
                  {saving ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>

              <div className="bg-card border border-border rounded-lg p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Funis desta Campanha</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] px-2.5 gap-1"
                    onClick={() => {
                      fetchAvailableFunnels();
                      setShowAddFunnel(true);
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    Adicionar Funil
                  </Button>
                </div>
                {funnelStats.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum funil vinculado a esta campanha.</p>
                )}
                {funnelStats.map((funnel) => (
                  <div key={funnel.funnel_id} className="flex items-center gap-2 py-1">
                    <GitBranch className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground flex-1">{funnel.funnel_name}</span>
                    <Link to={`/funnels/${funnel.funnel_id}`}>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-primary hover:text-primary">
                        Gerenciar
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] px-2 text-destructive hover:text-destructive gap-1"
                      onClick={() => handleUnlinkFunnel(funnel.funnel_id)}
                    >
                      <Unlink className="w-3 h-3" />
                      Desvincular
                    </Button>
                  </div>
                ))}
              </div>

              {/* Dialog para adicionar funil */}
              <Dialog open={showAddFunnel} onOpenChange={setShowAddFunnel}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-sm">Adicionar Funil à Campanha</DialogTitle>
                    <DialogDescription className="text-xs">
                      Selecione um funil para vincular a "{campaign.name}".
                    </DialogDescription>
                  </DialogHeader>
                  {loadingAvailable ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : availableFunnels.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Todos os funis já estão vinculados a esta campanha.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {availableFunnels.map((funnel) => (
                        <button
                          key={funnel.id}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left"
                          onClick={() => handleAddFunnel(funnel.id)}
                        >
                          <GitBranch className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{funnel.name}</p>
                            {funnel.description && (
                              <p className="text-[10px] text-muted-foreground truncate">{funnel.description}</p>
                            )}
                          </div>
                          {funnel.campaign_id && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-500 shrink-0">
                              <AlertTriangle className="w-3 h-3" />
                              Outra campanha
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* Zona de perigo */}
              <div className="bg-card border border-destructive/30 rounded-lg p-5 space-y-3">
                <h3 className="text-sm font-semibold text-destructive">Zona de Perigo</h3>
                <p className="text-xs text-muted-foreground">
                  Excluir esta campanha irá desvinculá-la de todos os funis. Os funis e leads não serão excluídos.
                </p>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 text-xs gap-1.5"
                  onClick={async () => {
                    if (!confirm(`Tem certeza que deseja excluir a campanha "${campaign.name}"?`)) return;
                    // Unlink funnels first
                    await supabase.from("funnels").update({ campaign_id: null }).eq("campaign_id", campaign.id);
                    // Delete campaign
                    const { error } = await supabase.from("campaigns").delete().eq("id", campaign.id);
                    if (error) {
                      alert("Erro ao excluir: " + error.message);
                      return;
                    }
                    navigate("/campaigns");
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir Campanha
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
