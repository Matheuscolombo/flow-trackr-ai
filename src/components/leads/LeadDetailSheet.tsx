import { useEffect, useState } from "react";
import { Mail, Phone, Monitor, Smartphone, ShoppingBag, Loader2, CreditCard, Repeat, Star, AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useProductCatalog, resolveProductName } from "@/hooks/useProductCatalog";

interface DbLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  utm_source: string | null;
  utm_content: string | null;
  device: string | null;
  purchase_count: number;
  total_revenue: number;
  is_subscriber: boolean;
  is_ghost: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface SaleEvent {
  id: string;
  product_name: string;
  net_value: number;
  gross_value: number;
  paid_at: string | null;
  sale_created_at: string | null;
  created_at: string;
  platform: string;
  status: string;
}

interface LeadDetailSheetProps {
  lead: DbLead | null;
  open: boolean;
  onClose: () => void;
}

const sourceColors: Record<string, string> = {
  eduzz: "bg-blue-600/15 text-blue-300 border-blue-600/30",
  hotmart: "bg-red-500/15 text-red-400 border-red-500/30",
  kiwify: "bg-green-500/15 text-green-400 border-green-500/30",
  ticto: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  guru: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") return null; // paid is the default, no need for badge
  if (status === "refunded") {
    return (
      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border font-medium bg-red-500/15 text-red-400 border-red-500/30">
        reembolsado
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border font-medium bg-amber-500/15 text-amber-400 border-amber-500/30">
        pendente
      </Badge>
    );
  }
  return null;
}

function SaleSummary({ sales }: { sales: SaleEvent[] }) {
  const paid = sales.filter((s) => s.status === "paid").length;
  const refunded = sales.filter((s) => s.status === "refunded").length;
  const pending = sales.filter((s) => s.status === "pending").length;

  if (refunded === 0 && pending === 0) return null;

  const parts: string[] = [];
  if (paid > 0) parts.push(`${paid} paga${paid !== 1 ? "s" : ""}`);
  if (refunded > 0) parts.push(`${refunded} reembolsada${refunded !== 1 ? "s" : ""}`);
  if (pending > 0) parts.push(`${pending} pendente${pending !== 1 ? "s" : ""}`);

  return (
    <p className="text-[10px] text-muted-foreground mb-2">{parts.join(" · ")}</p>
  );
}

