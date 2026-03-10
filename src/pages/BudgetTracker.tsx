import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { startOfMonth, endOfMonth, getDaysInMonth, getDate, format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import SectionHeader from "@/components/SectionHeader";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  CalendarDays,
  Flame,
  Target,
  AlertTriangle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Helpers ──
const fmtARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtCur = (n: number, cur = "ARS") =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const today = new Date();
const daysElapsed = getDate(today); // day of month (1-31)
const daysInMonth = getDaysInMonth(today);
const daysRemaining = daysInMonth - daysElapsed;
const mtdFrom = format(startOfMonth(today), "yyyy-MM-dd");
const mtdTo = format(today, "yyyy-MM-dd");

type PacingStatus = "overpacing" | "on_track" | "underpacing" | "no_data";

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
}

const pacingConfig: Record<PacingStatus, { label: string; color: string; icon: typeof TrendingUp; barColor: string }> = {
  overpacing:  { label: "Overpacing",  color: "text-destructive",  icon: TrendingUp,   barColor: "bg-destructive" },
  on_track:    { label: "On Track",    color: "text-success",      icon: Minus,        barColor: "bg-success" },
  underpacing: { label: "Underpacing", color: "text-warning",      icon: TrendingDown, barColor: "bg-warning" },
  no_data:     { label: "Sin datos",   color: "text-muted-foreground", icon: Minus,    barColor: "bg-muted" },
};

