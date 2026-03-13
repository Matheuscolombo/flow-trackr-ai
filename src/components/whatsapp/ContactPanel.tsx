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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContactPanelProps {
  phone: string;
  leadId: string | null;
  contactName: string | null;
  profilePicUrl: string | null;
  instanceId: string | null;
  onClose: () => void;
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
  tag: {
    id: string;
    name: string;
    color: string;
  };
}

interface SaleEvent {
  id: string;
  product_name: string;
  net_value: number;
  status: string;
  paid_at: string | null;
  platform: string;
}

export function ContactPanel({
  phone,
  leadId,
  contactName,
  profilePicUrl,
  instanceId,
  onClose,
}: ContactPanelProps) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [tags, setTags] = useState<LeadTag[]>([]);
  const [sales, setSales] = useState<SaleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      // Fetch lead details, tags, and sales in parallel
      const [leadRes, tagsRes, salesRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, name, email, phone, profile_pic_url, source, total_revenue, purchase_count, first_purchase_at, last_purchase_at, created_at, utm_source, utm_medium, utm_campaign, is_subscriber")
          .eq("id", leadId)
          .maybeSingle(),
        supabase
          .from("lead_tags")
          .select("id, tag_id, tags:tag_id(id, name, color)")
          .eq("lead_id", leadId),
        supabase
          .from("sale_events")
          .select("id, product_name, net_value, status, paid_at, platform")
          .eq("lead_id", leadId)
          .eq("status", "paid")
          .order("paid_at", { ascending: false })
          .limit(10),
      ]);

      if (leadRes.data) setLead(leadRes.data as LeadDetail);
      if (tagsRes.data) {
        const mapped = (tagsRes.data as unknown[]).map((lt: any) => ({
          id: lt.id,
          tag: lt.tags,
        })).filter((lt: any) => lt.tag);
        setTags(mapped);
      }
      if (salesRes.data) setSales(salesRes.data as SaleEvent[]);

      setLoading(false);
    };

    fetchData();
  }, [leadId]);

  const displayName = lead?.name || contactName || phone;
  const displayPic = lead?.profile_pic_url || profilePicUrl;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="w-80 border-l border-border flex flex-col bg-background shrink-0 hidden lg:flex">
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
          ) : !lead ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground">Lead não vinculado</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Este contato ainda não possui um lead associado.
              </p>
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
                          style={{
                            borderColor: lt.tag.color,
                            color: lt.tag.color,
                          }}
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
                  <div className="bg-muted rounded-md p-2 text-center">
                    <p className="text-lg font-bold text-foreground">{lead.purchase_count}</p>
                    <p className="text-[10px] text-muted-foreground">Compras</p>
                  </div>
                  <div className="bg-muted rounded-md p-2 text-center">
                    <p className="text-sm font-bold text-foreground">{formatCurrency(lead.total_revenue)}</p>
                    <p className="text-[10px] text-muted-foreground">Receita</p>
                  </div>
                </div>
                {lead.is_subscriber && (
                  <Badge variant="default" className="mt-2 text-[10px]">
                    Assinante
                  </Badge>
                )}
              </div>

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
