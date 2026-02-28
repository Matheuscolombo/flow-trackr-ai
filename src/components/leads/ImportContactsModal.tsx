import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileText, Download, X, CheckCircle, AlertCircle, ChevronRight, Loader2, Check, Tag, Plus, Zap, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

function detectSeparator(firstLine: string): string {
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseCSVHeaders(raw: string): string[] {
  const firstLine = raw.split(/\r?\n/)[0]?.replace(/^\uFEFF/, "") || "";
  const sep = detectSeparator(firstLine);
  return firstLine.split(sep).map((h) => h.replace(/^"|"$/g, "").trim());
}

function countDataLines(raw: string): number {
  return raw.split(/\r?\n/).filter((l) => l.trim()).length - 1;
}

// ─── Synonym-based field detection ───────────────────────────────────────────

const SYNONYMS: Record<string, string[]> = {
  nome: ["nome", "name", "nome completo", "full_name", "customer_name", "nome do lead"],
  telefone: ["telefone", "phone", "fone", "celular", "whatsapp", "mobile"],
  email: ["email", "e-mail", "e-mail do lead", "customer_email"],
};

const FIELD_LABELS: Record<string, string> = {
  nome: "Nome",
  telefone: "Telefone",
  email: "E-mail",
};

function findField(headers: string[], fieldKey: string): string | null {
  const synonyms = SYNONYMS[fieldKey] || [];
  for (const header of headers) {
    const h = header.toLowerCase().trim();
    if (synonyms.some((s) => h === s)) return header;
  }
  for (const header of headers) {
    const h = header.toLowerCase().trim();
    if (synonyms.some((s) => s.length >= 4 && (h.includes(s) || s.includes(h)))) return header;
  }
  return null;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DbFunnel {
  id: string;
  name: string;
  funnel_stages: { id: string; name: string; order_index: number }[];
}

interface DbTag {
  id: string;
  name: string;
  color: string;
  scope: string;
  funnel_id: string | null;
}

interface DbCampaign {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: () => void;
}

type ImportMode = "funnel" | "event_only" | "backfill";

const NONE_VALUE = "__none__";
const ALL_CAMPAIGNS = "__all__";
const BATCH_SIZE = 500;
const TEMPLATE_CSV = `nome,telefone,email\nAna Silva,11999990001,ana@email.com\nCarlos Melo,11999990002,carlos@email.com`;

function splitCSVIntoBatches(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const header = lines[0]?.replace(/^\uFEFF/, "") ?? "";
  const dataLines = lines.slice(1).filter((l) => l.trim());
  const batches: string[] = [];
  for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
    batches.push(header + "\n" + dataLines.slice(i, i + BATCH_SIZE).join("\n"));
  }
  return batches;
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

export function ImportContactsModal({ open, onClose, onImport }: Props) {
  const [step, setStep] = useState<"upload" | "mapping" | "processing" | "result">("upload");

  // Upload state
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Mode
  const [importMode, setImportMode] = useState<ImportMode>("funnel");

  // Mapping state
  const [headers, setHeaders] = useState<string[]>([]);
  const [lineCount, setLineCount] = useState(0);
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, string | null>>({});
  const [funnelId, setFunnelId] = useState("");
  const [stageId, setStageId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");

  // Event mode state
  const [eventName, setEventName] = useState("");
  const [campaignId, setCampaignId] = useState(ALL_CAMPAIGNS);

  // Data from DB
  const [funnels, setFunnels] = useState<DbFunnel[]>([]);
  const [tags, setTags] = useState<DbTag[]>([]);
  const [campaigns, setCampaigns] = useState<DbCampaign[]>([]);
  const [loadingFunnels, setLoadingFunnels] = useState(false);

  // Processing state
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // Result
  const [result, setResult] = useState<{
    imported?: number;
    duplicates?: number;
    duplicates_updated?: number;
    no_contact: number;
    found?: number;
    not_found?: number;
    events_created?: number;
    created?: number;
    duplicate_registrations?: number;
  } | null>(null);

  // ── Fetch funnels + tags + campaigns on open ──
  useEffect(() => {
    if (!open) return;
    setLoadingFunnels(true);

    Promise.all([
      supabase
        .from("funnels")
        .select("id, name, funnel_stages(id, name, order_index)")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("tags")
        .select("id, name, color, scope, funnel_id"),
      supabase
        .from("campaigns")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]).then(([funnelsRes, tagsRes, campaignsRes]) => {
      const f = (funnelsRes.data || []) as DbFunnel[];
      setFunnels(f);
      setTags((tagsRes.data || []) as DbTag[]);
      setCampaigns((campaignsRes.data || []) as DbCampaign[]);
      if (f.length > 0 && !funnelId) {
        setFunnelId(f[0].id);
        const stages = (f[0].funnel_stages || []).sort((a, b) => a.order_index - b.order_index);
        if (stages.length > 0) setStageId(stages[0].id);
      }
      setLoadingFunnels(false);
    });
  }, [open]);

  const selectedFunnel = funnels.find((f) => f.id === funnelId);
  const sortedStages = (selectedFunnel?.funnel_stages || []).sort((a, b) => a.order_index - b.order_index);

  // Filter tags: in event_only mode show all, otherwise global + funnel-specific
  const availableTags = importMode === "event_only"
    ? tags
    : tags.filter((t) => t.scope === "global" || t.funnel_id === funnelId);

  const reset = () => {
    setStep("upload");
    setCsvText("");
    setFileName("");
    setPasteText("");
    setHeaders([]);
    setLineCount(0);
    setFieldOverrides({});
    setFunnelId("");
    setStageId("");
    setSelectedTagIds([]);
    setNewTagName("");
    setImportMode("funnel");
    setEventName("");
    setCampaignId(ALL_CAMPAIGNS);
    setBatchProgress({ current: 0, total: 0 });
    setResult(null);
  };

  const handleClose = () => { reset(); onClose(); };

  // ── File handling ──
  const processFile = (text: string, name?: string) => {
    const h = parseCSVHeaders(text);
    const count = countDataLines(text);
    if (count < 1) return;
    setCsvText(text);
    setFileName(name || "colado.csv");
    setHeaders(h);
    setLineCount(count);

    // Auto-detect fields
    const initial: Record<string, string | null> = {};
    for (const key of Object.keys(FIELD_LABELS)) {
      initial[key] = findField(h, key);
    }
    setFieldOverrides(initial);
    setStep("mapping");
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) return;
    const reader = new FileReader();
    reader.onload = (e) => processFile(e.target?.result as string, file.name);
    reader.readAsText(file, "utf-8");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Create new tag inline ──
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const { data: ws } = await supabase.from("workspaces").select("id").limit(1).single();
    if (!ws) return;

    const { data: created } = await supabase
      .from("tags")
      .insert({
        workspace_id: ws.id,
        name: newTagName.trim(),
        scope: "global",
        color: "#6366F1",
      })
      .select("id, name, color, scope, funnel_id")
      .single();

    if (created) {
      setTags((prev) => [...prev, created as DbTag]);
      setSelectedTagIds((prev) => [...prev, created.id]);
      setNewTagName("");
    }
  };

  // ── Process import ──
  const handleProcess = async () => {
    setStep("processing");
    const batches = splitCSVIntoBatches(csvText);
    setBatchProgress({ current: 0, total: batches.length });

    const cleanOverrides: Record<string, string> = {};
    for (const [key, val] of Object.entries(fieldOverrides)) {
      if (val) cleanOverrides[key] = val;
    }

    if (importMode === "event_only") {
      let accFound = 0;
      let accNotFound = 0;
      let accNoContact = 0;
      let accEventsCreated = 0;

      for (let i = 0; i < batches.length; i++) {
        setBatchProgress({ current: i + 1, total: batches.length });
        try {
          const { data, error } = await supabase.functions.invoke("import-leads", {
            body: {
              mode: "event_only",
              csvText: batches[i],
              fieldOverrides: cleanOverrides,
              eventName,
              campaignId: campaignId === ALL_CAMPAIGNS ? undefined : campaignId,
              tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
            },
          });
          if (error) { console.error(`[ImportLeads:event] batch ${i + 1} error:`, error); continue; }
          accFound += data.found ?? 0;
          accNotFound += data.not_found ?? 0;
          accNoContact += data.no_contact ?? 0;
          accEventsCreated += data.events_created ?? 0;
        } catch (err) {
          console.error(`[ImportLeads:event] batch ${i + 1} threw:`, err);
        }
      }

      setResult({ found: accFound, not_found: accNotFound, no_contact: accNoContact, events_created: accEventsCreated });
    } else if (importMode === "backfill") {
      let accCreated = 0;
      let accDuplicateRegs = 0;
      let accNoContact = 0;
      let accEventsCreated = 0;

      for (let i = 0; i < batches.length; i++) {
        setBatchProgress({ current: i + 1, total: batches.length });
        try {
          const { data, error } = await supabase.functions.invoke("import-leads", {
            body: {
              mode: "backfill",
              csvText: batches[i],
              funnelId,
              stageId,
              tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
            },
          });
          if (error) { console.error(`[ImportLeads:backfill] batch ${i + 1} error:`, error); continue; }
          accCreated += data.created ?? 0;
          accDuplicateRegs += data.duplicate_registrations ?? 0;
          accNoContact += data.no_contact ?? 0;
          accEventsCreated += data.events_created ?? 0;
        } catch (err) {
          console.error(`[ImportLeads:backfill] batch ${i + 1} threw:`, err);
        }
      }

      setResult({ created: accCreated, duplicate_registrations: accDuplicateRegs, no_contact: accNoContact, events_created: accEventsCreated });
    } else {
      let accImported = 0;
      let accDuplicates = 0;
      let accDuplicatesUpdated = 0;
      let accNoContact = 0;

      for (let i = 0; i < batches.length; i++) {
        setBatchProgress({ current: i + 1, total: batches.length });
        try {
          const { data, error } = await supabase.functions.invoke("import-leads", {
            body: {
              csvText: batches[i],
              fieldOverrides: cleanOverrides,
              funnelId,
              stageId,
              tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
            },
          });
          if (error) { console.error(`[ImportLeads] batch ${i + 1} error:`, error); continue; }
          accImported += data.imported ?? 0;
          accDuplicates += data.duplicates ?? 0;
          accDuplicatesUpdated += data.duplicates_updated ?? 0;
          accNoContact += data.no_contact ?? 0;
        } catch (err) {
          console.error(`[ImportLeads] batch ${i + 1} threw:`, err);
        }
      }

      setResult({ imported: accImported, duplicates: accDuplicates, duplicates_updated: accDuplicatesUpdated, no_contact: accNoContact });
    }

    setStep("result");
  };

  const handleConfirm = () => {
    onImport();
    handleClose();
  };

  const hasMinimumFields = !!(fieldOverrides["telefone"] || fieldOverrides["email"]);

  const canProcess = importMode === "funnel" || importMode === "backfill"
    ? hasMinimumFields && !!funnelId && !!stageId
    : hasMinimumFields && !!eventName.trim();

  const stepLabel = step === "upload" ? "Upload" : step === "mapping" ? "Mapeamento" : step === "processing" ? "Processando" : "Resultado";
  const stepNum = step === "upload" ? 1 : step === "mapping" ? 2 : step === "processing" ? 3 : 4;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold">Importar Leads</DialogTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Etapa {stepNum} — {stepLabel}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Arraste um arquivo .csv aqui</p>
                <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou cole o CSV abaixo</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Textarea
              placeholder={`nome,telefone,email\nAna Silva,11999990001,ana@email.com`}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="h-28 font-mono text-xs bg-card border-border resize-none"
            />

            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                <Download className="w-3.5 h-3.5" />
                Baixar template CSV
              </Button>
              <Button size="sm" disabled={!pasteText.trim()} onClick={() => processFile(pasteText)} className="gap-1.5 text-xs">
                Continuar <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Mapping ── */}
        {step === "mapping" && (
          <div className="space-y-4">
            {/* File info */}
            <div className="bg-muted/40 border border-border rounded-lg p-4 flex items-center gap-3">
              <FileText className="w-8 h-8 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{fileName}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {lineCount.toLocaleString("pt-BR")} linhas · {headers.length} colunas
                </p>
              </div>
            </div>

            {/* Mode selector */}
            <Tabs value={importMode} onValueChange={(v) => setImportMode(v as ImportMode)}>
              <TabsList className="w-full">
                <TabsTrigger value="funnel" className="flex-1 text-xs gap-1.5">
                  <Upload className="w-3 h-3" />
                  Funil
                </TabsTrigger>
                <TabsTrigger value="backfill" className="flex-1 text-xs gap-1.5">
                  <History className="w-3 h-3" />
                  Backfill
                </TabsTrigger>
                <TabsTrigger value="event_only" className="flex-1 text-xs gap-1.5">
                  <Zap className="w-3 h-3" />
                  Evento
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {importMode === "backfill" && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-xs text-amber-300">
                  <strong>Backfill:</strong> Cada linha vira um evento individual com data/página/dispositivo. 
                  Cadastros repetidos do mesmo contato são marcados como "cadastro_repetido" com signup_count atualizado.
                </p>
              </div>
            )}

            {/* Field mapping */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 border-b border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Mapeamento de campos</p>
              </div>
              <div className="divide-y divide-border">
                {Object.entries(FIELD_LABELS).map(([key, label]) => {
                  const currentValue = fieldOverrides[key];
                  return (
                    <div key={key} className="flex items-center gap-2 px-3 py-2">
                      {currentValue ? (
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <X className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                      )}
                      <span className="text-xs font-medium text-foreground w-20">{label}</span>
                      <Select
                        value={currentValue || NONE_VALUE}
                        onValueChange={(v) => setFieldOverrides((prev) => ({ ...prev, [key]: v === NONE_VALUE ? null : v }))}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1 border-border bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE} className="text-xs text-muted-foreground">— nenhuma —</SelectItem>
                          {headers.map((h) => (
                            <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>

            {!hasMinimumFields && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg p-3">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Mapeie pelo menos <strong>Telefone</strong> ou <strong>E-mail</strong> para continuar.
              </div>
            )}

            {/* Funnel mode: funnel + stage selectors */}
            {(importMode === "funnel" || importMode === "backfill") && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Funil de destino</Label>
                  {loadingFunnels ? (
                    <div className="flex items-center gap-2 h-8"><Loader2 className="w-3.5 h-3.5 animate-spin" /></div>
                  ) : (
                    <Select value={funnelId} onValueChange={(v) => {
                      setFunnelId(v);
                      const f = funnels.find((f) => f.id === v);
                      const stages = (f?.funnel_stages || []).sort((a, b) => a.order_index - b.order_index);
                      setStageId(stages[0]?.id || "");
                    }}>
                      <SelectTrigger className="h-8 text-xs bg-card border-border">
                        <SelectValue placeholder="Selecionar funil" />
                      </SelectTrigger>
                      <SelectContent>
                        {funnels.map((f) => (
                          <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Etapa inicial</Label>
                  <Select value={stageId} onValueChange={setStageId}>
                    <SelectTrigger className="h-8 text-xs bg-card border-border">
                      <SelectValue placeholder="Selecionar etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedStages.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Event mode: campaign + event name */}
            {importMode === "event_only" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Campanha</Label>
                  <Select value={campaignId} onValueChange={setCampaignId}>
                    <SelectTrigger className="h-8 text-xs bg-card border-border">
                      <SelectValue placeholder="Selecionar campanha" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_CAMPAIGNS} className="text-xs">Todas as campanhas</SelectItem>
                      {campaigns.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Registra o evento em todos os funis da campanha onde o lead já está posicionado.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome do evento</Label>
                  <Input
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="ex: entry_group"
                    className="h-8 text-xs bg-card border-border"
                  />
                  {!eventName.trim() && (
                    <p className="text-[10px] text-amber-400">Informe o nome do evento para continuar.</p>
                  )}
                </div>
              </div>
            )}

            {/* Tags section */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Tag className="w-3 h-3" />
                Tags (opcional)
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => setSelectedTagIds((prev) =>
                        selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                      )}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                        selected
                          ? "border-primary bg-primary/15 text-primary font-medium"
                          : "border-border bg-muted/40 text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
                <div className="flex items-center gap-1">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateTag(); } }}
                    placeholder="Nova tag..."
                    className="h-6 text-[10px] w-24 px-2 border-border bg-card"
                  />
                  {newTagName.trim() && (
                    <Button size="sm" variant="ghost" onClick={handleCreateTag} className="h-6 w-6 p-0">
                      <Plus className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-1">
              <Button variant="ghost" size="sm" onClick={() => setStep("upload")} className="text-xs">Voltar</Button>
              <Button
                size="sm"
                disabled={!canProcess}
                onClick={handleProcess}
                className="gap-1.5 text-xs"
              >
                {importMode === "event_only"
                  ? `Registrar evento para ${lineCount.toLocaleString("pt-BR")} leads`
                  : `Importar ${lineCount.toLocaleString("pt-BR")} leads`
                }
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Processing ── */}
        {step === "processing" && (
          <div className="py-8 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm font-medium text-foreground">
                {importMode === "event_only" ? "Registrando eventos..." : "Importando leads..."}
              </p>
              <p className="text-xs text-muted-foreground">
                Batch {batchProgress.current} de {batchProgress.total}
              </p>
            </div>
            {batchProgress.total > 0 && (
              <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-2" />
            )}
          </div>
        )}

        {/* ── Step 4: Result ── */}
        {step === "result" && result && (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              {/* Backfill mode result */}
              {result.created !== undefined ? (
                <>
                  <div className="flex-1 min-w-[100px] rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 flex flex-col items-center gap-1">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                    <span className="text-2xl font-bold text-emerald-400">{result.created}</span>
                    <span className="text-xs text-muted-foreground text-center">novos leads</span>
                  </div>
                  <div className="flex-1 min-w-[100px] rounded-lg bg-primary/10 border border-primary/20 p-4 flex flex-col items-center gap-1">
                    <Zap className="w-6 h-6 text-primary" />
                    <span className="text-2xl font-bold text-primary">{result.events_created}</span>
                    <span className="text-xs text-muted-foreground text-center">eventos criados</span>
                  </div>
                  {(result.duplicate_registrations ?? 0) > 0 && (
                    <div className="flex-1 min-w-[100px] rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 flex flex-col items-center gap-1">
                      <History className="w-6 h-6 text-amber-400" />
                      <span className="text-2xl font-bold text-amber-400">{result.duplicate_registrations}</span>
                      <span className="text-xs text-muted-foreground text-center">cadastros repetidos</span>
                    </div>
                  )}
                </>
              ) : result.found !== undefined ? (
                <>
                  <div className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 flex flex-col items-center gap-1">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                    <span className="text-2xl font-bold text-emerald-400">{result.found}</span>
                    <span className="text-xs text-muted-foreground text-center">encontrados</span>
                  </div>
                  <div className="flex-1 rounded-lg bg-primary/10 border border-primary/20 p-4 flex flex-col items-center gap-1">
                    <Zap className="w-6 h-6 text-primary" />
                    <span className="text-2xl font-bold text-primary">{result.events_created}</span>
                    <span className="text-xs text-muted-foreground text-center">eventos criados</span>
                  </div>
                  {(result.not_found ?? 0) > 0 && (
                    <div className="flex-1 rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 flex flex-col items-center gap-1">
                      <AlertCircle className="w-6 h-6 text-amber-400" />
                      <span className="text-2xl font-bold text-amber-400">{result.not_found}</span>
                      <span className="text-xs text-muted-foreground text-center">não encontrados</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Funnel mode result */}
                  <div className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 flex flex-col items-center gap-1">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                    <span className="text-2xl font-bold text-emerald-400">{result.imported}</span>
                    <span className="text-xs text-muted-foreground text-center">importados</span>
                  </div>
                  {(result.duplicates ?? 0) > 0 && (
                    <div className="flex-1 rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 flex flex-col items-center gap-1">
                      <AlertCircle className="w-6 h-6 text-amber-400" />
                      <span className="text-2xl font-bold text-amber-400">{result.duplicates}</span>
                      <span className="text-xs text-muted-foreground text-center">duplicados atualizados</span>
                      <span className="text-[9px] text-muted-foreground text-center leading-tight">cadastros incrementados</span>
                    </div>
                  )}
                </>
              )}
              {result.no_contact > 0 && (
                <div className="flex-1 rounded-lg bg-destructive/10 border border-destructive/20 p-4 flex flex-col items-center gap-1">
                  <X className="w-6 h-6 text-destructive" />
                  <span className="text-2xl font-bold text-destructive">{result.no_contact}</span>
                  <span className="text-xs text-muted-foreground text-center">sem contato</span>
                </div>
              )}
            </div>

            <Button size="sm" onClick={handleConfirm} className="w-full text-xs">
              Fechar e ver leads
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
