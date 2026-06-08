// src/pages/Home.tsx — Ojo de Águila: Cross-client portfolio overview
import { usePortfolioOverview, type ClientSummary, type PortfolioAlert } from "@/hooks/usePortfolioOverview";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DollarSign, TrendingUp, Users, AlertTriangle, ArrowUpRight,
  ArrowDownRight, Minus, Eye, ShoppingCart, MousePointerClick,
  Target, Calendar, Wallet, ChevronRight, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { roasColor } from "@/lib/semaforo";
import SectionHeader from "@/components/SectionHeader";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { fmtCurrency, fmtCurrencyCompact, fmtCompact, fmtPercent, fmt } from "@/components/formatters";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

const pacingConfig = {
  overpacing:  { label: "Over",  icon: ArrowUpRight,  bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20" },
  on_track:    { label: "OK",    icon: Minus,          bg: "bg-success/10",     text: "text-success",     border: "border-success/20" },
  underpacing: { label: "Under", icon: ArrowDownRight, bg: "bg-warning/10",     text: "text-warning",     border: "border-warning/20" },
};

// ── Alert Banner ─────────────────────────────────────────────────────────────

function AlertBanner({ alerts }: { alerts: PortfolioAlert[] }) {
  if (alerts.length === 0) return null;

  const critical = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");

  return (
    <Card className="border-l-4 border-l-warning bg-warning/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span className="text-xs font-bold uppercase tracking-wide text-warning">
            {alerts.length} alerta{alerts.length > 1 ? "s" : ""} activa{alerts.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="space-y-1.5">
          {critical.map((a, i) => (
            <div key={`c-${i}`} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
              <span className="text-xs text-foreground">{a.message}</span>
            </div>
          ))}
          {warnings.map((a, i) => (
            <div key={`w-${i}`} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
              <span className="text-xs text-muted-foreground">{a.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Client Row ───────────────────────────────────────────────────────────────

function ClientRow({
  client, onSelect,
}: {
  client: ClientSummary;
  onSelect: () => void;
}) {
  const pacing = pacingConfig[client.pacingStatus];
  const PacingIcon = pacing.icon;
  const hasBudget = client.budgetNet > 0;

  return (
    <Card
      className="shadow-sm hover:bg-muted/30 transition-colors cursor-pointer group"
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Name + pacing badge */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold truncate">{client.clientName}</h3>
              {hasBudget && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-wide gap-0.5 border-0 px-1.5 py-0",
                    pacing.bg, pacing.text
                  )}
                >
                  <PacingIcon className="h-2.5 w-2.5" />
                  {pacing.label} {client.pacingDelta > 0 ? "+" : ""}{client.pacingDelta.toFixed(0)}pp
                </Badge>
              )}
            </div>

            {/* Pacing bar */}
            {hasBudget && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      client.pacingStatus === "overpacing" ? "bg-destructive" :
                      client.pacingStatus === "underpacing" ? "bg-warning" : "bg-success"
                    )}
                    style={{ width: `${Math.min(client.pacingPercent, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">
                  {client.pacingPercent.toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {/* KPI grid */}
          <div className="hidden md:grid grid-cols-5 gap-x-6 text-right">
            <KpiCell label="Spend" value={fmtCompact(client.spend)} />
            <KpiCell label="Revenue" value={client.revenue > 0 ? fmtCompact(client.revenue) : "—"} />
            <KpiCell
              label="ROAS"
              value={client.roas > 0 ? `${client.roas.toFixed(1)}x` : "—"}
              className={roasColor(client.roas)}
            />
            <KpiCell
              label="CPA"
              value={client.cpa > 0 ? `$${fmtCompact(client.cpa)}` : "—"}
            />
            <KpiCell label="Compras" value={client.purchases > 0 ? fmt(client.purchases) : "—"} />
          </div>

          {/* Platform split */}
          <div className="hidden lg:flex items-center gap-1.5 min-w-[100px]">
            {client.spendMeta > 0 && (
              <Badge variant="secondary" className="text-[9px] font-medium bg-blue-500/10 text-blue-400 border-0 px-1.5 py-0">
                Meta {client.spend > 0 ? `${((client.spendMeta / client.spend) * 100).toFixed(0)}%` : ""}
              </Badge>
            )}
            {client.spendGoogle > 0 && (
              <Badge variant="secondary" className="text-[9px] font-medium bg-green-500/10 text-green-400 border-0 px-1.5 py-0">
                Google {client.spend > 0 ? `${((client.spendGoogle / client.spend) * 100).toFixed(0)}%` : ""}
              </Badge>
            )}
          </div>

          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
        </div>

        {/* Mobile KPIs */}
        <div className="grid grid-cols-4 gap-3 mt-3 md:hidden">
          <KpiCell label="Spend" value={fmtCompact(client.spend)} />
          <KpiCell label="Revenue" value={client.revenue > 0 ? fmtCompact(client.revenue) : "—"} />
          <KpiCell label="ROAS" value={client.roas > 0 ? `${client.roas.toFixed(1)}x` : "—"} className={roasColor(client.roas)} />
          <KpiCell label="Compras" value={client.purchases > 0 ? fmt(client.purchases) : "—"} />
        </div>
      </CardContent>
    </Card>
  );
}

function KpiCell({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground leading-none mb-0.5">{label}</p>
      <p className={cn("text-xs font-bold tabular-nums", className)}>{value}</p>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

const Home = () => {
  const { currentWorkspace } = useWorkspace();
  const { setSelectedClient, clients: allClients } = useClient();
  const { firstName } = useProfile();
  const navigate = useNavigate();
  const { data: portfolio, isLoading } = usePortfolioOverview();

  const handleClientClick = (clientId: string) => {
    const client = allClients.find((c) => c.id === clientId);
    if (client) {
      setSelectedClient(client);
      navigate("/performance");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
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
        {portfolio && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1.5 py-1 px-2.5">
              <Calendar className="h-3 w-3" />
              Día {portfolio.daysElapsed}/{portfolio.daysInMonth}
            </Badge>
            <Badge variant="outline" className="text-xs gap-1.5 py-1 px-2.5">
              <Activity className="h-3 w-3" />
              {portfolio.totals.clientCount} clientes
            </Badge>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
          <Skeleton className="h-40 rounded-lg" />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : !portfolio || portfolio.clients.length === 0 ? (
        <EmptyState
          title="Sin datos de performance"
          description="Cargá data en performance_daily para ver el dashboard."
        />
      ) : (
        <>
          {/* ── TOTALS ──────────────────────────────────────────────────── */}
          <section>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard
                icon={DollarSign}
                label="Spend Total"
                value={fmtCurrencyCompact(portfolio.totals.totalSpend, "ARS")}
                status="primary"
                hero
              />
              <StatCard
                icon={TrendingUp}
                label="Revenue Total"
                value={fmtCurrencyCompact(portfolio.totals.totalRevenue, "ARS")}
                status="success"
                hero
              />
              <StatCard
                icon={Target}
                label="ROAS Blended"
                value={`${portfolio.totals.blendedRoas.toFixed(1)}x`}
                status={portfolio.totals.blendedRoas >= 3 ? "success" : portfolio.totals.blendedRoas >= 1.5 ? "warning" : "destructive"}
                hero
              />
              <StatCard
                icon={ShoppingCart}
                label="Compras"
                value={fmt(portfolio.totals.totalPurchases)}
                subtitle={`CPA: ${fmtCurrencyCompact(portfolio.totals.blendedCpa, "ARS")}`}
                status="neutral"
                hero
              />
              <StatCard
                icon={Eye}
                label="Impresiones"
                value={fmtCompact(portfolio.totals.totalImpressions)}
                subtitle={`${fmtCompact(portfolio.totals.totalClicks)} clicks`}
                status="neutral"
                hero
              />
            </div>
          </section>

          {/* ── ALERTS ─────────────────────────────────────────────────── */}
          <AlertBanner alerts={portfolio.alerts} />

          {/* ── CLIENT TABLE ───────────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader
              badge="Cartera"
              title="Clientes"
              subtitle={`${portfolio.month} · ${portfolio.daysElapsed} días transcurridos`}
            />

            {/* Column headers (desktop) */}
            <div className="hidden md:flex items-center gap-4 px-4 py-2">
              <div className="flex-1">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Cliente</span>
              </div>
              <div className="grid grid-cols-5 gap-x-6 text-right">
                {["Spend", "Revenue", "ROAS", "CPA", "Compras"].map((h) => (
                  <span key={h} className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{h}</span>
                ))}
              </div>
              <div className="hidden lg:block min-w-[100px]">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Split</span>
              </div>
              <div className="w-4" />
            </div>

            {/* Client rows */}
            <div className="space-y-2">
              {portfolio.clients.map((client) => (
                <ClientRow
                  key={client.clientId}
                  client={client}
                  onSelect={() => handleClientClick(client.clientId)}
                />
              ))}
            </div>
          </section>

          {/* ── PORTFOLIO SUMMARY FOOTER ───────────────────────────────── */}
          <section>
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide">Portfolio Total</p>
                      <p className="text-[10px] text-muted-foreground">
                        {portfolio.totals.clientCount} clientes activos · {portfolio.month}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Spend Total</p>
                      <p className="text-sm font-bold">{fmtCurrency(portfolio.totals.totalSpend, "ARS")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Revenue Ads</p>
                      <p className="text-sm font-bold">{fmtCurrency(portfolio.totals.totalRevenue, "ARS")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Compras</p>
                      <p className="text-sm font-bold">{fmt(portfolio.totals.totalPurchases)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">ROAS Blended</p>
                      <p className={cn("text-sm font-bold", roasColor(portfolio.totals.blendedRoas))}>
                        {portfolio.totals.blendedRoas.toFixed(2)}x
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
};

export default Home;
