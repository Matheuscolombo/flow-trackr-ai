import { useState, useMemo } from "react";
import { Pencil, Trash2, Loader2, Check, X, ShoppingCart, DollarSign, Search, Package, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const platformColors: Record<string, string> = {
  eduzz: "bg-blue-600/20 text-blue-300 border-blue-500/40",
  hotmart: "bg-red-500/20 text-red-300 border-red-500/40",
  kiwify: "bg-green-500/20 text-green-300 border-green-500/40",
  ticto: "bg-violet-500/20 text-violet-300 border-violet-500/40",
  guru: "bg-amber-500/20 text-amber-300 border-amber-500/40",
};

function MappingBadge({ mapping, onDelete }: { mapping: ProductMapping; onDelete: () => void }) {
  const isNumeric = /^\d+$/.test(mapping.external_name);
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-2 py-1 h-auto border font-medium capitalize gap-1.5 group cursor-default ${
        platformColors[mapping.platform] || "bg-muted text-muted-foreground border-border"
      }`}
    >
      <span className="font-semibold">{mapping.platform}</span>
      <span className="opacity-50">·</span>
      <span>{isNumeric ? `ID ${mapping.external_name}` : mapping.external_name}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 hover:text-destructive"
        title="Remover vínculo"
      >
        <X className="w-3 h-3" />
      </button>
    </Badge>
  );
}

function EditCard({ product, onDone }: { product: Product; onDone: () => void }) {
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
    <Card className="border-primary/50 bg-card">
      <CardContent className="p-4 space-y-3">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Nome do produto"
        />
        <Input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="h-8 text-sm"
          placeholder="Descrição (opcional)"
        />
        <div className="flex items-center gap-2 justify-end">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onDone}>
            <X className="w-3.5 h-3.5 mr-1" /> Cancelar
          </Button>
          <Button size="sm" className="h-7 px-3" onClick={handleSave} disabled={!name.trim() || updateProduct.isPending}>
            {updateProduct.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductCard({
  product,
  mappings,
  stats,
  onEdit,
  onDelete,
  onDeleteMapping,
  isDeleting,
}: {
  product: Product;
  mappings: ProductMapping[];
  stats?: { total_sales: number; total_revenue: number };
  onEdit: () => void;
  onDelete: () => void;
  onDeleteMapping: (m: ProductMapping) => void;
  isDeleting: boolean;
}) {
  return (
    <Card className="bg-card hover:bg-[hsl(var(--sentinel-card-hover))] transition-colors group">
      <CardContent className="p-4 space-y-3">
        {/* Header: name + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground truncate">{product.name}</h3>
            {product.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{product.description}</p>
            )}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete} disabled={isDeleting}>
              <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
            </Button>
          </div>
        </div>

        {/* Mappings */}
        <div className="flex flex-wrap gap-1.5">
          {mappings.length > 0 ? (
            mappings.map((m) => (
              <MappingBadge key={m.id} mapping={m} onDelete={() => onDeleteMapping(m)} />
            ))
          ) : (
            <span className="text-[10px] text-muted-foreground italic">Sem vínculos</span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 pt-1 border-t border-border">
          <div className="flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm tabular-nums font-medium text-muted-foreground">
              {stats ? stats.total_sales.toLocaleString("pt-BR") : "—"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm tabular-nums font-semibold text-[hsl(var(--sentinel-success))]">
              {stats ? `R$ ${stats.total_revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="bg-card">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="flex gap-4 pt-1 border-t border-border">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ProductCardGrid() {
  const { data, isLoading } = useProductCatalog();
  const deleteProduct = useDeleteProduct();
  const deleteMapping = useDeleteMapping();
  const catalogStats = useCatalogProductStats();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("name-asc");

  const products = data?.products || [];
  const mappings = data?.mappings || [];

  // Group mappings by product_id
  const mappingsByProduct: Record<string, ProductMapping[]> = {};
  for (const m of mappings) {
    if (!mappingsByProduct[m.product_id]) mappingsByProduct[m.product_id] = [];
    mappingsByProduct[m.product_id].push(m);
  }

  // Unique platforms from mappings
  const platforms = Array.from(new Set(mappings.map((m) => m.platform))).sort();

  // Filter products
  const filtered = products.filter((p) => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchesPlatform =
      !platformFilter ||
      (mappingsByProduct[p.id] || []).some((m) => m.platform === platformFilter);
    return matchesSearch && matchesPlatform;
  });

  // Sort products
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const statsA = catalogStats[a.id] || { total_sales: 0, total_revenue: 0 };
      const statsB = catalogStats[b.id] || { total_sales: 0, total_revenue: 0 };
      const mappingsA = (mappingsByProduct[a.id] || []).length;
      const mappingsB = (mappingsByProduct[b.id] || []).length;
      switch (sortBy) {
        case "name-asc": return a.name.localeCompare(b.name, "pt-BR");
        case "name-desc": return b.name.localeCompare(a.name, "pt-BR");
        case "revenue-desc": return statsB.total_revenue - statsA.total_revenue;
        case "revenue-asc": return statsA.total_revenue - statsB.total_revenue;
        case "sales-desc": return statsB.total_sales - statsA.total_sales;
        case "sales-asc": return statsA.total_sales - statsB.total_sales;
        case "recent": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "mappings": return mappingsB - mappingsA;
        default: return 0;
      }
    });
    return arr;
  }, [filtered, sortBy, catalogStats, mappingsByProduct]);

  if (isLoading) return <LoadingSkeleton />;

  if (products.length === 0) {
    return (
      <div className="text-center py-14">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
          <Package className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Nenhum produto cadastrado</p>
        <p className="text-xs text-muted-foreground mt-1">
          Catalogue os IDs acima para organizar seus produtos.
        </p>
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
    <div className="space-y-4">
      {/* Search + platform filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-8 w-auto min-w-[180px] text-xs gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Nome (A → Z)</SelectItem>
            <SelectItem value="name-desc">Nome (Z → A)</SelectItem>
            <SelectItem value="revenue-desc">Receita (maior)</SelectItem>
            <SelectItem value="revenue-asc">Receita (menor)</SelectItem>
            <SelectItem value="sales-desc">Vendas (maior)</SelectItem>
            <SelectItem value="sales-asc">Vendas (menor)</SelectItem>
            <SelectItem value="recent">Mais recente</SelectItem>
            <SelectItem value="mappings">Mais vínculos</SelectItem>
          </SelectContent>
        </Select>
        {platforms.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setPlatformFilter(null)}
              className={`text-[10px] px-2.5 py-1 rounded-full border font-medium capitalize transition-colors ${
                !platformFilter
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "bg-muted text-muted-foreground border-border hover:bg-secondary"
              }`}
            >
              Todos
            </button>
            {platforms.map((p) => (
              <button
                key={p}
                onClick={() => setPlatformFilter(platformFilter === p ? null : p)}
                className={`text-[10px] px-2.5 py-1 rounded-full border font-medium capitalize transition-colors ${
                  platformFilter === p
                    ? `${platformColors[p] || "bg-primary/20 text-primary border-primary/40"}`
                    : "bg-muted text-muted-foreground border-border hover:bg-secondary"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cards grid */}
      {sorted.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          Nenhum produto encontrado.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sorted.map((product) =>
            editingId === product.id ? (
              <EditCard key={product.id} product={product} onDone={() => setEditingId(null)} />
            ) : (
              <ProductCard
                key={product.id}
                product={product}
                mappings={mappingsByProduct[product.id] || []}
                stats={catalogStats[product.id]}
                onEdit={() => setEditingId(product.id)}
                onDelete={() => handleDelete(product)}
                onDeleteMapping={handleDeleteMapping}
                isDeleting={deleteProduct.isPending}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
