import { useState, useEffect } from "react";
import {
  X,
  User,
  Phone,
  Mail,
  ShoppingCart,
  Tag,
  Calendar,
  DollarSign,
  ExternalLink,
  Loader2,
  GitBranch,
  Clock,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface ContactPanelProps {
  phone: string;
  leadId: string | null;
  contactName: string | null;
  profilePicUrl: string | null;
  instanceId: string | null;
  workspaceId: string;
  onClose: () => void;
  onLeadLinked?: (leadId: string) => void;
}

interface LeadDetail {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  profile_pic_url: string | null;
  source: string;
  total_revenue: number;
  purchase_count: number;
  first_purchase_at: string | null;
  last_purchase_at: string | null;
  created_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  is_subscriber: boolean;
}

interface LeadTag {
  id: string;
  tag: { id: string; name: string; color: string };
}

interface SaleEvent {
  id: string;
  product_name: string;
  net_value: number;
  status: string;
  paid_at: string | null;
  platform: string;
}

interface FunnelPosition {
  id: string;
  funnel_name: string;
  stage_name: string;
  stage_color: string;
  entered_at: string;
}

interface TimelineEvent {
  id: string;
  event_name: string;
  source: string;
  timestamp_event: string;
  payload_raw: Record<string, unknown>;
}

/** Normaliza telefone para variantes de 12 e 13 dígitos (9o dígito BR) */
function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const variants: string[] = [digits];
  // BR: se tem 13 dígitos (55 + DDD + 9 + 8dig), gera versão sem o 9
  if (digits.length === 13 && digits.startsWith("55")) {
    variants.push(digits.slice(0, 4) + digits.slice(5));
  }
  // BR: se tem 12 dígitos (55 + DDD + 8dig), gera versão com o 9
  if (digits.length === 12 && digits.startsWith("55")) {
    variants.push(digits.slice(0, 4) + "9" + digits.slice(4));
  }
  return variants;
}

