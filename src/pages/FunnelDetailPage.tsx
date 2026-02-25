import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Settings, Webhook, Columns, ChevronRight, Loader2, Clock, TrendingUp, BarChart2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { KanbanBoard } from "@/components/funnel/KanbanBoard";
import { WebhookConfig } from "@/components/funnel/WebhookConfig";
import { FunnelVisual } from "@/components/funnel/FunnelVisual";
import { Badge } from "@/components/ui/badge";
import type { FunnelStage, Lead } from "@/types";

type Tab = "kanban" | "funnel" | "config" | "webhook";

interface DbFunnel {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  webhook_token: string;
  campaign_id: string | null;
  workspace_id: string;
  created_at: string;
}

interface DbStageRule {
  id: string;
  funnel_id: string;
  event_name: string;
  from_stage_id: string | null;
  to_stage_id: string;
  priority: number;
  created_at: string;
}

interface DbCampaign {
  id: string;
  name: string;
}

interface StageCount {
  stage_id: string;
  count: number;
}

function adaptLeadForKanban(
  row: { stage_id: string; entered_at: string; source: string; leads: { id: string; name: string | null; email: string | null; phone: string | null; utm_source: string | null; total_revenue: number; purchase_count: number; is_ghost: boolean; created_at: string; source: string } },
  stage: FunnelStage,
  funnelId: string
): Lead {
  const entered = new Date(row.entered_at);
  const hoursInStage = (Date.now() - entered.getTime()) / 3_600_000;
  const posSource = row.source !== "system" ? row.source : null;
  const src = (posSource || row.leads.source || row.leads.utm_source || "webhook") as Lead["source"];
  return {
    id: row.leads.id,
    workspace_id: "",
    name: row.leads.name || "Sem nome",
    email: row.leads.email || "",
    phone: row.leads.phone || "",
    source: src,
    attribution: {
      utm_source: row.leads.utm_source,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      referral_source: null,
      device: null,
      city: null,
      region: null,
      country: null,
      page_url: null,
      form_id: null,
      converted_at: null,
    },
    metadata: {},
    created_at: row.leads.created_at || row.entered_at,
    funnel_positions: [{
      id: "",
      lead_id: row.leads.id,
      funnel_id: funnelId,
      funnel_name: stage.name,
      current_stage_id: row.stage_id,
      current_stage_name: stage.name,
      entered_at: row.entered_at,
      converted_at: null,
      page_url: null,
      time_in_stage_hours: Math.floor(hoursInStage),
      moved_by: "webhook",
      source: src,
    }],
    primary_funnel_id: funnelId,
    primary_funnel_name: stage.name,
    primary_stage_id: row.stage_id,
    primary_stage_name: stage.name,
    time_in_stage_hours: Math.floor(hoursInStage),
    funnel_name: stage.name,
    current_stage_name: stage.name,
    total_revenue: row.leads.total_revenue,
    purchase_count: row.leads.purchase_count,
  };
}

const FunnelDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("kanban");
  const [sortBy, setSortBy] = useState<"recent" | "value">("recent");
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSaveName = async () => {
    setEditingName(false);
    const trimmed = editName.trim();
    if (!trimmed || !funnel || trimmed === funnel.name) return;
    const { error } = await supabase.from("funnels").update({ name: trimmed }).eq("id", funnel.id);
    if (error) {
      toast({ title: "Erro ao renomear", description: error.message, variant: "destructive" });
      return;
    }
    setFunnel({ ...funnel, name: trimmed });
  };

  const [funnel, setFunnel] = useState<DbFunnel | null>(null);
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [rules, setRules] = useState<DbStageRule[]>([]);
  const [campaign, setCampaign] = useState<DbCampaign | null>(null);
  const [stageCounts, setStageCounts] = useState<StageCount[]>([]);
  const [leadsByStage, setLeadsByStage] = useState<Record<string, Lead[]>>({});
  const [leadsBuyerStats, setLeadsBuyerStats] = useState<{ singleBuyers: number; multiBuyers: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);

    Promise.all([
      supabase.from("funnels").select("*").eq("id", id).single(),
      supabase.from("funnel_stages").select("*").eq("funnel_id", id).order("order_index"),
      supabase.from("stage_transition_rules").select("*").eq("funnel_id", id).order("priority"),
    ]).then(async ([funnelRes, stagesRes, rulesRes]) => {
      if (funnelRes.error || !funnelRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const funnelData = funnelRes.data as DbFunnel;
      const stageList = (stagesRes.data || []) as FunnelStage[];
      setFunnel(funnelData);
      setStages(stageList);
      setRules((rulesRes.data || []) as DbStageRule[]);

      // Load campaign if linked
      if (funnelData.campaign_id) {
        const { data: camp } = await supabase
          .from("campaigns")
          .select("id, name")
          .eq("id", funnelData.campaign_id)
          .single();
        if (camp) setCampaign(camp as DbCampaign);
      }

      const stageIds = stageList.map((s) => s.id);
        if (stageIds.length > 0) {
          // Count leads per stage using count:exact to bypass the 1000-row default limit
          const countResults = await Promise.all(
            stageIds.map((stageId) =>
              supabase
                .from("lead_funnel_stages")
                .select("*", { count: "exact", head: true })
                .eq("funnel_id", id)
                .eq("stage_id", stageId)
                .then(({ count }) => ({ stage_id: stageId, count: count ?? 0 }))
            )
          );
          setStageCounts(countResults);

          // Fetch leads per stage (up to 200 per stage), ordered by entered_at desc (default)
          const stageMap: Record<string, FunnelStage> = {};
          stageList.forEach((s) => { stageMap[s.id] = s; });

          const byStage: Record<string, Lead[]> = {};
          stageList.forEach((s) => { byStage[s.id] = []; });

          await Promise.all(
            stageIds.map(async (stageId) => {
              const { data: lfsRows } = await supabase
                .from("lead_funnel_stages")
                .select("stage_id, entered_at, source, leads(id, name, email, phone, utm_source, total_revenue, purchase_count, is_ghost, created_at, imported_at, source)")
                .eq("funnel_id", id)
                .eq("stage_id", stageId)
                .order("entered_at", { ascending: false })
                .limit(200);

              const stage = stageMap[stageId];
              if (!stage) return;
              byStage[stageId] = (lfsRows || [])
                .filter((row: any) => row.leads)
                .map((row: any) => adaptLeadForKanban(row, stage, id));
            })
          );

          setLeadsByStage(byStage);
        }

          // Fetch real buyer stats server-side (entire funnel, no row limit)
          const { data: buyerStats } = await supabase
            .rpc("get_funnel_buyer_stats" as any, { p_funnel_id: id });
          if (buyerStats && buyerStats.length > 0) {
            const row = buyerStats[0];
            setLeadsBuyerStats({
              singleBuyers: Number(row.single_buyers ?? 0),
              multiBuyers: Number(row.multi_buyers ?? 0),
            });
          }

      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (notFound || !funnel) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Funil não encontrado.</p>
          <Link to="/funnels" className="text-xs text-primary hover:underline mt-2 block">
            Voltar para Funis
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "kanban", label: "Kanban", icon: Columns },
    { id: "funnel", label: "Funil", icon: BarChart2 },
    { id: "config", label: "Configuração", icon: Settings },
    { id: "webhook", label: "Webhook", icon: Webhook },
  ];

  // Build a compatible funnel object for WebhookConfig
  const funnelForWebhook = {
    ...funnel,
    stages,
    rules,
    total_leads: stageCounts.reduce((a, b) => a + b.count, 0),
    conversion_rate: 0,
  };




  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
          <Link to="/campaigns" className="hover:text-foreground transition-colors">Campanhas</Link>
          {campaign && (
            <>
              <ChevronRight className="w-2.5 h-2.5" />
              <Link to={`/campaigns/${campaign.id}`} className="hover:text-foreground transition-colors">
                {campaign.name}
              </Link>
            </>
          )}
          <ChevronRight className="w-2.5 h-2.5" />
          <span className="text-foreground">{funnel.name}</span>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <Link to={campaign ? `/campaigns/${campaign.id}` : "/funnels"}>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              {editingName ? (
                <Input
                  ref={nameInputRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                  className="h-7 text-base font-bold w-56"
                  autoFocus
                />
              ) : (
                <h1
                  className="text-base font-bold text-foreground cursor-pointer hover:text-primary transition-colors group/name flex items-center gap-1.5"
                  onClick={() => { setEditName(funnel.name); setEditingName(true); }}
                >
                  {funnel.name}
                  <Pencil className="w-3 h-3 opacity-0 group-hover/name:opacity-50 transition-opacity" />
                </h1>
              )}
              <Badge
                className={`text-[9px] px-1.5 py-0 h-4 ${
                  funnel.is_active
                    ? "bg-sentinel-success/15 text-sentinel-success border-sentinel-success/30"
                    : "bg-muted text-muted-foreground border-border"
                }`}
                variant="outline"
              >
                {funnel.is_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            {funnel.description && (
              <p className="text-xs text-muted-foreground">{funnel.description}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "kanban" && (
          <div className="space-y-3">
            {/* Stage summary cards */}
            <div className="flex gap-3 flex-wrap">
              {stages.map((stage) => {
                const count = stageCounts.find((c) => c.stage_id === stage.id)?.count || 0;
                return (
                  <div key={stage.id} className="bg-card border border-border rounded-lg px-4 py-3 min-w-[120px]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                      <span className="text-[10px] text-muted-foreground font-medium truncate">{stage.name}</span>
                    </div>
                    <p className="text-lg font-bold text-foreground tabular-nums">{count}</p>
                    <p className="text-[10px] text-muted-foreground">leads</p>
                  </div>
                );
              })}
            </div>

            {/* Sort toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Ordenar:</span>
              <button
                onClick={() => setSortBy("recent")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                  sortBy === "recent"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Clock className="w-2.5 h-2.5" />
                Mais recentes
              </button>
              <button
                onClick={() => setSortBy("value")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                  sortBy === "value"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <TrendingUp className="w-2.5 h-2.5" />
                Maior valor
              </button>
            </div>

            <KanbanBoard
              stages={stages}
              leadsByStage={leadsByStage}
              funnelId={funnel.id}
              stageCounts={Object.fromEntries(stageCounts.map((c) => [c.stage_id, c.count]))}
              sortBy={sortBy}
            />
          </div>
        )}

        {activeTab === "funnel" && (
          <FunnelVisual
            stages={stages}
            stageCounts={stageCounts}
            funnelId={funnel.id}
            leadsBuyerStats={leadsBuyerStats}
          />
        )}

        {activeTab === "config" && (
          <div className="bg-card border border-border rounded-lg p-5 space-y-4 max-w-2xl">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Etapas do funil</h3>
              <div className="space-y-1.5 mt-3">
                {stages.map((stage, i) => (
                  <div key={stage.id} className="flex items-center gap-3 bg-background border border-border rounded-md px-3 py-2">
                    <span className="text-[10px] text-muted-foreground w-4 text-right">{i + 1}</span>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                    <span className="text-xs text-foreground flex-1">{stage.name}</span>
                  </div>
                ))}
                {stages.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma etapa configurada.</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1 mt-4">Regras de Transição</h3>
              <div className="space-y-1.5 mt-3">
                {rules.map((rule) => {
                  const toStage = stages.find((s) => s.id === rule.to_stage_id);
                  return (
                    <div key={rule.id} className="flex items-center gap-3 bg-background border border-border rounded-md px-3 py-2">
                      <code className="text-xs font-mono text-primary flex-1">{rule.event_name}</code>
                      <span className="text-muted-foreground text-xs">→</span>
                      <div className="flex items-center gap-1.5">
                        {toStage && (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: toStage.color }} />
                        )}
                        <span className="text-xs text-foreground">{toStage?.name || "—"}</span>
                      </div>
                    </div>
                  );
                })}
                {rules.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma regra configurada.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "webhook" && (
          <div className="max-w-2xl">
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Configuração do Webhook</h3>
              <WebhookConfig funnel={funnelForWebhook as any} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FunnelDetailPage;
