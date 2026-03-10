import { useState } from "react";
import { usePerformanceData, type CampaignRow, type PlatformTotals, type DailyPoint } from "@/hooks/usePerformanceData";
import { useWorkspace, type PlatformFilter } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";
import { fmt, fmtCurrency, fmtCompact, fmtPercent } from "@/components/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import {
  ComposedChart,
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  MousePointerClick,
  ShoppingCart,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Download,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────────────────────

function delta(current: number, prev: number) {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function DeltaBadge({ current, prev, inverse = false }: { current: number; prev: number; inverse?: boolean }) {
  const d = delta(current, prev);
  if (d === null) return <span className="text-[10px] text-muted-foreground">–</span>;
  const positive = inverse ? d < 0 : d > 0;
  const neutral = Math.abs(d) < 0.5;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-medium",
      neutral ? "text-muted-foreground" : positive ? "text-success" : "text-destructive",
    )}>
      {neutral ? <Minus className="h-2.5 w-2.5" /> : positive ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
      {Math.abs(d).toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label, value, prev, current, inverse = false, tooltip,
}: {
  label: string; value: string; prev: number; current: number; inverse?: boolean; tooltip?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-xl font-bold tracking-tight">{value}</p>
        <div className="mt-1">
          <DeltaBadge current={current} prev={prev} inverse={inverse} />
        </div>
      </CardContent>
    </Card>
  );
}

function roasStatus(roas: number) {
  if (roas >= 3) return "text-success font-bold";
  if (roas >= 1) return "text-warning font-medium";
  return "text-destructive";
}

