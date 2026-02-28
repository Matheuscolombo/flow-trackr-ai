import { useState } from "react";
import { Plus, Trash2, GripVertical, Copy, Check, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { FunnelStage, StageTransitionRule } from "@/types";

const STAGE_COLORS = [
  "#3B82F6", "#8B5CF6", "#F59E0B", "#EC4899",
  "#10B981", "#EF4444", "#6366F1", "#14B8A6",
  "#F97316", "#84CC16", "#06B6D4", "#A855F7",
  "#E11D48", "#0EA5E9", "#D946EF", "#FACC15",
];

interface NewStage {
  id: string;
  name: string;
  color: string;
  order_index: number;
  page_url: string;
}

interface NewRule {
  id: string;
  event_name: string;
  to_stage_id: string;
}

function generateToken(): string {
  return `${crypto.randomUUID().slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`;
}

interface FunnelBuilderProps {
  onSave?: (data: {
    name: string;
    description: string;
    stages: NewStage[];
    rules: NewRule[];
    webhook_token: string;
  }) => void;
}

export function FunnelBuilder({ onSave }: FunnelBuilderProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stages, setStages] = useState<NewStage[]>([
    { id: "ns-1", name: "Lead Novo", color: "#3B82F6", order_index: 0, page_url: "" },
    { id: "ns-2", name: "Contato Feito", color: "#8B5CF6", order_index: 1, page_url: "" },
    { id: "ns-3", name: "Fechado", color: "#10B981", order_index: 2, page_url: "" },
  ]);
  const [rules, setRules] = useState<NewRule[]>([
    { id: "nr-1", event_name: "lead_created", to_stage_id: "ns-1" },
  ]);
  const [webhookToken] = useState(generateToken);
  const [copied, setCopied] = useState<"token" | "url" | null>(null);

  const webhookUrl = `https://api.sentinel.app/webhook/${webhookToken}`;

  const addStage = () => {
    const newId = `ns-${Date.now()}`;
    setStages((prev) => [
      ...prev,
      {
        id: newId,
        name: `Etapa ${prev.length + 1}`,
        color: STAGE_COLORS[prev.length % STAGE_COLORS.length],
        order_index: prev.length,
        page_url: "",
      },
    ]);
  };

  const removeStage = (id: string) => {
    setStages((prev) => prev.filter((s) => s.id !== id));
  };

  const updateStageName = (id: string, name: string) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const updateStageColor = (id: string, color: string) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)));
  };

  const updateStagePageUrl = (id: string, page_url: string) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, page_url } : s)));
  };

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      { id: `nr-${Date.now()}`, event_name: "", to_stage_id: stages[0]?.id || "" },
    ]);
  };

  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRule = (id: string, field: keyof NewRule, value: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const copyToClipboard = async (text: string, type: "token" | "url") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSave = () => {
    if (onSave) {
      onSave({ name, description, stages, rules, webhook_token: webhookToken });
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Informações do Funil</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do funil</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Captação Imóveis SP"
              className="bg-background border-border text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o objetivo deste funil..."
              className="bg-background border-border text-sm"
            />
          </div>
        </div>
      </div>

      {/* Stages */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Etapas do Funil</h3>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addStage}>
            <Plus className="w-3 h-3" /> Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="bg-background border border-border rounded-md px-3 py-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab" />
                <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                <Input
                  value={stage.name}
                  onChange={(e) => updateStageName(stage.id, e.target.value)}
                  className="h-7 text-xs bg-transparent border-0 p-0 focus-visible:ring-0 flex-1"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="w-6 h-6 rounded-full border-2 border-border hover:border-foreground/50 transition-colors shrink-0"
                      style={{ backgroundColor: stage.color }}
                      title="Trocar cor"
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="end" side="top">
                    <div className="grid grid-cols-8 gap-1.5">
                      {STAGE_COLORS.map((c) => (
                        <button
                          key={c}
                          className={`w-5 h-5 rounded-full transition-transform ${stage.color === c ? "scale-110 ring-2 ring-offset-1 ring-offset-background ring-primary" : "hover:scale-110"}`}
                          style={{ backgroundColor: c }}
                          onClick={() => updateStageColor(stage.id, c)}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-sentinel-critical"
                  onClick={() => removeStage(stage.id)}
                  disabled={stages.length <= 1}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2 pl-7">
                <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                <Input
                  value={stage.page_url}
                  onChange={(e) => updateStagePageUrl(stage.id, e.target.value)}
                  placeholder="Link da página (opcional)"
                  className="h-6 text-[10px] bg-transparent border-0 p-0 focus-visible:ring-0 flex-1 text-muted-foreground placeholder:text-muted-foreground/50"
                />
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                  {stage.page_url.trim() ? "Página" : "Evento"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transition Rules */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Regras de Transição</h3>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addRule}>
            <Plus className="w-3 h-3" /> Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Quando o evento chegar via webhook, o lead será movido automaticamente para a etapa definida.
        </p>
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-2 bg-background border border-border rounded-md px-3 py-2">
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={rule.event_name}
                  onChange={(e) => updateRule(rule.id, "event_name", e.target.value)}
                  placeholder="event_name"
                  className="h-7 text-xs font-mono bg-transparent border-0 p-0 focus-visible:ring-0"
                />
                <span className="text-[10px] text-muted-foreground shrink-0">→</span>
                <select
                  value={rule.to_stage_id}
                  onChange={(e) => updateRule(rule.id, "to_stage_id", e.target.value)}
                  className="h-7 text-xs bg-background border-0 text-foreground focus:outline-none flex-1"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-sentinel-critical"
                onClick={() => removeRule(rule.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook Config */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Configuração do Webhook</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">URL do Webhook</Label>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="bg-background border-border text-xs font-mono text-muted-foreground"
              />
              <Button
                size="icon"
                variant="outline"
                className="shrink-0"
                onClick={() => copyToClipboard(webhookUrl, "url")}
              >
                {copied === "url" ? <Check className="w-4 h-4 text-sentinel-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Token do Funil</Label>
            <div className="flex gap-2">
              <Input
                value={webhookToken}
                readOnly
                className="bg-background border-border text-xs font-mono text-muted-foreground"
              />
              <Button
                size="icon"
                variant="outline"
                className="shrink-0"
                onClick={() => copyToClipboard(webhookToken, "token")}
              >
                {copied === "token" ? <Check className="w-4 h-4 text-sentinel-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Payload example */}
          <div className="space-y-1.5">
            <Label className="text-xs">Exemplo de Payload (n8n / Zapier)</Label>
            <div className="bg-background border border-border rounded-md p-3">
              <pre className="text-[10px] text-muted-foreground overflow-x-auto">{`{
  "event": "lead_created",
  "phone": "+5511999990001",
  "name": "Nome do Lead",
  "email": "email@exemplo.com",
  "idempotency_key": "unique-key-001",
  "metadata": {
    "utm_source": "google",
    "utm_campaign": "minha-campanha"
  }
}`}</pre>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          className="flex-1"
          onClick={handleSave}
          disabled={!name.trim()}
        >
          Criar Funil
        </Button>
      </div>
    </div>
  );
}
