import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plug, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Play, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Tables } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;
type Account = Tables<"accounts">;

const STATUS_CONFIG = {
  connected: { label: "Connected", icon: CheckCircle2, variant: "default" as const, className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  degraded: { label: "Degraded", icon: AlertTriangle, variant: "secondary" as const, className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  disconnected: { label: "Disconnected", icon: XCircle, variant: "outline" as const, className: "bg-muted text-muted-foreground" },
};

export default function Connections() {
  const { currentWorkspace, workspaceRole } = useWorkspace();
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [metaIntegration, setMetaIntegration] = useState<Integration | null>(null);
  const [metaAccounts, setMetaAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [backfillDays, setBackfillDays] = useState(30);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);

  // Handle OAuth redirect result
  useEffect(() => {
    const oauthProvider = searchParams.get("oauth");
    const status = searchParams.get("status");
    const message = searchParams.get("message");

    if (oauthProvider === "meta") {
      if (status === "success") {
        toast({ title: "Meta conectado", description: "Cuentas publicitarias descubiertas exitosamente." });
      } else if (status === "error") {
        toast({ title: "Error al conectar Meta", description: message || "Ocurrió un error.", variant: "destructive" });
      }
      // Clean URL params
      searchParams.delete("oauth");
      searchParams.delete("status");
      searchParams.delete("message");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Fetch integration + accounts
  useEffect(() => {
    if (!currentWorkspace) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      const [intRes, accRes] = await Promise.all([
        supabase
          .from("integrations")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .eq("provider", "meta")
          .maybeSingle(),
        supabase
          .from("accounts")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .eq("provider", "meta")
          .order("name"),
      ]);
      setMetaIntegration(intRes.data);
      setMetaAccounts(accRes.data ?? []);
      setLoading(false);
    };

    fetchData();
  }, [currentWorkspace, searchParams]);

  // Listen for popup OAuth completion
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'oauth-complete' || event.data?.provider !== 'meta') return;
      if (event.data.status === 'success') {
        toast({ title: "Meta conectado", description: "Cuentas publicitarias descubiertas exitosamente." });
      } else {
        toast({ title: "Error al conectar Meta", description: event.data.message || "Ocurrió un error.", variant: "destructive" });
      }
      setConnecting(false);
      // Re-fetch data
      setLoading(true);
      Promise.all([
        supabase.from("integrations").select("*").eq("workspace_id", currentWorkspace!.id).eq("provider", "meta").maybeSingle(),
        supabase.from("accounts").select("*").eq("workspace_id", currentWorkspace!.id).eq("provider", "meta").order("name"),
      ]).then(([intRes, accRes]) => {
        setMetaIntegration(intRes.data);
        setMetaAccounts(accRes.data ?? []);
        setLoading(false);
      });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [currentWorkspace]);

  const handleConnectMeta = async () => {
    if (!currentWorkspace || !session) return;
    setConnecting(true);

    try {
      const { data, error } = await supabase.functions.invoke("oauth-start-meta", {
        body: { workspace_id: currentWorkspace.id },
      });

      if (error) throw error;
      if (data?.url) {
        const popup = window.open(data.url, 'meta-oauth', 'width=600,height=700,scrollbars=yes');
        if (!popup) {
          // Popup blocked — fall back to top-level navigation
          window.location.href = data.url;
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo iniciar OAuth",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const handleSyncMeta = async () => {
    if (!currentWorkspace || !session) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-meta-daily", {
        body: { workspace_id: currentWorkspace.id, days_back: 3 },
      });
      if (error) throw error;
      toast({
        title: "Sync completado",
        description: `Se insertaron ${data?.upserted ?? 0} registros en performance_daily.${data?.errors?.length ? ` (${data.errors.length} errores)` : ""}`,
      });
    } catch (err) {
      toast({
        title: "Error al sincronizar",
        description: err instanceof Error ? err.message : "No se pudo ejecutar la sincronización",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleBackfillMeta = async () => {
    if (!currentWorkspace || !session) return;
    const days = Math.min(Math.max(1, backfillDays), 90);
    setBackfilling(true);
    setBackfillStatus("started");
    try {
      const { data, error } = await supabase.functions.invoke("sync-meta-daily", {
        body: { workspace_id: currentWorkspace.id, days_back: days, triggered_by: "manual" },
      });
      if (error) throw error;
      // Check if the function returned errors (cooldown, rate limit, etc.)
      if (data?.errors?.length && data?.upserted === 0) {
        const errMsg = data.errors[0];
        const isCooldown = errMsg.includes("cooldown") || errMsg.includes("rate limit") || errMsg.includes("locked");
        setBackfillStatus(`bloqueado: ${errMsg}`);
        toast({
          title: isCooldown ? "Backfill en cooldown" : "Backfill con errores",
          description: errMsg,
          variant: "destructive",
        });
      } else {
        setBackfillStatus(`success: ${data?.upserted ?? 0} rows, ${data?.pages ?? 0} pages`);
        toast({
          title: "Backfill completado",
          description: `${data?.upserted ?? 0} registros sincronizados (${days} días).${data?.hit_limit ? " ⚠️ Hit limit." : ""}`,
        });
      }
    } catch (err) {
      setBackfillStatus(`fail: ${err instanceof Error ? err.message : "error"}`);
      toast({
        title: "Error en backfill",
        description: err instanceof Error ? err.message : "No se pudo ejecutar el backfill",
        variant: "destructive",
      });
    } finally {
      setBackfilling(false);
    }
  };

  const isAdmin = workspaceRole === "admin";
  const statusKey = metaIntegration?.status ?? "disconnected";
  const statusInfo = STATUS_CONFIG[statusKey as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.disconnected;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Connections</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestioná tus integraciones con plataformas de ads.</p>
      </div>

      {/* Meta Ads Card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plug className="h-5 w-5" />
              Meta Ads
            </CardTitle>
            <CardDescription>Facebook & Instagram Ads</CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <Badge className={statusInfo.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusInfo.label}
            </Badge>

            {isAdmin && metaIntegration?.status === "connected" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncMeta}
                disabled={syncing || loading}
              >
                {syncing ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                {syncing ? "Sincronizando…" : "Sync Now"}
              </Button>
            )}

            {isAdmin && (
              <Button
                size="sm"
                onClick={handleConnectMeta}
                disabled={connecting || loading}
              >
                {connecting && <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {metaIntegration ? "Reconectar" : "Conectar Meta"}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {!currentWorkspace ? (
            <p className="text-sm text-muted-foreground">Seleccioná un workspace para gestionar conexiones.</p>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : metaIntegration ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Scopes:</span>{" "}
                  <span className="font-mono text-xs">{metaIntegration.scopes?.join(", ") || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Token expira:</span>{" "}
                  <span>
                    {metaIntegration.token_expires_at
                      ? new Date(metaIntegration.token_expires_at).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Backfill control */}
              {isAdmin && metaIntegration.status === "connected" && (
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Backfill Meta</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground text-xs cursor-help">(?)</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Sincroniza datos históricos de Meta Ads. Máximo 90 días. Cooldown: 1 backfill manual cada 6 horas.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={backfillDays}
                      onChange={(e) => setBackfillDays(Number(e.target.value))}
                      className="w-24 h-8 text-sm"
                      placeholder="days"
                    />
                    <span className="text-xs text-muted-foreground">días</span>
                    <Button size="sm" variant="outline" onClick={handleBackfillMeta} disabled={backfilling}>
                      {backfilling ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                      Run Backfill
                    </Button>
                  </div>
                  {backfillStatus && (
                    <p className={`text-xs ${backfillStatus.startsWith("fail") ? "text-destructive" : "text-muted-foreground"}`}>
                      Status: {backfillStatus}
                    </p>
                  )}
                </div>
              )}

              {metaAccounts.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">
                    Ad Accounts ({metaAccounts.length})
                  </h3>
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium">Nombre</th>
                          <th className="px-3 py-2 text-left font-medium">Account ID</th>
                          <th className="px-3 py-2 text-left font-medium">Moneda</th>
                          <th className="px-3 py-2 text-left font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metaAccounts.map((acct) => (
                          <tr key={acct.id} className="border-b last:border-0">
                            <td className="px-3 py-2">{acct.name}</td>
                            <td className="px-3 py-2 font-mono text-xs">{acct.external_account_id}</td>
                            <td className="px-3 py-2">{acct.currency ?? "—"}</td>
                            <td className="px-3 py-2">
                              <Badge variant={acct.status === "active" ? "default" : "secondary"} className="text-xs">
                                {acct.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {metaAccounts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No se encontraron cuentas publicitarias.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "Conectá tu cuenta de Meta para descubrir cuentas publicitarias."
                : "Pedile a un admin que conecte Meta Ads."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Google Ads Card - Coming Soon */}
      <Card className="opacity-75">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plug className="h-5 w-5" />
              Google Ads
            </CardTitle>
            <CardDescription>Search, Display, Shopping & YouTube Ads</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">Coming next</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Requiere: OAuth Client ID/Secret, Developer Token. Scopes: <code className="text-xs font-mono">adwords</code>.
          </p>
        </CardContent>
      </Card>

      {/* GA4 Card - Coming Soon */}
      <Card className="opacity-75">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plug className="h-5 w-5" />
              Google Analytics 4
            </CardTitle>
            <CardDescription>Sessions, Transactions & Revenue</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">Coming next</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Requiere: OAuth Client ID/Secret. Scopes: <code className="text-xs font-mono">analytics.readonly</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