// ── Budget Card ──
function BudgetCard({ seg }: { seg: SegmentBudget }) {
  const pacing = pacingConfig[seg.pacing];
  const PacingIcon = pacing.icon;
  const pct = Math.min(seg.percentConsumed, 100);
  const projectedPct = Math.min((seg.projectedMonthly / seg.budget) * 100, 150);

  return (
    <Card className={cn("relative overflow-hidden", seg.pacing === "overpacing" && "border-destructive/40", seg.pacing === "underpacing" && "border-warning/30")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-bold truncate">{seg.name}</CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">{seg.clientName}</p>
          </div>
          <Badge
            variant="outline"
            className={cn("text-[9px] shrink-0 flex items-center gap-1 font-semibold", pacing.color, "border-current/30")}
          >
            <PacingIcon className="h-2.5 w-2.5" />
            {pacing.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Budget vs Spend */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Spend MTD</p>
            <p className="text-xl font-bold tabular-nums">{fmtCur(seg.spendMTD, seg.currency)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget</p>
            <p className="text-sm font-semibold tabular-nums text-muted-foreground">{fmtCur(seg.budget, seg.currency)}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{pct.toFixed(1)}% consumido</span>
            <span>Día {daysElapsed}/{daysInMonth}</span>
          </div>
          <div className="relative w-full h-2.5 bg-muted rounded-full overflow-hidden">
            {/* Expected spend marker (where you "should" be) */}
            <div
              className="absolute top-0 h-full w-0.5 bg-foreground/30 z-10"
              style={{ left: `${(daysElapsed / daysInMonth) * 100}%` }}
            />
            {/* Actual spend */}
            <div
              className={cn("h-full rounded-full transition-all", pacing.barColor)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[9px] text-muted-foreground">La línea vertical es el ritmo esperado para hoy</p>
        </div>

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
            <TooltipContent side="top" className="text-xs">Promedio diario de los últimos {daysElapsed} días</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-muted/40 rounded-md p-2.5 cursor-help">
                <div className="flex items-center gap-1 mb-1">
                  <Target className="h-3 w-3 text-primary" />
                  <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Proyección</span>
                </div>
                <p className={cn("text-sm font-bold tabular-nums", seg.projectedMonthly > seg.budget * 1.1 ? "text-destructive" : seg.projectedMonthly < seg.budget * 0.9 ? "text-warning" : "text-success")}>
                  {fmtCur(seg.projectedMonthly, seg.currency)}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Proyección al cierre del mes al ritmo actual</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("bg-muted/40 rounded-md p-2.5 cursor-help", seg.daysRemainingAtRate < 0 && "bg-destructive/10")}>
                <div className="flex items-center gap-1 mb-1">
                  <CalendarDays className="h-3 w-3 text-blue-500" />
                  <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Días restantes</span>
                </div>
                <p className={cn("text-sm font-bold tabular-nums", seg.daysRemainingAtRate < 0 ? "text-destructive" : seg.daysRemainingAtRate < 5 ? "text-warning" : "")}>
                  {seg.daysRemainingAtRate <= 0
                    ? "Agotado"
                    : seg.dailyBurnRate === 0
                    ? "–"
                    : `${Math.floor(seg.daysRemainingAtRate)} días`}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Días que dura el presupuesto restante al burn rate actual</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="bg-muted/40 rounded-md p-2.5 cursor-help">
                <div className="flex items-center gap-1 mb-1">
                  <DollarSign className="h-3 w-3 text-green-500" />
                  <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Restante</span>
                </div>
                <p className={cn("text-sm font-bold tabular-nums", seg.budget - seg.spendMTD < 0 ? "text-destructive" : "")}>
                  {fmtCur(Math.max(0, seg.budget - seg.spendMTD), seg.currency)}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Budget disponible para el resto del mes</TooltipContent>
          </Tooltip>
        </div>

        {/* Alert: budget exceeded */}
        {seg.spendMTD > seg.budget && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive font-medium">
              Excedido por {fmtCur(seg.spendMTD - seg.budget, seg.currency)} ({((seg.spendMTD / seg.budget - 1) * 100).toFixed(1)}%)
            </p>
          </div>
        )}

        {/* Alert: will run out before month ends */}
        {seg.daysRemainingAtRate > 0 && seg.daysRemainingAtRate < daysRemaining && seg.daysRemainingAtRate < 5 && seg.spendMTD <= seg.budget && (
          <div className="flex items-center gap-2 rounded-md bg-warning/10 border border-warning/20 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
            <p className="text-xs text-warning font-medium">
              El budget se agota en ~{Math.floor(seg.daysRemainingAtRate)} días al ritmo actual
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Summary bar ──
function SummaryBar({ segments }: { segments: SegmentBudget[] }) {
  const totalBudget = segments.reduce((s, seg) => s + seg.budget, 0);
  const totalSpend = segments.reduce((s, seg) => s + seg.spendMTD, 0);
  const totalProjected = segments.reduce((s, seg) => s + seg.projectedMonthly, 0);
  const totalBurn = segments.reduce((s, seg) => s + seg.dailyBurnRate, 0);
  const overBudget = segments.filter((s) => s.pacing === "overpacing").length;
  const underBudget = segments.filter((s) => s.pacing === "underpacing").length;

  if (totalBudget === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Card>
        <CardContent className="py-3 px-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Budget total</p>
          <p className="text-lg font-bold tabular-nums">{fmtARS(totalBudget)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{segments.length} segmento(s)</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 px-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Spend MTD</p>
          <p className="text-lg font-bold tabular-nums">{fmtARS(totalSpend)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{((totalSpend / totalBudget) * 100).toFixed(1)}% consumido</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 px-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Burn diario total</p>
          <p className="text-lg font-bold tabular-nums">{fmtARS(totalBurn)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">promedio últimos {daysElapsed} días</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 px-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Proyección fin de mes</p>
          <p className={cn("text-lg font-bold tabular-nums", totalProjected > totalBudget * 1.05 ? "text-destructive" : totalProjected < totalBudget * 0.9 ? "text-warning" : "text-success")}>
            {fmtARS(totalProjected)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{((totalProjected / totalBudget) * 100).toFixed(1)}% del budget</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 px-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Pacing</p>
          <div className="flex gap-2 mt-1">
            {overBudget > 0 && (
              <span className="text-xs font-bold text-destructive flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />{overBudget} over
              </span>
            )}
            {underBudget > 0 && (
              <span className="text-xs font-bold text-warning flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />{underBudget} under
              </span>
            )}
            {overBudget === 0 && underBudget === 0 && (
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

// ── Main Page ──
export default function BudgetTracker() {
  const { currentWorkspace } = useWorkspace();
  const { clients, selectedClient } = useClient();
  const wsId = currentWorkspace?.id ?? "";

  // Fetch segments with budget
  const { data: segments, isLoading: loadingSegs } = useQuery({
    queryKey: ["budget-segments", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("segments")
        .select("id, name, monthly_budget, currency, client_id")
        .eq("workspace_id", wsId)
        .eq("status", "active")
        .gt("monthly_budget", 0)
        .order("name");
      return data ?? [];
    },
  });

  // Fetch campaign→segment map
  const { data: segMap } = useQuery({
    queryKey: ["budget-segmap", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_segment_map")
        .select("segment_id, campaign_id")
        .eq("workspace_id", wsId)
        .eq("match_status", "assigned");
      return data ?? [];
    },
  });

  // Fetch MTD performance
  const { data: perfData, isLoading: loadingPerf } = useQuery({
    queryKey: ["budget-perf-mtd", wsId, mtdFrom, mtdTo],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("performance_daily")
        .select("entity_id, spend")
        .eq("workspace_id", wsId)
        .eq("entity_type", "campaign")
        .gte("date", mtdFrom)
        .lte("date", mtdTo);
      return data ?? [];
    },
  });

  const budgetData = useMemo<SegmentBudget[]>(() => {
    if (!segments || !segMap || !perfData) return [];

    // Build spend per campaign map
    const campaignSpend = new Map<string, number>();
    for (const row of perfData) {
      campaignSpend.set(row.entity_id, (campaignSpend.get(row.entity_id) ?? 0) + Number(row.spend));
    }

    // Build campaign IDs per segment
    const segCampaigns = new Map<string, string[]>();
    for (const m of segMap) {
      const existing = segCampaigns.get(m.segment_id) ?? [];
      existing.push(m.campaign_id);
      segCampaigns.set(m.segment_id, existing);
    }

    return segments
      .filter((s) => !selectedClient || s.client_id === selectedClient.id)
      .map((seg) => {
        const campIds = segCampaigns.get(seg.id) ?? [];
        const spendMTD = campIds.reduce((sum, cId) => sum + (campaignSpend.get(cId) ?? 0), 0);
        const budget = Number(seg.monthly_budget) || 0;
        // Use at least 3 days to avoid day-1 projection explosion (1 day spend * 31 = unreliable)
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

        return { id: seg.id, name: seg.name, clientName, budget, currency: seg.currency ?? "ARS", spendMTD, dailyBurnRate, projectedMonthly, percentConsumed, daysRemainingAtRate, pacing };
      });
  }, [segments, segMap, perfData, selectedClient, clients]);

  const isLoading = loadingSegs || loadingPerf;

  const overBudgetSegs = budgetData.filter((s) => s.pacing === "overpacing");
  const noBudgetSegs = budgetData.filter((s) => s.pacing === "no_data");

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
            <p className="text-xs text-muted-foreground/70">Configurá el budget en cada segmento desde <strong>Segments</strong>.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <SummaryBar segments={budgetData} />

          {/* Overpacing alert */}
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

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {budgetData
              .sort((a, b) => {
                const order: PacingStatus[] = ["overpacing", "underpacing", "on_track", "no_data"];
                return order.indexOf(a.pacing) - order.indexOf(b.pacing);
              })
              .map((seg) => <BudgetCard key={seg.id} seg={seg} />)
            }
          </div>

          {noBudgetSegs.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {noBudgetSegs.length} segmento(s) sin datos de spend para este mes.
            </p>
          )}
        </>
      )}
    </div>
  );
}
