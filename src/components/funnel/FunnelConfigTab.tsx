import { useState, useEffect, useRef, useCallback } from "react";
import { Link2, Save, Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FunnelStage, StageTransitionRule } from "@/types";

const STAGE_COLORS = [
  "#3B82F6", "#8B5CF6", "#F59E0B", "#EC4899",
  "#10B981", "#EF4444", "#6366F1", "#14B8A6",
  "#F97316", "#84CC16", "#06B6D4", "#A855F7",
  "#E11D48", "#0EA5E9", "#D946EF", "#FACC15",
];

interface EditableStage {
  id: string;
  name: string;
  color: string;
  page_url: string;
  order_index: number;
  isNew?: boolean;
}

interface FunnelConfigTabProps {
  stages: FunnelStage[];
  rules: StageTransitionRule[];
  funnelId: string;
  onStagesUpdated?: () => void;
}

export function FunnelConfigTab({ stages, rules, funnelId, onStagesUpdated }: FunnelConfigTabProps) {
  const { toast } = useToast();
  const [editableStages, setEditableStages] = useState<EditableStage[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const initialized = useRef(false);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  useEffect(() => {
    if (stages.length > 0 && !initialized.current) {
      setEditableStages(
        stages.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          page_url: s.page_url || "",
          order_index: s.order_index,
        }))
      );
      initialized.current = true;
    }
  }, [stages]);

  const markDirty = useCallback(() => setDirty(true), []);

  const updateField = (id: string, field: keyof EditableStage, value: string) => {
    setEditableStages((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    markDirty();
  };

  const addStage = () => {
    const newId = `new-${Date.now()}`;
    setEditableStages((prev) => [
      ...prev,
      {
        id: newId,
        name: `Etapa ${prev.length + 1}`,
        color: STAGE_COLORS[prev.length % STAGE_COLORS.length],
        page_url: "",
        order_index: prev.length,
        isNew: true,
      },
    ]);
    markDirty();
  };

  const removeStage = (id: string) => {
    setEditableStages((prev) => prev.filter((s) => s.id !== id));
    markDirty();
  };

  const handleDragStart = (idx: number) => {
    dragItem.current = idx;
  };

  const handleDragEnter = (idx: number) => {
    dragOver.current = idx;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) {
      dragItem.current = null;
      dragOver.current = null;
      return;
    }
    setEditableStages((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(dragItem.current!, 1);
      copy.splice(dragOver.current!, 0, removed);
      return copy.map((s, i) => ({ ...s, order_index: i }));
    });
    dragItem.current = null;
    dragOver.current = null;
    markDirty();
  };

  const handleSave = async () => {
    setSaving(true);

    // Find deleted stages (existed in original but not in editable)
    const editableIds = new Set(editableStages.map((s) => s.id));
    const deletedStages = stages.filter((s) => !editableIds.has(s.id));

    // Delete removed stages
    for (const del of deletedStages) {
      await supabase.from("funnel_stages").delete().eq("id", del.id);
    }

    // Upsert stages
    for (const stage of editableStages) {
      if (stage.isNew) {
        await supabase.from("funnel_stages").insert({
          funnel_id: funnelId,
          name: stage.name,
          color: stage.color,
          order_index: stage.order_index,
          page_url: stage.page_url.trim() || null,
        } as any);
      } else {
        await supabase.from("funnel_stages").update({
          name: stage.name,
          color: stage.color,
          order_index: stage.order_index,
          page_url: stage.page_url.trim() || null,
        } as any).eq("id", stage.id);
      }
    }

    toast({ title: "Etapas salvas!", description: "Configuração atualizada com sucesso." });
    setSaving(false);
    setDirty(false);
    onStagesUpdated?.();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-foreground">Etapas do funil</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addStage}>
              <Plus className="w-3 h-3" /> Adicionar
            </Button>
            <Button
              size="sm"
              variant={dirty ? "default" : "outline"}
              className="h-7 text-xs gap-1"
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              <Save className="w-3 h-3" /> Salvar
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          {editableStages.map((stage, i) => (
            <div
              key={stage.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragEnter={() => handleDragEnter(i)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className="bg-background border border-border rounded-md px-3 py-2 space-y-1.5 cursor-default"
            >
              <div className="flex items-center gap-2">
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab shrink-0" />
                <span className="text-[10px] text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="w-5 h-5 rounded-full border-2 border-border hover:border-foreground/50 transition-colors shrink-0"
                      style={{ backgroundColor: stage.color }}
                      title="Trocar cor"
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start" side="top">
                    <div className="grid grid-cols-8 gap-1.5">
                      {STAGE_COLORS.map((c) => (
                        <button
                          key={c}
                          className={`w-5 h-5 rounded-full transition-transform ${stage.color === c ? "scale-110 ring-2 ring-offset-1 ring-offset-background ring-primary" : "hover:scale-110"}`}
                          style={{ backgroundColor: c }}
                          onClick={() => updateField(stage.id, "color", c)}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Input
                  value={stage.name}
                  onChange={(e) => updateField(stage.id, "name", e.target.value)}
                  className="h-7 text-xs bg-transparent border-0 p-0 focus-visible:ring-0 flex-1"
                />
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                  {stage.page_url.trim() ? "Página" : "Evento"}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => removeStage(stage.id)}
                  disabled={editableStages.length <= 1}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2 pl-10">
                <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
                <Input
                  value={stage.page_url}
                  onChange={(e) => updateField(stage.id, "page_url", e.target.value)}
                  placeholder="https://..."
                  className="h-6 text-[10px] bg-transparent border-0 p-0 focus-visible:ring-0 flex-1 text-muted-foreground placeholder:text-muted-foreground/50"
                />
              </div>
            </div>
          ))}
          {editableStages.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma etapa configurada.</p>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Regras de Transição</h3>
        <div className="space-y-1.5">
          {rules.map((rule) => {
            const toStage = editableStages.find((s) => s.id === rule.to_stage_id);
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
