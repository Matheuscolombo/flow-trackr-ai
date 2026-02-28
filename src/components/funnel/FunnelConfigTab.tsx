import { useState, useEffect, useRef } from "react";
import { Link2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FunnelStage, StageTransitionRule } from "@/types";

interface FunnelConfigTabProps {
  stages: FunnelStage[];
  rules: StageTransitionRule[];
}

export function FunnelConfigTab({ stages, rules }: FunnelConfigTabProps) {
  const { toast } = useToast();
  const [stageUrls, setStageUrls] = useState<Record<string, string>>({});
  const [savingUrls, setSavingUrls] = useState(false);
  const urlsInitialized = useRef(false);

  useEffect(() => {
    if (stages.length > 0 && !urlsInitialized.current) {
      const initial: Record<string, string> = {};
      stages.forEach((s) => { initial[s.id] = s.page_url || ""; });
      setStageUrls(initial);
      urlsInitialized.current = true;
    }
  }, [stages]);

  const handleSaveUrls = async () => {
    setSavingUrls(true);
    for (const stage of stages) {
      const url = (stageUrls[stage.id] || "").trim();
      await supabase.from("funnel_stages").update({ page_url: url || null } as any).eq("id", stage.id);
    }
    toast({ title: "URLs salvas!", description: "As URLs das etapas foram atualizadas." });
    setSavingUrls(false);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4 max-w-2xl">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-foreground">Etapas do funil</h3>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleSaveUrls} disabled={savingUrls}>
            <Save className="w-3 h-3" /> Salvar URLs
          </Button>
        </div>
        <div className="space-y-1.5 mt-3">
          {stages.map((stage, i) => (
            <div key={stage.id} className="bg-background border border-border rounded-md px-3 py-2 space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground w-4 text-right">{i + 1}</span>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                <span className="text-xs text-foreground flex-1">{stage.name}</span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                  {(stageUrls[stage.id] || "").trim() ? "Página" : "Evento"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 pl-7">
                <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
                <Input
                  value={stageUrls[stage.id] || ""}
                  onChange={(e) => setStageUrls((prev) => ({ ...prev, [stage.id]: e.target.value }))}
                  placeholder="https://..."
                  className="h-6 text-[10px] bg-transparent border-0 p-0 focus-visible:ring-0 flex-1 text-muted-foreground placeholder:text-muted-foreground/50"
                />
              </div>
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
  );
}