export function LeadDetailSheet({ lead, open, onClose }: LeadDetailSheetProps) {
  const [sales, setSales] = useState<SaleEvent[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const { data: catalogData } = useProductCatalog();

  useEffect(() => {
    if (!open || !lead) return;

    setLoadingSales(true);
    setSales([]);

    supabase
      .from("sale_events")
      .select("id, product_name, net_value, gross_value, paid_at, sale_created_at, created_at, platform, status, subscription_contract, is_subscription")
      .eq("lead_id", lead.id)
      .order("paid_at", { ascending: false, nullsFirst: true })
      .then(({ data }) => {
        // Sort: pending (no date) first, then by paid_at desc
        const sorted = ((data as SaleEvent[]) || []).sort((a, b) => {
          if (a.status === "pending" && !a.paid_at && b.paid_at) return -1;
          if (b.status === "pending" && !b.paid_at && a.paid_at) return 1;
          if (!a.paid_at && !b.paid_at) return 0;
          if (!a.paid_at) return -1;
          if (!b.paid_at) return 1;
          return b.paid_at.localeCompare(a.paid_at);
        });
        setSales(sorted);
        setLoadingSales(false);
      });
  }, [open, lead]);

  if (!lead) return null;

  const initials = (lead.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const isMultiBuyer = lead.purchase_count >= 2;
  const isBuyer = lead.purchase_count >= 1;

  const originLabel = lead.utm_source
    ? lead.utm_source
    : lead.is_ghost
    ? "importado"
    : "orgânico";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[380px] sm:w-[420px] overflow-y-auto p-0 flex flex-col gap-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-sm font-bold text-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-bold text-foreground leading-tight truncate">
                {lead.name || "Sem nome"}
              </SheetTitle>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {lead.is_ghost && (
                  <Badge variant="outline" className="text-[10px] px-1.5 h-4 border bg-muted text-muted-foreground border-border">
                    👻 fantasma
                  </Badge>
                )}
                {isMultiBuyer && (
                  <Badge variant="outline" className="text-[10px] px-1.5 h-4 border bg-primary/10 text-primary border-primary/20">
                    <Star className="w-2.5 h-2.5 mr-0.5" />
                    multi-comprador
                  </Badge>
                )}
                {lead.is_subscriber && (
                  <Badge variant="outline" className="text-[10px] px-1.5 h-4 border bg-accent/10 text-accent-foreground border-accent/20">
                    <Repeat className="w-2.5 h-2.5 mr-0.5" />
                    assinante
                  </Badge>
                )}
                {isBuyer && !isMultiBuyer && (
                  <Badge variant="outline" className="text-[10px] px-1.5 h-4 border bg-sentinel-success/10 text-sentinel-success border-sentinel-success/20">
                    <CreditCard className="w-2.5 h-2.5 mr-0.5" />
                    comprador
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Separator />

        {/* Contact */}
        <div className="px-5 py-4 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contato</p>

          {lead.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-foreground truncate">{lead.email}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-mono text-foreground">{lead.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {lead.device === "Mobile" ? (
              <Smartphone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            ) : (
              <Monitor className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="text-xs text-muted-foreground">
              {lead.device || "Desconhecido"} · {originLabel}
            </span>
          </div>
          {lead.utm_content && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded truncate max-w-full">
                {lead.utm_content}
              </span>
            </div>
          )}
        </div>

        <Separator />

        {/* Purchases */}
        <div className="px-5 py-4 flex-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Compras</p>
            {lead.purchase_count > 0 && (
              <span className="text-xs font-bold text-sentinel-success">
                R$ {lead.total_revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} líquido
              </span>
            )}
          </div>

          {!loadingSales && sales.length > 0 && <SaleSummary sales={sales} />}

          {loadingSales ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ShoppingBag className="w-8 h-8 text-muted-foreground/20 mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma compra registrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sales.map((sale) => {
                const isRefunded = sale.status === "refunded";
                const isPending = sale.status === "pending";
                const isNeutral = isRefunded || isPending;
                const { name: displayName, isMapped } = resolveProductName(
                  sale.product_name,
                  sale.platform,
                  catalogData ? { mappingIndex: catalogData.mappingIndex, nameMap: catalogData.nameMap } : undefined
                );

                return (
                  <div
                    key={sale.id}
                    className={`rounded-lg border p-3 space-y-1 ${
                      isRefunded
                        ? "border-red-500/20 bg-red-500/5"
                        : isPending
                        ? "border-amber-500/20 bg-amber-500/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-medium leading-tight flex-1 flex items-center gap-1 ${isNeutral ? "text-muted-foreground" : "text-foreground"}`}>
                        {displayName}
                        {!isMapped && (
                          <span title="ID sem nome cadastrado — vá em Produtos para nomear">
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                          </span>
                        )}
                      </p>
                      <div className="flex flex-col items-end shrink-0">
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            isRefunded
                              ? "line-through text-muted-foreground"
                              : isPending
                              ? "text-muted-foreground"
                              : "text-sentinel-success"
                          }`}
                        >
                          R$ {sale.net_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        {sale.gross_value > 0 && sale.gross_value !== sale.net_value && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            bruto: R$ {sale.gross_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 h-4 border font-medium capitalize ${
                          sourceColors[sale.platform] || "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {sale.platform}
                      </Badge>
                      <StatusBadge status={sale.status} />
                      {(sale.paid_at || sale.sale_created_at || sale.created_at) && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(sale.paid_at || sale.sale_created_at || sale.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — entry date */}
        <Separator />
        <div className="px-5 py-3">
          <p className="text-[10px] text-muted-foreground">
            Lead desde {formatDate(lead.created_at)} · via {lead.source}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
