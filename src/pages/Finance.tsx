import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import SectionHeader from "@/components/SectionHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { fmt, fmtCurrency } from "@/components/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { DollarSign, TrendingUp, Percent, Plus, ShoppingCart, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const chartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--success))" },
  spend: { label: "Ad Spend", color: "hsl(var(--primary))" },
};

// Matches DB enum: cogs | shipping | platform_fees | taxes | fulfillment | other
const costTypeOptions = [
  { value: "cogs", label: "COGS" },
  { value: "shipping", label: "Envío" },
  { value: "platform_fees", label: "Platform Fees" },
  { value: "taxes", label: "Impuestos" },
  { value: "fulfillment", label: "Fulfillment" },
  { value: "other", label: "Otro" },
] as const;

const costTypeLabel = Object.fromEntries(costTypeOptions.map((o) => [o.value, o.label]));

interface FinancialSettings {
  avg_cogs_percent: number;
  shipping_percent: number;
  payment_fee_percent: number;
  refund_percent: number;
  iva_percent: number;
}

interface CostRow {
  id: string;
  date: string;
  cost_type: string;
  amount: number;
  notes: string | null;
  product_category: string | null;
}

interface FinanceData {
  totalRevenue: number;
  totalSpend: number;
  totalAdditionalCosts: number;
  contributionMargin: number;
  marginPercent: number;
  orders: number;
  costRows: CostRow[];
  daily: Array<{ date: string; revenue: number; spend: number }>;
  finSettings: FinancialSettings;
}

const defaultFinSettings: FinancialSettings = {
  avg_cogs_percent: 0,
  shipping_percent: 0,
  payment_fee_percent: 0,
  refund_percent: 0,
  iva_percent: 0,
};

function useFinanceData() {
  const { currentWorkspace, dateRange } = useWorkspace();
  const { selectedClient } = useClient();
  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");
  const clientId = selectedClient?.id ?? null;

  return useQuery({
    queryKey: ["finance", currentWorkspace?.id, clientId, fromStr, toStr],
    queryFn: async (): Promise<FinanceData> => {
      if (!currentWorkspace) return emptyFinance();

      const [revResult, costsResult, perfResult, finResult] = await Promise.all([
        // Revenue filtered by client via workspace_revenue_daily
        supabase
          .from("workspace_revenue_daily")
          .select("date, total_revenue, total_purchases")
          .eq("workspace_id", currentWorkspace.id)
          .gte("date", fromStr)
          .lte("date", toStr)
          .then((q) => clientId ? { ...q, data: (q.data ?? []).filter((r: any) => r.client_id === clientId || !clientId) } : q),
        // Additional manual costs (workspace-level, no client_id in schema)
        supabase
          .from("finance_costs")
          .select("id, date, cost_type, amount, notes, product_category")
          .eq("workspace_id", currentWorkspace.id)
          .gte("date", fromStr)
          .lte("date", toStr)
          .order("date", { ascending: false }),
        // Spend filtered by client
        (() => {
          let q = supabase
            .from("performance_daily")
            .select("date, spend")
            .eq("workspace_id", currentWorkspace.id)
            .gte("date", fromStr)
            .lte("date", toStr);
          if (clientId) q = q.eq("client_id", clientId);
          return q;
        })(),
        // Financial settings: try client-specific first, fallback to workspace
        (async () => {
          if (clientId) {
            const { data } = await supabase
              .from("client_financial_settings")
              .select("avg_cogs_percent, shipping_percent, payment_fee_percent, refund_percent, iva_percent")
              .eq("client_id", clientId)
              .maybeSingle();
            if (data) return data;
          }
          const { data } = await supabase
            .from("workspace_financial_settings")
            .select("avg_cogs_percent, shipping_percent, payment_fee_percent, refund_percent, iva_percent")
            .eq("workspace_id", currentWorkspace.id)
            .maybeSingle();
          return data;
        })(),
      ]);

      const revenueRows = revResult.data ?? [];
      const costRows = (costsResult.data ?? []) as CostRow[];
      const perfRows = perfResult.data ?? [];
      const finSettings: FinancialSettings = finResult ? {
        avg_cogs_percent: Number(finResult.avg_cogs_percent) || 0,
        shipping_percent: Number(finResult.shipping_percent) || 0,
        payment_fee_percent: Number(finResult.payment_fee_percent) || 0,
        refund_percent: Number(finResult.refund_percent) || 0,
        iva_percent: Number(finResult.iva_percent) || 0,
      } : defaultFinSettings;

      const totalRevenue = revenueRows.reduce((s: number, r: any) => s + (Number(r.total_revenue) || 0), 0);
      const orders = revenueRows.reduce((s: number, r: any) => s + (Number(r.total_purchases) || 0), 0);

      // Aggregate spend
      const spendByDate = new Map<string, number>();
      for (const p of perfRows) {
        spendByDate.set(p.date, (spendByDate.get(p.date) ?? 0) + (Number(p.spend) || 0));
      }
      const totalSpend = Array.from(spendByDate.values()).reduce((s, v) => s + v, 0);

      // Additional manual costs
      const totalAdditionalCosts = costRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

      // CM using financial settings % on revenue
      const settingsDeductions =
        totalRevenue * (finSettings.avg_cogs_percent / 100) +
        totalRevenue * (finSettings.shipping_percent / 100) +
        totalRevenue * (finSettings.payment_fee_percent / 100) +
        totalRevenue * (finSettings.refund_percent / 100) +
        totalRevenue * (finSettings.iva_percent / 100);

      const contributionMargin = totalRevenue - totalSpend - settingsDeductions - totalAdditionalCosts;
      const marginPercent = totalRevenue > 0 ? (contributionMargin / totalRevenue) * 100 : 0;

      // Daily chart data
      const allDates = new Set([
        ...revenueRows.map((r: any) => r.date),
        ...Array.from(spendByDate.keys()),
      ]);
      const revByDate = new Map<string, number>();
      for (const r of revenueRows as any[]) {
        revByDate.set(r.date, (revByDate.get(r.date) ?? 0) + (Number(r.total_revenue) || 0));
      }
      const daily = Array.from(allDates).sort().map((date) => ({
        date,
        revenue: revByDate.get(date) ?? 0,
        spend: spendByDate.get(date) ?? 0,
      }));

      return { totalRevenue, totalSpend, totalAdditionalCosts, contributionMargin, marginPercent, orders, costRows, daily, finSettings };
    },
    enabled: !!currentWorkspace,
  });
}

