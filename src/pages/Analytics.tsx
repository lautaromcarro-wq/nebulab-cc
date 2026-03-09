import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import SectionHeader from "@/components/SectionHeader";
import StatCard from "@/components/StatCard";
import { fmt, fmtCurrency, fmtCompact, fmtPercent } from "@/components/formatters";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import {
  DollarSign, TrendingUp, ShoppingCart, Eye, MousePointerClick,
  Globe, Users, Activity, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Formatters ──
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));
const fmtM = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));
const fmtDuration = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

const PLATFORM_COLORS: Record<string, string> = {
  meta: "#1877F2",
  google_ads: "#34A853",
  ga4: "#F9AB00",
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta",
  google_ads: "Google Ads",
  ga4: "GA4",
};

// ── Custom tooltip ──
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-muted-foreground">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span>{p.name}:</span>
          <span className="font-bold">{typeof p.value === "number" && p.value > 100 ? fmtK(p.value) : typeof p.value === "number" ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main ──
export default function Analytics() {
  const { currentWorkspace, dateRange } = useWorkspace();
  const { selectedClient } = useClient();
  const wsId = currentWorkspace?.id ?? "";
  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["analytics-data", wsId, selectedClient?.id, fromStr, toStr],
    enabled: !!wsId,
    queryFn: async () => {
      let q = supabase
        .from("performance_daily")
        .select("date, provider, entity_type, spend, impressions, clicks, purchases, revenue, conversions, sessions, users_count, notes, currency")
        .eq("workspace_id", wsId)
        .gte("date", fromStr)
        .lte("date", toStr)
        .order("date");
      if (selectedClient) q = q.eq("client_id", selectedClient.id);
      const { data } = await q;
      return data ?? [];
    },
  });

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

  // ── Aggregate data ──
  const adRows = rows.filter((r) => r.provider !== "ga4");
  const ga4Rows = rows.filter((r) => r.provider === "ga4");

  // Daily aggregated (for charts) — ad platforms only
  const dailyMap = new Map<string, { date: string; spend: number; revenue: number; impressions: number; clicks: number; purchases: number }>();
  for (const r of adRows) {
    const ex = dailyMap.get(r.date) ?? { date: r.date, spend: 0, revenue: 0, impressions: 0, clicks: 0, purchases: 0 };
    ex.spend += Number(r.spend) || 0;
    ex.revenue += Number(r.revenue) || 0;
    ex.impressions += Number(r.impressions) || 0;
    ex.clicks += Number(r.clicks) || 0;
    ex.purchases += Number(r.purchases) || 0;
    dailyMap.set(r.date, ex);
  }
  const daily = Array.from(dailyMap.values()).map((d) => ({
    ...d,
    roas: d.spend > 0 ? d.revenue / d.spend : 0,
    label: format(new Date(d.date), "dd MMM", { locale: es }),
  }));

  // By platform aggregates
  const platformMap = new Map<string, { spend: number; impressions: number; clicks: number; purchases: number; revenue: number; conversions: number }>();
  for (const r of adRows) {
    const p = r.provider;
    const ex = platformMap.get(p) ?? { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0, conversions: 0 };
    ex.spend += Number(r.spend) || 0;
    ex.impressions += Number(r.impressions) || 0;
    ex.clicks += Number(r.clicks) || 0;
    ex.purchases += Number(r.purchases) || 0;
    ex.revenue += Number(r.revenue) || 0;
    ex.conversions += Number(r.conversions) || 0;
    platformMap.set(p, ex);
  }

  const platforms = Array.from(platformMap.entries()).map(([provider, d]) => ({
    provider,
    label: PLATFORM_LABELS[provider] ?? provider,
    color: PLATFORM_COLORS[provider] ?? "#888",
    spend: d.spend,
    impressions: d.impressions,
    clicks: d.clicks,
    purchases: d.purchases,
    revenue: d.revenue,
    conversions: d.conversions,
    roas: d.spend > 0 ? d.revenue / d.spend : 0,
    ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
    cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0,
    cpa: d.purchases > 0 ? d.spend / d.purchases : 0,
  })).sort((a, b) => b.spend - a.spend);

  // ROAS chart by platform (daily)
  const roasDailyMap = new Map<string, Record<string, number>>();
  for (const r of adRows) {
    const ex = roasDailyMap.get(r.date) ?? { date: r.date };
    if (!ex[`spend_${r.provider}`]) ex[`spend_${r.provider}`] = 0;
    if (!ex[`rev_${r.provider}`]) ex[`rev_${r.provider}`] = 0;
    ex[`spend_${r.provider}`] += Number(r.spend) || 0;
    ex[`rev_${r.provider}`] += Number(r.revenue) || 0;
    roasDailyMap.set(r.date, ex);
  }
  const roasDaily = Array.from(roasDailyMap.values()).map((d) => {
    const out: Record<string, any> = { label: format(new Date(d.date as string), "dd MMM", { locale: es }) };
    for (const prov of platformMap.keys()) {
      const spend = Number(d[`spend_${prov}`]) || 0;
      const rev = Number(d[`rev_${prov}`]) || 0;
      out[prov] = spend > 0 ? rev / spend : 0;
    }
    return out;
  });

  // Totals
  const totalSpend = adRows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const totalRevenue = adRows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
  const totalImpressions = adRows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
  const totalClicks = adRows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
  const totalPurchases = adRows.reduce((s, r) => s + (Number(r.purchases) || 0), 0);
  const blendedROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  // GA4 aggregates
  const totalSessions = ga4Rows.reduce((s, r) => s + (Number(r.sessions) || 0), 0);
  const totalUsers = ga4Rows.reduce((s, r) => s + (Number(r.users_count) || 0), 0);
  const totalGA4Purchases = ga4Rows.reduce((s, r) => s + (Number(r.purchases) || 0), 0);
  const ga4Daily = new Map<string, { sessions: number; users: number; purchases: number }>();
  for (const r of ga4Rows) {
    const ex = ga4Daily.get(r.date) ?? { sessions: 0, users: 0, purchases: 0 };
    ex.sessions += Number(r.sessions) || 0;
    ex.users += Number(r.users_count) || 0;
    ex.purchases += Number(r.purchases) || 0;
    ga4Daily.set(r.date, ex);
  }
  const ga4DailyArr = Array.from(ga4Daily.entries()).map(([date, d]) => ({
    label: format(new Date(date), "dd MMM", { locale: es }),
    ...d,
    convRate: d.sessions > 0 ? (d.purchases / d.sessions) * 100 : 0,
  })).sort((a, b) => a.label.localeCompare(b.label));

  // Notes-based GA4 extras (bounce_rate, avg_session_duration, atc, checkout)
  const ga4Notes = ga4Rows.map((r) => r.notes as any).filter(Boolean);
  const avgBounce = ga4Notes.length > 0 ? ga4Notes.reduce((s: number, n: any) => s + (Number(n?.bounce_rate) || 0), 0) / ga4Notes.length : null;
  const avgDuration = ga4Notes.length > 0 ? ga4Notes.reduce((s: number, n: any) => s + (Number(n?.avg_session_duration) || 0), 0) / ga4Notes.length : null;
  const totalATC = ga4Notes.reduce((s: number, n: any) => s + (Number(n?.add_to_cart) || 0), 0);
  const totalCheckout = ga4Notes.reduce((s: number, n: any) => s + (Number(n?.begin_checkout) || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        badge="Analytics"
        title="Analytics Dashboard"
        subtitle={`${format(dateRange.from, "dd MMM", { locale: es })} – ${format(dateRange.to, "dd MMM yyyy", { locale: es })}`}
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

        {/* ── OVERVIEW TAB ── */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={DollarSign} label="Spend Total" value={fmtCurrency(totalSpend)} status="primary" />
            <StatCard icon={TrendingUp} label="Revenue Total" value={fmtCurrency(totalRevenue)} status="success" />
            <StatCard icon={TrendingUp} label="ROAS Blended" value={`${blendedROAS.toFixed(2)}x`} status={blendedROAS >= 1 ? "success" : "warning"} />
            <StatCard icon={ShoppingCart} label="Compras" value={fmt(totalPurchases)} status="neutral" />
          </div>

          {/* Spend vs Revenue chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">Spend vs Revenue — Diario</CardTitle>
            </CardHeader>
            <CardContent>
              {daily.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Sin datos para el período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={daily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtK} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Line type="monotone" dataKey="spend" name="Spend" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ROAS Blended chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">ROAS Diario por Plataforma</CardTitle>
            </CardHeader>
            <CardContent>
              {roasDaily.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Sin datos para el período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={roasDaily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}x`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    {Array.from(platformMap.keys()).map((prov) => (
                      <Line key={prov} type="monotone" dataKey={prov} name={PLATFORM_LABELS[prov] ?? prov} stroke={PLATFORM_COLORS[prov] ?? "#888"} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Spend by platform bar */}
          {platforms.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold">Spend por Plataforma</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {platforms.map((p) => (
                    <div key={p.provider} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{p.label}</span>
                        <span className="tabular-nums">{fmtCurrency(p.spend)} <span className="text-muted-foreground">({((p.spend / totalSpend) * 100).toFixed(1)}%)</span></span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(p.spend / totalSpend) * 100}%`, backgroundColor: p.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── PLATFORMS TAB ── */}
        <TabsContent value="platforms" className="space-y-6">
          {platforms.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Sin datos de plataformas para el período.</CardContent></Card>
          ) : platforms.map((p) => (
            <Card key={p.provider}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <CardTitle className="text-sm font-bold">{p.label}</CardTitle>
                  <Badge variant="outline" className="text-[9px]">ROAS {p.roas.toFixed(2)}x</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Spend", value: fmtCurrency(p.spend), highlight: true },
                    { label: "Revenue / Conv. Value", value: fmtCurrency(p.revenue) },
                    { label: "ROAS", value: `${p.roas.toFixed(2)}x`, good: p.roas >= 1 },
                    { label: "Compras / Resultados", value: fmt(p.purchases > 0 ? p.purchases : p.conversions) },
                    { label: "Impresiones", value: fmtM(p.impressions) },
                    { label: "Clicks / Link Clicks", value: fmtM(p.clicks) },
                    { label: "CTR", value: `${p.ctr.toFixed(2)}%` },
                    { label: "CPM", value: fmtCurrency(p.cpm) },
                  ].map((m) => (
                    <div key={m.label} className="bg-muted/30 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{m.label}</p>
                      <p className={cn("text-sm font-bold tabular-nums", m.good !== undefined ? (m.good ? "text-success" : "text-warning") : m.highlight ? "text-primary" : "")}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Daily spend+revenue chart per platform */}
                {(() => {
                  const platDaily = daily.filter((_, i) => adRows.filter((r) => r.provider === p.provider && r.date === daily[i]?.date).length > 0);
                  const data = Array.from(
                    new Map(
                      adRows
                        .filter((r) => r.provider === p.provider)
                        .reduce((acc, r) => {
                          const ex = acc.get(r.date) ?? { date: r.date, spend: 0, revenue: 0 };
                          ex.spend += Number(r.spend) || 0;
                          ex.revenue += Number(r.revenue) || 0;
                          acc.set(r.date, ex);
                          return acc;
                        }, new Map<string, { date: string; spend: number; revenue: number }>())
                    ).values()
                  ).sort((a, b) => a.date.localeCompare(b.date))
                    .map((d) => ({ ...d, label: format(new Date(d.date), "dd MMM", { locale: es }) }));

                  if (data.length < 2) return null;
                  return (
                    <div className="mt-4">
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                          <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={fmtK} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="spend" name="Spend" fill={p.color} opacity={0.7} radius={[2, 2, 0, 0]} />
                          <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--success))" opacity={0.6} radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── WEB (GA4) TAB ── */}
        <TabsContent value="web" className="space-y-6">
          {totalSessions === 0 && totalUsers === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-2">
                <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">Sin datos de GA4 para el período seleccionado.</p>
                <p className="text-xs text-muted-foreground/70">Verificá que la integración de GA4 esté activa y sincronizando.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Main KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={Users} label="Sesiones" value={fmtCompact(totalSessions)} status="primary" />
                <StatCard icon={Users} label="Usuarios" value={fmtCompact(totalUsers)} status="neutral" />
                <StatCard icon={ShoppingCart} label="Compras" value={fmt(totalGA4Purchases)} status="success" />
                <StatCard icon={Activity} label="Conv. Rate" value={totalSessions > 0 ? `${((totalGA4Purchases / totalSessions) * 100).toFixed(2)}%` : "–"} status="neutral" />
              </div>

              {/* Conversion rates grid */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Tasas de Conversión</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Compras / Sesión", value: totalSessions > 0 ? `${((totalGA4Purchases / totalSessions) * 100).toFixed(2)}%` : "–" },
                    { label: "Compras / Usuarios", value: totalUsers > 0 ? `${((totalGA4Purchases / totalUsers) * 100).toFixed(2)}%` : "–" },
                    { label: "Add to Cart / Sesión", value: totalSessions > 0 && totalATC > 0 ? `${((totalATC / totalSessions) * 100).toFixed(2)}%` : "–" },
                    { label: "Begin Checkout / Sesión", value: totalSessions > 0 && totalCheckout > 0 ? `${((totalCheckout / totalSessions) * 100).toFixed(2)}%` : "–" },
                    { label: "Tasa de Rebote", value: avgBounce != null ? `${(avgBounce * 100).toFixed(1)}%` : "–" },
                    { label: "Duración Promedio Sesión", value: avgDuration != null ? fmtDuration(avgDuration) : "–" },
                    { label: "Páginas / Sesión", value: "–" },
                    { label: "Usuarios nuevos", value: "–" },
                  ].map((m) => (
                    <div key={m.label} className="bg-muted/30 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{m.label}</p>
                      <p className="text-sm font-bold tabular-nums">{m.value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Sessions / Users daily chart */}
              {ga4DailyArr.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-bold">Sesiones y Conversiones — Diario</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={ga4DailyArr} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtK} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Line type="monotone" dataKey="sessions" name="Sesiones" stroke="#F9AB00" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="purchases" name="Compras" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Conversion rate trend */}
              {ga4DailyArr.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-bold">Tasa de Conversión — Diario</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={ga4DailyArr} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(2)}%`} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="convRate" name="Conv. Rate (%)" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
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
