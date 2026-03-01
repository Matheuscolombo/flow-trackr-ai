import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, GitBranch, CheckCircle2, XCircle, TrendingUp, Users, Loader2, Copy, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FunnelStage {
  id: string;
  name: string;
  color: string;
  order_index: number;
}

interface Funnel {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  funnel_stages: FunnelStage[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const FunnelsPage = () => {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Funnel | null>(null);
  const { toast } = useToast();

  const loadFunnels = async () => {
    const { data } = await supabase
      .from("funnels")
      .select("id, name, description, is_active, created_at, funnel_stages(id, name, color, order_index)")
      .order("created_at", { ascending: false });

    setFunnels(
      (data || []).map((f) => ({
        ...f,
        funnel_stages: [...(f.funnel_stages || [])].sort((a, b) => a.order_index - b.order_index),
      }))
    );
    setLoading(false);
  };

  useEffect(() => { loadFunnels(); }, []);

  const handleDuplicate = async (funnel: Funnel) => {
    setDuplicating(funnel.id);
    try {
      // 1. Create new funnel
      const { data: newFunnel, error: fErr } = await supabase
        .from("funnels")
        .select("id, workspace_id")
        .eq("id", funnel.id)
        .single();

      if (fErr || !newFunnel) throw new Error("Funil não encontrado");

      const { data: created, error: createErr } = await supabase
        .from("funnels")
        .insert({
          workspace_id: newFunnel.workspace_id,
          name: `Cópia de ${funnel.name}`,
          description: funnel.description,
          is_active: funnel.is_active,
        })
        .select("id")
        .single();

      if (createErr || !created) throw new Error(createErr?.message || "Erro ao criar funil");

      // 2. Copy stages
      const stageIdMap = new Map<string, string>();
      for (const stage of funnel.funnel_stages) {
        const { data: newStage } = await supabase
          .from("funnel_stages")
          .insert({
            funnel_id: created.id,
            name: stage.name,
            color: stage.color,
            order_index: stage.order_index,
          })
          .select("id")
          .single();
        if (newStage) stageIdMap.set(stage.id, newStage.id);
      }

      // 3. Copy transition rules
      const { data: originalRules } = await supabase
        .from("stage_transition_rules")
        .select("*")
        .eq("funnel_id", funnel.id);

      if (originalRules && originalRules.length > 0) {
        const mappedRules = originalRules
          .filter((r) => stageIdMap.has(r.to_stage_id))
          .map((r) => ({
            funnel_id: created.id,
            event_name: r.event_name,
            to_stage_id: stageIdMap.get(r.to_stage_id)!,
            from_stage_id: r.from_stage_id ? stageIdMap.get(r.from_stage_id) || null : null,
            priority: r.priority,
          }));
        if (mappedRules.length > 0) {
          await supabase.from("stage_transition_rules").insert(mappedRules);
        }
      }

      toast({ title: "Funil duplicado!", description: `"Cópia de ${funnel.name}" criado com sucesso.` });
      await loadFunnels();
    } catch (err: any) {
      toast({ title: "Erro ao duplicar", description: err.message, variant: "destructive" });
    } finally {
      setDuplicating(null);
    }
  };

  const handleDelete = async (funnel: Funnel) => {
    setDeleting(funnel.id);
    try {
      // 1. Clear leads via edge function
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("clear-funnel-leads", {
        body: { funnel_id: funnel.id },
      });
      if (res.error) throw new Error(res.error.message || "Erro ao limpar leads");

      // 2. Delete related records in order
      await supabase.from("funnel_edges").delete().eq("funnel_id", funnel.id);
      await supabase.from("funnel_source_nodes").delete().eq("funnel_id", funnel.id);
      await supabase.from("stage_transition_rules").delete().eq("funnel_id", funnel.id);
      await supabase.from("funnel_stages").delete().eq("funnel_id", funnel.id);
      
      // 3. Delete sentinel_alerts referencing this funnel
      await supabase.from("sentinel_alerts").delete().eq("funnel_id", funnel.id);
      
      // 4. Delete tags scoped to this funnel
      await supabase.from("tags").delete().eq("funnel_id", funnel.id);

      // 5. Delete the funnel itself
      const { error: delErr } = await supabase.from("funnels").delete().eq("id", funnel.id);
      if (delErr) throw new Error(delErr.message);

      toast({ title: "Funil apagado!", description: `"${funnel.name}" foi removido com sucesso.` });
      await loadFunnels();
    } catch (err: any) {
      toast({ title: "Erro ao apagar", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(null);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-foreground">Funis</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? "Carregando..." : `${funnels.length} funis configurados`}
          </p>
        </div>
        <Link to="/funnels/new">
          <Button size="sm" className="h-8 text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Novo Funil
          </Button>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : funnels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <GitBranch className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhum funil ainda</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Importe suas planilhas de vendas para gerar a Base Histórica automaticamente,
              ou crie um funil para começar a rastrear leads.
            </p>
            <Link to="/funnels/new">
              <Button size="sm" className="h-8 text-xs gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Criar primeiro funil
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {funnels.map((funnel) => (
              <Link key={funnel.id} to={`/funnels/${funnel.id}`}>
                <div className="bg-card border border-border rounded-lg p-5 hover:border-primary/30 transition-all group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-md bg-primary/10 shrink-0 mt-0.5">
                        <GitBranch className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {funnel.name}
                          </h3>
                          {funnel.is_active ? (
                            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-sentinel-success/15 text-sentinel-success border-sentinel-success/30" variant="outline">
                              <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                              Ativo
                            </Badge>
                          ) : (
                            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-muted text-muted-foreground border-border" variant="outline">
                              <XCircle className="w-2.5 h-2.5 mr-0.5" />
                              Inativo
                            </Badge>
                          )}
                        </div>
                        {funnel.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{funnel.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">Criado em {formatDate(funnel.created_at)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                          <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onClick={(e) => { e.preventDefault(); handleDuplicate(funnel); }}
                            disabled={duplicating === funnel.id}
                          >
                            <Copy className="w-3.5 h-3.5 mr-2" />
                            {duplicating === funnel.id ? "Duplicando..." : "Duplicar"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => { e.preventDefault(); setDeleteTarget(funnel); }}
                            disabled={deleting === funnel.id}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            {deleting === funnel.id ? "Apagando..." : "Apagar"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <TrendingUp className="w-3 h-3 text-sentinel-success" />
                          <span className="text-sm font-bold text-sentinel-success tabular-nums">—</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">conversão</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-foreground tabular-nums">{funnel.funnel_stages.length}</span>
                        <p className="text-[10px] text-muted-foreground">etapas</p>
                      </div>
                    </div>
                  </div>

                  {/* Stage pills */}
                  {funnel.funnel_stages.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-4 flex-wrap">
                      {funnel.funnel_stages.map((stage, idx) => (
                        <div key={stage.id} className="flex items-center gap-1">
                          <div className="flex items-center gap-1 bg-muted rounded-full px-2 py-0.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                            <span className="text-[10px] text-muted-foreground">{stage.name}</span>
                          </div>
                          {idx < funnel.funnel_stages.length - 1 && (
                            <span className="text-[10px] text-muted-foreground/40">→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar funil?</AlertDialogTitle>
            <AlertDialogDescription>
              O funil <strong>"{deleteTarget?.name}"</strong> será permanentemente removido junto com todas as suas etapas, regras de transição e conexões.
              Leads que não estiverem em nenhum outro funil também serão apagados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deleting}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {deleting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Apagando...</> : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FunnelsPage;
