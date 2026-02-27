import { useScorecard, type SegmentScorecard } from "@/hooks/useScorecard";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceHealth } from "@/hooks/useWorkspaceHealth";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import SectionHeader from "@/components/SectionHeader";
import StatusStrip from "@/components/StatusStrip";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { fmt, fmtCurrency, fmtCompact } from "@/components/formatters";

const pacingConfig = {
  overpacing: { label: "Overpacing", icon: ArrowUpRight, className: "bg-destructive/10 text-destructive border-destructive/20" },
  on_track: { label: "On Track", icon: Minus, className: "bg-success/10 text-success border-success/20" },
  underpacing: { label: "Underpacing", icon: ArrowDownRight, className: "bg-warning/10 text-warning border-warning/20" },
};

const Home = () => {
  const { segments, loading: wsLoading, currentWorkspace } = useWorkspace();
  const { data, isLoading } = useScorecard();
  const { data: health } = useWorkspaceHealth();

  const loading = wsLoading || isLoading;
  const totals = data?.totals;
  const cards = data?.cards ?? [];

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <SectionHeader badge="Dashboard" title="Scorecard" subtitle="Vista global de performance y pacing" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="space-y-8 animate-fade-in">
        <SectionHeader badge="Dashboard" title="Scorecard" subtitle="Vista global de performance y pacing" />
        <EmptyState
          title="Sin datos de Segments"
          description="Conectá integraciones y creá Segments para visualizar el Scorecard."
        />
      </div>
    );
  }

  // Determine status for hero KPIs
  const marginStatus = totals && totals.contributionMargin < 0 ? "destructive" : "success";
  const roasStatus = totals && totals.roasGa4 < 1 ? "warning" : "success";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <SectionHeader badge="Dashboard" title="Scorecard" subtitle="Vista global de performance y pacing por Segment" />

      {/* Status Strip */}
      {health && <StatusStrip health={health} />}

      {/* Hero KPIs */}
      {totals && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              status={roasStatus}
              hero
            />
            <StatCard
              icon={DollarSign}
              label="Contribution MTD"
              value={fmtCurrency(totals.contributionMargin)}
              subtitle={`Margin ${fmt(totals.marginPercent, 1)}%`}
              status={marginStatus as any}
              hero
            />
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

      {/* Segment Cards */}
      <div>
        <SectionHeader badge="Segments" title="Detalle por Segment" subtitle={`${cards.length} segmento(s) activo(s)`} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mt-4">
          {cards.map((card) => (
            <SegmentCard key={card.segmentId} card={card} workspaceCurrency={currentWorkspace?.currency ?? "USD"} />
          ))}
        </div>
      </div>
    </div>
  );
};

function SegmentCard({ card, workspaceCurrency }: { card: SegmentScorecard; workspaceCurrency: string }) {
  const currencyMismatch = card.currency !== workspaceCurrency;
  const pacing = pacingConfig[card.pacingStatus];
  const PacingIcon = pacing.icon;

  // Determine segment health via pacing
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
        {/* Spend + Budget bar */}
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

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          <MetricCell label="ROAS" value={`${fmt(card.roas, 2)}x`} />
          <MetricCell label="EOM Proj." value={fmtCurrency(card.projectedEom, card.currency)} />
          <MetricCell label="Daily Avg" value={fmtCurrency(card.dailyAvgSpend, card.currency)} />
          <MetricCell label="CTR" value={`${fmt(card.ctr, 2)}%`} />
          <MetricCell label="CPC" value={fmtCurrency(card.cpc, card.currency)} />
          <MetricCell label="Purchases" value={fmt(card.purchases)} />
        </div>

        {/* Platform split */}
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
