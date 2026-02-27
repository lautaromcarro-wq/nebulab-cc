import { useScorecard, type SegmentScorecard } from "@/hooks/useScorecard";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceHealth } from "@/hooks/useWorkspaceHealth";
import { useProfile } from "@/hooks/useProfile";
import { useRecentChangelog } from "@/hooks/useRecentChangelog";
import { useClient } from "@/contexts/ClientContext";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DollarSign,
  TrendingUp,
  MousePointerClick,
  ShoppingCart,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Percent,
  Clock,
  FileText,
  Users,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SectionHeader from "@/components/SectionHeader";
import StatusStrip from "@/components/StatusStrip";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { fmt, fmtCurrency, fmtCompact } from "@/components/formatters";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const pacingConfig = {
  overpacing: { label: "Overpacing", icon: ArrowUpRight, className: "bg-destructive/10 text-destructive border-destructive/20" },
  on_track: { label: "On Track", icon: Minus, className: "bg-success/10 text-success border-success/20" },
  underpacing: { label: "Underpacing", icon: ArrowDownRight, className: "bg-warning/10 text-warning border-warning/20" },
};

const changeTypeIcons: Record<string, string> = {
  strategic: "🧠",
  budget: "💰",
  creative: "🎨",
  targeting: "🎯",
  bid: "📊",
  landing: "🔗",
  copy: "✏️",
  new_adset: "➕",
  other: "📝",
};

const platformBadge: Record<string, { label: string; className: string }> = {
  meta: { label: "Meta", className: "bg-info/10 text-info" },
  google_ads: { label: "Google Ads", className: "bg-success/10 text-success" },
  ga4: { label: "GA4", className: "bg-warning/10 text-warning" },
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

const Home = () => {
  const { segments, loading: wsLoading, currentWorkspace } = useWorkspace();
  const { clients } = useClient();
  const { data, isLoading } = useScorecard();
  const { data: health } = useWorkspaceHealth();
  const { firstName } = useProfile();
  const { entries: changelog, loading: changelogLoading } = useRecentChangelog(5);

  const loading = wsLoading || isLoading;
  const totals = data?.totals;
  const cards = data?.cards ?? [];

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
        <div className="flex items-center gap-3">
          <StatCard
            icon={Users}
            label="Clientes Activos"
            value={String(clients.length)}
            status="primary"
            className="min-w-[140px]"
          />
        </div>
      </div>

      {/* Status Strip */}
      {health && <StatusStrip health={health} />}

      {/* Loading */}
      {loading ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </>
      ) : segments.length === 0 ? (
        <EmptyState
          title="Sin datos de Segments"
          description="Conectá integraciones y creá Segments para visualizar el Scorecard."
        />
      ) : (
        <>
          {/* Hero KPIs */}
          {totals && (
            <>
              <div>
                <SectionHeader badge="MTD" title="Scorecard" subtitle="Vista global de performance y pacing" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                  <StatCard
                    icon={DollarSign}
                    label="Spend MTD"
                    value={fmtCurrency(totals.totalSpend)}
                    status="primary"
                    hero
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="ROAS GA4"
                    value={`${fmt(totals.roasGa4, 2)}x`}
                    tooltip="Revenue GA4 / Spend total. No blended."
                    status={totals.roasGa4 < 1 ? "warning" : "success"}
                    hero
                  />
                  <StatCard
                    icon={DollarSign}
                    label="Contribution MTD"
                    value={fmtCurrency(totals.contributionMargin)}
                    subtitle={`Margin ${fmt(totals.marginPercent, 1)}%`}
                    status={totals.contributionMargin < 0 ? "destructive" : "success"}
                    hero
                  />
                </div>
              </div>

              {/* Secondary KPIs */}
              <div>
                <SectionHeader title="Métricas Secundarias" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
                  <StatCard icon={DollarSign} label="Revenue GA4" value={fmtCurrency(totals.revenueGa4)} status="neutral" />
                  <StatCard icon={TrendingUp} label="Blended ROAS" value={`${fmt(totals.blendedRoas, 2)}x`} subtitle="Estimación" status="neutral" tooltip="Promedio ponderado plataforma + GA4 (alpha 0.5)" />
                  <StatCard icon={Percent} label="Margin %" value={`${fmt(totals.marginPercent, 1)}%`} status="neutral" />
                  <StatCard icon={Eye} label="Impressions" value={fmtCompact(totals.totalImpressions)} status="neutral" />
                  <StatCard icon={MousePointerClick} label="CTR" value={`${fmt(totals.ctr, 2)}%`} status="neutral" />
                  <StatCard icon={ShoppingCart} label="Purchases" value={fmt(totals.totalPurchases)} status="neutral" />
                </div>
              </div>
            </>
          )}

          {/* Two-column layout: Segments + Changelog */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Segment Cards */}
            <div className="xl:col-span-2">
              <SectionHeader badge="Segments" title="Detalle por Segment" subtitle={`${cards.length} segmento(s) activo(s)`} />
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                {cards.map((card) => (
                  <SegmentCard key={card.segmentId} card={card} workspaceCurrency={currentWorkspace?.currency ?? "USD"} />
                ))}
              </div>
            </div>

            {/* Recent Changelog Feed */}
            <div>
              <SectionHeader
                badge="Bitácora"
                title="Últimos Cambios"
                subtitle="Actividad reciente"
              />
              <div className="mt-4 space-y-2">
                {changelogLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))
                ) : changelog.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">
                        Sin cambios registrados aún.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  changelog.map((entry) => (
                    <ChangelogItem key={entry.id} entry={entry} />
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ── Changelog Feed Item ──
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
            <span className="text-[10px] text-muted-foreground">
              {entry.profile_name}
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              {formatDistanceToNow(new Date(entry.created_at), { locale: es, addSuffix: true })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Segment Card (unchanged logic) ──
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
          <MetricCell label="ROAS" value={`${fmt(card.roas, 2)}x`} />
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
