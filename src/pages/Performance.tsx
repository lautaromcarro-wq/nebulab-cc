import { useState } from "react";
import { usePerformanceData, type CampaignRow } from "@/hooks/usePerformanceData";
import { useWorkspace, type PlatformFilter } from "@/contexts/WorkspaceContext";
import SectionHeader from "@/components/SectionHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { fmt, fmtCurrency, fmtCompact, fmtPercent } from "@/components/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  Eye,
  MousePointerClick,
  ShoppingCart,
  TrendingUp,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const providerBadge: Record<string, { label: string; className: string }> = {
  meta: { label: "Meta", className: "bg-info/10 text-info border-info/20" },
  google_ads: { label: "Google", className: "bg-success/10 text-success border-success/20" },
};

type SortKey = keyof Pick<CampaignRow, "spend" | "impressions" | "clicks" | "ctr" | "purchases" | "revenue" | "cpa" | "roas">;

const chartConfig: ChartConfig = {
  spend: { label: "Spend", color: "hsl(var(--primary))" },
  purchases: { label: "Purchases", color: "hsl(var(--success))" },
};

const Performance = () => {
  const { data, isLoading } = usePerformanceData();
  const { platformFilter, setPlatformFilter } = useWorkspace();
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <SectionHeader badge="Performance" title="Campaign Overview" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (!data || data.campaigns.length === 0) {
    return (
      <div className="space-y-8 animate-fade-in">
        <SectionHeader badge="Performance" title="Campaign Overview" />
        <EmptyState
          title="Sin datos de campañas"
          description="No hay datos de performance para el rango seleccionado. Verificá las integraciones y el rango de fechas."
        />
      </div>
    );
  }

  const { totals, campaigns, daily } = data;

  // Sort campaigns
  const sorted = [...campaigns].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortAsc ? diff : -diff;
  });

  const SortableHead = ({ label, colKey }: { label: string; colKey: SortKey }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => handleSort(colKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === colKey && (
          <ArrowUpDown className="h-3 w-3 text-primary" />
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <SectionHeader
        badge="Performance"
        title="Campaign Overview"
        subtitle={`${campaigns.length} campaña(s) activa(s)`}
        action={
          <Select
            value={platformFilter}
            onValueChange={(v) => setPlatformFilter(v as PlatformFilter)}
          >
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="meta">Meta</SelectItem>
              <SelectItem value="google_ads">Google Ads</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Spend" value={fmtCurrency(totals.spend)} status="primary" hero />
        <StatCard icon={ShoppingCart} label="Purchases" value={fmt(totals.purchases)} status="success" hero />
        <StatCard icon={TrendingUp} label="ROAS" value={`${fmt(totals.roas, 2)}x`} status={totals.roas >= 1 ? "success" : "warning"} hero />
        <StatCard icon={DollarSign} label="CPA" value={fmtCurrency(totals.cpa)} status="neutral" hero />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Eye} label="Impressions" value={fmtCompact(totals.impressions)} status="neutral" />
        <StatCard icon={MousePointerClick} label="Clicks" value={fmtCompact(totals.clicks)} status="neutral" />
        <StatCard icon={MousePointerClick} label="CTR" value={fmtPercent(totals.ctr)} status="neutral" />
        <StatCard icon={DollarSign} label="Revenue Plat." value={fmtCurrency(totals.revenue)} status="neutral" />
      </div>

      {/* Chart */}
      {daily.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wide">
              Spend vs Purchases (Diario)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <LineChart data={daily} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => {
                    const d = new Date(v + "T00:00:00");
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis yAxisId="spend" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis yAxisId="purchases" orientation="right" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  yAxisId="spend"
                  type="monotone"
                  dataKey="spend"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  name="Spend"
                />
                <Line
                  yAxisId="purchases"
                  type="monotone"
                  dataKey="purchases"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  dot={false}
                  name="Purchases"
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Campaign Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wide">
            Detalle por Campaña
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaña</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Cuenta</TableHead>
                <SortableHead label="Spend" colKey="spend" />
                <SortableHead label="Impr." colKey="impressions" />
                <SortableHead label="Clicks" colKey="clicks" />
                <SortableHead label="CTR" colKey="ctr" />
                <SortableHead label="Purch." colKey="purchases" />
                <SortableHead label="Revenue" colKey="revenue" />
                <SortableHead label="CPA" colKey="cpa" />
                <SortableHead label="ROAS" colKey="roas" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c) => {
                const badge = providerBadge[c.provider] ?? { label: c.provider, className: "bg-muted text-muted-foreground" };
                return (
                  <TableRow key={c.campaignId}>
                    <TableCell className="font-medium text-xs max-w-[200px] truncate">
                      {c.campaignName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] border-0", badge.className)}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                      {c.accountName}
                    </TableCell>
                    <TableCell className="text-xs font-medium tabular-nums">
                      {fmtCurrency(c.spend)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {fmtCompact(c.impressions)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {fmtCompact(c.clicks)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {fmtPercent(c.ctr)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {fmt(c.purchases)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {fmtCurrency(c.revenue)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {c.purchases > 0 ? fmtCurrency(c.cpa) : "–"}
                    </TableCell>
                    <TableCell className={cn(
                      "text-xs font-medium tabular-nums",
                      c.roas >= 1 ? "text-success" : c.roas > 0 ? "text-warning" : "text-muted-foreground"
                    )}>
                      {c.spend > 0 ? `${fmt(c.roas, 2)}x` : "–"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Performance;
