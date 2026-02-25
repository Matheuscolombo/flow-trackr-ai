import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, GitBranch, Users, TrendingUp, ChevronRight, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface FunnelStage {
  id: string;
  name: string;
  color: string;
}

interface CampaignFunnel {
  id: string;
  name: string;
  is_active: boolean;
  funnel_stages: FunnelStage[];
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  funnels: CampaignFunnel[];
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name, description, is_active, funnels(id, name, is_active, funnel_stages(id, name, color))")
        .order("created_at", { ascending: false });

      setCampaigns(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-foreground">Campanhas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? "Carregando..." : `${campaigns.length} campanhas · agrupe funis por lançamento ou desafio`}
          </p>
        </div>
        <Link to="/campaigns/new">
          <Button size="sm" className="h-8 text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Nova Campanha
          </Button>
        </Link>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Zap className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhuma campanha ainda</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Agrupe seus funis por lançamento ou desafio para comparar performance.
              A campanha "Base Histórica" será criada automaticamente após o primeiro login.
            </p>
            <Link to="/campaigns/new">
              <Button size="sm" className="h-8 text-xs gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Criar primeira campanha
              </Button>
            </Link>
          </div>
        ) : (
          campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-card border border-border rounded-lg p-5 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">{campaign.name}</h2>
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
                    {campaign.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{campaign.description}</p>
                    )}
                  </div>
                </div>

                <Link to={`/campaigns/${campaign.id}`}>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-border">
                    Ver Campanha
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>

              {/* Metrics row */}
              <div className="flex items-center gap-6 mb-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span className="font-semibold text-foreground">{campaign.funnels.length}</span>
                  <span>{campaign.funnels.length === 1 ? "funil" : "funis"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span className="font-semibold text-foreground">—</span>
                  <span>leads</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="font-semibold text-foreground">—%</span>
                  <span>conversão geral</span>
                </div>
              </div>

              {/* Funnels preview */}
              {campaign.funnels.length > 0 && (
                <div className="space-y-2">
                  {campaign.funnels.map((funnel) => (
                    <Link
                      key={funnel.id}
                      to={`/funnels/${funnel.id}`}
                      className="flex items-center gap-3 bg-background border border-border rounded-md px-3 py-2 hover:border-primary/30 transition-colors group"
                    >
                      <GitBranch className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      <span className="text-xs font-medium text-foreground flex-1">{funnel.name}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {(funnel.funnel_stages || []).slice(0, 5).map((stage) => (
                            <div
                              key={stage.id}
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: stage.color }}
                              title={stage.name}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {funnel.funnel_stages?.length || 0} etapas
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