export function ContactPanel({
  phone,
  leadId,
  contactName,
  profilePicUrl,
  workspaceId,
  onClose,
  onLeadLinked,
}: ContactPanelProps) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [resolvedLeadId, setResolvedLeadId] = useState<string | null>(leadId);
  const [tags, setTags] = useState<LeadTag[]>([]);
  const [sales, setSales] = useState<SaleEvent[]>([]);
  const [funnelPositions, setFunnelPositions] = useState<FunnelPosition[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Step 1: resolve lead ID (from prop or phone lookup)
  useEffect(() => {
    if (leadId) {
      setResolvedLeadId(leadId);
      return;
    }

    // Search lead by phone variants
    const variants = phoneVariants(phone);
    const orFilter = variants.map((v) => `phone.eq.${v}`).join(",");

    supabase
      .from("leads")
      .select("id")
      .or(orFilter)
      .eq("workspace_id", workspaceId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setResolvedLeadId(data.id);
          onLeadLinked?.(data.id);
        } else {
          setResolvedLeadId(null);
          setLoading(false);
        }
      });
  }, [leadId, phone, workspaceId]);

  // Step 2: fetch all lead data when resolvedLeadId is set
  useEffect(() => {
    if (!resolvedLeadId) return;

    const fetchData = async () => {
      setLoading(true);

      const [leadRes, tagsRes, salesRes, funnelsRes, eventsRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, name, email, phone, profile_pic_url, source, total_revenue, purchase_count, first_purchase_at, last_purchase_at, created_at, utm_source, utm_medium, utm_campaign, is_subscriber")
          .eq("id", resolvedLeadId)
          .maybeSingle(),
        supabase
          .from("lead_tags")
          .select("id, tag_id, tags:tag_id(id, name, color)")
          .eq("lead_id", resolvedLeadId),
        supabase
          .from("sale_events")
          .select("id, product_name, net_value, status, paid_at, platform")
          .eq("lead_id", resolvedLeadId)
          .eq("status", "paid")
          .order("paid_at", { ascending: false })
          .limit(10),
        supabase
          .from("lead_funnel_stages")
          .select("id, entered_at, stage_id, funnel_id, funnel_stages:stage_id(name, color), funnels:funnel_id(name)")
          .eq("lead_id", resolvedLeadId)
          .order("entered_at", { ascending: false }),
        supabase
          .from("lead_events")
          .select("id, event_name, source, timestamp_event, payload_raw")
          .eq("lead_id", resolvedLeadId)
          .order("timestamp_event", { ascending: false })
          .limit(15),
      ]);

      if (leadRes.data) setLead(leadRes.data as LeadDetail);
      if (tagsRes.data) {
        const mapped = (tagsRes.data as unknown[])
          .map((lt: any) => ({ id: lt.id, tag: lt.tags }))
          .filter((lt: any) => lt.tag);
        setTags(mapped);
      }
      if (salesRes.data) setSales(salesRes.data as SaleEvent[]);
      if (funnelsRes.data) {
        const positions = (funnelsRes.data as any[])
          .filter((r) => r.funnel_stages && r.funnels)
          .map((r) => ({
            id: r.id,
            funnel_name: r.funnels.name,
            stage_name: r.funnel_stages.name,
            stage_color: r.funnel_stages.color,
            entered_at: r.entered_at,
          }));
        setFunnelPositions(positions);
      }
      if (eventsRes.data) setTimeline(eventsRes.data as TimelineEvent[]);

      setLoading(false);
    };

    fetchData();
  }, [resolvedLeadId]);

  const handleCreateLead = async () => {
    setCreating(true);
    try {
      const digits = phone.replace(/\D/g, "");
      const { data, error } = await supabase
        .from("leads")
        .insert({
          workspace_id: workspaceId,
          phone: digits,
          name: contactName,
          profile_pic_url: profilePicUrl,
          source: "whatsapp",
        })
        .select("id")
        .single();

      if (error) throw error;
      if (data) {
        setResolvedLeadId(data.id);
        onLeadLinked?.(data.id);
        toast.success("Lead criado com sucesso");
      }
    } catch (err: any) {
      toast.error("Erro ao criar lead: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const displayName = lead?.name || contactName || phone;
  const displayPic = lead?.profile_pic_url || profilePicUrl;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const eventLabel = (name: string) => {
    const map: Record<string, string> = {
      signup: "Cadastro",
      re_signup: "Recadastro",
      checkout: "Checkout",
      purchase: "Compra",
      page_view: "Visualização",
      lead_moved: "Movido",
    };
    return map[name] || name;
  };

  return (
    <div className="w-96 border-l border-border flex flex-col bg-background shrink-0 hidden md:flex overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">Contato</h3>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Avatar + Name */}
          <div className="flex flex-col items-center text-center gap-2">
            {displayPic && !imgError ? (
              <img
                src={displayPic}
                alt={displayName}
                className="w-20 h-20 rounded-full object-cover border-2 border-border"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">{displayName}</p>
              <p className="text-[10px] text-muted-foreground">{phone}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !resolvedLeadId || !lead ? (
            <div className="text-center py-4 space-y-3">
              <p className="text-xs text-muted-foreground">Lead não encontrado</p>
              <p className="text-[10px] text-muted-foreground">
                Este contato ainda não possui um lead associado.
              </p>
              <Button
                size="sm"
                onClick={handleCreateLead}
                disabled={creating}
                className="gap-1.5"
              >
                {creating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" />
                )}
                Criar Lead
              </Button>
            </div>
          ) : (
            <>
              {/* Contact info */}
              <div className="space-y-2">
                {lead.email && (
                  <div className="flex items-center gap-2 text-xs">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-foreground truncate">{lead.email}</span>
                  </div>
                )}
                {lead.phone && (
                  <div className="flex items-center gap-2 text-xs">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-foreground">{lead.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    Lead desde {format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                {lead.source && lead.source !== "manual" && (
                  <div className="flex items-center gap-2 text-xs">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Fonte: {lead.source}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">Tags</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((lt) => (
                        <Badge
                          key={lt.id}
                          variant="outline"
                          className="text-[10px] px-2 py-0.5"
                          style={{ borderColor: lt.tag.color, color: lt.tag.color }}
                        >
                          {lt.tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Revenue / Stats */}
              <Separator />
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">Compras</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted rounded-md p-2 text-center overflow-hidden">
                    <p className="text-lg font-bold text-foreground">{lead.purchase_count}</p>
                    <p className="text-[10px] text-muted-foreground">Compras</p>
                  </div>
                  <div className="bg-muted rounded-md p-2 text-center overflow-hidden">
                    <p className="text-sm font-bold text-foreground truncate">{formatCurrency(lead.total_revenue)}</p>
                    <p className="text-[10px] text-muted-foreground">Receita</p>
                  </div>
                </div>
                {lead.is_subscriber && (
                  <Badge variant="default" className="mt-2 text-[10px]">
                    Assinante
                  </Badge>
                )}
              </div>

              {/* Funnel Positions */}
              {funnelPositions.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">Funis</span>
                    </div>
                    <div className="space-y-1.5">
                      {funnelPositions.map((fp) => (
                        <div
                          key={fp.id}
                          className="bg-muted rounded-md px-2.5 py-1.5 flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-foreground truncate">
                              {fp.funnel_name}
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                              {format(new Date(fp.entered_at), "dd/MM/yy", { locale: ptBR })}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 shrink-0 ml-2"
                            style={{ borderColor: fp.stage_color, color: fp.stage_color }}
                          >
                            {fp.stage_name}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Timeline */}
              {timeline.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">Timeline</span>
                    </div>
                    <div className="space-y-0">
                      {timeline.map((evt, i) => (
                        <div key={evt.id} className="flex gap-2">
                          {/* Vertical line */}
                          <div className="flex flex-col items-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                            {i < timeline.length - 1 && (
                              <div className="w-px flex-1 bg-border" />
                            )}
                          </div>
                          <div className="pb-2.5 min-w-0">
                            <p className="text-[11px] font-medium text-foreground">
                              {eventLabel(evt.event_name)}
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                              {format(new Date(evt.timestamp_event), "dd/MM/yy HH:mm", { locale: ptBR })}
                              {evt.source !== "webhook" && (
                                <span className="ml-1 text-muted-foreground/70">· {evt.source}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* UTM Info */}
              {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1.5">UTM</p>
                    <div className="space-y-1 text-[10px] text-muted-foreground">
                      {lead.utm_source && <p>Source: <span className="text-foreground">{lead.utm_source}</span></p>}
                      {lead.utm_medium && <p>Medium: <span className="text-foreground">{lead.utm_medium}</span></p>}
                      {lead.utm_campaign && <p>Campaign: <span className="text-foreground">{lead.utm_campaign}</span></p>}
                    </div>
                  </div>
                </>
              )}

              {/* Recent Sales */}
              {sales.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <ShoppingCart className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">Últimas Compras</span>
                    </div>
                    <div className="space-y-1.5">
                      {sales.map((sale) => (
                        <div
                          key={sale.id}
                          className="bg-muted rounded-md px-2.5 py-1.5 flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-foreground truncate">
                              {sale.product_name}
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                              {sale.paid_at
                                ? format(new Date(sale.paid_at), "dd/MM/yy", { locale: ptBR })
                                : "—"}{" "}
                              · {sale.platform}
                            </p>
                          </div>
                          <span className="text-[11px] font-semibold text-foreground shrink-0 ml-2">
                            {formatCurrency(sale.net_value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
