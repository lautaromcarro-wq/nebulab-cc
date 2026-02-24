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
import { Shield, Activity, Settings2 } from "lucide-react";
import { format } from "date-fns";

const LIMITS = {
  CRON_MAX_DAYS_BACK: 3,
  MANUAL_MAX_DAYS_BACK: 30,
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetch = async () => {
      setLoading(true);
      const [runsRes, eventsRes] = await Promise.all([
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
      ]);
      setSyncRuns((runsRes.data as unknown as SyncRun[]) ?? []);
      setRiskEvents((eventsRes.data as unknown as RiskEvent[]) ?? []);
      setLoading(false);
    };

    fetch();
  }, [currentWorkspace]);

  if (loading) {
    return <div className="animate-pulse text-muted-foreground p-8">Cargando…</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ops & Guardrails</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor de sincronización y eventos de riesgo.
        </p>
      </div>

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
