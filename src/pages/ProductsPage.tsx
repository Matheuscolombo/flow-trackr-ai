import { Package, AlertTriangle, BookOpen } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { UnmappedProductsList } from "@/components/products/UnmappedProductsList";
import { ProductCatalogTable } from "@/components/products/ProductCatalogTable";
import { useProductCatalog } from "@/hooks/useProductCatalog";
import { useUnmappedProducts } from "@/hooks/useProductCatalog";

export default function ProductsPage() {
  const { data: catalog } = useProductCatalog();
  const { data: unmapped = [] } = useUnmappedProducts();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Package className="w-4.5 h-4.5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Catálogo de Produtos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mapeie IDs numéricos para nomes reais. O nome aparece automaticamente em todo o sistema.
          </p>
        </div>
      </div>

      {/* Section 1 — Unmapped */}
      {unmapped.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-foreground">IDs sem nome</h2>
          </div>
          <UnmappedProductsList />
        </section>
      )}

      <Separator />

      {/* Section 2 — Catalog */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Catálogo cadastrado</h2>
          </div>
          {catalog && catalog.products.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {catalog.products.length} produto{catalog.products.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <ProductCatalogTable />
      </section>
    </div>
  );
}
