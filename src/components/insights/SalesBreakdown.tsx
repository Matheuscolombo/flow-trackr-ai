import { useSalesBreakdown } from "@/hooks/useSalesBreakdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Layers, Radio, Megaphone } from "lucide-react";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtN(v: number) {
  return v.toLocaleString("pt-BR");
}

export function SalesBreakdown() {
  const { data, isLoading } = useSalesBreakdown();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Método de Pagamento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            Método de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] h-8">Método</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Vendas</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Receita</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Ticket Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byPaymentMethod.map((r) => (
                <TableRow key={r.payment_method}>
                  <TableCell className="text-xs py-2">{r.payment_method}</TableCell>
                  <TableCell className="text-xs py-2 text-right">{fmtN(r.sale_count)}</TableCell>
                  <TableCell className="text-xs py-2 text-right">{fmt(r.total_revenue)}</TableCell>
                  <TableCell className="text-xs py-2 text-right">{fmt(r.avg_ticket)}</TableCell>
                </TableRow>
              ))}
              {data.byPaymentMethod.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-xs text-center text-muted-foreground py-4">
                    Sem dados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Parcelas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            Parcelas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] h-8">Parcelas</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Vendas</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Receita</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Ticket Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byInstallments.map((r) => (
                <TableRow key={r.installments}>
                  <TableCell className="text-xs py-2">
                    {r.installments === 1 ? "À vista" : `${r.installments}x`}
                  </TableCell>
                  <TableCell className="text-xs py-2 text-right">{fmtN(r.sale_count)}</TableCell>
                  <TableCell className="text-xs py-2 text-right">{fmt(r.total_revenue)}</TableCell>
                  <TableCell className="text-xs py-2 text-right">{fmt(r.avg_ticket)}</TableCell>
                </TableRow>
              ))}
              {data.byInstallments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-xs text-center text-muted-foreground py-4">
                    Sem dados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Canal de Aquisição */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Radio className="w-4 h-4 text-muted-foreground" />
            Canal de Aquisição
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] h-8">Canal (utm_medium)</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Vendas</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Receita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byUtmMedium.map((r) => (
                <TableRow key={r.utm_medium}>
                  <TableCell className="text-xs py-2">{r.utm_medium}</TableCell>
                  <TableCell className="text-xs py-2 text-right">{fmtN(r.sale_count)}</TableCell>
                  <TableCell className="text-xs py-2 text-right">{fmt(r.total_revenue)}</TableCell>
                </TableRow>
              ))}
              {data.byUtmMedium.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-xs text-center text-muted-foreground py-4">
                    Sem dados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Criativos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-muted-foreground" />
            Criativos (Top por Receita)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] h-8">Criativo</TableHead>
                <TableHead className="text-[10px] h-8">Campanha</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Vendas</TableHead>
                <TableHead className="text-[10px] h-8 text-right">Receita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byCreative.slice(0, 10).map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs py-2 max-w-[150px] truncate" title={r.creative}>
                    {r.creative}
                  </TableCell>
                  <TableCell className="text-xs py-2 max-w-[120px] truncate" title={r.campaign}>
                    {r.campaign}
                  </TableCell>
                  <TableCell className="text-xs py-2 text-right">{fmtN(r.sale_count)}</TableCell>
                  <TableCell className="text-xs py-2 text-right">{fmt(r.total_revenue)}</TableCell>
                </TableRow>
              ))}
              {data.byCreative.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-xs text-center text-muted-foreground py-4">
                    Sem dados de criativos
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
