import { useState } from "react";
import { AlertTriangle, Tag, Loader2, ChevronDown, ChevronUp, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useUnmappedProducts,
  useCreateProductWithMapping,
  useLinkToProduct,
  useProductCatalog,
} from "@/hooks/useProductCatalog";
import { useToast } from "@/hooks/use-toast";

const sourceColors: Record<string, string> = {
  eduzz: "bg-blue-600/15 text-blue-300 border-blue-600/30",
  hotmart: "bg-red-500/15 text-red-400 border-red-500/30",
  kiwify: "bg-green-500/15 text-green-400 border-green-500/30",
  ticto: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  guru: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

type FormMode = "create" | "link";

interface InlineFormProps {
  platform: string;
  externalName: string;
  onDone: () => void;
}

function InlineForm({ platform, externalName, onDone }: InlineFormProps) {
  const [mode, setMode] = useState<FormMode>("create");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const createProduct = useCreateProductWithMapping();
  const linkProduct = useLinkToProduct();
  const { data: catalog } = useProductCatalog();
  const { toast } = useToast();

  const existingProducts = catalog?.products || [];

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      await createProduct.mutateAsync({
        name: name.trim(),
        description: desc.trim() || undefined,
        platform,
        external_name: externalName,
      });
      toast({ title: "Produto criado!", description: `"${name.trim()}" salvo com sucesso.` });
      onDone();
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  }

  async function handleLink() {
    if (!selectedProductId) return;
    try {
      await linkProduct.mutateAsync({
        product_id: selectedProductId,
        platform,
        external_name: externalName,
      });
      const productName = existingProducts.find((p) => p.id === selectedProductId)?.name;
      toast({ title: "Vinculado!", description: `Associado a "${productName}".` });
      onDone();
    } catch {
      toast({ title: "Erro ao vincular", variant: "destructive" });
    }
  }

  const isPending = createProduct.isPending || linkProduct.isPending;

  return (
    <div className="mt-3 p-3 rounded-lg bg-muted/60 border border-border space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-1">
        <Button
          size="sm"
          variant={mode === "create" ? "default" : "ghost"}
          className="h-7 text-xs gap-1.5"
          onClick={() => setMode("create")}
        >
          <Tag className="w-3 h-3" />
          Criar produto
        </Button>
        {existingProducts.length > 0 && (
          <Button
            size="sm"
            variant={mode === "link" ? "default" : "ghost"}
            className="h-7 text-xs gap-1.5"
            onClick={() => setMode("link")}
          >
            <Link2 className="w-3 h-3" />
            Vincular a existente
          </Button>
        )}
      </div>

      {mode === "create" ? (
        <>
          <Input
            autoFocus
            placeholder="Nome do produto (ex: Tinturas de Ervas)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Textarea
            placeholder="Descrição opcional..."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="text-sm min-h-[56px] resize-none"
          />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleCreate} disabled={!name.trim() || isPending}>
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Salvar"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDone}>
              Cancelar
            </Button>
          </div>
        </>
      ) : (
        <>
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Selecione um produto existente..." />
            </SelectTrigger>
            <SelectContent>
              {existingProducts.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleLink} disabled={!selectedProductId || isPending}>
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Vincular"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDone}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function UnmappedProductsList() {
  const { data: unmapped = [], isLoading } = useUnmappedProducts();
  const [openForm, setOpenForm] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Verificando produtos não mapeados...</span>
      </div>
    );
  }

  if (unmapped.length === 0) {
    return (
      <div className="rounded-lg border border-sentinel-success/20 bg-sentinel-success/5 px-4 py-3">
        <p className="text-sm text-sentinel-success font-medium">✓ Todos os produtos estão catalogados</p>
      </div>
    );
  }

  const visible = showAll ? unmapped : unmapped.slice(0, 5);
  const isNumeric = (s: string) => /^\d+$/.test(s);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="text-sm text-amber-400 font-medium">
          {unmapped.length} produto{unmapped.length !== 1 ? "s" : ""} sem catalogação
        </p>
      </div>

      {visible.map((item) => {
        const key = `${item.platform}:${item.product_name}`;
        const isOpen = openForm === key;

        return (
          <div key={key} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-xs font-semibold text-foreground ${isNumeric(item.product_name) ? "font-mono" : ""}`}>
                    {isNumeric(item.product_name) ? `ID: ${item.product_name}` : item.product_name}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 h-4 border font-medium capitalize ${
                      sourceColors[item.platform] || "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {item.platform}
                  </Badge>
                  {item.has_subscription && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border font-medium bg-blue-500/10 text-blue-400 border-blue-500/20">
                      assinatura
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {item.total_sales.toLocaleString("pt-BR")} venda{item.total_sales !== 1 ? "s" : ""} ·{" "}
                  R$ {item.total_revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0 gap-1.5"
                onClick={() => setOpenForm(isOpen ? null : key)}
              >
                <Tag className="w-3 h-3" />
                {isOpen ? "Fechar" : "Catalogar"}
              </Button>
            </div>

            {isOpen && (
              <InlineForm
                platform={item.platform}
                externalName={item.product_name}
                onDone={() => setOpenForm(null)}
              />
            )}
          </div>
        );
      })}

      {unmapped.length > 5 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-muted-foreground gap-1"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <><ChevronUp className="w-3 h-3" /> Mostrar menos</>
          ) : (
            <><ChevronDown className="w-3 h-3" /> Ver mais {unmapped.length - 5} produtos</>
          )}
        </Button>
      )}
    </div>
  );
}
