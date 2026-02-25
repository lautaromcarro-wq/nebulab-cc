import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plug, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Play, Clock, ExternalLink, ShieldAlert, Copy, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Tables, Json } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;
type Account = Tables<"accounts">;

const STATUS_CONFIG = {
  connected: { label: "Connected", icon: CheckCircle2, variant: "default" as const, className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  degraded: { label: "Degraded", icon: AlertTriangle, variant: "secondary" as const, className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  disconnected: { label: "Disconnected", icon: XCircle, variant: "outline" as const, className: "bg-muted text-muted-foreground" },
};

function getMetaString(metadata: Json | null, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const val = (metadata as Record<string, Json | undefined>)[key];
  return typeof val === "string" ? val : null;
}

function getAccountSyncStatus(metadata: Json | null): { status: string; message: string | null } {
  const syncStatus = getMetaString(metadata, "sync_status");
  const syncError = getMetaString(metadata, "sync_error");
  if (syncStatus === "blocked" || syncStatus === "error") {
    return { status: syncStatus, message: syncError };
  }
  return { status: "ok", message: null };
}

/** Parse OAuth URL for diagnostic display */
function parseOAuthDiagnostics(url: string) {
  try {
    const parsed = new URL(url);
    return {
      redirectUri: parsed.searchParams.get("redirect_uri") || "MISSING",
      responseType: parsed.searchParams.get("response_type") || "MISSING",
      scope: parsed.searchParams.get("scope") || "MISSING",
      clientId: parsed.searchParams.get("client_id") ? "***configured***" : "MISSING",
      hasState: !!parsed.searchParams.get("state"),
      warnings: [
        ...(parsed.searchParams.get("response_type") !== "code" ? ["⚠ response_type no es 'code'"] : []),
        ...(!parsed.searchParams.get("redirect_uri") ? ["⚠ redirect_uri faltante"] : []),
        ...(!parsed.searchParams.get("scope") ? ["⚠ scope faltante"] : []),
      ],
    };
  } catch {
    return null;
  }
}

/** Default: top-level redirect */
function navigateTopLevel(url: string) {
  if (window.self !== window.top) {
    try {
      window.top!.location.href = url;
      return;
    } catch { /* cross-origin fallback */ }
  }
  window.location.assign(url);
}

/** Secondary: open in new tab */
function openInNewTab(url: string): boolean {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  return !!win;
}

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
  const [oauthDiag, setOauthDiag] = useState<{ url: string; diag: ReturnType<typeof parseOAuthDiagnostics> } | null>(null);
  const [oauthBlocked, setOauthBlocked] = useState(false);

  const refreshData = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const [intRes, accRes] = await Promise.all([
      supabase.from("integrations").select("*").eq("workspace_id", currentWorkspace.id).eq("provider", "meta").maybeSingle(),
      supabase.from("accounts").select("*").eq("workspace_id", currentWorkspace.id).eq("provider", "meta").order("name"),
    ]);
    setMetaIntegration(intRes.data);
    setMetaAccounts(accRes.data ?? []);
    setLoading(false);
  };

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
      searchParams.delete("oauth");
      searchParams.delete("status");
      searchParams.delete("message");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Fetch integration + accounts
  useEffect(() => {
    if (!currentWorkspace) { setLoading(false); return; }
    refreshData();
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
      setOauthDiag(null);
      setOauthBlocked(false);
      refreshData();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [currentWorkspace]);

  /** Fetch OAuth URL and navigate top-level (default) */
  const handleConnectMeta = async (forceReauth = false) => {
    if (!currentWorkspace || !session) return;
    setConnecting(true);
    setOauthBlocked(false);

    try {
      const { data, error } = await supabase.functions.invoke("oauth-start-meta", {
        body: { workspace_id: currentWorkspace.id, force_reauth: forceReauth },
      });

      if (error) throw error;
      if (data?.url) {
        const diag = parseOAuthDiagnostics(data.url);
        setOauthDiag({ url: data.url, diag });
        // Default: top-level redirect
        navigateTopLevel(data.url);
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

  /** Secondary: open in new tab */
  const handleOpenNewTab = () => {
    if (!oauthDiag?.url) return;
    const ok = openInNewTab(oauthDiag.url);
    if (!ok) {
      setOauthBlocked(true);
      toast({ title: "Popup bloqueado", description: "Permití popups o usá 'Copiar URL' y pegala en una pestaña nueva.", variant: "destructive" });
    }
  };

  /** Copy OAuth URL to clipboard */
  const handleCopyUrl = async () => {
    if (!oauthDiag?.url) return;
    try {
      await navigator.clipboard.writeText(oauthDiag.url);
      toast({ title: "URL copiada", description: "Pegala en una nueva pestaña del navegador." });
    } catch {
      toast({ title: "Error al copiar", description: "Copiá la URL manualmente desde el panel de diagnóstico.", variant: "destructive" });
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
      const failedCount = data?.failed_accounts?.length ?? 0;
      toast({
        title: "Sync completado",
        description: `${data?.upserted ?? 0} registros sincronizados.${failedCount ? ` ${failedCount} cuentas con errores.` : ""}`,
        variant: failedCount ? "destructive" : "default",
      });
      // Refresh to show updated per-account status
      refreshData();
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
      if (data?.errors?.length && data?.upserted === 0) {
        const errMsg = data.errors[0];
        const isCooldown = errMsg.includes("cooldown") || errMsg.includes("rate limit") || errMsg.includes("locked");
        setBackfillStatus(`bloqueado: ${errMsg}`);
        toast({ title: isCooldown ? "Backfill en cooldown" : "Backfill con errores", description: errMsg, variant: "destructive" });
      } else {
        const failedCount = data?.failed_accounts?.length ?? 0;
        setBackfillStatus(`success: ${data?.upserted ?? 0} rows${failedCount ? `, ${failedCount} cuentas fallidas` : ""}`);
        toast({
          title: "Backfill completado",
          description: `${data?.upserted ?? 0} registros sincronizados (${days} días).${failedCount ? ` ${failedCount} cuentas con errores.` : ""}`,
        });
      }
      refreshData();
    } catch (err) {
      setBackfillStatus(`fail: ${err instanceof Error ? err.message : "error"}`);
      toast({ title: "Error en backfill", description: err instanceof Error ? err.message : "No se pudo ejecutar el backfill", variant: "destructive" });
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
              <Button size="sm" variant="outline" onClick={handleSyncMeta} disabled={syncing || loading}>
                {syncing ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                {syncing ? "Sincronizando…" : "Sync Now"}
              </Button>
            )}

            {isAdmin && (
              <div className="flex items-center gap-1">
                <Button size="sm" onClick={() => handleConnectMeta(false)} disabled={connecting || loading}>
                  {connecting && <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  {metaIntegration ? "Reconectar" : "Conectar Meta"}
                </Button>
                {metaIntegration && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => handleConnectMeta(true)} disabled={connecting || loading}>
                        <ShieldAlert className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Force reauth: re-solicita permisos a Facebook. Usá esto si tenés cuentas bloqueadas o cambiaste de Business Manager.
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        {/* OAuth Diagnostic Panel */}
        {oauthDiag && (
          <div className="mx-6 mb-4 rounded-md border border-border bg-muted/30 p-3 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium flex items-center gap-1.5 text-sm">
                <Info className="h-4 w-4 text-muted-foreground" />
                OAuth Diagnóstico
              </span>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleOpenNewTab}>
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Abrir en nueva pestaña
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCopyUrl}>
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar URL
                </Button>
              </div>
            </div>

            {oauthDiag.diag && (
              <div className="space-y-1 font-mono">
                <p><span className="text-muted-foreground">redirect_uri:</span> {decodeURIComponent(oauthDiag.diag.redirectUri)}</p>
                <p><span className="text-muted-foreground">response_type:</span> {oauthDiag.diag.responseType}</p>
                <p><span className="text-muted-foreground">scope:</span> {oauthDiag.diag.scope}</p>
                <p><span className="text-muted-foreground">client_id:</span> {oauthDiag.diag.clientId}</p>
                <p><span className="text-muted-foreground">state:</span> {oauthDiag.diag.hasState ? "✓ presente" : "✗ FALTANTE"}</p>
                {oauthDiag.diag.warnings.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {oauthDiag.diag.warnings.map((w, i) => (
                      <p key={i} className="text-destructive font-sans font-medium">{w}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Blocked checklist */}
            {oauthBlocked && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 space-y-1.5">
                <p className="font-sans font-medium text-destructive">El navegador bloqueó la ventana de OAuth. Probá:</p>
                <ul className="list-disc list-inside font-sans space-y-0.5 text-foreground">
                  <li>Usá el botón <strong>"Copiar URL"</strong> y pegala en una pestaña nueva</li>
                  <li>Probá Chrome en perfil limpio / incógnito</li>
                  <li>Probá Edge sin extensiones</li>
                  <li>Desactivá adblockers (uBlock, AdGuard, etc.)</li>
                  <li>Si usás la Preview de Lovable, abrí la app publicada y conectá desde ahí</li>
                </ul>
              </div>
            )}
          </div>
        )}

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
                  <span>{metaIntegration.token_expires_at ? new Date(metaIntegration.token_expires_at).toLocaleDateString() : "—"}</span>
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
                    <Input type="number" min={1} max={90} value={backfillDays} onChange={(e) => setBackfillDays(Number(e.target.value))} className="w-24 h-8 text-sm" placeholder="days" />
                    <span className="text-xs text-muted-foreground">días</span>
                    <Button size="sm" variant="outline" onClick={handleBackfillMeta} disabled={backfilling}>
                      {backfilling ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                      Run Backfill
                    </Button>
                  </div>
                  {backfillStatus && (
                    <p className={`text-xs ${backfillStatus.startsWith("fail") || backfillStatus.startsWith("bloqueado") ? "text-destructive" : "text-muted-foreground"}`}>
                      Status: {backfillStatus}
                    </p>
                  )}
                </div>
              )}

              {metaAccounts.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Ad Accounts ({metaAccounts.length})</h3>
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium">Nombre</th>
                          <th className="px-3 py-2 text-left font-medium">Account ID</th>
                          <th className="px-3 py-2 text-left font-medium">Business</th>
                          <th className="px-3 py-2 text-left font-medium">Moneda</th>
                          <th className="px-3 py-2 text-left font-medium">Estado</th>
                          <th className="px-3 py-2 text-left font-medium">Sync</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metaAccounts.map((acct) => {
                          const businessName = getMetaString(acct.metadata, "business_name");
                          const businessId = getMetaString(acct.metadata, "business_id");
                          const { status: syncSt, message: syncMsg } = getAccountSyncStatus(acct.metadata);

                          return (
                            <tr key={acct.id} className="border-b last:border-0">
                              <td className="px-3 py-2">{acct.name}</td>
                              <td className="px-3 py-2 font-mono text-xs">{acct.external_account_id}</td>
                              <td className="px-3 py-2 text-xs">
                                {businessName ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help">{businessName}</span>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">ID: {businessId || "—"}</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2">{acct.currency ?? "—"}</td>
                              <td className="px-3 py-2">
                                <Badge variant={acct.status === "active" ? "default" : "secondary"} className="text-xs">
                                  {acct.status}
                                </Badge>
                              </td>
                              <td className="px-3 py-2">
                                {syncSt === "ok" ? (
                                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">OK</Badge>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="destructive" className="text-xs cursor-help">
                                        {syncSt === "blocked" ? "Blocked" : "Error"}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs text-xs">{syncMsg || "Error desconocido"}</TooltipContent>
                                  </Tooltip>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {metaAccounts.length === 0 && (
                <p className="text-sm text-muted-foreground">No se encontraron cuentas publicitarias.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "Conectá tu cuenta de Meta para descubrir cuentas publicitarias." : "Pedile a un admin que conecte Meta Ads."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Google Ads Card - Coming Soon */}
      <Card className="opacity-75">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg"><Plug className="h-5 w-5" />Google Ads</CardTitle>
            <CardDescription>Search, Display, Shopping & YouTube Ads</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">Coming next</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Requiere: OAuth Client ID/Secret, Developer Token. Scopes: <code className="text-xs font-mono">adwords</code>.</p>
        </CardContent>
      </Card>

      {/* GA4 Card - Coming Soon */}
      <Card className="opacity-75">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg"><Plug className="h-5 w-5" />Google Analytics 4</CardTitle>
            <CardDescription>Sessions, Transactions & Revenue</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">Coming next</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Requiere: OAuth Client ID/Secret. Scopes: <code className="text-xs font-mono">analytics.readonly</code>.</p>
        </CardContent>
      </Card>
    </div>
  );
}
