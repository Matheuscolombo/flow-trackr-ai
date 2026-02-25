import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Product {
  id: string;
  workspace_id: string;
  platform: string | null;
  external_id: string | null;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductMapping {
  id: string;
  workspace_id: string;
  product_id: string;
  platform: string;
  external_name: string;
  created_at: string;
}

// Map format: "platform:external_name" → product_id
export type MappingIndex = Record<string, string>;
// Map format: product_id → canonical name
export type ProductNameMap = Record<string, string>;

export function useProductCatalog() {
  const { workspaceId } = useAuth();

  return useQuery({
    queryKey: ["product-catalog", workspaceId],
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{
      products: Product[];
      mappings: ProductMapping[];
      mappingIndex: MappingIndex;
      nameMap: ProductNameMap;
    }> => {
      const [productsRes, mappingsRes] = await Promise.all([
        (supabase as any).from("products").select("*").eq("workspace_id", workspaceId!).order("name"),
        (supabase as any).from("product_mappings").select("*").eq("workspace_id", workspaceId!),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (mappingsRes.error) throw mappingsRes.error;

      const products = (productsRes.data || []) as Product[];
      const mappings = (mappingsRes.data || []) as ProductMapping[];

      const mappingIndex: MappingIndex = {};
      for (const m of mappings) {
        mappingIndex[`${m.platform}:${m.external_name}`] = m.product_id;
      }

      const nameMap: ProductNameMap = {};
      for (const p of products) {
        nameMap[p.id] = p.name;
      }

      return { products, mappings, mappingIndex, nameMap };
    },
  });
}

// Returns ALL product stats from sale_events
export function useAllProductStats() {
  const { workspaceId } = useAuth();

  return useQuery({
    queryKey: ["all-product-stats", workspaceId],
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_all_product_stats" as any, {
        p_workspace_id: workspaceId!,
      });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

// Returns ALL unmapped product names from sale_events
export function useUnmappedProducts() {
  const { workspaceId } = useAuth();
  const { data: catalog } = useProductCatalog();
  const { data: allStats } = useAllProductStats();

  return useQuery({
    queryKey: ["unmapped-products", workspaceId, catalog?.mappings.length, allStats?.length],
    enabled: !!workspaceId && !!catalog && !!allStats,
    queryFn: async () => {
      return (allStats || []).filter((row) => {
        const key = `${row.platform}:${row.product_name}`;
        return !catalog?.mappingIndex[key];
      });
    },
  });
}

// Aggregate stats per canonical product using mappings
export function useCatalogProductStats() {
  const { data: catalog } = useProductCatalog();
  const { data: allStats } = useAllProductStats();

  if (!catalog || !allStats) return {};

  const statsMap: Record<string, { total_sales: number; total_revenue: number }> = {};

  for (const row of allStats) {
    const key = `${row.platform}:${row.product_name}`;
    const productId = catalog.mappingIndex[key];
    if (!productId) continue;
    if (!statsMap[productId]) statsMap[productId] = { total_sales: 0, total_revenue: 0 };
    statsMap[productId].total_sales += Number(row.total_sales || 0);
    statsMap[productId].total_revenue += Number(row.total_revenue || 0);
  }

  return statsMap;
}

// Create a canonical product + mapping in one go
export function useCreateProductWithMapping() {
  const { workspaceId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      name: string;
      description?: string;
      platform: string;
      external_name: string;
    }) => {
      // 1. Create canonical product
      const { data: product, error: pErr } = await (supabase as any)
        .from("products")
        .insert({
          workspace_id: workspaceId!,
          name: payload.name,
          description: payload.description || null,
        })
        .select()
        .single();

      if (pErr) throw pErr;

      // 2. Create mapping
      const { error: mErr } = await (supabase as any)
        .from("product_mappings")
        .insert({
          workspace_id: workspaceId!,
          product_id: product.id,
          platform: payload.platform,
          external_name: payload.external_name,
        });

      if (mErr) throw mErr;

      return product as Product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["unmapped-products"] });
    },
  });
}

// Link an external name to an existing canonical product
export function useLinkToProduct() {
  const { workspaceId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      product_id: string;
      platform: string;
      external_name: string;
    }) => {
      const { error } = await (supabase as any)
        .from("product_mappings")
        .insert({
          workspace_id: workspaceId!,
          product_id: payload.product_id,
          platform: payload.platform,
          external_name: payload.external_name,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["unmapped-products"] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { id: string; name: string; description?: string }) => {
      const { error } = await (supabase as any)
        .from("products")
        .update({ name: payload.name, description: payload.description || null })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-catalog"] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("products")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["unmapped-products"] });
    },
  });
}

export function useDeleteMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("product_mappings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["unmapped-products"] });
    },
  });
}

// Utility: resolve a product_name to its canonical display name
export function resolveProductName(
  productName: string,
  platform: string,
  catalog: { mappingIndex: MappingIndex; nameMap: ProductNameMap } | undefined
): { name: string; isMapped: boolean } {
  if (!catalog) return { name: productName, isMapped: false };
  const key = `${platform}:${productName}`;
  const productId = catalog.mappingIndex[key];
  if (productId && catalog.nameMap[productId]) {
    return { name: catalog.nameMap[productId], isMapped: true };
  }
  return { name: productName, isMapped: false };
}
