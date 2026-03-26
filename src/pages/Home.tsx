import { useScorecard, type SegmentScorecard, type ScorecardDaily } from "@/hooks/useScorecard";
import { usePlatformMetrics, type GA4Metrics, type MetaMetrics, type GoogleMetrics } from "@/hooks/usePlatformMetrics";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceHealth } from "@/hooks/useWorkspaceHealth";
import { useProfile } from "@/hooks/useProfile";
import { useRecentChangelog } from "@/hooks/useRecentChangelog";
import { useClient } from "@/contexts/ClientContext";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight, Minus,
  Percent, Clock, FileText, Users, Sparkles, Globe, MousePointerClick,
  ShoppingCart, Eye, HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DeltaBadge } from "@/components/DeltaBadge";
import { roasColor, marginColor } from "@/lib/semaforo";
import SectionHeader from "@/components/SectionHeader";
import StatusStrip from "@/components/StatusStrip";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { fmt, fmtCurrency, fmtCompact, fmtPercent } from "@/components/formatters";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as ReTooltip,
} from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtAxisDate(v: string): string {
  const d = new Date(v + "T00:00:00");
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// Compact metric cell for platform panels
function KpiChip({
  label, value, current, prev, inverse = false, tooltip, noData = false,
}: {
  label: string; value: string; current: number; prev: number;
  inverse?: boolean; tooltip?: string; noData?: boolean;
}) {
  const content = (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-none">{label}</p>
      <p className={cn("text-sm font-bold leading-tight", noData && "text-muted-foreground/50")}>{value}</p>
      <DeltaBadge current={current} prev={prev} inverse={inverse} />
    </div>
  );
  if (!tooltip) return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild><div className="cursor-help">{content}</div></TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

const pacingConfig = {
  overpacing:  { label: "Overpacing",  icon: ArrowUpRight,  className: "bg-destructive/10 text-destructive border-destructive/20" },
  on_track:    { label: "On Track",    icon: Minus,         className: "bg-success/10 text-success border-success/20" },
  underpacing: { label: "Underpacing", icon: ArrowDownRight, className: "bg-warning/10 text-warning border-warning/20" },
};

const changeTypeIcons: Record<string, string> = {
  strategic: "🧠", budget: "💰", creative: "🎨", targeting: "🎯",
  bid: "📊", landing: "🔗", copy: "✏️", new_adset: "➕", other: "📝",
};

const platformBadge: Record<string, { label: string; className: string }> = {
  meta:       { label: "Meta",       className: "bg-info/10 text-info" },
  google_ads: { label: "Google Ads", className: "bg-success/10 text-success" },
  ga4:        { label: "GA4",        className: "bg-warning/10 text-warning" },
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

// ── Platform panel header ─────────────────────────────────────────────────────

function PlatformHeader({
  color, label, sub,
}: { color: string; label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between pb-3 mb-3 border-b">
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
        <h3 className="text-xs font-bold uppercase tracking-widest">{label}</h3>
      </div>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ── GA4 Panel ─────────────────────────────────────────────────────────────────

function GA4Panel({ current, prev }: { current: GA4Metrics; prev: GA4Metrics }) {
  const hasData = current.sessions > 0;
  return (
    <Card className="border-l-4 border-l-warning">
      <CardContent className="p-4">
        <PlatformHeader color="bg-warning" label="GA4 · Sitio Web" sub={hasData ? `${fmtCompact(current.sessions)} sesiones` : undefined} />

        {/* KPI grid */}
        <div className="grid grid-cols-3 gap-x-3 gap-y-4 mb-4">
          <KpiChip label="Sesiones" value={fmtCompact(current.sessions)} current={current.sessions} prev={prev.sessions} noData={!hasData} />
          <KpiChip label="Usuarios" value={fmtCompact(current.users)} current={current.users} prev={prev.users} noData={!hasData} />
          <KpiChip
            label="Pág / Visita"
            value={hasData ? fmt(current.pagesPerSession, 1) : "–"}
            current={current.pagesPerSession} prev={prev.pagesPerSession}
            noData={!hasData}
          />
          <KpiChip
            label="Duración avg"
            value={hasData ? fmtDuration(current.avgSessionDuration) : "–"}
            current={current.avgSessionDuration} prev={prev.avgSessionDuration}
            noData={!hasData}
          />
          <KpiChip
            label="Tasa Rebote"
            value={hasData ? fmtPercent(current.bounceRate) : "–"}
            current={current.bounceRate} prev={prev.bounceRate}
            inverse
            noData={!hasData}
            tooltip="% de sesiones sin interacción. Menor es mejor."
          />
        </div>

        {/* Channel Groups chart */}
        {current.byChannel.length > 0 ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Canales de Tráfico</p>
            <div className="space-y-1.5">
              {current.byChannel.map((ch) => {
                const maxSessions = current.byChannel[0]?.sessions || 1;
                const pct = (ch.sessions / maxSessions) * 100;
                return (
                  <div key={ch.channel} className="flex items-center gap-2">
                    <p className="text-[10px] text-muted-foreground w-24 truncate shrink-0">{ch.channel}</p>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-warning rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] tabular-nums text-muted-foreground w-10 text-right">{fmtCompact(ch.sessions)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/50 text-center py-2">Sin datos de canales</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Meta Panel ────────────────────────────────────────────────────────────────

function MetaPanel({ current, prev, isLeadGen }: { current: MetaMetrics; prev: MetaMetrics; isLeadGen: boolean }) {
  const hasData = current.spend > 0;
  return (
    <Card className="border-l-4 border-l-info">
      <CardContent className="p-4">
        <PlatformHeader
          color="bg-info"
          label="Meta Ads"
          sub={hasData ? `${fmtCurrency(current.spend)} invertidos` : undefined}
        />

        {/* Row 1: Volumen */}
        <div className="mb-3">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Volumen</p>
          <div className="grid grid-cols-4 gap-x-3 gap-y-3">
            <KpiChip label="Inversión" value={fmtCurrency(current.spend)} current={current.spend} prev={prev.spend} noData={!hasData} />
            <KpiChip label="Alcance" value={fmtCompact(current.reach)} current={current.reach} prev={prev.reach} noData={!hasData} tooltip="Personas únicas que vieron el anuncio." />
            <KpiChip label="Impresiones" value={fmtCompact(current.impressions)} current={current.impressions} prev={prev.impressions} noData={!hasData} />
            <KpiChip label="CPM" value={hasData ? fmtCurrency(current.cpm) : "–"} current={current.cpm} prev={prev.cpm} inverse noData={!hasData} tooltip="Costo por 1000 impresiones." />
          </div>
        </div>

        {/* Row 2: Resultados */}
        <div className="mb-3">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">
            {isLeadGen ? "Leads" : "Compras"}
          </p>
          <div className="grid grid-cols-4 gap-x-3 gap-y-3">
            <KpiChip
              label={isLeadGen ? "Leads" : "Compras"}
              value={fmt(current.purchases)}
              current={current.purchases} prev={prev.purchases}
              noData={!hasData}
            />
            {!isLeadGen && (
              <KpiChip label="Revenue" value={fmtCurrency(current.revenue)} current={current.revenue} prev={prev.revenue} noData={!hasData} />
            )}
            <KpiChip
              label={isLeadGen ? "CPL" : "CPA"}
              value={current.purchases > 0 ? fmtCurrency(current.cpc) : "–"}
              current={current.cpc} prev={prev.cpc}
              inverse noData={!hasData}
            />
            {!isLeadGen && (
              <KpiChip
                label="ROAS"
                value={current.spend > 0 ? `${fmt(current.roas, 2)}x` : "–"}
                current={current.roas} prev={prev.roas}
                noData={!hasData}
                tooltip="Revenue plataforma / Spend. Validar contra GA4."
              />
            )}
          </div>
        </div>

        {/* Row 3: Eficiencia */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Eficiencia</p>
          <div className="grid grid-cols-4 gap-x-3 gap-y-3">
            <KpiChip
              label="CTR Link"
              value={fmtPercent(current.ctr)}
              current={current.ctr} prev={prev.ctr}
              noData={!hasData}
              tooltip="Clics en link / Impresiones."
            />
            <KpiChip
              label="CPC Link"
              value={current.clicks > 0 ? fmtCurrency(current.cpc) : "–"}
              current={current.cpc} prev={prev.cpc}
              inverse noData={!hasData}
            />
            <KpiChip
              label="Hook Rate"
              value={current.impressions > 0 ? fmtPercent(current.hookRate) : "–"}
              current={current.hookRate} prev={prev.hookRate}
              noData={!hasData}
              tooltip="% de impresiones con ≥ 3 segundos de visualización. Mide el gancho creativo."
            />
            <KpiChip
              label="L.P. Views"
              value={fmtCompact(current.landingPageViews)}
              current={current.landingPageViews} prev={prev.landingPageViews}
              noData={!hasData}
              tooltip="Visitas confirmadas a la página de destino."
            />
          </div>
          <div className="grid grid-cols-4 gap-x-3 gap-y-3 mt-3">
            <KpiChip
              label="% Visita"
              value={current.clicks > 0 ? fmtPercent(current.visitRate) : "–"}
              current={current.visitRate} prev={prev.visitRate}
              noData={!hasData}
              tooltip="Landing Page Views / Clicks. Indica la tasa de carga real de la página."
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Google Panel ──────────────────────────────────────────────────────────────

function GooglePanel({ current, prev }: { current: GoogleMetrics; prev: GoogleMetrics }) {
  const hasData = current.spend > 0;
  const convBreakdown = Object.entries(current.conversionsBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  return (
    <Card className="border-l-4 border-l-success">
      <CardContent className="p-4">
        <PlatformHeader
          color="bg-success"
          label="Google Ads"
          sub={hasData ? `${fmtCurrency(current.spend)} invertidos` : undefined}
        />

        {/* KPI grid */}
        <div className="grid grid-cols-3 gap-x-3 gap-y-3 mb-4">
          <KpiChip label="Inversión" value={fmtCurrency(current.spend)} current={current.spend} prev={prev.spend} noData={!hasData} />
          <KpiChip label="Impresiones" value={fmtCompact(current.impressions)} current={current.impressions} prev={prev.impressions} noData={!hasData} />
          <KpiChip label="Clicks" value={fmtCompact(current.clicks)} current={current.clicks} prev={prev.clicks} noData={!hasData} />
          <KpiChip
            label="CTR"
            value={fmtPercent(current.ctr)}
            current={current.ctr} prev={prev.ctr}
            noData={!hasData}
          />
          <KpiChip
            label="CPC"
            value={current.clicks > 0 ? fmtCurrency(current.cpc) : "–"}
            current={current.cpc} prev={prev.cpc}
            inverse noData={!hasData}
          />
          <KpiChip
            label="Conversiones"
            value={fmt(current.conversions)}
            current={current.conversions} prev={prev.conversions}
            noData={!hasData}
          />
        </div>

        {/* Conversion breakdown */}
        {convBreakdown.length > 0 ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">Desglose Conversiones</p>
            <div className="space-y-1">
              {convBreakdown.map(([name, val]) => (
                <div key={name} className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground truncate max-w-[60%]">{name}</p>
                  <span className="text-[10px] font-semibold tabular-nums">{fmt(val)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/50 text-center py-2">Sin desglose de conversiones</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Trend Chart ───────────────────────────────────────────────────────────────

function TrendChart({ daily }: { daily: ScorecardDaily[] }) {
  if (daily.length < 2) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-wide">Revenue vs Spend · Evolución</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={140}>
          <ComposedChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis dataKey="date" tickFormatter={fmtAxisDate} tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${fmtCompact(v)}`} width={50} />
            <ReTooltip
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
              formatter={(v: number, name: string) => [fmtCurrency(v), name === "spend" ? "Spend" : "Revenue"]}
              labelFormatter={(l) => fmtAxisDate(l as string)}
            />
            <Bar dataKey="spend" fill="hsl(var(--primary)/0.5)" name="spend" radius={[2, 2, 0, 0]} />
            <Line type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="revenue" />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const Home = () => {
  const { segments, loading: wsLoading, currentWorkspace } = useWorkspace();
  const { clients, selectedClient } = useClient();
  const { data: scorecard, isLoading } = useScorecard();
  const prevTotals = scorecard?.prevTotals;
  const { data: platform, isLoading: platformLoading } = usePlatformMetrics();
  const { data: health } = useWorkspaceHealth();
  const { firstName } = useProfile();
  const { entries: changelog, loading: changelogLoading } = useRecentChangelog(5);
  const navigate = useNavigate();

  const loading = wsLoading || isLoading;
  const totals = scorecard?.totals;
  const cards = scorecard?.cards ?? [];
  const daily = scorecard?.daily ?? [];

  const isLeadGen = selectedClient?.client_type === "lead_gen";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
            {currentWorkspace && (
              <span className="ml-2 text-muted-foreground/70">· {currentWorkspace.name}</span>
            )}
          </p>
        </div>
        <StatCard
          icon={Users}
          label="Clientes Activos"
          value={String(clients.length)}
          status="primary"
          className="min-w-[140px]"
        />
        {selectedClient && (
          <button
            onClick={() => navigate("/clients")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all group"
          >
            <Sparkles className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-wide text-primary">AI Analyst</p>
              <p className="text-[9px] text-muted-foreground">Analizar {selectedClient.name}</p>
            </div>
          </button>
        )}
      </div>

      {/* Status Strip */}
      {health && <StatusStrip health={health} />}

      {/* Loading skeletons */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
          <Skeleton className="h-40 rounded-lg" />
        </div>
      ) : segments.length === 0 ? (
        <EmptyState
          title="Sin datos de Segments"
          description="Conectá integraciones y creá Segments para visualizar el Scorecard."
        />
      ) : (
        <>
          {/* ── SECCIÓN 1: RESULTADOS DEL NEGOCIO ───────────────────────── */}
          {totals && (
            <section className="space-y-4">
              <SectionHeader badge="MTD" title="Resultados del Negocio" subtitle="Vista global de performance y rentabilidad" />

              {/* Hero KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="relative">
                  <StatCard icon={DollarSign} label="Revenue GA4" value={fmtCurrency(totals.revenueGa4)} status="success" hero />
                  {prevTotals && <div className="absolute bottom-3 right-3"><DeltaBadge current={totals.revenueGa4} prev={prevTotals.revenueGa4} /></div>}
                </div>
                <div className="relative">
                  <StatCard icon={DollarSign} label="Spend MTD" value={fmtCurrency(totals.totalSpend)} status="primary" hero />
                  {prevTotals && <div className="absolute bottom-3 right-3"><DeltaBadge current={totals.totalSpend} prev={prevTotals.totalSpend} inverse /></div>}
                </div>
                <div className="relative">
                  <StatCard
                    icon={TrendingUp}
                    label="ROAS GA4"
                    value={`${fmt(totals.roasGa4, 2)}x`}
                    tooltip="Revenue GA4 / Spend total."
                    status={totals.roasGa4 < 1 ? "warning" : "success"}
                    hero
                  />
                  {prevTotals && <div className="absolute bottom-3 right-3"><DeltaBadge current={totals.roasGa4} prev={prevTotals.roasGa4} /></div>}
                </div>
                <div className="relative">
                  <StatCard
                    icon={Percent}
                    label="Contribution"
                    value={fmtCurrency(totals.contributionMargin)}
                    subtitle={`Margin ${fmt(totals.marginPercent, 1)}%`}
                    status={totals.contributionMargin < 0 ? "destructive" : "success"}
                    hero
                  />
                  {prevTotals && <div className="absolute bottom-3 right-3"><DeltaBadge current={totals.contributionMargin} prev={prevTotals.contributionMargin} /></div>}
                </div>
              </div>

              {/* Secondary KPIs */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Blended ROAS</p>
                    <p className={cn("text-sm font-bold", roasColor(totals.blendedRoas))}>{fmt(totals.blendedRoas, 2)}x</p>
                    {prevTotals && <div className="mt-0.5"><DeltaBadge current={totals.blendedRoas} prev={prevTotals.blendedRoas} /></div>}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">ROAS Meta</p>
                    <p className={cn("text-sm font-bold", roasColor(totals.roasMeta))}>{fmt(totals.roasMeta, 2)}x</p>
                    {prevTotals && <div className="mt-0.5"><DeltaBadge current={totals.roasMeta} prev={prevTotals.roasMeta} /></div>}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">ROAS Google</p>
                    <p className={cn("text-sm font-bold", roasColor(totals.roasGoogle))}>{fmt(totals.roasGoogle, 2)}x</p>
                    {prevTotals && <div className="mt-0.5"><DeltaBadge current={totals.roasGoogle} prev={prevTotals.roasGoogle} /></div>}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Impressions</p>
                    <p className="text-sm font-bold">{fmtCompact(totals.totalImpressions)}</p>
                    {prevTotals && <div className="mt-0.5"><DeltaBadge current={totals.totalImpressions} prev={prevTotals.totalImpressions} /></div>}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">CTR</p>
                    <p className="text-sm font-bold">{fmt(totals.ctr, 2)}%</p>
                    {prevTotals && <div className="mt-0.5"><DeltaBadge current={totals.ctr} prev={prevTotals.ctr} /></div>}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Purchases</p>
                    <p className="text-sm font-bold">{fmt(totals.totalPurchases)}</p>
                    {prevTotals && <div className="mt-0.5"><DeltaBadge current={totals.totalPurchases} prev={prevTotals.totalPurchases} /></div>}
                  </CardContent>
                </Card>
              </div>

              {/* Trend chart */}
              <TrendChart daily={daily} />

              {/* Segments + Changelog */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pt-2">
                <div className="xl:col-span-2">
                  <SectionHeader badge="Segments" title="Detalle por Segment" subtitle={`${cards.length} segmento(s) activo(s)`} />
                  <div className="grid gap-4 md:grid-cols-2 mt-4">
                    {cards.map((card) => (
                      <SegmentCard key={card.segmentId} card={card} workspaceCurrency={currentWorkspace?.currency ?? "USD"} />
                    ))}
                  </div>
                </div>
                <div>
                  <SectionHeader badge="Bitácora" title="Últimos Cambios" subtitle="Actividad reciente" />
                  <div className="mt-4 space-y-2">
                    {changelogLoading ? (
                      Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
                    ) : changelog.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center">
                          <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">Sin cambios registrados aún.</p>
                        </CardContent>
                      </Card>
                    ) : (
                      changelog.map((entry) => <ChangelogItem key={entry.id} entry={entry} />)
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── SECCIÓN 2: PANEL CONSOLIDADO ────────────────────────────── */}
          <section className="space-y-4">
            <SectionHeader
              badge="Consolidado"
              title="Panel de Plataformas"
              subtitle="GA4 · Meta Ads · Google Ads"
            />

            {platformLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-lg" />)}
              </div>
            ) : platform ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GA4Panel current={platform.ga4.current} prev={platform.ga4.prev} />
                <MetaPanel current={platform.meta.current} prev={platform.meta.prev} isLeadGen={isLeadGen} />
                <GooglePanel current={platform.google.current} prev={platform.google.prev} />
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
};

// ── Changelog Feed Item ───────────────────────────────────────────────────────

function ChangelogItem({ entry }: { entry: any }) {
  const icon = changeTypeIcons[entry.change_type] || changeTypeIcons.other;
  const platform = entry.platform ? platformBadge[entry.platform] : null;
  return (
    <Card className="shadow-sm hover:bg-muted/30 transition-colors">
      <CardContent className="p-3 flex items-start gap-3">
        <span className="text-base mt-0.5">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{entry.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {platform && (
              <Badge variant="secondary" className={cn("text-[9px] border-0 px-1.5 py-0", platform.className)}>
                {platform.label}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">{entry.profile_name}</span>
            <span className="text-[10px] text-muted-foreground/60">
              {formatDistanceToNow(new Date(entry.created_at), { locale: es, addSuffix: true })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Segment Card ──────────────────────────────────────────────────────────────

function SegmentCard({ card, workspaceCurrency }: { card: SegmentScorecard; workspaceCurrency: string }) {
  const currencyMismatch = card.currency !== workspaceCurrency;
  const pacing = pacingConfig[card.pacingStatus];
  const PacingIcon = pacing.icon;
  const borderStatus =
    card.pacingStatus === "on_track" ? "border-l-success" :
    card.pacingStatus === "overpacing" ? "border-l-destructive" : "border-l-warning";

  return (
    <Card className={cn("shadow-sm border-l-4", borderStatus)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wide">{card.segmentName}</CardTitle>
          <div className="flex items-center gap-1.5">
            {currencyMismatch && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">
                    ⚠ {card.currency}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Moneda del segmento ({card.currency}) distinta a la del workspace ({workspaceCurrency}).
                </TooltipContent>
              </Tooltip>
            )}
            <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-wide gap-1 border-0", pacing.className)}>
              <PacingIcon className="h-3 w-3" />
              {pacing.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-2xl font-bold tracking-tight">{fmtCurrency(card.totalSpend, card.currency)}</span>
            {card.monthlyBudget > 0 && (
              <span className="text-xs text-muted-foreground font-medium">
                / {fmtCurrency(card.monthlyBudget, card.currency)}
              </span>
            )}
          </div>
          {card.monthlyBudget > 0 && (
            <Progress value={Math.min(card.budgetUsedPercent, 100)} className="h-1.5" />
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">ROAS</p>
            <p className={cn("text-sm font-bold", roasColor(card.roas))}>{fmt(card.roas, 2)}x</p>
          </div>
          <MetricCell label="EOM Proj." value={fmtCurrency(card.projectedEom, card.currency)} />
          <MetricCell label="Daily Avg" value={fmtCurrency(card.dailyAvgSpend, card.currency)} />
          <MetricCell label="CTR" value={`${fmt(card.ctr, 2)}%`} />
          <MetricCell label="CPC" value={fmtCurrency(card.cpc, card.currency)} />
          <MetricCell label="Purchases" value={fmt(card.purchases)} />
        </div>
        {card.totalSpend > 0 && (
          <div className="flex gap-2 pt-1">
            {card.spendMeta > 0 && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-info/10 text-info border-0">
                Meta {fmt((card.spendMeta / card.totalSpend) * 100, 0)}%
              </Badge>
            )}
            {card.spendGoogle > 0 && (
              <Badge variant="secondary" className="text-[10px] font-medium bg-success/10 text-success border-0">
                Google {fmt((card.spendGoogle / card.totalSpend) * 100, 0)}%
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

export default Home;
