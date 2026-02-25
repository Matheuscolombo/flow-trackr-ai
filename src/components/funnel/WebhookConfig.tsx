import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Funnel } from "@/types";

interface WebhookConfigProps {
  funnel: Funnel;
}

export function WebhookConfig({ funnel }: WebhookConfigProps) {
  const [copied, setCopied] = useState<"url" | "token" | null>(null);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/webhook-lead`;

  const copy = async (text: string, type: "url" | "token") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">URL do Endpoint</Label>
        <div className="flex gap-2">
          <Input
            value={webhookUrl}
            readOnly
            className="bg-background border-border text-xs font-mono text-muted-foreground"
          />
          <Button size="icon" variant="outline" className="shrink-0" onClick={() => copy(webhookUrl, "url")}>
            {copied === "url" ? <Check className="w-4 h-4 text-sentinel-success" /> : <Copy className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant="outline" className="shrink-0" asChild>
            <a href={webhookUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Token do Funil</Label>
        <div className="flex gap-2">
          <Input
            value={funnel.webhook_token}
            readOnly
            className="bg-background border-border text-xs font-mono text-muted-foreground"
          />
          <Button size="icon" variant="outline" className="shrink-0" onClick={() => copy(funnel.webhook_token, "token")}>
            {copied === "token" ? <Check className="w-4 h-4 text-sentinel-success" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">Inclua este token no header <code className="font-mono bg-muted px-1 rounded">X-Funnel-Token</code> de cada requisição.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Payload de Exemplo</Label>
        <div className="bg-background border border-border rounded-md p-4">
          <pre className="text-[11px] text-muted-foreground overflow-x-auto">{`POST ${webhookUrl}
Content-Type: application/json
X-Funnel-Token: ${funnel.webhook_token}

{
  "event": "lead_created",
  "phone": "+5511999990001",
  "name": "Nome do Lead",
  "email": "email@exemplo.com",
  "idempotency_key": "uuid-unico-por-evento",
  "timestamp": "${new Date().toISOString()}",
  "metadata": {
    "utm_source": "google",
    "utm_campaign": "campanha-ativa"
  }
}`}</pre>
        </div>
      </div>

      <div className="bg-primary/10 border border-primary/20 rounded-md p-3">
        <p className="text-xs text-primary font-medium mb-1">Dica para n8n / Zapier</p>
        <p className="text-[11px] text-muted-foreground">
          Use um nó <strong className="text-foreground">HTTP Request</strong> apontando para a URL acima com método POST.
          Passe o campo <code className="font-mono bg-muted px-1 rounded">phone</code> normalizado (com DDI) para garantir deduplicação de leads.
        </p>
      </div>
    </div>
  );
}
