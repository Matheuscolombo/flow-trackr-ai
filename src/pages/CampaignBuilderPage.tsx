import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, GitBranch, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface RealFunnel {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  funnel_stages: { color: string }[];
  lead_count: number;
}

export default function CampaignBuilderPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { workspaceId } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFunnelIds, setSelectedFunnelIds] = useState<string[]>([]);
  const [funnels, setFunnels] = useState<RealFunnel[]>([]);
  const [loadingFunnels, setLoadingFunnels] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    supabase
      .from("funnels")
      .select("id, name, description, is_active, funnel_stages(color)")
      .eq("workspace_id", workspaceId)
      .order("name")
      .then(async ({ data: funnelData }) => {
        if (!funnelData) { setLoadingFunnels(false); return; }

        // Count leads per funnel
        const withCounts: RealFunnel[] = await Promise.all(
          funnelData.map(async (f) => {
            const { count } = await supabase
              .from("lead_funnel_stages")
              .select("id", { count: "exact", head: true })
              .eq("funnel_id", f.id);
            return { ...f, lead_count: count ?? 0 };
          })
        );
        setFunnels(withCounts);
        setLoadingFunnels(false);
      });
  }, [workspaceId]);

  const toggleFunnel = (id: string) => {
    setSelectedFunnelIds((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", description: "Dê um nome para a campanha.", variant: "destructive" });
      return;
    }
    if (!workspaceId) return;
    setSaving(true);

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert({ workspace_id: workspaceId, name: name.trim(), description: description.trim() || null, is_active: true })
      .select("id")
      .single();

    if (error || !campaign) {
      toast({ title: "Erro ao criar campanha", variant: "destructive" });
      setSaving(false);
      return;
    }

    // Link selected funnels to this campaign
    if (selectedFunnelIds.length > 0) {
      await Promise.all(
        selectedFunnelIds.map((fId) =>
          supabase.from("funnels").update({ campaign_id: campaign.id }).eq("id", fId)
        )
      );
    }

    toast({ title: "Campanha criada!", description: `"${name}" criada com ${selectedFunnelIds.length} funil(is).` });
    navigate("/campaigns");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link to="/campaigns">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-base font-bold text-foreground">Nova Campanha</h1>
            <p className="text-xs text-muted-foreground">Agrupe funis de um mesmo lançamento ou desafio</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-xl space-y-6">
          {/* Name & description */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Informações da Campanha</h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Nome *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Desafio Protocolo Antidoenças"
                className="h-9 text-xs bg-background border-border"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Descrição</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o objetivo desta campanha..."
                rows={3}
                className="text-xs bg-background border-border resize-none"
              />
            </div>
          </div>

          {/* Funnel selection */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Funis incluídos</h2>
              <span className="text-xs text-muted-foreground">{selectedFunnelIds.length} selecionado(s)</span>
            </div>

            {loadingFunnels ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Carregando funis...</span>
              </div>
            ) : funnels.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum funil criado ainda.</p>
            ) : (
              <div className="space-y-2">
                {funnels.map((funnel) => {
                  const selected = selectedFunnelIds.includes(funnel.id);
                  return (
                    <button
                      key={funnel.id}
                      onClick={() => toggleFunnel(funnel.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border text-left transition-colors ${
                        selected
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-background hover:border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        selected ? "border-primary bg-primary" : "border-border bg-background"
                      }`}>
                        {selected && <div className="w-2 h-2 rounded-sm bg-primary-foreground" />}
                      </div>
                      <GitBranch className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{funnel.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{funnel.description || "Sem descrição"}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex gap-1">
                          {(funnel.funnel_stages || []).slice(0, 5).map((s, i) => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{funnel.lead_count} leads</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <Link to="/funnels/new" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <Plus className="w-3 h-3" />
              Criar novo funil
            </Link>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 justify-end">
            <Link to="/campaigns">
              <Button variant="outline" size="sm" className="h-8 text-xs border-border">
                Cancelar
              </Button>
            </Link>
            <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Criar Campanha"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
