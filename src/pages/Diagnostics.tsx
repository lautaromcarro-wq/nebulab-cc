import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { differenceInDays, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import SectionHeader from "@/components/SectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Stethoscope,
  Zap,
  Database,
  Wifi,
  WifiOff,
  Clock,
  AlertCircle,
  ShoppingCart,
  BarChart3,
  LineChart,
  TrendingUp,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type CheckStatus = "ok" | "warn" | "error" | "unknown";

interface CheckResult {
  status: CheckStatus;
  label: string;
  detail: string | null;
}

interface ConnectorHealth {
  name: string;
  icon: React.ElementType;
  connection: CheckResult;
  dataFreshness: CheckResult;
  lastSync: CheckResult;
  liveCheck?: CheckResult | null; // null = not yet run, undefined = n/a
  lastError?: string | null;
  pingId?: string; // ecommerce connection id for live ping
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function freshnessCheck(maxDate: string | null, label: string): CheckResult {
  if (!maxDate) return { status: "error", label, detail: "Sin datos" };
  const days = differenceInDays(new Date(), parseISO(maxDate));
  if (days <= 1) return { status: "ok", label, detail: maxDate };
  if (days <= 7) return { status: "warn", label, detail: `${maxDate} (hace ${days}d)` };
  return { status: "error", label, detail: `${maxDate} (hace ${days}d)` };
}

function connectionCheck(status: string, lastError?: string | null): CheckResult {
  if (status === "connected") return { status: "ok", label: "Conectado", detail: null };
  if (status === "error") return { status: "error", label: "Error", detail: lastError ?? null };
  return { status: "warn", label: "Desconectado", detail: null };
}

function syncCheck(lastAt: string | null): CheckResult {
  if (!lastAt) return { status: "warn", label: "Nunca sincronizado", detail: null };
  const ago = formatDistanceToNow(parseISO(lastAt), { locale: es, addSuffix: true });
  const days = differenceInDays(new Date(), parseISO(lastAt));
  if (days <= 1) return { status: "ok", label: `Sync ${ago}`, detail: lastAt };
  if (days <= 7) return { status: "warn", label: `Sync ${ago}`, detail: lastAt };
  return { status: "error", label: `Sync ${ago}`, detail: lastAt };
}

const statusIcon: Record<CheckStatus, React.ElementType> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
  unknown: AlertCircle,
};

const statusColor: Record<CheckStatus, string> = {
  ok: "text-success",
  warn: "text-warning",
  error: "text-destructive",
  unknown: "text-muted-foreground",
};

const badgeClass: Record<CheckStatus, string> = {
  ok: "bg-success/10 text-success border-success/20",
  warn: "bg-warning/10 text-warning border-warning/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  unknown: "bg-muted text-muted-foreground",
};

// ── Data hook ────────────────────────────────────────────────────────────────

function useDiagnosticsData() {
  const { currentWorkspace } = useWorkspace();
  const { selectedClient } = useClient();
  const wsId = currentWorkspace?.id ?? null;
  const clientId = selectedClient?.id ?? null;

  return useQuery({
    queryKey: ["diagnostics", wsId, clientId],
    queryFn: async () => {
      if (!wsId) return null;

      const [integrationsRes, ecommerceRes, perfRes, analyticsRes, syncRunsRes] = await Promise.all([
        // OAuth integrations (Meta, Google Ads)
        supabase
          .from("integrations")
          .select("provider, status, metadata, updated_at")
          .eq("workspace_id", wsId),

        // Ecommerce connections
        (supabase as any)
          .from("ecommerce_connections")
          .select("id, provider, status, last_sync_at, last_error, client_id")
          .eq("workspace_id", wsId),

        // Latest data date per provider — 90 rows covers 3 providers × 30 days
        supabase
          .from("performance_daily")
          .select("provider, date")
          .eq("workspace_id", wsId)
          .order("date", { ascending: false })
          .limit(90),

        // Latest date in analytics_daily
        supabase
          .from("analytics_daily")
          .select("date")
          .eq("workspace_id", wsId)
          .order("date", { ascending: false })
          .limit(1),

        // Last sync run per provider — 20 covers typical job variety
        supabase
          .from("sync_runs")
          .select("provider, job_name, status, started_at, ended_at, details")
          .eq("workspace_id", wsId)
          .order("started_at", { ascending: false })
          .limit(20),
      ]);

      const integrations = integrationsRes.data ?? [];
      const ecommerceConns = (ecommerceRes.data ?? []) as Array<{
        id: string; provider: string; status: string;
        last_sync_at: string | null; last_error: string | null; client_id: string;
      }>;
      const perfRows = perfRes.data ?? [];
      const analyticsDate = analyticsRes.data?.[0]?.date ?? null;
      const syncRuns = syncRunsRes.data ?? [];

      // Max date per provider from performance_daily
      const maxDateByProvider: Record<string, string> = {};
      for (const row of perfRows) {
        const p = row.provider as string;
        if (!maxDateByProvider[p] || row.date > maxDateByProvider[p]) {
          maxDateByProvider[p] = row.date;
        }
      }

      // Last sync run per job
      const lastRunByJob: Record<string, typeof syncRuns[0]> = {};
      for (const run of syncRuns) {
        const key = run.job_name || run.provider;
        if (!lastRunByJob[key]) lastRunByJob[key] = run;
      }

      return { integrations, ecommerceConns, maxDateByProvider, analyticsDate, lastRunByJob, clientId };
    },
    enabled: !!wsId,
    staleTime: 30_000,
  });
}

// ── ConnectorCard ─────────────────────────────────────────────────────────────

function CheckRow({ icon: Icon, label, result }: {
  icon: React.ElementType;
  label: string;
  result: CheckResult;
}) {
  const StatusIcon = statusIcon[result.status];
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        {result.detail && (
          <p className="text-[11px] text-muted-foreground/70 truncate">{result.detail}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <StatusIcon className={cn("h-3.5 w-3.5", statusColor[result.status])} />
        <span className={cn("text-[11px] font-medium", statusColor[result.status])}>{result.label}</span>
      </div>
    </div>
  );
}

function ConnectorCard({
  connector,
  onPing,
  pinging,
}: {
  connector: ConnectorHealth;
  onPing?: () => void;
  pinging?: boolean;
}) {
  const Icon = connector.icon;
  const checks = [connector.connection, connector.dataFreshness, connector.lastSync];
  const worstStatus = checks.reduce<CheckStatus>((worst, c) => {
    const order: CheckStatus[] = ["ok", "unknown", "warn", "error"];
    return order.indexOf(c.status) > order.indexOf(worst) ? c.status : worst;
  }, "ok");

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">{connector.name}</CardTitle>
          </div>
          <Badge variant="outline" className={cn("text-[10px] border", badgeClass[worstStatus])}>
            {worstStatus === "ok" ? "OK" : worstStatus === "warn" ? "Atención" : worstStatus === "error" ? "Error" : "—"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-0 divide-y divide-border">
        <CheckRow icon={Wifi} label="Conexión" result={connector.connection} />
        <CheckRow icon={Database} label="Datos" result={connector.dataFreshness} />
        <CheckRow icon={Clock} label="Último sync" result={connector.lastSync} />

        {connector.liveCheck !== undefined && (
          <div className="pt-2">
            {connector.liveCheck === null ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={onPing}
                disabled={pinging}
              >
                <Zap className={cn("h-3 w-3 mr-1.5", pinging && "animate-pulse")} />
                {pinging ? "Probando API…" : "Ping API en vivo"}
              </Button>
            ) : (
              <CheckRow icon={Zap} label="Ping en vivo" result={connector.liveCheck} />
            )}
          </div>
        )}

        {connector.lastError && (
          <div className="pt-2">
            <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-2">
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              <p className="text-[11px] text-destructive break-all">{connector.lastError}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ connectors }: { connectors: ConnectorHealth[] }) {
  const allChecks = connectors.flatMap((c) => [c.connection, c.dataFreshness, c.lastSync]);
  const total = allChecks.length;
  let passing = 0, errors = 0, warns = 0;
  for (const c of allChecks) {
    if (c.status === "ok") passing++;
    else if (c.status === "error") errors++;
    else if (c.status === "warn") warns++;
  }

  const overallStatus: CheckStatus = errors > 0 ? "error" : warns > 0 ? "warn" : "ok";
  const OverallIcon = statusIcon[overallStatus];

  return (
    <div className={cn(
      "rounded-lg border p-4 flex items-center justify-between",
      overallStatus === "ok" ? "bg-success/5 border-success/20"
        : overallStatus === "warn" ? "bg-warning/5 border-warning/20"
        : "bg-destructive/5 border-destructive/20"
    )}>
      <div className="flex items-center gap-3">
        <OverallIcon className={cn("h-5 w-5", statusColor[overallStatus])} />
        <div>
          <p className="text-sm font-semibold">
            {overallStatus === "ok" ? "Sistema operativo" : overallStatus === "warn" ? "Atención requerida" : "Issues críticos detectados"}
          </p>
          <p className="text-xs text-muted-foreground">
            {passing}/{total} checks pasando · {errors} errores · {warns} advertencias
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm font-bold tabular-nums">
        <span className={statusColor[overallStatus]}>{Math.round((passing / total) * 100)}%</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Diagnostics() {
  const { currentWorkspace } = useWorkspace();
  const { selectedClient } = useClient();
  const qc = useQueryClient();
  const { data, isLoading } = useDiagnosticsData();
  const [pingingMap, setPingingMap] = useState<Record<string, boolean>>({});
  const [liveChecks, setLiveChecks] = useState<Record<string, CheckResult>>({});

  const handlePing = async (connId: string, connName: string) => {
    setPingingMap((p) => ({ ...p, [connId]: true }));
    try {
      const { data: fnResult, error } = await supabase.functions.invoke("sync-ecommerce-daily", {
        body: { connectionId: connId, testOnly: true },
      });
      if (error || !fnResult?.success) {
        setLiveChecks((p) => ({
          ...p,
          [connId]: { status: "error", label: "Error", detail: error?.message ?? fnResult?.error ?? "desconocido" },
        }));
      } else {
        setLiveChecks((p) => ({
          ...p,
          [connId]: {
            status: "ok",
            label: "API responde",
            detail: `${fnResult.ordersFound} órdenes · ${fnResult.productsFound} productos`,
          },
        }));
      }
    } catch (e) {
      setLiveChecks((p) => ({
        ...p,
        [connId]: { status: "error", label: "Error", detail: e instanceof Error ? e.message : "Error desconocido" },
      }));
    } finally {
      setPingingMap((p) => ({ ...p, [connId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <SectionHeader badge="Admin" title="Diagnóstico" subtitle="Health check de conectores y datos" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!currentWorkspace || !data) {
    return (
      <div className="space-y-6 animate-fade-in">
        <SectionHeader badge="Admin" title="Diagnóstico" subtitle="Health check de conectores y datos" />
        <p className="text-sm text-muted-foreground">No hay workspace seleccionado.</p>
      </div>
    );
  }

  // ── Build connector list ──────────────────────────────────────────────────

  const connectors: ConnectorHealth[] = [];

  // Meta Ads
  const metaInt = data.integrations.find((i) => i.provider === "meta");
  connectors.push({
    name: "Meta Ads",
    icon: BarChart3,
    connection: metaInt
      ? connectionCheck(metaInt.status)
      : { status: "error", label: "No configurado", detail: null },
    dataFreshness: freshnessCheck(data.maxDateByProvider["meta"] ?? null, "Último dato"),
    lastSync: syncCheck(
      data.lastRunByJob["sync_meta_daily"]?.started_at
        ?? data.lastRunByJob["meta"]?.started_at
        ?? null
    ),
  });

  // Google Ads
  const googleInt = data.integrations.find((i) => i.provider === "google_ads");
  connectors.push({
    name: "Google Ads",
    icon: TrendingUp,
    connection: googleInt
      ? connectionCheck(googleInt.status)
      : { status: "error", label: "No configurado", detail: null },
    dataFreshness: freshnessCheck(data.maxDateByProvider["google_ads"] ?? null, "Último dato"),
    lastSync: syncCheck(
      data.lastRunByJob["sync_google_ads_daily"]?.started_at
        ?? data.lastRunByJob["google_ads"]?.started_at
        ?? null
    ),
  });

  // GA4 / Analytics
  connectors.push({
    name: "Google Analytics 4",
    icon: LineChart,
    connection: data.analyticsDate
      ? { status: "ok", label: "Con datos", detail: null }
      : { status: "warn", label: "Sin datos", detail: null },
    dataFreshness: freshnessCheck(data.analyticsDate, "Último dato"),
    lastSync: syncCheck(
      data.lastRunByJob["sync_ga4_daily"]?.started_at
        ?? data.lastRunByJob["ga4"]?.started_at
        ?? null
    ),
  });

  // Ecommerce connections (one card per connection, filtered by client if selected)
  const ecomConns = selectedClient
    ? data.ecommerceConns.filter((c) => c.client_id === selectedClient.id)
    : data.ecommerceConns;

  for (const conn of ecomConns) {
    const maxOrderDate = data.maxDateByProvider[`ecommerce_${conn.id}`] ?? null;
    connectors.push({
      name: `Tiendanube${ecomConns.length > 1 ? ` (${conn.client_id.slice(0, 6)})` : ""}`,
      icon: ShoppingCart,
      connection: connectionCheck(conn.status, conn.last_error),
      dataFreshness: freshnessCheck(maxOrderDate, "Última orden"),
      lastSync: syncCheck(conn.last_sync_at),
      liveCheck: liveChecks[conn.id] ?? null,
      lastError: conn.status === "error" ? conn.last_error : null,
      pingId: conn.id,
    });
  }

  // If no ecommerce configured, show placeholder
  if (ecomConns.length === 0) {
    connectors.push({
      name: "Tiendanube",
      icon: ShoppingCart,
      connection: { status: "unknown", label: "No configurado", detail: null },
      dataFreshness: { status: "unknown", label: "Sin datos", detail: null },
      lastSync: { status: "unknown", label: "Nunca", detail: null },
    });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <SectionHeader badge="Admin" title="Diagnóstico" subtitle="Health check de conectores y datos" />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => qc.invalidateQueries({ queryKey: ["diagnostics"] })}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </Button>
      </div>

      <SummaryStrip connectors={connectors} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connectors.map((connector, i) => (
          <ConnectorCard
            key={i}
            connector={connector}
            onPing={connector.pingId ? () => handlePing(connector.pingId!, connector.name) : undefined}
            pinging={connector.pingId ? pingingMap[connector.pingId] : false}
          />
        ))}
      </div>

      {/* Sync run log for quick reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Últimos sync runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {Object.values(data.lastRunByJob).length === 0 ? (
            <p className="text-xs text-muted-foreground px-4 pb-4">Sin historial de sync.</p>
          ) : (
            <div className="divide-y divide-border">
              {Object.values(data.lastRunByJob).slice(0, 8).map((run: any, i) => {
                const runStatus: CheckStatus = run.status === "success" ? "ok" : run.status === "error" ? "error" : "warn";
                const StatusIcon = statusIcon[runStatus];
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", statusColor[runStatus])} />
                      <span className="text-xs font-medium truncate">{run.job_name || run.provider}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {run.details?.items_upserted != null && (
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {run.details.items_upserted} rows
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {run.started_at
                          ? formatDistanceToNow(parseISO(run.started_at), { locale: es, addSuffix: true })
                          : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
