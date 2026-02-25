import { useState, useEffect, useCallback } from "react";
import {
  Search, Upload, X, Monitor, Smartphone, GitBranch,
  DollarSign, CreditCard, Star, Repeat, Loader2, ChevronLeft, ChevronRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ImportContactsModal } from "@/components/leads/ImportContactsModal";
import { SalesImportModal } from "@/components/sales/SalesImportModal";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";
import type { Lead } from "@/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const sourceColors: Record<string, string> = {
  n8n: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  zapier: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  api: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  manual: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  typebot: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  webhook: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  eduzz: "bg-blue-600/15 text-blue-300 border-blue-600/30",
  hotmart: "bg-red-500/15 text-red-400 border-red-500/30",
};

const utmSourceColors: Record<string, string> = {
  facebook: "bg-blue-600/15 text-blue-400 border-blue-600/30",
  instagram: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  google: "bg-green-500/15 text-green-400 border-green-500/30",
  organic: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

const PAGE_SIZE = 100;

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

// ── Component ─────────────────────────────────────────────────────────────────

const LeadsPage = () => {
  const [leads, setLeads] = useState<DbLead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterSource, setFilterSource] = useState("all");
  const [filterDevice, setFilterDevice] = useState("all");
  const [filterFinancial, setFilterFinancial] = useState("all");

  const [importOpen, setImportOpen] = useState(false);
  const [salesImportOpen, setSalesImportOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<DbLead | null>(null);

    const fetchLeads = useCallback(async () => {
    setLoading(true);

    // When multi-buyer filter is active, sort by revenue desc so they appear first
    const sortField = filterFinancial === "multi" || filterFinancial === "buyers" ? "total_revenue" : "created_at";
    const sortAsc = false;

    let query = supabase
      .from("leads")
      .select("id, name, email, phone, source, utm_source, utm_content, device, purchase_count, total_revenue, is_subscriber, is_ghost, created_at, imported_at, metadata", { count: "exact" })
      .order(sortField, { ascending: sortAsc })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    // Search
    if (search.trim()) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    // Financial filter
    if (filterFinancial === "buyers") query = query.gte("purchase_count", 1);
    if (filterFinancial === "non_buyers") query = query.eq("purchase_count", 0);
    if (filterFinancial === "subscribers") query = query.eq("is_subscriber", true);
    if (filterFinancial === "multi") query = query.gte("purchase_count", 2);
    if (filterFinancial === "ghost") query = query.eq("is_ghost", true);

    // Source filter
    if (filterSource !== "all" && filterSource !== "organic") {
      query = query.eq("utm_source", filterSource);
    } else if (filterSource === "organic") {
      query = query.is("utm_source", null);
    }

    // Device filter
    if (filterDevice !== "all") {
      query = query.eq("device", filterDevice);
    }

    const { data, count } = await query;
    setLeads((data || []) as DbLead[]);
    setTotalCount(count || 0);
    setLoading(false);
  }, [page, search, filterFinancial, filterSource, filterDevice]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleSearch = () => {
    setPage(0);
    setSearch(searchInput);
  };

  const hasActiveFilters = filterSource !== "all" || filterDevice !== "all" || filterFinancial !== "all" || search !== "";
  const clearFilters = () => {
    setFilterSource("all");
    setFilterDevice("all");
    setFilterFinancial("all");
    setSearchInput("");
    setSearch("");
    setPage(0);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground">Leads</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? "Carregando..." : `${totalCount.toLocaleString("pt-BR")} leads únicos`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder="Nome, email ou telefone..."
                className="pl-9 h-8 text-xs bg-card border-border"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSalesImportOpen(true)}
              className="h-8 text-xs gap-1.5 border-border"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Importar Vendas
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="h-8 text-xs gap-1.5 border-border"
            >
              <Upload className="w-3.5 h-3.5" />
              Importar Leads
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterFinancial} onValueChange={(v) => { setFilterFinancial(v); setPage(0); }}>
            <SelectTrigger className="h-7 text-xs w-44 border-border bg-card">
              <SelectValue placeholder="Status financeiro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os leads</SelectItem>
              <SelectItem value="buyers" className="text-xs">💳 Compradores</SelectItem>
              <SelectItem value="non_buyers" className="text-xs">Não-compradores</SelectItem>
              <SelectItem value="subscribers" className="text-xs">🔄 Assinantes</SelectItem>
              <SelectItem value="multi" className="text-xs">⭐ Multi-compradores</SelectItem>
              <SelectItem value="ghost" className="text-xs">👻 Fantasmas (externos)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterSource} onValueChange={(v) => { setFilterSource(v); setPage(0); }}>
            <SelectTrigger className="h-7 text-xs w-36 border-border bg-card">
              <SelectValue placeholder="Origem UTM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todas origens</SelectItem>
              <SelectItem value="facebook" className="text-xs">Facebook</SelectItem>
              <SelectItem value="instagram" className="text-xs">Instagram</SelectItem>
              <SelectItem value="google" className="text-xs">Google</SelectItem>
              <SelectItem value="organic" className="text-xs">Orgânico</SelectItem>
            </SelectContent>
          </Select>

          {/* Device toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            {[
              { value: "all", label: "Todos" },
              { value: "Mobile", label: "Mobile", icon: Smartphone },
              { value: "Desktop", label: "Desktop", icon: Monitor },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => { setFilterDevice(value); setPage(0); }}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                  filterDevice === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters} className="h-7 text-[10px] gap-1 text-muted-foreground hover:text-foreground px-2">
              <X className="w-3 h-3" />
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Upload className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhum lead encontrado</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              {hasActiveFilters
                ? "Tente limpar os filtros."
                : "Importe suas planilhas de vendas para começar."}
            </p>
            {!hasActiveFilters && (
              <Button size="sm" onClick={() => setSalesImportOpen(true)} className="h-8 text-xs gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                Importar Vendas
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background border-b border-border z-10">
              <tr>
                <th className="text-left px-6 py-3 text-muted-foreground font-medium">Lead</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Contato</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-3 h-3" />
                    Compras
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Origem</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                  <div className="flex items-center gap-1.5">
                    <GitBranch className="w-3 h-3" />
                    Plataforma
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Entrada</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const initials = (lead.name || "?")
                  .split(" ")
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase();

                return (
                  <tr key={lead.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedLead(lead)}>
                    {/* Nome */}
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold text-primary">{initials}</span>
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{lead.name || "—"}</span>
                          {lead.is_ghost && (
                            <span className="ml-1.5 text-[9px] text-muted-foreground">👻</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contato */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {lead.email && (
                          <p className="text-xs text-muted-foreground truncate max-w-[160px]">{lead.email}</p>
                        )}
                        {lead.phone && (
                          <p className="text-xs font-mono text-muted-foreground">{lead.phone}</p>
                        )}
                      </div>
                    </td>

                    {/* Compras */}
                     <td className="px-4 py-3">
                       {lead.purchase_count > 0 ? (
                         <div className="flex items-center gap-1.5">
                           <CreditCard className="w-3 h-3 text-sentinel-success shrink-0" />
                           <span className="text-xs font-bold text-sentinel-success tabular-nums">
                             R$ {lead.total_revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                           </span>
                           {lead.purchase_count >= 2 && (
                             <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 rounded px-1 py-0 leading-4">
                               ×{lead.purchase_count}
                             </span>
                           )}
                           {lead.is_subscriber && <Repeat className="w-2.5 h-2.5 text-accent-foreground" />}
                         </div>
                       ) : (
                         <span className="text-[10px] text-muted-foreground">—</span>
                       )}
                     </td>

                    {/* Origem UTM */}
                     <td className="px-4 py-3">
                       <div className="flex items-center gap-1.5 flex-wrap">
                         {lead.utm_source ? (
                           <Badge
                             className={`text-[9px] px-1.5 py-0 h-4 border font-medium capitalize ${
                               utmSourceColors[lead.utm_source] || "bg-muted text-muted-foreground border-border"
                             }`}
                             variant="outline"
                           >
                             {lead.utm_source}
                           </Badge>
                         ) : lead.is_ghost ? (
                           <Badge className="text-[9px] px-1.5 py-0 h-4 border font-medium bg-blue-500/10 text-blue-400 border-blue-500/30" variant="outline">
                             importado
                           </Badge>
                         ) : (
                           <Badge className="text-[9px] px-1.5 py-0 h-4 border font-medium bg-muted text-muted-foreground border-border" variant="outline">
                             orgânico
                           </Badge>
                         )}
                        {lead.utm_content && (
                          <span className="text-[9px] text-muted-foreground font-mono truncate max-w-[80px]" title={lead.utm_content}>
                            {lead.utm_content}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Plataforma / Source */}
                    <td className="px-4 py-3">
                      <Badge
                        className={`text-[9px] px-1.5 py-0 h-4 border font-medium capitalize ${
                          sourceColors[lead.source] || "bg-muted text-muted-foreground border-border"
                        }`}
                        variant="outline"
                      >
                        {lead.source}
                      </Badge>
                    </td>

                    {/* Entrada */}
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {formatDate(lead.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages} · {totalCount.toLocaleString("pt-BR")} leads
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <ImportContactsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={() => { fetchLeads(); setImportOpen(false); }}
      />

      <SalesImportModal
        open={salesImportOpen}
        onClose={() => setSalesImportOpen(false)}
        existingLeads={[]}
        onImport={(_sales, _newLeads) => { fetchLeads(); setSalesImportOpen(false); }}
      />

      <LeadDetailSheet
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </div>
  );
};

export default LeadsPage;