function emptyFinance(): FinanceData {
  return { totalRevenue: 0, totalSpend: 0, totalAdditionalCosts: 0, contributionMargin: 0, marginPercent: 0, orders: 0, costRows: [], daily: [], finSettings: defaultFinSettings };
}

function AddCostDialog({ workspaceId, onSuccess }: { workspaceId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    amount: "",
    cost_type: "cogs",
    product_category: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.amount) return;
    setLoading(true);
    const { error } = await supabase.from("finance_costs").insert({
      workspace_id: workspaceId,
      date: form.date,
      amount: Number(form.amount),
      cost_type: form.cost_type as any,
      product_category: form.cost_type === "cogs" && form.product_category.trim() ? form.product_category.trim() : null,
      notes: form.notes || null,
      currency: "USD",
    } as any);
    setLoading(false);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Costo guardado");
    setOpen(false);
    setForm({ date: format(new Date(), "yyyy-MM-dd"), amount: "", cost_type: "cogs", product_category: "", notes: "" });
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
          <Plus className="h-3.5 w-3.5" /> Agregar Costo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Agregar Costo Adicional</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
          </div>
          <div>
            <Label>Monto</Label>
            <Input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
          </div>
          <div>
            <Label>Categoría de Costo</Label>
            <Select value={form.cost_type} onValueChange={(v) => setForm((p) => ({ ...p, cost_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {costTypeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.cost_type === "cogs" && (
            <div>
              <Label>
                Vertical / Categoría de producto
                <span className="text-muted-foreground text-[10px] ml-1">(para análisis de share)</span>
              </Label>
              <Input
                placeholder="Ej: Indumentaria, Calzado, Accesorios..."
                value={form.product_category}
                onChange={(e) => setForm((p) => ({ ...p, product_category: e.target.value }))}
              />
            </div>
          )}
          <div>
            <Label>Notas <span className="text-muted-foreground text-[10px]">(opcional)</span></Label>
            <Input placeholder="Ej: COGS Enero — Proveedor X" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Finance = () => {
  const { currentWorkspace } = useWorkspace();
  const { selectedClient } = useClient();
  const qc = useQueryClient();
  const { data, isLoading } = useFinanceData();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["finance"] });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <SectionHeader badge="Finance" title="Finance & Unit Economics" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  const noData = !data || (data.totalRevenue === 0 && data.totalSpend === 0);
  const fin = data?.finSettings ?? defaultFinSettings;
  const totalSettingsPct = fin.avg_cogs_percent + fin.shipping_percent + fin.payment_fee_percent + fin.refund_percent + fin.iva_percent;

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        badge="Finance"
        title="Finance & Unit Economics"
        subtitle={selectedClient ? selectedClient.name : "Workspace global"}
        action={
          currentWorkspace && (
            <AddCostDialog workspaceId={currentWorkspace.id} onSuccess={invalidate} />
          )
        }
      />

      {/* Client required notice */}
      {!selectedClient && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <p className="text-xs text-warning">Seleccioná un cliente en el filtro para ver Unit Economics específicos. Los datos actuales son del workspace completo.</p>
        </div>
      )}

      {/* Financial settings summary */}
      {totalSettingsPct > 0 && (
        <Card className="border-dashed">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Márgenes configurados</span> ({selectedClient ? selectedClient.name : "workspace"}):
              {" "}COGS {fin.avg_cogs_percent}% · Envío {fin.shipping_percent}% · Fees {fin.payment_fee_percent}% · Dev. {fin.refund_percent}% · IVA {fin.iva_percent}% = <span className="font-medium text-foreground">{totalSettingsPct.toFixed(1)}% deducciones sobre revenue</span>
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">Configurá los % en Client Hub → Financial (por cliente) o Settings → Financial (workspace).</p>
          </CardContent>
        </Card>
      )}

      {noData ? (
        <EmptyState
          title="Sin datos financieros"
          description={selectedClient
            ? `Sin revenue ni spend para ${selectedClient.name} en el período seleccionado. Verificá las integraciones y que el cliente tenga cuentas vinculadas.`
            : "Sin datos en el período seleccionado."}
        />
      ) : (
        <>
          {/* Hero KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={DollarSign} label="Revenue" value={fmtCurrency(data!.totalRevenue)} status="success" hero />
            <StatCard icon={DollarSign} label="Ad Spend" value={fmtCurrency(data!.totalSpend)} status="primary" hero />
            <StatCard
              icon={TrendingUp}
              label="Contribution Margin"
              value={fmtCurrency(data!.contributionMargin)}
              status={data!.contributionMargin >= 0 ? "success" : "destructive"}
              hero
            />
            <StatCard
              icon={Percent}
              label="Margin %"
              value={`${fmt(data!.marginPercent, 1)}%`}
              subtitle="CM / Revenue"
              status={data!.marginPercent >= 20 ? "success" : data!.marginPercent >= 0 ? "warning" : "destructive"}
              hero
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={ShoppingCart} label="Órdenes" value={fmt(data!.orders)} status="neutral" />
            <StatCard icon={DollarSign} label="AOV" value={data!.orders > 0 ? fmtCurrency(data!.totalRevenue / data!.orders) : "–"} status="neutral" />
            <StatCard icon={DollarSign} label="CAC" value={data!.orders > 0 ? fmtCurrency(data!.totalSpend / data!.orders) : "–"} status="neutral" tooltip="Ad Spend / Órdenes" />
            <StatCard icon={DollarSign} label="Costos Adicionales" value={fmtCurrency(data!.totalAdditionalCosts)} status="neutral" tooltip="Costos manuales (sin % de settings)" />
          </div>

          {/* CM Formula */}
          <Card className="border-dashed">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">CM</span> = Revenue ({fmtCurrency(data!.totalRevenue)}) − Spend ({fmtCurrency(data!.totalSpend)}) − Deducciones settings ({fmtCurrency(data!.totalRevenue * totalSettingsPct / 100)}) − Costos adicionales ({fmtCurrency(data!.totalAdditionalCosts)}) = <span className="font-medium text-foreground">{fmtCurrency(data!.contributionMargin)}</span>
              </p>
            </CardContent>
          </Card>

          {/* Chart */}
          {data!.daily.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wide">Revenue vs Ad Spend (Diario)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-64 w-full">
                  <LineChart data={data!.daily} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="date" tickFormatter={(v) => { const d = new Date(v + "T00:00:00"); return `${d.getDate()}/${d.getMonth() + 1}`; }} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line yAxisId={0} type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="Revenue" />
                    <Line yAxisId={0} type="monotone" dataKey="spend" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Ad Spend" />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* COGS Vertical Share */}
          {(() => {
            const cogsRows = data!.costRows.filter((r) => r.cost_type === "cogs" && r.product_category);
            if (cogsRows.length === 0) return null;
            const totalCogs = cogsRows.reduce((s, r) => s + r.amount, 0);
            const byVertical = new Map<string, number>();
            for (const r of cogsRows) {
              byVertical.set(r.product_category!, (byVertical.get(r.product_category!) ?? 0) + r.amount);
            }
            const verticals = Array.from(byVertical.entries())
              .map(([cat, amt]) => ({ cat, amt, pct: totalCogs > 0 ? (amt / totalCogs) * 100 : 0 }))
              .sort((a, b) => b.amt - a.amt);
            return (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-wide">COGS por Vertical</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {verticals.map((v) => (
                    <div key={v.cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{v.cat}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {fmtCurrency(v.amt)} <span className="font-semibold text-foreground">{v.pct.toFixed(1)}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${v.pct}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Total COGS categorizado: <span className="font-medium text-foreground">{fmtCurrency(totalCogs)}</span>
                  </p>
                </CardContent>
              </Card>
            );
          })()}

          {/* Additional Costs Table */}
          {data!.costRows.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wide">Costos Adicionales Registrados</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Vertical</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.costRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{r.date}</TableCell>
                        <TableCell className="text-xs">{costTypeLabel[r.cost_type] ?? r.cost_type}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.product_category ?? "—"}</TableCell>
                        <TableCell className="text-xs font-medium tabular-nums">{fmtCurrency(r.amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default Finance;
