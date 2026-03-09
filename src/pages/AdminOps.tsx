import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Activity, Settings2, Database, AlertTriangle, Bug, RefreshCw, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { toast } from "sonner";

const LIMITS = {
  CRON_MAX_DAYS_BACK: 3,
  MANUAL_MAX_DAYS_BACK: 90,
  MAX_RUNTIME_SEC: 120,
  MAX_ROWS_PER_RUN: 20_000,
  MAX_API_PAGES: 50,
  MAX_RUNS_PER_HOUR: 2,
  MANUAL_COOLDOWN_HOURS: 6,
};

interface SyncRun {
  id: string;
  workspace_id: string;
  provider: string;
  job_name: string;
  status: string;
  items_upserted: number | null;
  started_at: string;
  ended_at: string | null;
  triggered_by: string | null;
  details: Record<string, unknown> | null;
}

interface RiskEvent {
  id: string;
  workspace_id: string;
  provider: string;
  severity: string;
  code: string;
  message: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

interface DataCoverage {
  min_date: string | null;
  max_date: string | null;
  row_count: number;
  currencies: string[];
}

interface AlertRule {
  id: string;
  rule_type: string;
  severity: string;
  entity_scope: string | null;
  is_enabled: boolean;
  description: string | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  warn: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  critical: "bg-red-500/15 text-red-600 border-red-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  partial: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  error: "bg-red-500/15 text-red-600 border-red-500/30",
  running: "bg-blue-500/15 text-blue-600 border-blue-500/30",
};

export default function AdminOps() {
  const { currentWorkspace } = useWorkspace();
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);
  const [coverage, setCoverage] = useState<DataCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugResult, setDebugResult] = useState<Record<string, unknown> | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [backfillProvider, setBackfillProvider] = useState<"meta" | "google_ads">("meta");
  const [backfillFrom, setBackfillFrom] = useState("");
  const [backfillTo, setBackfillTo] = useState("");
  const [backfillLoading, setBackfillLoading] = useState(false);

  const runEnvDebug = async () => {
    setDebugLoading(true);
    setDebugResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("debug-env-google-ads");
      if (error) setDebugResult({ error: error.message });
      else setDebugResult(data);
    } catch (e: unknown) {
      setDebugResult({ error: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setDebugLoading(false);
    }
  };

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchAll = async () => {
      setLoading(true);
      const [runsRes, eventsRes, perfRes] = await Promise.all([
        supabase
          .from("sync_runs")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .order("started_at", { ascending: false })
          .limit(50),
        supabase
          .from("risk_events")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("performance_daily")
          .select("date")
          .eq("workspace_id", currentWorkspace.id)
          .order("date", { ascending: true }),
      ]);

      setSyncRuns((runsRes.data as unknown as SyncRun[]) ?? []);
      setRiskEvents((eventsRes.data as unknown as RiskEvent[]) ?? []);

      // Compute coverage from performance_daily rows
      const perfRows = perfRes.data ?? [];
      if (perfRows.length > 0) {
        const dates = perfRows.map((r) => r.date);
        setCoverage({
          min_date: dates[0],
          max_date: dates[dates.length - 1],
          row_count: perfRows.length,
          currencies: [], // filled below
        });
      } else {
        setCoverage({ min_date: null, max_date: null, row_count: 0, currencies: [] });
      }

      // Check distinct currencies
      const { data: currData } = await supabase
        .from("accounts")
        .select("currency")
        .eq("workspace_id", currentWorkspace.id)
        .not("currency", "is", null);
      const currencies = [...new Set((currData ?? []).map((r) => r.currency).filter(Boolean))] as string[];
      setCoverage((prev) => prev ? { ...prev, currencies } : prev);

      setLoading(false);
    };

    fetchAll();
  }, [currentWorkspace]);

  useEffect(() => {
    if (!currentWorkspace) return;
    supabase
      .from("alert_rules")
      .select("id, rule_type, severity, entity_scope, is_enabled, description")
      .eq("workspace_id", currentWorkspace.id)
      .order("rule_type")
      .then(({ data }) => setAlertRules((data as unknown as AlertRule[]) ?? []));
  }, [currentWorkspace]);

  const toggleAlertRule = async (id: string, enabled: boolean) => {
    const { error } = await supabase.from("alert_rules").update({ is_enabled: enabled }).eq("id", id);
    if (error) { toast.error("Error al actualizar regla"); return; }
    setAlertRules((prev) => prev.map((r) => r.id === id ? { ...r, is_enabled: enabled } : r));
  };

  const runBackfill = async () => {
    if (!currentWorkspace || !backfillFrom || !backfillTo) {
      toast.error("Completá fecha inicio y fin"); return;
    }
    setBackfillLoading(true);
    try {
      const fnName = backfillProvider === "meta" ? "backfill-meta" : "backfill-google-ads";
      const { error } = await supabase.functions.invoke(fnName, {
        body: { workspace_id: currentWorkspace.id, from: backfillFrom, to: backfillTo },
      });
      if (error) toast.error(`Error: ${error.message}`);
      else toast.success(`Backfill ${backfillProvider} iniciado para ${backfillFrom} → ${backfillTo}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBackfillLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground p-8">Cargando…</div>;
  }

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400_000).toISOString().split("T")[0];
  const currentMonth = new Date();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

  const coverageStale = coverage?.max_date ? coverage.max_date < yesterday : true;
  const coverageLow = coverage ? coverage.row_count < daysInMonth * 0.8 : true; // rough check
  const multiCurrency = (coverage?.currencies.length ?? 0) > 1;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ops & Guardrails</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor de sincronización, cobertura de datos y eventos de riesgo.
        </p>
      </div>

      {/* Data Coverage */}
      <Card className={coverageStale || coverageLow || multiCurrency ? "border-amber-500/50" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Coverage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Min date</span>
              <p className="font-semibold">{coverage?.min_date ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Max date</span>
              <p className="font-semibold">{coverage?.max_date ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Rows (performance_daily)</span>
              <p className="font-semibold">{coverage?.row_count.toLocaleString() ?? 0}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Currencies</span>
              <p className="font-semibold">{coverage?.currencies.join(", ") || "—"}</p>
            </div>
          </div>

          {coverageStale && (
            <div className="flex items-center gap-2 text-amber-600 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Datos desactualizados: max(date) &lt; ayer ({yesterday}). Ejecutá un sync o backfill.</span>
            </div>
          )}
          {multiCurrency && (
            <div className="flex items-center gap-2 text-amber-600 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Múltiples monedas detectadas: {coverage?.currencies.join(", ")}. No se convierte automáticamente.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Limits */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Hard Limits (V1)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {Object.entries(LIMITS).map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <span className="text-muted-foreground text-xs font-mono">{key}</span>
                <span className="font-semibold">{typeof value === "number" ? value.toLocaleString() : String(value)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Google Ads Env Debug */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Google Ads Env Debug
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" onClick={runEnvDebug} disabled={debugLoading}>
            {debugLoading ? "Cargando…" : "Run Google Env Debug"}
          </Button>
          {debugResult && (
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap font-mono">
              {JSON.stringify(debugResult, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Backfill */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Backfill Manual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Lanza un backfill de datos históricos para el rango de fechas indicado. El job corre de forma asíncrona.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Plataforma</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  size="sm"
                  variant={backfillProvider === "meta" ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setBackfillProvider("meta")}
                >Meta</Button>
                <Button
                  size="sm"
                  variant={backfillProvider === "google_ads" ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setBackfillProvider("google_ads")}
                >Google Ads</Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={backfillFrom} onChange={(e) => setBackfillFrom(e.target.value)} className="h-8 text-xs mt-1 w-36" />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={backfillTo} onChange={(e) => setBackfillTo(e.target.value)} className="h-8 text-xs mt-1 w-36" />
            </div>
            <Button size="sm" onClick={runBackfill} disabled={backfillLoading || !backfillFrom || !backfillTo} className="h-8 text-xs gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${backfillLoading ? "animate-spin" : ""}`} />
              {backfillLoading ? "Ejecutando…" : "Ejecutar Backfill"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alert Rules */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alert Rules ({alertRules.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay reglas de alertas configuradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Severidad</TableHead>
                  <TableHead className="text-xs">Scope</TableHead>
                  <TableHead className="text-xs">Descripción</TableHead>
                  <TableHead className="text-xs text-right">Activo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="text-xs font-mono">{rule.rule_type}</TableCell>
                    <TableCell>
                      <Badge className={SEVERITY_COLORS[rule.severity] ?? ""}>{rule.severity}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{rule.entity_scope ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{rule.description ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={rule.is_enabled}
                        onCheckedChange={(v) => toggleAlertRule(rule.id, v)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Risk Events */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Risk Events ({riskEvents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {riskEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay eventos de riesgo recientes.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs">Severity</TableHead>
                    <TableHead className="text-xs">Code</TableHead>
                    <TableHead className="text-xs">Provider</TableHead>
                    <TableHead className="text-xs">Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riskEvents.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(e.created_at), "dd/MM HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge className={SEVERITY_COLORS[e.severity] ?? ""}>
                          {e.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{e.code}</TableCell>
                      <TableCell className="text-xs">{e.provider}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{e.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Runs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Sync Runs ({syncRuns.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {syncRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay sync runs recientes.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Started</TableHead>
                    <TableHead className="text-xs">Job</TableHead>
                    <TableHead className="text-xs">Provider</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Rows</TableHead>
                    <TableHead className="text-xs">Trigger</TableHead>
                    <TableHead className="text-xs">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncRuns.map((r) => {
                    const details = r.details as Record<string, unknown> | null;
                    const detailStr = details
                      ? Object.entries(details)
                          .filter(([, v]) => v !== undefined && v !== null)
                          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                          .join(" · ")
                      : "";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(r.started_at), "dd/MM HH:mm")}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{r.job_name}</TableCell>
                        <TableCell className="text-xs">{r.provider}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[r.status] ?? ""}>
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{r.items_upserted ?? 0}</TableCell>
                        <TableCell className="text-xs">{r.triggered_by ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate font-mono opacity-70">
                          {detailStr || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}