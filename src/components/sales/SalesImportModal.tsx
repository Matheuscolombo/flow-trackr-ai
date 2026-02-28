import { useState, useCallback } from "react";
import { Upload, X, CheckCircle2, AlertTriangle, Loader2, FileText, DollarSign, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, SaleEvent } from "@/types";

interface SalesImportModalProps {
  open: boolean;
  onClose: () => void;
  existingLeads: Lead[];
  onImport: (sales: SaleEvent[], newLeads: Lead[]) => void;
}

type Step = "upload" | "preview" | "processing" | "result";

interface ImportResult {
  enriched: number;
  ghosts: number;
  ignored: number;
  noContact: number;
  duplicates: number;
  totalRevenue: number;
  platform: string;
  sales: SaleEvent[];
  newLeads: Lead[];
}

// ─── Field detection (mirrors edge function logic for preview) ─────────────────

const SYNONYMS: Record<string, string[]> = {
  email: ["email", "e-mail", "e-mail do comprador", "customer_email", "cliente / e-mail", "buyer_email", "e-mail do cliente", "email do cliente"],
  nome: ["nome", "nome do comprador", "nome do cliente", "buyer_name", "customer_name", "cliente", "nome completo"],
  telefone: ["telefone", "fone", "phone", "telefone completo do cliente", "buyer_phone", "customer_phone", "cliente / fones", "fones", "celular", "whatsapp"],
  gross_value: ["valor da venda", "valor do pedido", "gross_value", "amount", "valor bruto", "amount_paid", "valor do item", "valor"],
  net_value: ["ganho líquido", "ganho liquido", "valor líquido", "net_value", "net_amount", "valor liquidado", "valor liquido"],
  produto: ["produto", "product", "product_name", "nome do produto", "item", "título do produto", "titulo do produto"],
  paid_at: ["data de pagamento", "data de aprovação", "paid_at", "approved_date", "data da compra", "data da transação", "data da transacao"],
  created_at: ["data de criação", "data de criacao", "created_at", "sale_created_at", "data do pedido", "data pedido", "data da venda"],
  status: ["status", "status da compra", "status da venda", "transaction_status", "situação", "situacao"],
  external_id: ["fatura", "número do pedido", "numero do pedido", "order_id", "transaction_id", "pedido", "id do pedido"],
  payment_method: ["método de pagamento", "metodo de pagamento", "payment_method", "tipo de pagamento", "forma de pagamento"],
  card_brand: ["bandeira", "card_brand", "bandeira do cartão", "bandeira do cartao"],
  installments: ["parcelas", "installments", "nº parcelas", "n parcelas", "quantidade de parcelas"],
  utm_source: ["utm source", "utm_source", "origem", "source", "utmsource"],
  utm_campaign: ["utm campaign", "utm_campaign", "campanha", "campaign", "utmcampaign"],
  utm_content: ["utm content", "utm_content", "conteúdo", "utmcontent"],
  utm_medium: ["utm medium", "utm_medium", "utmmedium"],
  utm_term: ["utm term", "utm_term", "utmterm"],
  src: ["src", "source_id"],
  sck: ["sck", "checkout_source"],
  affiliate: ["afiliado", "affiliate", "afiliado principal"],
  offer_name: ["oferta", "offer", "nome da oferta", "offer_name"],
  ad_name: ["ad name", "ad_name", "anúncio", "creative", "criativo"],
  ad_set_name: ["ad set name", "ad_set_name", "conjunto de anuncios", "adset", "conjunto"],
  campaign_name: ["campaign name", "campaign_name", "nome da campanha"],
  placement: ["channel", "canal", "placement"],
};

const CRITICAL_FIELDS = ["email", "gross_value"];

