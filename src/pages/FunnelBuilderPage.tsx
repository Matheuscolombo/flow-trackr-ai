import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FunnelBuilder } from "@/components/funnel/FunnelBuilder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const FunnelBuilderPage = () => {
  const navigate = useNavigate();
  const { workspaceId } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const handleSave = async (data: {
    name: string;
    description: string;
    stages: { id: string; name: string; color: string; order_index: number; page_url: string }[];
    rules: { id: string; event_name: string; to_stage_id: string }[];
    webhook_token: string;
  }) => {
    if (!workspaceId) {
      toast({ title: "Erro", description: "Workspace não encontrado.", variant: "destructive" });
      return;
    }
    setSaving(true);

    // 1. Create funnel
    const { data: funnel, error: funnelErr } = await supabase
      .from("funnels")
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        description: data.description || null,
        webhook_token: data.webhook_token,
        is_active: true,
      })
      .select("id")
      .single();

    if (funnelErr || !funnel) {
      toast({ title: "Erro ao criar funil", description: funnelErr?.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // 2. Create stages
    const stageIdMap = new Map<string, string>(); // local id -> real id
    for (const stage of data.stages) {
      const { data: created, error } = await supabase
        .from("funnel_stages")
        .insert({
          funnel_id: funnel.id,
          name: stage.name,
          color: stage.color,
          order_index: stage.order_index,
          page_url: stage.page_url.trim() || null,
        })
        .select("id")
        .single();

      if (created) {
        stageIdMap.set(stage.id, created.id);
      }
    }

    // 3. Create transition rules
    const validRules = data.rules.filter((r) => r.event_name.trim() && stageIdMap.has(r.to_stage_id));
    if (validRules.length > 0) {
      await supabase.from("stage_transition_rules").insert(
        validRules.map((r, i) => ({
          funnel_id: funnel.id,
          event_name: r.event_name.trim(),
          to_stage_id: stageIdMap.get(r.to_stage_id)!,
          priority: i + 1,
        }))
      );
    }

    toast({ title: "Funil criado!", description: `"${data.name}" salvo com ${data.stages.length} etapas.` });
    setSaving(false);
    navigate("/funnels");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <Link to="/funnels">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-base font-bold text-foreground">Novo Funil</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Configure etapas, regras de transição e webhook</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <FunnelBuilder onSave={handleSave} />
        </div>
      </div>
    </div>
  );
};

export default FunnelBuilderPage;