function CampaignTable({
  campaigns, isLeadGen,
}: {
  campaigns: CampaignRow[]; isLeadGen: boolean;
}) {
  const [sortKey, setSortKey] = useState<keyof CampaignRow>("spend");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...campaigns].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return sortAsc ? av - bv : bv - av;
  });

  const handleSort = (key: keyof CampaignRow) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const Th = ({ label, col }: { label: string; col: keyof CampaignRow }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground"
      onClick={() => handleSort(col)}
    >
      {label}{sortKey === col ? (sortAsc ? " ↑" : " ↓") : ""}
    </TableHead>
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Campaña</TableHead>
          <Th label="Spend" col="spend" />
          <Th label="Impr." col="impressions" />
          <Th label="Clicks" col="clicks" />
          <Th label="CTR" col="ctr" />
          {isLeadGen ? (
            <>
              <Th label="Leads" col="purchases" />
              <Th label="CPL" col="cpa" />
            </>
          ) : (
            <>
              <Th label="Compras" col="purchases" />
              <Th label="Revenue" col="revenue" />
              <Th label="CPA" col="cpa" />
              <Th label="ROAS" col="roas" />
            </>
          )}
          <Th label="CPC" col="cpc" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((c) => (
          <TableRow key={c.campaignId}>
            <TableCell className="text-xs font-medium max-w-[220px] truncate">{c.campaignName}</TableCell>
            <TableCell className="text-xs tabular-nums">{fmtCurrency(c.spend)}</TableCell>
            <TableCell className="text-xs tabular-nums">{fmtCompact(c.impressions)}</TableCell>
            <TableCell className="text-xs tabular-nums">{fmtCompact(c.clicks)}</TableCell>
            <TableCell className="text-xs tabular-nums">{fmtPercent(c.ctr)}</TableCell>
            {isLeadGen ? (
              <>
                <TableCell className="text-xs tabular-nums">{fmt(c.purchases)}</TableCell>
                <TableCell className="text-xs tabular-nums">{c.purchases > 0 ? fmtCurrency(c.cpa) : "–"}</TableCell>
              </>
            ) : (
              <>
                <TableCell className="text-xs tabular-nums">{fmt(c.purchases)}</TableCell>
                <TableCell className="text-xs tabular-nums">{fmtCurrency(c.revenue)}</TableCell>
                <TableCell className="text-xs tabular-nums">{c.purchases > 0 ? fmtCurrency(c.cpa) : "–"}</TableCell>
                <TableCell className={cn("text-xs tabular-nums", c.spend > 0 ? roasStatus(c.roas) : "text-muted-foreground")}>
                  {c.spend > 0 ? `${fmt(c.roas, 2)}x` : "–"}
                </TableCell>
              </>
            )}
            <TableCell className="text-xs tabular-nums">{c.clicks > 0 ? fmtCurrency(c.cpc) : "–"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function fmtAxisDate(v: string) {
  const d = new Date(v + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ── Meta Tab ─────────────────────────────────────────────────────────────────

const metaChartConfig: ChartConfig = {
  spend: { label: "Spend", color: "hsl(var(--primary))" },
  cpa: { label: "CPA", color: "hsl(var(--destructive))" },
  revenue: { label: "Revenue", color: "hsl(var(--success))" },
};

function MetaTab({ totals, prevTotals, campaigns, daily, isLeadGen }: {
  totals: PlatformTotals; prevTotals: PlatformTotals;
  campaigns: CampaignRow[]; daily: DailyPoint[]; isLeadGen: boolean;
}) {
  if (campaigns.length === 0) {
    return <EmptyState title="Sin datos de Meta Ads" description="No hay campañas Meta en el período seleccionado." />;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Inversión" value={fmtCurrency(totals.spend)} current={totals.spend} prev={prevTotals.spend} />
        <KpiCard
          label={isLeadGen ? "Leads" : "Compras"}
          value={fmt(totals.purchases)}
          current={totals.purchases} prev={prevTotals.purchases}
        />
        {!isLeadGen && (
          <KpiCard label="Revenue" value={fmtCurrency(totals.revenue)} current={totals.revenue} prev={prevTotals.revenue} />
        )}
        <KpiCard
          label={isLeadGen ? "CPL" : "CPA"}
          value={totals.purchases > 0 ? fmtCurrency(totals.cpa) : "–"}
          current={totals.cpa} prev={prevTotals.cpa}
          inverse
        />
        {!isLeadGen && (
          <KpiCard
            label="ROAS"
            value={`${fmt(totals.roas, 2)}x`}
            current={totals.roas} prev={prevTotals.roas}
            tooltip="Revenue plataforma / Spend. Validar contra GA4."
          />
        )}
        <KpiCard
          label="CTR link"
          value={fmtPercent(totals.ctr)}
          current={totals.ctr} prev={prevTotals.ctr}
        />
        <KpiCard
          label="CPC"
          value={totals.clicks > 0 ? fmtCurrency(totals.cpc) : "–"}
          current={totals.cpc} prev={prevTotals.cpc}
          inverse
        />
      </div>

      {/* Scaling Tax Chart */}
      {daily.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wide">Scaling Tax</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Si el CPA sube junto al spend, estás pagando el impuesto de escalar.
                  Cada punto donde las barras crecen y la línea de CPA sube indica pérdida de eficiencia.
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={metaChartConfig} className="h-64 w-full">
              <ComposedChart data={daily} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="spend" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${fmtCompact(v)}`} />
                <YAxis yAxisId="cpa" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${fmt(v, 0)}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar yAxisId="spend" dataKey="spend" fill="hsl(var(--primary)/0.7)" name="Spend" radius={[2, 2, 0, 0]} />
                <Line yAxisId="cpa" type="monotone" dataKey="cpa" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name="CPA" />
                {!isLeadGen && (
                  <Line yAxisId="spend" type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="Revenue" />
                )}
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Campaign Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wide">Detalle por Campaña</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <CampaignTable campaigns={campaigns} isLeadGen={isLeadGen} />
        </CardContent>
      </Card>
    </div>
  );
}

// ── Google Tab ────────────────────────────────────────────────────────────────

const googleChartConfig: ChartConfig = {
  cpc: { label: "CPC", color: "hsl(var(--primary))" },
  ctr: { label: "CTR %", color: "hsl(var(--success))" },
};

function GoogleTab({ totals, prevTotals, campaigns, daily, isLeadGen }: {
  totals: PlatformTotals; prevTotals: PlatformTotals;
  campaigns: CampaignRow[]; daily: DailyPoint[]; isLeadGen: boolean;
}) {
  if (campaigns.length === 0) {
    return <EmptyState title="Sin datos de Google Ads" description="No hay campañas Google en el período seleccionado." />;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Inversión" value={fmtCurrency(totals.spend)} current={totals.spend} prev={prevTotals.spend} />
        <KpiCard
          label={isLeadGen ? "Leads" : "Compras"}
          value={fmt(totals.purchases)}
          current={totals.purchases} prev={prevTotals.purchases}
        />
        {!isLeadGen && (
          <KpiCard label="Revenue" value={fmtCurrency(totals.revenue)} current={totals.revenue} prev={prevTotals.revenue} />
        )}
        <KpiCard
          label={isLeadGen ? "CPL" : "CPA"}
          value={totals.purchases > 0 ? fmtCurrency(totals.cpa) : "–"}
          current={totals.cpa} prev={prevTotals.cpa}
          inverse
        />
        <KpiCard
          label="CPC"
          value={totals.clicks > 0 ? fmtCurrency(totals.cpc) : "–"}
          current={totals.cpc} prev={prevTotals.cpc}
          inverse
          tooltip="Costo de Intención. CPC creciente = mayor competencia o menor Quality Score."
        />
      </div>

      {/* CPC / CTR Trend */}
      {daily.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wide">Costo de Intención</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  CPC sube + CTR baja = problema de relevancia o competencia.
                  CPC sube + CTR sube = subasta más competitiva pero tráfico de calidad.
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={googleChartConfig} className="h-64 w-full">
              <LineChart data={daily} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="cpc" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${fmt(v, 2)}`} />
                <YAxis yAxisId="ctr" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${fmt(v, 2)}%`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line yAxisId="cpc" type="monotone" dataKey="cpc" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="CPC" />
                <Line yAxisId="ctr" type="monotone" dataKey="ctr" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="CTR %" />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Campaign Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wide">Detalle por Campaña</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <CampaignTable campaigns={campaigns} isLeadGen={isLeadGen} />
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const Performance = () => {
  const { data, isLoading } = usePerformanceData();
  const { platformFilter, setPlatformFilter, dateRange } = useWorkspace();
  const { selectedClient } = useClient();
  const [activeTab, setActiveTab] = useState("meta");

  const isLeadGen = selectedClient?.client_type === "lead_gen";

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ["Plataforma", "Campaña", "Spend", "Impressions", "Clicks", "CTR%", "Compras/Leads", "Revenue", "CPA/CPL", "ROAS", "CPC"],
      ...[...data.meta.campaigns, ...data.google.campaigns].map((c) => [
        c.provider, c.campaignName,
        c.spend.toFixed(2), c.impressions, c.clicks, c.ctr.toFixed(2),
        c.purchases, c.revenue.toFixed(2),
        c.purchases > 0 ? c.cpa.toFixed(2) : "",
        c.spend > 0 ? c.roas.toFixed(2) : "",
        c.clicks > 0 ? c.cpc.toFixed(2) : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance_${format(dateRange.from, "yyyyMMdd")}_${format(dateRange.to, "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <SectionHeader badge="Performance" title="Paid Media" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  const totalCampaigns = (data?.meta.campaigns.length ?? 0) + (data?.google.campaigns.length ?? 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        badge="Performance"
        title="Paid Media"
        subtitle={`${totalCampaigns} campaña(s)${isLeadGen ? " · Lead Gen" : " · Ecommerce"}`}
        action={
          <div className="flex items-center gap-2">
            <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v as PlatformFilter)}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="meta">Meta</SelectItem>
                <SelectItem value="google_ads">Google Ads</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9">
          <TabsTrigger value="meta" className="text-xs gap-1.5">
            Meta Ads
            {data && data.meta.campaigns.length > 0 && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1">{data.meta.campaigns.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="google" className="text-xs gap-1.5">
            Google Ads
            {data && data.google.campaigns.length > 0 && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1">{data.google.campaigns.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="mt-6">
          {data ? (
            <MetaTab
              totals={data.meta.totals}
              prevTotals={data.meta.prevTotals}
              campaigns={data.meta.campaigns}
              daily={data.meta.daily}
              isLeadGen={isLeadGen}
            />
          ) : (
            <EmptyState title="Sin datos" description="No hay datos de performance para el período seleccionado." />
          )}
        </TabsContent>

        <TabsContent value="google" className="mt-6">
          {data ? (
            <GoogleTab
              totals={data.google.totals}
              prevTotals={data.google.prevTotals}
              campaigns={data.google.campaigns}
              daily={data.google.daily}
              isLeadGen={isLeadGen}
            />
          ) : (
            <EmptyState title="Sin datos" description="No hay datos de performance para el período seleccionado." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// date-fns format import for CSV
function format(d: Date, fmt: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return fmt
    .replace("yyyyMMdd", `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`)
    .replace("yyyy-MM-dd", `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
}

export default Performance;
