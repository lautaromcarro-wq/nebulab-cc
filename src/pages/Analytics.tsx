import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { format, subDays, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import SectionHeader from "@/components/SectionHeader";
import { fmt, fmtCurrency, fmtCompact } from "@/components/formatters";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as ReTooltip, Legend,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, ShoppingCart,
  Globe, Users, Activity, BarChart3, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Formatters ──
const fmtK = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));
const fmtDuration = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, "0")}`;

const PLATFORM_COLORS: Record<string, string> = { meta: "#1877F2", google_ads: "#34A853", ga4: "#F9AB00" };
const PLATFORM_LABELS: Record<string, string> = { meta: "Meta", google_ads: "Google Ads", ga4: "GA4" };

// ── Delta helpers ──
// higherIsBetter: true = green when positive, false = green when negative (e.g. CPA, spend)
function calcDelta(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function DeltaBadge({
  current,
  previous,
  fmt: fmtFn,
  higherIsBetter = true,
  className,
}: {
  current: number;
  previous: number;
  fmt: (n: number) => string;
  higherIsBetter?: boolean;
  className?: string;
}) {
  const delta = calcDelta(current, previous);
  if (delta === null) return null;

  const isPositive = delta > 0;
  const isGood = higherIsBetter ? isPositive : !isPositive;
  const Icon = delta === 0 ? Minus : isPositive ? TrendingUp : TrendingDown;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded cursor-help",
            isGood
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive",
            className
          )}
        >
          <Icon className="h-2.5 w-2.5" />
          {Math.abs(delta).toFixed(1)}%
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="text-muted-foreground">Período anterior</p>
        <p className="font-bold">{fmtFn(previous)}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ── KPI Card with optional delta ──
function KpiCard({
  icon: Icon,
  label,
  value,
  fmtFn,
  previous,
  higherIsBetter = true,
  compare,
}: {
  icon: any;
  label: string;
  value: number;
  fmtFn: (n: number) => string;
  previous?: number;
  higherIsBetter?: boolean;
  compare: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex items-end gap-2">
          <p className="text-xl font-bold tabular-nums">{fmtFn(value)}</p>
          {compare && previous !== undefined && (
            <DeltaBadge current={value} previous={previous} fmt={fmtFn} higherIsBetter={higherIsBetter} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Chart tooltip ──
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-muted-foreground">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span>{p.name}:</span>
          <span className="font-bold">{typeof p.value === "number" ? (p.value > 100 ? fmtK(p.value) : p.value.toFixed(2)) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Platform metric row ──
function PlatformMetric({
  label, value, fmtFn, previous, higherIsBetter = true, compare,
}: {
  label: string; value: number; fmtFn: (n: number) => string;
  previous?: number; higherIsBetter?: boolean; compare: boolean;
}) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-end gap-1.5">
        <p className="text-sm font-bold tabular-nums">{fmtFn(value)}</p>
        {compare && previous !== undefined && (
          <DeltaBadge current={value} previous={previous} fmt={fmtFn} higherIsBetter={higherIsBetter} />
        )}
      </div>
    </div>
  );
}

// ── Data aggregation helper ──
function aggregateRows(rows: any[]) {
  const adRows = rows.filter((r) => r.provider !== "ga4");
  const ga4Rows = rows.filter((r) => r.provider === "ga4");

  const totalSpend = adRows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const totalRevenue = adRows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
  const totalImpressions = adRows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
  const totalClicks = adRows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
  const totalPurchases = adRows.reduce((s, r) => s + (Number(r.purchases) || 0), 0);

  const totalSessions = ga4Rows.reduce((s, r) => s + (Number(r.sessions) || 0), 0);
  const totalUsers = ga4Rows.reduce((s, r) => s + (Number(r.users_count) || 0), 0);
  const totalGA4Purchases = ga4Rows.reduce((s, r) => s + (Number(r.purchases) || 0), 0);

  const platformMap = new Map<string, { spend: number; impressions: number; clicks: number; purchases: number; revenue: number; conversions: number }>();
  for (const r of adRows) {
    const ex = platformMap.get(r.provider) ?? { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0, conversions: 0 };
    ex.spend += Number(r.spend) || 0;
    ex.impressions += Number(r.impressions) || 0;
    ex.clicks += Number(r.clicks) || 0;
    ex.purchases += Number(r.purchases) || 0;
    ex.revenue += Number(r.revenue) || 0;
    ex.conversions += Number(r.conversions) || 0;
    platformMap.set(r.provider, ex);
  }

  return {
    adRows, ga4Rows,
    totalSpend, totalRevenue, totalImpressions, totalClicks, totalPurchases,
    blendedROAS: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    totalSessions, totalUsers, totalGA4Purchases,
    platforms: Array.from(platformMap.entries()).map(([provider, d]) => ({
      provider, label: PLATFORM_LABELS[provider] ?? provider, color: PLATFORM_COLORS[provider] ?? "#888",
      ...d,
      roas: d.spend > 0 ? d.revenue / d.spend : 0,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
      cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0,
      cpa: d.purchases > 0 ? d.spend / d.purchases : 0,
    })).sort((a, b) => b.spend - a.spend),
    platformMap,
  };
}

// ── Main ──
export default function Analytics() {
  const { currentWorkspace, dateRange } = useWorkspace();
  const { selectedClient } = useClient();
  const wsId = currentWorkspace?.id ?? "";
  const [compare, setCompare] = useState(false);

  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");

  // Previous period: same length, immediately before
  const periodDays = differenceInDays(dateRange.to, dateRange.from) + 1;
  const prevTo = subDays(dateRange.from, 1);
  const prevFrom = subDays(dateRange.from, periodDays);
  const prevFromStr = format(prevFrom, "yyyy-MM-dd");
  const prevToStr = format(prevTo, "yyyy-MM-dd");

  const fetchRows = async (from: string, to: string) => {
    let q = supabase
      .from("performance_daily")
      .select("date, provider, entity_type, spend, impressions, clicks, purchases, revenue, conversions, sessions, users_count, notes, currency")
      .eq("workspace_id", wsId)
      .gte("date", from)
      .lte("date", to)
      .order("date");
    if (selectedClient) q = q.eq("client_id", selectedClient.id);
    const { data } = await q;
    return data ?? [];
  };

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["analytics-data", wsId, selectedClient?.id, fromStr, toStr],
    enabled: !!wsId,
    queryFn: () => fetchRows(fromStr, toStr),
  });

  const { data: prevRows = [] } = useQuery({
    queryKey: ["analytics-prev", wsId, selectedClient?.id, prevFromStr, prevToStr],
    enabled: !!wsId && compare,
    queryFn: () => fetchRows(prevFromStr, prevToStr),
  });

  const curr = useMemo(() => aggregateRows(rows), [rows]);
  const prev = useMemo(() => aggregateRows(prevRows), [prevRows]);

  // Daily chart data (current + previous overlaid when compare on)
  const dailyChart = useMemo(() => {
    const map = new Map<string, { label: string; spend: number; revenue: number; roas: number }>();
    for (const r of curr.adRows) {
      const ex = map.get(r.date) ?? { label: format(new Date(r.date), "dd MMM", { locale: es }), spend: 0, revenue: 0, roas: 0 };
      ex.spend += Number(r.spend) || 0;
      ex.revenue += Number(r.revenue) || 0;
      map.set(r.date, ex);
    }
    return Array.from(map.values()).map((d) => ({ ...d, roas: d.spend > 0 ? d.revenue / d.spend : 0 }));
  }, [curr.adRows]);

  const prevDailyChart = useMemo(() => {
    const map = new Map<string, { label: string; spend: number; revenue: number }>();
    for (const r of prev.adRows) {
      const ex = map.get(r.date) ?? { label: format(new Date(r.date), "dd MMM", { locale: es }), spend: 0, revenue: 0 };
      ex.spend += Number(r.spend) || 0;
      ex.revenue += Number(r.revenue) || 0;
      map.set(r.date, ex);
    }
    return Array.from(map.values());
  }, [prev.adRows]);

  // Merge current + previous for overlay chart (align by day index)
  const mergedDaily = useMemo(() => {
    const maxLen = Math.max(dailyChart.length, prevDailyChart.length);
    return Array.from({ length: maxLen }, (_, i) => ({
      label: dailyChart[i]?.label ?? prevDailyChart[i]?.label ?? `Día ${i + 1}`,
      spend: dailyChart[i]?.spend ?? 0,
      revenue: dailyChart[i]?.revenue ?? 0,
      spend_prev: prevDailyChart[i]?.spend ?? undefined,
      revenue_prev: prevDailyChart[i]?.revenue ?? undefined,
    }));
  }, [dailyChart, prevDailyChart]);

  // ROAS by platform daily
  const roasDaily = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const r of curr.adRows) {
      const ex = map.get(r.date) ?? {};
      ex[`s_${r.provider}`] = (ex[`s_${r.provider}`] ?? 0) + (Number(r.spend) || 0);
      ex[`v_${r.provider}`] = (ex[`v_${r.provider}`] ?? 0) + (Number(r.revenue) || 0);
      map.set(r.date, ex);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => {
        const out: Record<string, any> = { label: format(new Date(date), "dd MMM", { locale: es }) };
        for (const prov of curr.platformMap.keys()) {
          out[prov] = (d[`s_${prov}`] ?? 0) > 0 ? (d[`v_${prov}`] ?? 0) / d[`s_${prov}`] : 0;
        }
        return out;
      });
  }, [curr]);

  // GA4 daily
  const ga4DailyArr = useMemo(() => {
    const map = new Map<string, { sessions: number; purchases: number }>();
    for (const r of curr.ga4Rows) {
      const ex = map.get(r.date) ?? { sessions: 0, purchases: 0 };
      ex.sessions += Number(r.sessions) || 0;
      ex.purchases += Number(r.purchases) || 0;
      map.set(r.date, ex);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        label: format(new Date(date), "dd MMM", { locale: es }),
        ...d,
        convRate: d.sessions > 0 ? (d.purchases / d.sessions) * 100 : 0,
      }));
  }, [curr.ga4Rows]);

  const ga4Notes = curr.ga4Rows.map((r) => r.notes as any).filter(Boolean);
  const avgBounce = ga4Notes.length > 0 ? ga4Notes.reduce((s: number, n: any) => s + (Number(n?.bounce_rate) || 0), 0) / ga4Notes.length : null;
  const avgDuration = ga4Notes.length > 0 ? ga4Notes.reduce((s: number, n: any) => s + (Number(n?.avg_session_duration) || 0), 0) / ga4Notes.length : null;
  const totalATC = ga4Notes.reduce((s: number, n: any) => s + (Number(n?.add_to_cart) || 0), 0);
  const totalCheckout = ga4Notes.reduce((s: number, n: any) => s + (Number(n?.begin_checkout) || 0), 0);

  const prevPlatform = (provider: string) => prev.platforms.find((p) => p.provider === provider);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <SectionHeader badge="Analytics" title="Analytics Dashboard" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const comparePeriodLabel = `${format(prevFrom, "dd MMM", { locale: es })} – ${format(prevTo, "dd MMM yyyy", { locale: es })}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        badge="Analytics"
        title="Analytics Dashboard"
        subtitle={`${format(dateRange.from, "dd MMM", { locale: es })} – ${format(dateRange.to, "dd MMM yyyy", { locale: es })}`}
        action={
          <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
            <Switch id="compare" checked={compare} onCheckedChange={setCompare} />
            <Label htmlFor="compare" className="text-xs cursor-pointer">
              Comparar con período anterior
              {compare && <span className="ml-1.5 text-muted-foreground">({comparePeriodLabel})</span>}
            </Label>
          </div>
        }
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />Overview
          </TabsTrigger>
          <TabsTrigger value="platforms" className="text-xs gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />Plataformas
          </TabsTrigger>
          <TabsTrigger value="web" className="text-xs gap-1.5">
            <Globe className="h-3.5 w-3.5" />Web (GA4)
          </TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={DollarSign} label="Spend Total" value={curr.totalSpend} fmtFn={fmtCurrency} previous={prev.totalSpend} higherIsBetter={false} compare={compare} />
            <KpiCard icon={TrendingUp} label="Revenue Total" value={curr.totalRevenue} fmtFn={fmtCurrency} previous={prev.totalRevenue} compare={compare} />
            <KpiCard icon={TrendingUp} label="ROAS Blended" value={curr.blendedROAS} fmtFn={(n) => `${n.toFixed(2)}x`} previous={prev.blendedROAS} compare={compare} />
            <KpiCard icon={ShoppingCart} label="Compras" value={curr.totalPurchases} fmtFn={fmt} previous={prev.totalPurchases} compare={compare} />
          </div>

          {/* Spend vs Revenue chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                Spend vs Revenue — Diario
                {compare && <span className="text-[10px] font-normal text-muted-foreground">líneas punteadas = período anterior</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mergedDaily.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Sin datos para el período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={mergedDaily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtK} />
                    <ReTooltip content={<ChartTip />} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Line type="monotone" dataKey="spend" name="Spend" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                    {compare && <Line type="monotone" dataKey="spend_prev" name="Spend (ant.)" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="4 3" dot={false} opacity={0.5} />}
                    {compare && <Line type="monotone" dataKey="revenue_prev" name="Revenue (ant.)" stroke="hsl(var(--success))" strokeWidth={1.5} strokeDasharray="4 3" dot={false} opacity={0.5} />}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ROAS by platform */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">ROAS Diario por Plataforma</CardTitle>
            </CardHeader>
            <CardContent>
              {roasDaily.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Sin datos.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={roasDaily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}x`} />
                    <ReTooltip content={<ChartTip />} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    {Array.from(curr.platformMap.keys()).map((prov) => (
                      <Line key={prov} type="monotone" dataKey={prov} name={PLATFORM_LABELS[prov] ?? prov} stroke={PLATFORM_COLORS[prov] ?? "#888"} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Spend share */}
          {curr.platforms.length > 0 && curr.totalSpend > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-bold">Distribución de Spend</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {curr.platforms.map((p) => (
                  <div key={p.provider} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{p.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums">{fmtCurrency(p.spend)}</span>
                        <span className="text-muted-foreground">({((p.spend / curr.totalSpend) * 100).toFixed(1)}%)</span>
                        {compare && prevPlatform(p.provider) && (
                          <DeltaBadge current={p.spend} previous={prevPlatform(p.provider)!.spend} fmt={fmtCurrency} higherIsBetter={false} />
                        )}
                      </div>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(p.spend / curr.totalSpend) * 100}%`, backgroundColor: p.color }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── PLATFORMS ── */}
        <TabsContent value="platforms" className="space-y-6">
          {curr.platforms.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Sin datos de plataformas.</CardContent></Card>
          ) : curr.platforms.map((p) => {
            const pp = prevPlatform(p.provider);
            return (
              <Card key={p.provider}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <CardTitle className="text-sm font-bold">{p.label}</CardTitle>
                    <span className={cn("text-xs font-bold", p.roas >= 1 ? "text-success" : "text-warning")}>
                      ROAS {p.roas.toFixed(2)}x
                    </span>
                    {compare && pp && (
                      <DeltaBadge current={p.roas} previous={pp.roas} fmt={(n) => `${n.toFixed(2)}x`} />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <PlatformMetric label="Spend" value={p.spend} fmtFn={fmtCurrency} previous={pp?.spend} higherIsBetter={false} compare={compare} />
                    <PlatformMetric label="Revenue / Conv. Value" value={p.revenue} fmtFn={fmtCurrency} previous={pp?.revenue} compare={compare} />
                    <PlatformMetric label="ROAS" value={p.roas} fmtFn={(n) => `${n.toFixed(2)}x`} previous={pp?.roas} compare={compare} />
                    <PlatformMetric label="Compras / Resultados" value={p.purchases > 0 ? p.purchases : p.conversions} fmtFn={fmt} previous={pp ? (pp.purchases > 0 ? pp.purchases : pp.conversions) : undefined} compare={compare} />
                    <PlatformMetric label="Impresiones" value={p.impressions} fmtFn={fmtCompact} previous={pp?.impressions} compare={compare} />
                    <PlatformMetric label="Clicks / Link Clicks" value={p.clicks} fmtFn={fmtCompact} previous={pp?.clicks} compare={compare} />
                    <PlatformMetric label="CTR" value={p.ctr} fmtFn={(n) => `${n.toFixed(2)}%`} previous={pp?.ctr} compare={compare} />
                    <PlatformMetric label="CPM" value={p.cpm} fmtFn={fmtCurrency} previous={pp?.cpm} higherIsBetter={false} compare={compare} />
                  </div>

                  {/* Mini bar chart */}
                  {(() => {
                    const data = Array.from(
                      curr.adRows
                        .filter((r) => r.provider === p.provider)
                        .reduce((acc, r) => {
                          const ex = acc.get(r.date) ?? { date: r.date, spend: 0, revenue: 0 };
                          ex.spend += Number(r.spend) || 0;
                          ex.revenue += Number(r.revenue) || 0;
                          acc.set(r.date, ex);
                          return acc;
                        }, new Map<string, any>()).values()
                    )
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((d) => ({ ...d, label: format(new Date(d.date), "dd MMM", { locale: es }) }));
                    if (data.length < 2) return null;
                    return (
                      <div className="mt-4">
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                            <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={fmtK} />
                            <ReTooltip content={<ChartTip />} />
                            <Bar dataKey="spend" name="Spend" fill={p.color} opacity={0.7} radius={[2, 2, 0, 0]} />
                            <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--success))" opacity={0.6} radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ── WEB (GA4) ── */}
        <TabsContent value="web" className="space-y-6">
          {curr.totalSessions === 0 && curr.totalUsers === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-2">
                <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">Sin datos de GA4 para el período.</p>
                <p className="text-xs text-muted-foreground/70">Verificá que la integración de GA4 esté activa.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard icon={Users} label="Sesiones" value={curr.totalSessions} fmtFn={fmtCompact} previous={prev.totalSessions} compare={compare} />
                <KpiCard icon={Users} label="Usuarios" value={curr.totalUsers} fmtFn={fmtCompact} previous={prev.totalUsers} compare={compare} />
                <KpiCard icon={ShoppingCart} label="Compras" value={curr.totalGA4Purchases} fmtFn={fmt} previous={prev.totalGA4Purchases} compare={compare} />
                <KpiCard
                  icon={Activity}
                  label="Conv. Rate"
                  value={curr.totalSessions > 0 ? (curr.totalGA4Purchases / curr.totalSessions) * 100 : 0}
                  fmtFn={(n) => `${n.toFixed(2)}%`}
                  previous={prev.totalSessions > 0 ? (prev.totalGA4Purchases / prev.totalSessions) * 100 : undefined}
                  compare={compare}
                />
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm font-bold">Tasas de Conversión</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Compras / Sesión", value: curr.totalSessions > 0 ? (curr.totalGA4Purchases / curr.totalSessions) * 100 : 0, fmtFn: (n: number) => `${n.toFixed(2)}%`, prevVal: prev.totalSessions > 0 ? (prev.totalGA4Purchases / prev.totalSessions) * 100 : 0 },
                    { label: "Compras / Usuarios", value: curr.totalUsers > 0 ? (curr.totalGA4Purchases / curr.totalUsers) * 100 : 0, fmtFn: (n: number) => `${n.toFixed(2)}%`, prevVal: prev.totalUsers > 0 ? (prev.totalGA4Purchases / prev.totalUsers) * 100 : 0 },
                    { label: "Add to Cart / Sesión", value: curr.totalSessions > 0 && totalATC > 0 ? (totalATC / curr.totalSessions) * 100 : 0, fmtFn: (n: number) => n > 0 ? `${n.toFixed(2)}%` : "–", prevVal: 0 },
                    { label: "Begin Checkout / Sesión", value: curr.totalSessions > 0 && totalCheckout > 0 ? (totalCheckout / curr.totalSessions) * 100 : 0, fmtFn: (n: number) => n > 0 ? `${n.toFixed(2)}%` : "–", prevVal: 0 },
                    { label: "Tasa de Rebote", value: avgBounce != null ? avgBounce * 100 : 0, fmtFn: (n: number) => n > 0 ? `${n.toFixed(1)}%` : "–", prevVal: 0, higherIsBetter: false },
                    { label: "Duración Promedio Sesión", value: avgDuration ?? 0, fmtFn: (n: number) => n > 0 ? fmtDuration(n) : "–", prevVal: 0 },
                  ].map((m) => (
                    <div key={m.label} className="bg-muted/30 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{m.label}</p>
                      <div className="flex items-end gap-1.5">
                        <p className="text-sm font-bold tabular-nums">{m.fmtFn(m.value)}</p>
                        {compare && m.prevVal > 0 && (
                          <DeltaBadge current={m.value} previous={m.prevVal} fmt={m.fmtFn} higherIsBetter={m.higherIsBetter ?? true} />
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {ga4DailyArr.length > 1 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm font-bold">Sesiones y Conversiones — Diario</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={ga4DailyArr} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtK} />
                        <ReTooltip content={<ChartTip />} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Line type="monotone" dataKey="sessions" name="Sesiones" stroke="#F9AB00" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="purchases" name="Compras" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
