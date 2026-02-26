import { useScorecard, type SegmentScorecard } from "@/hooks/useScorecard";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

const pacingConfig = {
  overpacing: { label: "Overpacing", variant: "destructive" as const, icon: ArrowUpRight, className: "bg-destructive/10 text-destructive border-destructive/20" },
  on_track: { label: "On Track", variant: "default" as const, icon: Minus, className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  underpacing: { label: "Underpacing", variant: "secondary" as const, icon: ArrowDownRight, className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
};

const Home = () => {
  const { segments, loading: wsLoading, currentWorkspace } = useWorkspace();
  const { data, isLoading } = useScorecard();

  const loading = wsLoading || isLoading;
  const totals = data?.totals;
  const cards = data?.cards ?? [];

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Scorecard</h1>
        <p className="text-muted-foreground text-sm mb-6">Vista global de performance y pacing por Segment.</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Scorecard</h1>
        <p className="text-muted-foreground text-sm">Vista global de performance y pacing por Segment.</p>
        <div className="mt-8 rounded-lg border border-dashed p-12 text-center text-muted-foreground text-sm">
          Scorecard en construcción — conectá integraciones y creá Segments para ver datos.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Scorecard</h1>
      <p className="text-muted-foreground text-sm mb-6">Vista global de performance y pacing por Segment.</p>

      {/* Summary KPIs */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
          <KpiCard icon={DollarSign} label="Spend MTD" value={fmtCurrency(totals.totalSpend)} />
          <KpiCard icon={DollarSign} label="Revenue GA4" value={fmtCurrency(totals.revenueGa4)} />
          <KpiCard icon={TrendingUp} label="ROAS GA4" value={`${fmt(totals.roasGa4, 2)}x`} />
          <KpiCard icon={TrendingUp} label="Blended ROAS" value={`${fmt(totals.blendedRoas, 2)}x`} subtitle="Estimación" />
          <KpiCard icon={Eye} label="Impressions" value={fmt(totals.totalImpressions)} />
          <KpiCard icon={MousePointerClick} label="CTR" value={`${fmt(totals.ctr, 2)}%`} />
          <KpiCard icon={ShoppingCart} label="Purchases" value={fmt(totals.totalPurchases)} />
        </div>
      )}

      {/* Segment cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <SegmentCard key={card.segmentId} card={card} workspaceCurrency={currentWorkspace?.currency ?? "USD"} />
        ))}
      </div>
    </div>
  );
};

function KpiCard({ icon: Icon, label, value, subtitle }: { icon: React.ElementType; label: string; value: string; subtitle?: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-semibold tracking-tight leading-tight">{value}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function SegmentCard({ card, workspaceCurrency }: { card: SegmentScorecard; workspaceCurrency: string }) {
  const currencyMismatch = card.currency !== workspaceCurrency;
  const pacing = pacingConfig[card.pacingStatus];
  const PacingIcon = pacing.icon;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">{card.segmentName}</CardTitle>
          <div className="flex items-center gap-1.5">
            {currencyMismatch && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20">
                    ⚠ {card.currency}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Moneda del segmento ({card.currency}) distinta a la del workspace ({workspaceCurrency}). No se convierte automáticamente.
                </TooltipContent>
              </Tooltip>
            )}
            <Badge variant="outline" className={cn("text-[10px] font-medium gap-1", pacing.className)}>
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
            <span className="text-xl font-bold tracking-tight">{fmtCurrency(card.totalSpend, card.currency)}</span>
            {card.monthlyBudget > 0 && (
              <span className="text-xs text-muted-foreground">
                / {fmtCurrency(card.monthlyBudget, card.currency)}
              </span>
            )}
          </div>
          {card.monthlyBudget > 0 && (
            <Progress
              value={Math.min(card.budgetUsedPercent, 100)}
              className="h-1.5"
            />
          )}
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          <MetricCell label="ROAS" value={`${fmt(card.roas, 2)}x`} />
          <MetricCell label="EOM proj." value={fmtCurrency(card.projectedEom, card.currency)} />
          <MetricCell label="Daily avg" value={fmtCurrency(card.dailyAvgSpend, card.currency)} />
          <MetricCell label="CTR" value={`${fmt(card.ctr, 2)}%`} />
          <MetricCell label="CPC" value={fmtCurrency(card.cpc, card.currency)} />
          <MetricCell label="Purchases" value={fmt(card.purchases)} />
        </div>

        {/* Platform split */}
        {card.totalSpend > 0 && (
          <div className="flex gap-2 pt-1">
            {card.spendMeta > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 font-medium">
                Meta {fmt((card.spendMeta / card.totalSpend) * 100, 0)}%
              </span>
            )}
            {card.spendGoogle > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 font-medium">
                Google {fmt((card.spendGoogle / card.totalSpend) * 100, 0)}%
              </span>
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
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

export default Home;
