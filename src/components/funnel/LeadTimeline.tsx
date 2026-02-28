import { useState, useEffect, useMemo } from "react";
import { X, ChevronDown, ChevronRight, Clock, Zap, MapPin, Smartphone, Monitor, ExternalLink, Tag, GitBranch, ShoppingCart, Play, CheckCircle2, Users, MessageSquare, QrCode, TrendingUp, CreditCard, Star, Repeat, Loader2, UserPlus } from "lucide-react";
import type { Lead, LeadEvent, SaleEvent } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LeadTimelineProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
}

const sourceColors: Record<string, string> = {
  n8n: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  zapier: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  api: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  manual: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  typebot: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  webhook: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

const utmSourceColors: Record<string, string> = {
  facebook: "bg-blue-600/15 text-blue-400 border-blue-600/30",
  instagram: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  google: "bg-green-500/15 text-green-400 border-green-500/30",
};

// Paleta de cores para os funis no drawer
const funnelColors = [
  { dot: "bg-blue-400", text: "text-blue-400", bar: "bg-blue-500/20 border-blue-500/30" },
  { dot: "bg-violet-400", text: "text-violet-400", bar: "bg-violet-500/20 border-violet-500/30" },
  { dot: "bg-amber-400", text: "text-amber-400", bar: "bg-amber-500/20 border-amber-500/30" },
  { dot: "bg-emerald-400", text: "text-emerald-400", bar: "bg-emerald-500/20 border-emerald-500/30" },
  { dot: "bg-pink-400", text: "text-pink-400", bar: "bg-pink-500/20 border-pink-500/30" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  if (hours > 0) return `há ${hours}h`;
  return "agora";
}

function timeDiff(a: string, b: string): string {
  const diff = Math.abs(new Date(b).getTime() - new Date(a).getTime());
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `+${days}d ${hours}h ${minutes}min`;
  if (hours > 0) return `+${hours}h ${minutes}min`;
  return `+${minutes}min`;
}


const eventConfig: Record<string, { icon: React.ElementType; dot: string; label: string }> = {
  base_importado:       { icon: Users,         dot: "bg-muted-foreground",     label: "Importado" },
  pagina_cadastro:      { icon: CheckCircle2,  dot: "bg-blue-400",             label: "Cadastro" },
  cadastro_repetido:    { icon: UserPlus,       dot: "bg-yellow-400",           label: "Cadastro repetido" },
  re_signup:            { icon: UserPlus,       dot: "bg-yellow-400",           label: "Re-cadastro" },
  grupo_confirmado:     { icon: Users,         dot: "bg-violet-400",           label: "Grupo" },
  mensagem_api_enviada: { icon: MessageSquare, dot: "bg-cyan-400",             label: "Mensagem" },
  live_assistida:       { icon: Play,          dot: "bg-primary",              label: "Live" },
  checkout_acessado:    { icon: ShoppingCart,  dot: "bg-amber-400",            label: "Checkout" },
  pix_gerado:           { icon: QrCode,        dot: "bg-amber-500",            label: "Pix" },
  carrinho_abandonado:  { icon: ShoppingCart,  dot: "bg-destructive",          label: "Abandono" },
  pagamento_confirmado: { icon: CheckCircle2,  dot: "bg-emerald-400",          label: "Pago ✓" },
  upsell_pix_gerado:    { icon: TrendingUp,    dot: "bg-pink-400",             label: "Upsell" },
};

function getEventConfig(name: string) {
  return eventConfig[name] ?? { icon: Zap, dot: "bg-primary", label: name };
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function EventItem({ event, prev }: { event: LeadEvent; prev?: LeadEvent }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getEventConfig(event.event_name);
  const Icon = cfg.icon;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
        <div className="w-px flex-1 bg-border mt-1" />
      </div>

      <div className="flex-1 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-xs font-mono font-semibold text-foreground">
                {event.event_name}
              </span>
              <Badge
                className={`text-[9px] px-1.5 py-0 h-4 border ${
                  sourceColors[event.source] || sourceColors.api
                }`}
                variant="outline"
              >
                {event.source}
              </Badge>
              {prev && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {timeDiff(prev.timestamp_event, event.timestamp_event)}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {formatDate(event.timestamp_event)}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </Button>
        </div>

        {expanded && (
          <div className="mt-2 bg-muted rounded-md p-3">
            <pre className="text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(event.payload_raw, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Seção Jornada nos Funis ──────────────────────────────────────────────────

function FunnelJourney({ lead }: { lead: Lead }) {
  if (lead.funnel_positions.length === 0) return null;

  return (
    <div className="p-5 border-b border-border space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">Jornada nos Funis</span>
        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/15 text-primary border-primary/30" variant="outline">
          {lead.funnel_positions.length} {lead.funnel_positions.length === 1 ? "funil" : "funis"}
        </Badge>
      </div>

      <div className="space-y-2">
        {lead.funnel_positions.map((pos, i) => {
          const color = funnelColors[i % funnelColors.length];
          return (
            <div key={pos.funnel_id} className={`rounded-lg border p-3 ${color.bar} space-y-2`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${color.dot}`} />
                  <div>
                    <p className={`text-xs font-semibold ${color.text}`}>{pos.funnel_name}</p>
                    <p className="text-xs text-foreground mt-0.5">
                      → <span className="font-medium">{pos.current_stage_name}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground">{timeAgo(pos.entered_at)}</p>
                  {pos.converted_at && (
                    <p className="text-[9px] text-muted-foreground/60">{formatDate(pos.converted_at)}</p>
                  )}
                </div>
              </div>

              {/* Página de conversão específica deste funil */}
              {pos.page_url && (
                <div className="flex items-center gap-1.5 pt-0.5 border-t border-current/10">
                  <ExternalLink className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                  <a
                    href={pos.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-muted-foreground hover:text-foreground truncate hover:underline"
                    title={pos.page_url}
                  >
                    {pos.page_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Seção Atribuição ─────────────────────────────────────────────────────────

function Attribution({ lead }: { lead: Lead }) {
  const attr = lead.attribution;
  const hasAttribution = attr.utm_source || attr.utm_content || attr.device || attr.city || attr.page_url || attr.referral_source || attr.converted_at;
  if (!hasAttribution) return null;

  return (
    <div className="p-5 border-b border-border space-y-3">
      <div className="flex items-center gap-2">
        <Tag className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">Atribuição</span>
      </div>

      {/* Device + City badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {attr.device && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs text-foreground">
            {attr.device === "Mobile" ? <Smartphone className="w-3 h-3 text-muted-foreground" /> : <Monitor className="w-3 h-3 text-muted-foreground" />}
            {attr.device}
          </div>
        )}
        {attr.city && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs text-foreground">
            <MapPin className="w-3 h-3 text-muted-foreground" />
            {attr.city}{attr.region ? `, ${attr.region}` : ""}
          </div>
        )}
      </div>

      {/* UTM fields */}
      <div className="space-y-1.5">
        {attr.utm_source && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-24 shrink-0">utm_source</span>
            <Badge
              className={`text-[9px] px-1.5 py-0 h-4 border capitalize ${
                utmSourceColors[attr.utm_source] || "bg-muted text-muted-foreground border-border"
              }`}
              variant="outline"
            >
              {attr.utm_source}
            </Badge>
          </div>
        )}
        {attr.utm_medium && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-24 shrink-0">utm_medium</span>
            <span className="text-[11px] text-foreground font-mono">{attr.utm_medium}</span>
          </div>
        )}
        {attr.utm_campaign && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-24 shrink-0">utm_campaign</span>
            <span className="text-[11px] text-foreground font-mono">{attr.utm_campaign}</span>
          </div>
        )}
        {attr.utm_content && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-24 shrink-0">utm_content</span>
            <span className="text-[11px] text-primary font-mono font-semibold">{attr.utm_content}</span>
          </div>
        )}
        {attr.utm_term && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-24 shrink-0">utm_term</span>
            <span className="text-[11px] text-foreground font-mono">{attr.utm_term}</span>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="space-y-1.5">
        {attr.page_url && (
          <div className="flex items-start gap-2">
            <span className="text-[10px] text-muted-foreground w-24 shrink-0 mt-0.5">Página</span>
            <a
              href={attr.page_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-1 break-all"
            >
              {attr.page_url.length > 40 ? attr.page_url.slice(0, 40) + "…" : attr.page_url}
              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
            </a>
          </div>
        )}
        {attr.referral_source && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-24 shrink-0">Referral</span>
            <a
              href={attr.referral_source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              {attr.referral_source}
              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
            </a>
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="space-y-1">
        {attr.converted_at && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-24 shrink-0">Conversão</span>
            <span className="text-[11px] text-foreground tabular-nums">{formatDate(attr.converted_at)}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-24 shrink-0">Cadastro</span>
          <span className="text-[11px] text-foreground tabular-nums">{formatDate(lead.created_at)}</span>
        </div>
        {attr.form_id && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-24 shrink-0">Form ID</span>
            <span className="text-[11px] text-foreground font-mono">{attr.form_id}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Seção Compras ────────────────────────────────────────────────────────────

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

function PurchaseHistory({ lead, sales, loading }: { lead: Lead; sales: SaleEvent[]; loading: boolean }) {
  const paidSales = sales.filter((s) => s.status === "paid");

  const totalRevenue = lead.total_revenue ?? 0;
  const purchaseCount = lead.purchase_count ?? 0;
  const isMultibuyer = purchaseCount >= 2;
  const isSubscriber = lead.is_subscriber ?? false;
  const ltvDays = lead.ltv_days ?? null;

  if (loading) {
    return (
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-xs">Carregando compras...</span>
        </div>
      </div>
    );
  }

  if (paidSales.length === 0 && purchaseCount === 0) return null;

  // Agrupa assinaturas pelo contrato
  const subscriptionMap: Record<string, SaleEvent[]> = {};
  const singleSales: SaleEvent[] = [];
  paidSales.forEach((s) => {
    if (s.is_subscription && s.subscription_contract) {
      if (!subscriptionMap[s.subscription_contract]) subscriptionMap[s.subscription_contract] = [];
      subscriptionMap[s.subscription_contract].push(s);
    } else {
      singleSales.push(s);
    }
  });

  return (
    <div className="p-5 border-b border-border space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CreditCard className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">Compras</span>
        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-400 border-emerald-500/30" variant="outline">
          {purchaseCount} {purchaseCount === 1 ? "compra" : "compras"}
        </Badge>
        {isMultibuyer && (
          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/15 text-primary border-primary/30" variant="outline">
            <Star className="w-2 h-2 mr-0.5" />
            Multi-comprador
          </Badge>
        )}
        {isSubscriber && (
          <Badge className="text-[9px] px-1.5 py-0 h-4 bg-violet-500/15 text-violet-400 border-violet-500/30" variant="outline">
            <Repeat className="w-2 h-2 mr-0.5" />
            Assinante
          </Badge>
        )}
      </div>

      {/* Receita total */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">Receita líquida total</span>
        <span className="text-sm font-bold text-emerald-400 tabular-nums">R$ {fmtBRL(totalRevenue)}</span>
      </div>

      {/* Vendas individuais */}
      <div className="space-y-2">
        {singleSales.map((sale) => (
          <SaleItem key={sale.id} sale={sale} />
        ))}

        {/* Assinaturas agrupadas */}
        {Object.entries(subscriptionMap).map(([contractId, items]) => {
          const totalSub = items.reduce((acc, s) => acc + s.net_value, 0);
          const first = items[0];
          return (
            <div key={contractId} className="border border-border rounded-lg p-3 space-y-1 bg-violet-500/5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Repeat className="w-3 h-3 text-violet-400 shrink-0" />
                  <span className="text-xs font-medium text-foreground">{first.product_name}</span>
                  <Badge className="text-[9px] px-1.5 py-0 h-4 bg-violet-500/15 text-violet-400 border-violet-500/30" variant="outline">
                    assinatura
                  </Badge>
                </div>
                <span className="text-xs font-bold text-emerald-400 tabular-nums shrink-0">R$ {fmtBRL(totalSub)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Iniciada {fmtShortDate(first.paid_at ?? first.created_at)} · {items.length} {items.length === 1 ? "cobrança" : "cobranças"} · R$ {fmtBRL(first.net_value)}/mês
              </p>
              {first.utm_content && (
                <p className="text-[9px] text-muted-foreground font-mono">
                  {first.payment_method} · {first.utm_source ?? "organic"} · {first.utm_content}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* LTV */}
      {ltvDays !== null && ltvDays > 0 && (
        <div className="flex items-center gap-2 pt-1 text-[10px] text-muted-foreground border-t border-border">
          <Clock className="w-3 h-3" />
          <span>LTV: <strong className="text-foreground">{ltvDays} dias</strong> entre primeira e última compra</span>
        </div>
      )}
    </div>
  );
}

function SaleItem({ sale }: { sale: SaleEvent }) {
  const platformBadge = sale.platform === "eduzz"
    ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
    : "bg-pink-500/15 text-pink-400 border-pink-500/30";

  const creative = sale.ad_name || sale.utm_content;
  const source = sale.ad_name ? sale.placement : sale.utm_source;

  return (
    <div className="border border-border rounded-lg p-3 space-y-1 bg-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium text-foreground truncate">{sale.product_name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-bold text-emerald-400 tabular-nums">R$ {fmtBRL(sale.net_value)}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">{fmtShortDate(sale.paid_at || sale.sale_created_at || sale.created_at)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge className={`text-[9px] px-1 py-0 h-4 border ${platformBadge}`} variant="outline">
          {sale.platform}
        </Badge>
        <span className="text-[9px] text-muted-foreground">{sale.payment_method}</span>
        {source && <span className="text-[9px] text-muted-foreground">· {source}</span>}
        {creative && <span className="text-[9px] text-primary font-mono">· {creative}</span>}
        {sale.is_bump && <Badge className="text-[9px] px-1 py-0 h-4 border bg-amber-500/15 text-amber-400 border-amber-500/30" variant="outline">bump</Badge>}
        {sale.affiliate && <span className="text-[9px] text-muted-foreground">· afil: {sale.affiliate}</span>}
      </div>
    </div>
  );
}

// ─── Timeline de eventos sintéticos + reais ───────────────────────────────────

interface SyntheticEvent {
  id: string;
  type: "lead_created" | "purchase" | "real" | "lead_imported";
  timestamp: string;
  label: string;
  detail?: string;
  value?: number;
  icon: React.ElementType;
  dotColor: string;
  realEvent?: LeadEvent;
}

function TimelineEvents({ lead, sales, realEvents, loadingEvents, loadingSales }: {
  lead: Lead;
  sales: SaleEvent[];
  realEvents: LeadEvent[];
  loadingEvents: boolean;
  loadingSales: boolean;
}) {
  const allEvents = useMemo(() => {
    const items: SyntheticEvent[] = [];

    // 1. "Lead cadastrado" — usa created_at (agora = data do primeiro evento real)
    items.push({
      id: "syn-lead-created",
      type: "lead_created",
      timestamp: lead.created_at,
      label: "Lead cadastrado",
      detail: `via ${lead.source}`,
      icon: UserPlus,
      dotColor: "bg-blue-400",
    });

    // 1b. "Lead importado" — se imported_at existir e for diferente de created_at
    if (lead.imported_at) {
      items.push({
        id: "syn-lead-imported",
        type: "lead_imported",
        timestamp: lead.imported_at,
        label: "Lead importado",
        detail: "via importação de vendas",
        icon: Users,
        dotColor: "bg-muted-foreground",
      });
    }

    // 2. Cada compra como evento
    sales.forEach((sale) => {
      const dateStr = sale.paid_at || sale.sale_created_at || sale.created_at;
      items.push({
        id: `syn-sale-${sale.id}`,
        type: "purchase",
        timestamp: dateStr,
        label: `Compra: ${sale.product_name}`,
        detail: `R$ ${fmtBRL(sale.net_value)} · ${sale.platform}`,
        value: sale.net_value,
        icon: ShoppingCart,
        dotColor: "bg-emerald-400",
      });
    });

    // 3. Eventos reais do banco
    realEvents.forEach((ev) => {
      const cfg = getEventConfig(ev.event_name);
      const label = cfg.label !== ev.event_name ? cfg.label : ev.event_name;
      items.push({
        id: ev.id,
        type: "real",
        timestamp: ev.timestamp_event,
        label,
        detail: ev.event_name === "re_signup" ? "Cadastrou novamente neste funil" : undefined,
        icon: cfg.icon,
        dotColor: cfg.dot,
        realEvent: ev,
      });
    });

    // Ordenar cronologicamente
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return items;
  }, [lead, sales, realEvents]);

  const loading = loadingEvents || loadingSales;

  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-3.5 h-3.5 text-primary" />
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-xs">Carregando eventos...</span>
          </div>
        ) : (
          <span className="text-xs font-semibold text-foreground">
            {allEvents.length} {allEvents.length === 1 ? "evento" : "eventos"}
          </span>
        )}
      </div>

      {!loading && (
        <div>
          {allEvents.map((ev, idx) => {
            const Icon = ev.icon;
            const prev = idx > 0 ? allEvents[idx - 1] : undefined;
            return (
              <div key={ev.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ev.dotColor}`} />
                  {idx < allEvents.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium text-foreground">{ev.label}</span>
                        {prev && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {timeDiff(prev.timestamp, ev.timestamp)}
                          </span>
                        )}
                      </div>
                      {ev.detail && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{ev.detail}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {formatDate(ev.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LeadTimeline({ lead, open, onClose }: LeadTimelineProps) {
  const [sales, setSales] = useState<SaleEvent[]>([]);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    if (!open || !lead.id) return;

    setLoadingSales(true);
    setLoadingEvents(true);

    // Buscar compras reais
    supabase
      .from("sale_events")
      .select("*")
      .eq("lead_id", lead.id)
      .order("paid_at", { ascending: false })
      .then(({ data }) => {
        setSales((data as SaleEvent[]) || []);
        setLoadingSales(false);
      });

    // Buscar eventos reais
    supabase
      .from("lead_events")
      .select("*")
      .eq("lead_id", lead.id)
      .order("timestamp_event", { ascending: true })
      .then(({ data }) => {
        setEvents((data as LeadEvent[]) || []);
        setLoadingEvents(false);
      });
  }, [open, lead.id]);

  const initials = lead.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-card border-l border-border flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{initials}</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{lead.name}</h3>
                <p className="text-xs text-muted-foreground">{lead.phone}</p>
                <p className="text-xs text-muted-foreground">{lead.email}</p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30" variant="outline">
              {lead.primary_stage_name}
            </Badge>
            <Badge className={`text-[10px] border ${
              sourceColors[lead.source] || sourceColors.api
            }`} variant="outline">
              {lead.source}
            </Badge>
            {(lead.signup_count ?? 1) > 1 && (
              <Badge className="text-[10px] bg-yellow-500/15 text-yellow-400 border-yellow-500/30" variant="outline">
                <UserPlus className="w-2.5 h-2.5 mr-1" />
                {lead.signup_count}x cadastros
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">{lead.primary_funnel_name}</span>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Compras (seção financeira) */}
          <PurchaseHistory lead={lead} sales={sales} loading={loadingSales} />

          {/* Jornada nos Funis */}
          <FunnelJourney lead={lead} />

          {/* Atribuição */}
          <Attribution lead={lead} />

          {/* Timeline de eventos (sintéticos + reais) */}
          <TimelineEvents lead={lead} sales={sales} realEvents={events} loadingEvents={loadingEvents} loadingSales={loadingSales} />
        </div>
      </div>
    </div>
  );
}
