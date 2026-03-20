import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { startOfMonth, endOfMonth, getDaysInMonth, getDate, format, eachDayOfInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import SectionHeader from "@/components/SectionHeader";
import { cn } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Minus, DollarSign,
  CalendarDays, Flame, Target, AlertTriangle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip as ReTooltip, ReferenceLine } from "recharts";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtCur = (n: number, cur = "ARS") =>
  new Intl.NumberFormat("es-AR", {
    style: "currency", currency: cur,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);

const fmtCompact = (n: number, cur = "ARS") => {
  if (n >= 1_000_000) return `${fmtCur(n / 1_000_000, cur).replace(/[.,]\d+/, "")}M`;
  if (n >= 1_000) return `${fmtCur(n / 1_000, cur).replace(/[.,]\d+/, "")}K`;
  return fmtCur(n, cur);
};

// ── Types ─────────────────────────────────────────────────────────────────────

type PacingStatus = "overpacing" | "on_track" | "underpacing" | "no_data";

interface DailyPoint { date: string; spend: number; expected: number }

interface SegmentBudget {
  id: string;
  name: string;
  clientName: string;
  budget: number;
  currency: string;
  spendMTD: number;
  dailyBurnRate: number;
  projectedMonthly: number;
  percentConsumed: number;
  daysRemainingAtRate: number;
  pacing: PacingStatus;
  dailyPoints: DailyPoint[];
}

const pacingConfig: Record<PacingStatus, {
  label: string; color: string; icon: typeof TrendingUp; barColor: string; borderColor: string;
}> = {
  overpacing:  { label: "Overpacing",  color: "text-destructive",      icon: TrendingUp,   barColor: "bg-destructive", borderColor: "border-destructive/40" },
  on_track:    { label: "On Track",    color: "text-success",          icon: Minus,        barColor: "bg-success",     borderColor: "" },
  underpacing: { label: "Underpacing", color: "text-warning",          icon: TrendingDown, barColor: "bg-warning",     borderColor: "border-warning/30" },
  no_data:     { label: "Sin datos",   color: "text-muted-foreground", icon: Minus,        barColor: "bg-muted",       borderColor: "" },
};

// ── Sparkline chart ───────────────────────────────────────────────────────────

function SpendSparkline({ points, currency }: { points: DailyPoint[]; currency: string }) {
  if (points.length < 2) return null;
  const maxSpend = Math.max(...points.map((p) => p.spend), 1);
  return (
    <div>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Spend diario este mes</p>
      <ResponsiveContainer width="100%" height={48}>
        <BarChart data={points} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap="10%">
          <Bar
            dataKey="spend"
            radius={[1, 1, 0, 0]}
            fill="hsl(var(--primary)/0.6)"
            maxBarSize={12}
          />
          <ReferenceLine
            y={points[0]?.expected ?? 0}
            stroke="hsl(var(--muted-foreground)/0.4)"
            strokeDasharray="3 3"
          />
          <ReTooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-popover border rounded px-2 py-1 text-[10px] shadow">
                  <p className="text-muted-foreground">{label}</p>
                  <p className="font-semibold">{fmtCur(payload[0].value as number, currency)}</p>
                </div>
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Budget Card ───────────────────────────────────────────────────────────────

function BudgetCard({ seg, daysElapsed, daysInMonth }: {
  seg: SegmentBudget; daysElapsed: number; daysInMonth: number;
}) {
  const pacing = pacingConfig[seg.pacing];
  const PacingIcon = pacing.icon;
  const pct = Math.min(seg.percentConsumed, 100);
  const expectedPct = (daysElapsed / daysInMonth) * 100;

  return (
    <Card className={cn("relative overflow-hidden", pacing.borderColor && `border ${pacing.borderColor}`)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-bold truncate">{seg.name}</CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">{seg.clientName}</p>
          </div>
          <Badge
            variant="outline"
            className={cn("text-[9px] shrink-0 flex items-center gap-1 font-semibold border-current/30", pacing.color)}
          >
            <PacingIcon className="h-2.5 w-2.5" />
            {pacing.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Spend vs Budget */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Spend MTD</p>
            <p className="text-xl font-bold tabular-nums">{fmtCur(seg.spendMTD, seg.currency)}</p>
          </div>
          {seg.budget > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget</p>
              <p className="text-sm font-semibold tabular-nums text-muted-foreground">
                {fmtCur(seg.budget, seg.currency)}
              </p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {seg.budget > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{pct.toFixed(1)}% consumido</span>
              <span>Día {daysElapsed}/{daysInMonth}</span>
            </div>
            <div className="relative w-full h-2.5 bg-muted rounded-full overflow-hidden">
              {/* Expected spend marker */}
              <div
                className="absolute top-0 h-full w-0.5 bg-foreground/25 z-10"
                style={{ left: `${Math.min(expectedPct, 99)}%` }}
              />
              {/* Actual spend */}
              <div
                className={cn("h-full rounded-full transition-all", pacing.barColor)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[9px] text-muted-foreground/60">
              Línea vertical = ritmo esperado para hoy ({expectedPct.toFixed(0)}%)
            </p>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-muted/40 rounded-md p-2.5 cursor-help">
                <div className="flex items-center gap-1 mb-1">
                  <Flame className="h-3 w-3 text-orange-500" />
                  <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Burn diario</span>
                </div>
                <p className="text-sm font-bold tabular-nums">{fmtCur(seg.dailyBurnRate, seg.currency)}</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Promedio diario de los {daysElapsed} días transcurridos
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-muted/40 rounded-md p-2.5 cursor-help">
                <div className="flex items-center gap-1 mb-1">
                  <Target className="h-3 w-3 text-primary" />
                  <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Proyección</span>
                </div>
                <p className={cn(
                  "text-sm font-bold tabular-nums",
                  seg.budget > 0
                    ? seg.projectedMonthly > seg.budget * 1.1
                      ? "text-destructive"
                      : seg.projectedMonthly < seg.budget * 0.9
                      ? "text-warning"
                      : "text-success"
                    : "",
                )}>
                  {fmtCur(seg.projectedMonthly, seg.currency)}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Proyección al cierre del mes al ritmo actual
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("bg-muted/40 rounded-md p-2.5 cursor-help", seg.daysRemainingAtRate < 0 && "bg-destructive/10")}>
                <div className="flex items-center gap-1 mb-1">
                  <CalendarDays className="h-3 w-3 text-blue-500" />
                  <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Días restantes</span>
                </div>
                <p className={cn(
                  "text-sm font-bold tabular-nums",
                  seg.daysRemainingAtRate < 0 ? "text-destructive" : seg.daysRemainingAtRate < 5 ? "text-warning" : "",
                )}>
                  {seg.budget === 0 ? "–"
                    : seg.daysRemainingAtRate <= 0 ? "Agotado"
                    : seg.dailyBurnRate === 0 ? "–"
                    : `${Math.floor(seg.daysRemainingAtRate)} días`}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Días que dura el presupuesto restante al burn rate actual
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-muted/40 rounded-md p-2.5 cursor-help">
                <div className="flex items-center gap-1 mb-1">
                  <DollarSign className="h-3 w-3 text-green-500" />
                  <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Restante</span>
                </div>
                <p className={cn("text-sm font-bold tabular-nums", seg.budget > 0 && seg.budget - seg.spendMTD < 0 ? "text-destructive" : "")}>
                  {seg.budget > 0
                    ? fmtCur(Math.max(0, seg.budget - seg.spendMTD), seg.currency)
                    : "–"}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Budget disponible para el resto del mes
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Sparkline */}
        <SpendSparkline points={seg.dailyPoints} currency={seg.currency} />

        {/* Alert: budget exceeded */}
        {seg.budget > 0 && seg.spendMTD > seg.budget && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive font-medium">
              Excedido por {fmtCur(seg.spendMTD - seg.budget, seg.currency)} ({((seg.spendMTD / seg.budget - 1) * 100).toFixed(1)}%)
            </p>
          </div>
        )}

        {/* Alert: budget running low */}
        {seg.budget > 0 && seg.daysRemainingAtRate > 0 && seg.daysRemainingAtRate < 5 && seg.spendMTD <= seg.budget && (
          <div className="flex items-center gap-2 rounded-md bg-warning/10 border border-warning/20 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
            <p className="text-xs text-warning font-medium">
              Budget se agota en ~{Math.floor(seg.daysRemainingAtRate)} días al ritmo actual
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Summary Bar ───────────────────────────────────────────────────────────────

function SummaryBar({ segs, daysElapsed, daysInMonth }: {
  segs: SegmentBudget[]; daysElapsed: number; daysInMonth: number;
}) {
  const withBudget = segs.filter((s) => s.budget > 0);
  if (withBudget.length === 0) return null;

  const totalBudget = withBudget.reduce((s, seg) => s + seg.budget, 0);
  const totalSpend = withBudget.reduce((s, seg) => s + seg.spendMTD, 0);
  const totalProjected = withBudget.reduce((s, seg) => s + seg.projectedMonthly, 0);
  const totalBurn = withBudget.reduce((s, seg) => s + seg.dailyBurnRate, 0);
  const over = segs.filter((s) => s.pacing === "overpacing").length;
  const under = segs.filter((s) => s.pacing === "underpacing").length;
  // Use first segment's currency for totals (assumes same currency across workspace)
  const cur = withBudget[0]?.currency ?? "ARS";

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Card>
        <CardContent className="py-3 px-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Budget total</p>
          <p className="text-lg font-bold tabular-nums">{fmtCompact(totalBudget, cur)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{withBudget.length} segmento(s)</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 px-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Spend MTD</p>
          <p className="text-lg font-bold tabular-nums">{fmtCompact(totalSpend, cur)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {totalBudget > 0 ? `${((totalSpend / totalBudget) * 100).toFixed(1)}% consumido` : "–"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 px-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Burn diario total</p>
          <p className="text-lg font-bold tabular-nums">{fmtCompact(totalBurn, cur)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">últimos {daysElapsed} días</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 px-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Proyección EOM</p>
          <p className={cn(
            "text-lg font-bold tabular-nums",
            totalProjected > totalBudget * 1.05 ? "text-destructive"
            : totalProjected < totalBudget * 0.9 ? "text-warning" : "text-success",
          )}>
            {fmtCompact(totalProjected, cur)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {totalBudget > 0 ? `${((totalProjected / totalBudget) * 100).toFixed(0)}% del budget` : "–"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 px-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Pacing global</p>
          <div className="flex gap-2 mt-1">
            {over > 0 && (
              <span className="text-xs font-bold text-destructive flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />{over} over
              </span>
            )}
            {under > 0 && (
              <span className="text-xs font-bold text-warning flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />{under} under
              </span>
            )}
            {over === 0 && under === 0 && (
              <span className="text-xs font-bold text-success flex items-center gap-1">
                <Minus className="h-3 w-3" />Todo on track
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Día {daysElapsed} de {daysInMonth}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BudgetTracker() {
  const { currentWorkspace } = useWorkspace();
  const { clients, selectedClient } = useClient();
  const wsId = currentWorkspace?.id ?? "";

  const today = new Date();
  const daysElapsed = getDate(today);
  const daysInMonth = getDaysInMonth(today);
  const daysRemaining = daysInMonth - daysElapsed;
  const mtdFrom = format(startOfMonth(today), "yyyy-MM-dd");
  const mtdTo = format(today, "yyyy-MM-dd");

  // All calendar days in the month so far (for sparkline)
  // Memoized so useMemo(budgetData) doesn't recompute on every render
  const mtdDays = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(today), end: today }).map((d) => format(d, "yyyy-MM-dd")),
    [daysElapsed], // only changes when the calendar day advances
  );

  // ── Query 1: segments with budget ─────────────────────────────────────────
  const { data: segments, isLoading: loadingSegs } = useQuery({
    queryKey: ["budget-segments", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("segments")
        .select("id, name, monthly_budget, currency, client_id")
        .eq("workspace_id", wsId)
        .eq("status", "active")
        .order("name");
      return data ?? [];
    },
  });

  // ── Query 2: segment_daily MTD (canonical spend per segment) ──────────────
  const { data: spendRows, isLoading: loadingSpend } = useQuery({
    queryKey: ["budget-spend-mtd", wsId, mtdFrom, mtdTo],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("segment_daily")
        .select("segment_id, date, spend")
        .eq("workspace_id", wsId)
        .gte("date", mtdFrom)
        .lte("date", mtdTo);
      return data ?? [];
    },
  });

  // ── Derive SegmentBudget array ─────────────────────────────────────────────
  const budgetData = useMemo<SegmentBudget[]>(() => {
    if (!segments || !spendRows) return [];

    // Build per-segment spend map: segmentId → { total, byDate }
    const spendByDate = new Map<string, Map<string, number>>();
    for (const row of spendRows) {
      const byDate = spendByDate.get(row.segment_id) ?? new Map<string, number>();
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + Number(row.spend));
      spendByDate.set(row.segment_id, byDate);
    }

    return segments
      .filter((s) => !selectedClient || s.client_id === selectedClient.id)
      .filter((s) => Number(s.monthly_budget) > 0)
      .map((seg) => {
        const byDate = spendByDate.get(seg.id) ?? new Map<string, number>();
        const spendMTD = Array.from(byDate.values()).reduce((s, v) => s + v, 0);
        const budget = Number(seg.monthly_budget) || 0;
        const currency = seg.currency ?? "ARS";

        // Use at least 3 days to avoid day-1 projection noise
        const dailyBurnRate = spendMTD / Math.max(daysElapsed, 3);
        const projectedMonthly = dailyBurnRate * daysInMonth;
        const percentConsumed = budget > 0 ? (spendMTD / budget) * 100 : 0;
        const daysRemainingAtRate = dailyBurnRate > 0 ? (budget - spendMTD) / dailyBurnRate : Infinity;
        const clientName = clients.find((c) => c.id === seg.client_id)?.name ?? "–";

        let pacing: PacingStatus = "no_data";
        if (spendMTD > 0 && budget > 0) {
          const ratio = projectedMonthly / budget;
          pacing = ratio > 1.1 ? "overpacing" : ratio < 0.9 ? "underpacing" : "on_track";
        }

        // Build daily sparkline: all calendar days MTD, fill missing with 0
        const expectedDaily = budget / daysInMonth;
        const dailyPoints: DailyPoint[] = mtdDays.map((d) => ({
          date: d.slice(5), // "MM-DD"
          spend: byDate.get(d) ?? 0,
          expected: expectedDaily,
        }));

        return {
          id: seg.id, name: seg.name, clientName, budget, currency,
          spendMTD, dailyBurnRate, projectedMonthly, percentConsumed, daysRemainingAtRate,
          pacing, dailyPoints,
        };
      });
  }, [segments, spendRows, selectedClient, clients, daysElapsed, daysInMonth, mtdDays]);

  const isLoading = loadingSegs || loadingSpend;
  const overBudgetSegs = budgetData.filter((s) => s.pacing === "overpacing");

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        badge="Budget"
        title="Budget Tracker"
        subtitle={`${format(startOfMonth(today), "MMMM yyyy", { locale: es })} · Día ${daysElapsed} de ${daysInMonth}`}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : budgetData.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-2">
            <Target className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No hay segmentos con presupuesto mensual asignado.</p>
            <p className="text-xs text-muted-foreground/70">
              Configurá el budget en cada segmento desde <strong>Segments</strong>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <SummaryBar segs={budgetData} daysElapsed={daysElapsed} daysInMonth={daysInMonth} />

          {/* Overpacing alert banner */}
          {overBudgetSegs.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-destructive">
                  {overBudgetSegs.length} segmento(s) en overpacing
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {overBudgetSegs.map((s) => s.name).join(", ")} — proyectados a superar el budget al ritmo actual.
                </p>
              </div>
            </div>
          )}

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...budgetData]
              .sort((a, b) => {
                const order: PacingStatus[] = ["overpacing", "underpacing", "on_track", "no_data"];
                return order.indexOf(a.pacing) - order.indexOf(b.pacing);
              })
              .map((seg) => (
                <BudgetCard key={seg.id} seg={seg} daysElapsed={daysElapsed} daysInMonth={daysInMonth} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
