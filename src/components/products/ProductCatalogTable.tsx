import { useState } from "react";
import { Pencil, Trash2, Loader2, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useProductCatalog,
  useUpdateProduct,
  useDeleteProduct,
  useDeleteMapping,
  useCatalogProductStats,
  Product,
  ProductMapping,
} from "@/hooks/useProductCatalog";
import { useToast } from "@/hooks/use-toast";

const sourceColors: Record<string, string> = {
  eduzz: "bg-blue-600/15 text-blue-300 border-blue-600/30",
  hotmart: "bg-red-500/15 text-red-400 border-red-500/30",
  kiwify: "bg-green-500/15 text-green-400 border-green-500/30",
  ticto: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  guru: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

interface EditRowProps {
  product: Product;
  onDone: () => void;
}

function EditRow({ product, onDone }: EditRowProps) {
  const [name, setName] = useState(product.name);
  const [desc, setDesc] = useState(product.description || "");
  const updateProduct = useUpdateProduct();
  const { toast } = useToast();

  async function handleSave() {
    if (!name.trim()) return;
    try {
      await updateProduct.mutateAsync({
        id: product.id,
        name: name.trim(),
        description: desc.trim() || undefined,
      });
      toast({ title: "Produto atualizado!" });
      onDone();
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  }

  return (
    <TableRow>
      <TableCell colSpan={3}>
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-sm flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Nome do produto"
          />
          <Input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="h-7 text-sm flex-1"
            placeholder="Descrição (opcional)"
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave} disabled={!name.trim() || updateProduct.isPending}>
            {updateProduct.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 text-sentinel-success" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDone}>
            <X className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function MappingBadge({ mapping, onDelete }: { mapping: ProductMapping; onDelete: () => void }) {
  const isNumeric = /^\d+$/.test(mapping.external_name);
  return (
    <Badge
      variant="outline"
      className={`text-[9px] px-1.5 py-0.5 h-auto border font-medium capitalize gap-1 group ${
        sourceColors[mapping.platform] || "bg-muted text-muted-foreground border-border"
      }`}
    >
      {mapping.platform} · {isNumeric ? `ID ${mapping.external_name}` : mapping.external_name}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
        title="Remover vínculo"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </Badge>
  );
}

export function ProductCatalogTable() {
  const { data, isLoading } = useProductCatalog();
  const deleteProduct = useDeleteProduct();
  const deleteMapping = useDeleteMapping();
  const catalogStats = useCatalogProductStats();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);

  const products = data?.products || [];
  const mappings = data?.mappings || [];

  // Group mappings by product_id
  const mappingsByProduct: Record<string, ProductMapping[]> = {};
  for (const m of mappings) {
    if (!mappingsByProduct[m.product_id]) mappingsByProduct[m.product_id] = [];
    mappingsByProduct[m.product_id].push(m);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Carregando catálogo...</span>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <p className="text-sm">Nenhum produto cadastrado ainda.</p>
        <p className="text-xs mt-1">Catalogue os produtos acima para começar.</p>
      </div>
    );
  }

  async function handleDelete(product: Product) {
    if (!confirm(`Excluir o produto "${product.name}" e todos os seus vínculos?`)) return;
    try {
      await deleteProduct.mutateAsync(product.id);
      toast({ title: "Produto excluído." });
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  }

  async function handleDeleteMapping(mapping: ProductMapping) {
    try {
      await deleteMapping.mutateAsync(mapping.id);
      toast({ title: "Vínculo removido." });
    } catch {
      toast({ title: "Erro ao remover vínculo", variant: "destructive" });
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Nome</TableHead>
          <TableHead className="text-xs">Vínculos (plataforma · identificador)</TableHead>
          <TableHead className="text-xs text-right">Vendas</TableHead>
          <TableHead className="text-xs text-right">Receita</TableHead>
          <TableHead className="text-xs w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => {
          const stats = catalogStats[product.id];
          return editingId === product.id ? (
            <EditRow key={product.id} product={product} onDone={() => setEditingId(null)} />
          ) : (
            <TableRow key={product.id}>
              <TableCell>
                <div>
                  <span className="text-sm font-medium">{product.name}</span>
                  {product.description && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{product.description}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(mappingsByProduct[product.id] || []).map((m) => (
                    <MappingBadge key={m.id} mapping={m} onDelete={() => handleDeleteMapping(m)} />
                  ))}
                  {!(mappingsByProduct[product.id]?.length) && (
                    <span className="text-[10px] text-muted-foreground">Sem vínculos</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                {stats ? stats.total_sales.toLocaleString("pt-BR") : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                {stats ? `R$ ${stats.total_revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(product.id)}>
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleDelete(product)}
                    disabled={deleteProduct.isPending}
                  >
                    <Trash2 className="w-3 h-3 text-destructive/70" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