function detectSeparator(firstLine: string): string {
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function findField(headers: string[], fieldKey: string): string | null {
  const synonyms = SYNONYMS[fieldKey] || [];
  // exact match first
  for (const header of headers) {
    const h = header.toLowerCase().trim();
    if (synonyms.some((s) => h === s)) return header;
  }
  // includes match
  for (const header of headers) {
    const h = header.toLowerCase().trim();
    if (synonyms.some((s) => s.length >= 5 && (h.includes(s) || s.includes(h)))) return header;
  }
  return null;
}

function detectPlatformLabel(headers: string[]): string {
  const lh = headers.map((h) => h.toLowerCase());
  if (lh.some((h) => h.includes("fatura"))) return "Eduzz";
  if (lh.some((h) => h.includes("número do pedido") || h.includes("numero do pedido"))) return "Hotmart";
  if (lh.some((h) => h === "pedido") && lh.some((h) => h.includes("valor bruto"))) return "Ticto";
  if (lh.some((h) => h === "transaction_id")) return "Guru";
  if (lh.some((h) => h === "order_id") && lh.some((h) => h.includes("customer"))) return "Kiwify";
  return "Não identificada";
}

interface FieldDetectionResult {
  headers: string[];
  platformLabel: string;
  detectedFields: Record<string, string | null>;
  validLines: number;
}

function analyzeCSV(text: string): FieldDetectionResult {
  const firstLine = text.split(/\r?\n/)[0]?.replace(/^\uFEFF/, "") || "";
  const sep = detectSeparator(firstLine);
  const rawHeaders = firstLine.split(sep).map((h) => h.replace(/^"|"$/g, "").trim());

  const allLines = text.split(/\r?\n/).filter((l) => l.trim());
  const dataLines = allLines.slice(1);

  const validLines = dataLines.filter((l) => {
    const vals = l.split(sep).map((v) => v.replace(/^"|"$/g, "").trim());
    return vals.some((v) => v.length > 0);
  }).length;

  const detectedFields: Record<string, string | null> = {};
  for (const key of Object.keys(SYNONYMS)) {
    detectedFields[key] = findField(rawHeaders, key);
  }

  return {
    headers: rawHeaders,
    platformLabel: detectPlatformLabel(rawHeaders),
    detectedFields,
    validLines,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

const BATCH_SIZE = 300;

function splitCSVIntoBatches(text: string): { header: string; batches: string[] } {
  const lines = text.split(/\r?\n/);
  const header = lines[0]?.replace(/^\uFEFF/, "") ?? "";
  const dataLines = lines.slice(1).filter((l) => l.trim());
  const batches: string[] = [];
  for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
    const chunk = dataLines.slice(i, i + BATCH_SIZE);
    batches.push(header + "\n" + chunk.join("\n"));
  }
  return { header, batches };
}

// Field labels for preview — organized in display groups
const FIELD_LABELS: Record<string, string> = {
  email: "E-mail",
  nome: "Nome",
  telefone: "Telefone",
  gross_value: "Valor bruto",
  net_value: "Valor líquido",
  produto: "Produto",
  paid_at: "Data pagamento",
  created_at: "Data do pedido",
  status: "Status",
  external_id: "ID externo",
  payment_method: "Método pagamento",
  card_brand: "Bandeira cartão",
  installments: "Parcelas",
  utm_source: "UTM Source",
  utm_campaign: "UTM Campaign",
  utm_content: "UTM Content",
  utm_medium: "UTM Medium",
  utm_term: "UTM Term",
  src: "SRC",
  sck: "SCK",
  affiliate: "Afiliado",
  offer_name: "Oferta",
  ad_name: "Anúncio",
  ad_set_name: "Conjunto",
  campaign_name: "Nome campanha",
  placement: "Canal",
};

const NONE_VALUE = "__none__";

export function SalesImportModal({ open, onClose, existingLeads, onImport }: SalesImportModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [fileText, setFileText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [analysis, setAnalysis] = useState<FieldDetectionResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [processedLines, setProcessedLines] = useState(0);
  // Editable field overrides — initialized from auto-detection, user can change
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string | null>>({});

  const reset = () => {
    setStep("upload");
    setFileText("");
    setFileName("");
    setAnalysis(null);
    setResult(null);
    setBatchProgress({ current: 0, total: 0 });
    setProcessedLines(0);
    setFieldOverrides({});
  };

  const handleClose = () => { reset(); onClose(); };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const a = analyzeCSV(text);
      setFileText(text);
      setFileName(file.name);
      setAnalysis(a);
      // Initialize overrides from auto-detected values
      const initial: Record<string, string | null> = {};
      for (const key of Object.keys(FIELD_LABELS)) {
        initial[key] = a.detectedFields[key] ?? null;
      }
      setFieldOverrides(initial);
      setStep("preview");
    };
    reader.readAsText(file, "utf-8");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const hasMinimumFields = !!(fieldOverrides["email"] || fieldOverrides["telefone"]);

  const handleFieldChange = (fieldKey: string, csvHeader: string) => {
    setFieldOverrides((prev) => ({
      ...prev,
      [fieldKey]: csvHeader === NONE_VALUE ? null : csvHeader,
    }));
  };

  const handleProcess = async () => {
    setStep("processing");

    const { batches } = splitCSVIntoBatches(fileText);
    const total = batches.length;
    setBatchProgress({ current: 0, total });
    setProcessedLines(0);
    const totalLines = analysis?.validLines ?? 0;

    // Build clean overrides to send (only non-null entries)
    const cleanOverrides: Record<string, string> = {};
    for (const [key, val] of Object.entries(fieldOverrides)) {
      if (val) cleanOverrides[key] = val;
    }

    let accEnriched = 0;
    let accGhosts = 0;
    let accIgnored = 0;
    let accNoContact = 0;
    let accDuplicates = 0;
    let accRevenue = 0;
    let lastPlatform = "other";

    for (let i = 0; i < batches.length; i++) {
      setBatchProgress({ current: i + 1, total });
      try {
        const { data, error } = await supabase.functions.invoke("import-sales", {
          body: { csvText: batches[i], fieldOverrides: cleanOverrides },
        });
        if (error) {
          console.error(`[SalesImportModal] batch ${i + 1} error:`, error);
          accIgnored += BATCH_SIZE;
          setProcessedLines(Math.min((i + 1) * BATCH_SIZE, totalLines));
          continue;
        }
        accEnriched += data.enriched ?? 0;
        accGhosts += data.ghosts ?? 0;
        accNoContact += data.no_contact ?? 0;
        accDuplicates += data.duplicates ?? 0;
        accIgnored += (data.ignored ?? 0) + (data.duplicates ?? 0);
        accRevenue += data.total_revenue ?? 0;
        lastPlatform = data.platform ?? lastPlatform;
        setProcessedLines(Math.min((i + 1) * BATCH_SIZE, totalLines));
      } catch (err) {
        console.error(`[SalesImportModal] batch ${i + 1} threw:`, err);
        accIgnored += BATCH_SIZE;
        setProcessedLines(Math.min((i + 1) * BATCH_SIZE, totalLines));
      }
    }

    setResult({
      enriched: accEnriched,
      ghosts: accGhosts,
      ignored: accIgnored,
      noContact: accNoContact,
      duplicates: accDuplicates,
      totalRevenue: accRevenue,
      platform: lastPlatform,
      sales: [],
      newLeads: [],
    });
    setStep("result");
  };

  const handleConfirm = () => {
    if (!result) return;
    onImport(result.sales, result.newLeads);
    handleClose();
  };

  const platformColor =
    analysis?.platformLabel === "Eduzz" ? "bg-orange-500/15 text-orange-400 border-orange-500/30" :
    analysis?.platformLabel === "Hotmart" ? "bg-pink-500/15 text-pink-400 border-pink-500/30" :
    analysis?.platformLabel === "Ticto" ? "bg-blue-500/15 text-blue-400 border-blue-500/30" :
    analysis?.platformLabel === "Guru" ? "bg-purple-500/15 text-purple-400 border-purple-500/30" :
    analysis?.platformLabel === "Kiwify" ? "bg-green-500/15 text-green-400 border-green-500/30" :
    "bg-muted/40 text-muted-foreground border-border";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            Importar Vendas
          </DialogTitle>
        </DialogHeader>

        {/* Step 1 — Upload */}
        {step === "upload" && (
          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Aceita <strong>qualquer CSV de vendas</strong> — Eduzz, Hotmart, Ticto, Guru, Kiwify ou exportação customizada.
              O separador e os campos são detectados automaticamente.
            </p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center gap-3 transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Arraste o CSV aqui</p>
                <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
              </div>
              <label className="cursor-pointer">
                <Button size="sm" variant="outline" className="text-xs" asChild>
                  <span>Selecionar arquivo</span>
                </Button>
                <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          </div>
        )}

        {/* Step 2 — Preview inteligente com mapeamento editável */}
        {step === "preview" && analysis && (
          <div className="space-y-4 pt-2">
            {/* File info */}
            <div className="bg-muted/40 border border-border rounded-lg p-4 flex items-center gap-3">
              <FileText className="w-8 h-8 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{fileName}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {analysis.validLines.toLocaleString("pt-BR")} linhas válidas · {analysis.headers.length} colunas
                </p>
              </div>
              <Badge className={`text-[10px] px-2 py-0.5 border shrink-0 ${platformColor}`} variant="outline">
                {analysis.platformLabel}
              </Badge>
            </div>

            {/* Editable field detection grid */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 border-b border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Mapeamento de campos</p>
              </div>
              <div className="grid grid-cols-2 gap-0">
                {Object.entries(FIELD_LABELS).map(([key, label]) => {
                  const currentValue = fieldOverrides[key];
                  const isCritical = CRITICAL_FIELDS.includes(key);
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 px-3 py-1.5 border-b border-r border-border last:border-b-0"
                    >
                      {currentValue ? (
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <X className={`w-3 h-3 shrink-0 ${isCritical ? "text-amber-400" : "text-muted-foreground/40"}`} />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium text-foreground leading-tight">{label}</p>
                        <Select
                          value={currentValue || NONE_VALUE}
                          onValueChange={(v) => handleFieldChange(key, v)}
                        >
                          <SelectTrigger className="h-5 text-[9px] border-0 bg-transparent p-0 shadow-none hover:bg-muted/40 rounded-sm min-w-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE} className="text-[10px] text-muted-foreground">
                              — nenhuma —
                            </SelectItem>
                            {analysis.headers.map((h) => (
                              <SelectItem key={h} value={h} className="text-[10px]">{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Warning if no email/phone */}
            {!hasMinimumFields && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg p-3">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Nenhuma coluna de e-mail ou telefone detectada. O cruzamento de leads pode não funcionar.
              </div>
            )}

            {/* What will happen */}
            <div className="bg-card border border-border rounded-lg p-3 space-y-1.5 text-xs">
              <p className="font-semibold text-foreground text-[10px] uppercase tracking-wide text-muted-foreground">O que será feito</p>
              <ul className="space-y-1 text-muted-foreground text-xs">
                <li>✓ Cruzamento por <strong>e-mail</strong> → depois por <strong>telefone</strong></li>
                <li>✓ Leads encontrados serão <strong>enriquecidos</strong> com dados de venda</li>
                <li>✓ Não encontrados → criados como <strong>leads fantasma</strong></li>
                <li>✓ Vendas <strong>reembolsadas/pendentes</strong> serão ignoradas</li>
                <li>✓ Compradores com 2+ compras → <strong>Multi-compradores</strong></li>
              </ul>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="ghost" className="text-xs" onClick={reset}>Cancelar</Button>
              <Button size="sm" className="text-xs" onClick={handleProcess}>
                Processar {analysis.validLines.toLocaleString("pt-BR")} linhas
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Processing */}
        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-5">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <div className="text-center w-full px-4">
              <p className="text-sm font-semibold text-foreground">Processando vendas...</p>
              <p className="text-lg font-bold tabular-nums text-foreground mt-2">
                {processedLines.toLocaleString("pt-BR")} <span className="text-muted-foreground font-normal text-sm">de</span> {(analysis?.validLines ?? 0).toLocaleString("pt-BR")}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Lote {batchProgress.current} de {batchProgress.total}
              </p>
              {(analysis?.validLines ?? 0) > 0 && (
                <div className="mt-3">
                  <Progress
                    value={(processedLines / (analysis?.validLines ?? 1)) * 100}
                    className="h-2"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4 — Result */}
        {step === "result" && result && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-foreground">Processamento concluído</span>
              {result.platform && result.platform !== "other" && (
                <Badge variant="outline" className="text-[9px] ml-auto capitalize">{result.platform}</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Leads enriquecidos", value: result.enriched, color: "text-emerald-400" },
                { label: "Leads fantasma criados", value: result.ghosts, color: "text-amber-400" },
                { label: "Receita líquida total", value: `R$ ${result.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "text-primary" },
                { label: "Linhas ignoradas", value: result.ignored, color: "text-muted-foreground" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-muted/40 border border-border rounded-lg p-3">
                  <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Detailed breakdown of ignored rows */}
            {result.ignored > 0 && (
              <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Detalhes das linhas ignoradas</p>
                {result.noContact > 0 && (
                  <p className="text-xs text-muted-foreground">
                    • <strong>{result.noContact}</strong> linhas sem e-mail nem telefone
                  </p>
                )}
                {result.duplicates > 0 && (
                  <p className="text-xs text-muted-foreground">
                    • <strong>{result.duplicates}</strong> linhas duplicadas (mesmo ID de fatura)
                  </p>
                )}
              </div>
            )}

            {result.ghosts > 0 && (
              <p className="text-[10px] text-muted-foreground">
                <strong>{result.ghosts}</strong> compradores não estavam no funil — filtre por "Fantasma" na LeadsPage para analisá-los.
              </p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="ghost" className="text-xs" onClick={reset}>Importar outro</Button>
              <Button size="sm" className="text-xs" onClick={handleConfirm}>
                Confirmar e aplicar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
