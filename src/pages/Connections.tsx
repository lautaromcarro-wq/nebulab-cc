import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plug, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Play, Clock, ExternalLink, ShieldAlert, Copy, Info, Stethoscope, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import type { Tables, Json } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;
type Account = Tables<"accounts">;

type AllowedBusiness = { id: string; workspace_id: string; business_id: string; business_name: string; enabled: boolean };
type AllowedAccount = { id: string; workspace_id: string; account_id: string; account_name: string; enabled: boolean };

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

function getMetaBool(metadata: Json | null, key: string): boolean | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const val = (metadata as Record<string, Json | undefined>)[key];
  return typeof val === "boolean" ? val : null;
}

function getAccountSyncStatus(metadata: Json | null): { status: string; message: string | null; lastError: Record<string, string> | null } {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return { status: "unknown", message: null, lastError: null };
  const m = metadata as Record<string, Json | undefined>;
  const syncStatus = typeof m.sync_status === "string" ? m.sync_status : "unknown";
  const syncError = typeof m.sync_error === "string" ? m.sync_error : null;
  const lastError = m.last_error && typeof m.last_error === "object" && !Array.isArray(m.last_error) ? m.last_error as Record<string, string> : null;
  if (syncStatus === "blocked" || syncStatus === "error" || syncStatus === "error_token") {
    return { status: syncStatus, message: syncError, lastError };
  }
  return { status: syncStatus === "ok" ? "ok" : "unknown", message: null, lastError: null };
}

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

function openAuthWindow(url: string): boolean {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  return !!win;
}

function navigateTopLevel(url: string) {
  if (window.self !== window.top) {
    try { window.top!.location.href = url; return; } catch { /* cross-origin */ }
  }
  window.location.assign(url);
}

type DiagResult = {
  account_id: string; external_id: string; name: string; status: string;
  error: { code?: string; subcode?: string; message?: string; fbtrace_id?: string } | null;
  business: { id: string; name: string } | null;
};

export default function Connections() {
  const { currentWorkspace, workspaceRole } = useWorkspace();
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [metaIntegration, setMetaIntegration] = useState<Integration | null>(null);
  const [metaAccounts, setMetaAccounts] = useState<Account[]>([]);
  const [googleIntegration, setGoogleIntegration] = useState<Integration | null>(null);
  const [googleAccounts, setGoogleAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [backfillDays, setBackfillDays] = useState(30);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
  const [googleBackfillDays, setGoogleBackfillDays] = useState(30);
  const [googleBackfilling, setGoogleBackfilling] = useState(false);
  const [googleBackfillStatus, setGoogleBackfillStatus] = useState<string | null>(null);
  const [oauthDiag, setOauthDiag] = useState<{ url: string; diag: ReturnType<typeof parseOAuthDiagnostics>; provider: string } | null>(null);
  const [oauthBlocked, setOauthBlocked] = useState(false);
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResults, setDiagResults] = useState<DiagResult[] | null>(null);

  // BM/Account allowlist state
  const [allowedBusinesses, setAllowedBusinesses] = useState<AllowedBusiness[]>([]);
  const [allowedAccounts, setAllowedAccounts] = useState<AllowedAccount[]>([]);
  const [savingAllowlist, setSavingAllowlist] = useState(false);

  const refreshData = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const [intMetaRes, intGoogleRes, accMetaRes, accGoogleRes, bizRes, acctRes] = await Promise.all([
      supabase.from("integrations").select("*").eq("workspace_id", currentWorkspace.id).eq("provider", "meta").maybeSingle(),
      supabase.from("integrations").select("*").eq("workspace_id", currentWorkspace.id).eq("provider", "google_ads").maybeSingle(),
      supabase.from("accounts").select("*").eq("workspace_id", currentWorkspace.id).eq("provider", "meta").order("name"),
      supabase.from("accounts").select("*").eq("workspace_id", currentWorkspace.id).eq("provider", "google_ads").order("name"),
      supabase.from("meta_allowed_businesses").select("*").eq("workspace_id", currentWorkspace.id).order("business_name"),
      supabase.from("meta_allowed_accounts").select("*").eq("workspace_id", currentWorkspace.id),
    ]);
    setMetaIntegration(intMetaRes.data);
    setGoogleIntegration(intGoogleRes.data);
    setMetaAccounts(accMetaRes.data ?? []);
    setGoogleAccounts(accGoogleRes.data ?? []);
    setAllowedBusinesses((bizRes.data as AllowedBusiness[] | null) ?? []);
    setAllowedAccounts((acctRes.data as AllowedAccount[] | null) ?? []);
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => {
    const oauthProvider = searchParams.get("oauth");
    const status = searchParams.get("status");
    const message = searchParams.get("message");
    if (oauthProvider === "meta") {
      if (status === "success") toast({ title: "Meta conectado", description: "Cuentas publicitarias descubiertas exitosamente." });
      else if (status === "error") toast({ title: "Error al conectar Meta", description: message || "Ocurrió un error.", variant: "destructive" });
      searchParams.delete("oauth"); searchParams.delete("status"); searchParams.delete("message");
      setSearchParams(searchParams, { replace: true });
    }
    if (oauthProvider === "google_ads") {
      if (status === "success") toast({ title: "Google Ads conectado", description: "Cuentas descubiertas exitosamente." });
      else if (status === "error") toast({ title: "Error al conectar Google Ads", description: message || "Ocurrió un error.", variant: "destructive" });
      searchParams.delete("oauth"); searchParams.delete("status"); searchParams.delete("message");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!currentWorkspace) { setLoading(false); return; }
    refreshData();
  }, [currentWorkspace, refreshData]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'oauth-complete') return;
      const provider = event.data.provider;
      if (provider === 'meta') {
        if (event.data.status === 'success') toast({ title: "Meta conectado", description: "Cuentas publicitarias descubiertas exitosamente." });
        else toast({ title: "Error al conectar Meta", description: event.data.message || "Ocurrió un error.", variant: "destructive" });
        setConnecting(false);
      } else if (provider === 'google_ads') {
        if (event.data.status === 'success') toast({ title: "Google Ads conectado", description: "Cuentas descubiertas exitosamente." });
        else toast({ title: "Error al conectar Google Ads", description: event.data.message || "Ocurrió un error.", variant: "destructive" });
        setConnectingGoogle(false);
      }
      setOauthDiag(null); setOauthBlocked(false); refreshData();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [refreshData]);

  // ── Meta handlers ──
  const handleConnectMeta = async (forceReauth = false) => {
    if (!currentWorkspace || !session) return;
    setConnecting(true); setOauthBlocked(false);
    try {
      const { data, error } = await supabase.functions.invoke("oauth-start-meta", {
        body: { workspace_id: currentWorkspace.id, force_reauth: forceReauth },
      });
      if (error) throw error;
      if (data?.url) {
        const diag = parseOAuthDiagnostics(data.url);
        setOauthDiag({ url: data.url, diag, provider: "meta" });
        const ok = openAuthWindow(data.url);
        if (!ok) { setOauthBlocked(true); navigateTopLevel(data.url); }
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo iniciar OAuth", variant: "destructive" });
      setConnecting(false);
    }
  };

  // ── Google Ads handlers ──
  const handleConnectGoogle = async () => {
    if (!currentWorkspace || !session) return;
    setConnectingGoogle(true); setOauthBlocked(false);
    try {
      const { data, error } = await supabase.functions.invoke("oauth-start-google-ads", {
        body: { workspace_id: currentWorkspace.id },
      });
      if (error) throw error;
      if (data?.url) {
        const diag = parseOAuthDiagnostics(data.url);
        setOauthDiag({ url: data.url, diag, provider: "google_ads" });
        const ok = openAuthWindow(data.url);
        if (!ok) { setOauthBlocked(true); navigateTopLevel(data.url); }
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo iniciar OAuth", variant: "destructive" });
      setConnectingGoogle(false);
    }
  };

  const handleSyncGoogle = async () => {
    if (!currentWorkspace || !session) return;
    setSyncingGoogle(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-google-daily", {
        body: { workspace_id: currentWorkspace.id, days_back: 3 },
      });
      if (error) throw error;
      const failedCount = data?.failed_accounts?.length ?? 0;
      toast({ title: "Sync completado", description: `${data?.upserted ?? 0} registros.${failedCount ? ` ${failedCount} cuentas con errores.` : ""}`, variant: failedCount ? "destructive" : "default" });
      refreshData();
    } catch (err) {
      toast({ title: "Error al sincronizar", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setSyncingGoogle(false); }
  };

  const handleBackfillGoogle = async () => {
    if (!currentWorkspace || !session) return;
    const days = Math.min(Math.max(1, googleBackfillDays), 90);
    setGoogleBackfilling(true); setGoogleBackfillStatus("started");
    try {
      const { data, error } = await supabase.functions.invoke("sync-google-daily", {
        body: { workspace_id: currentWorkspace.id, days_back: days, triggered_by: "manual" },
      });
      if (error) throw error;
      if (data?.errors?.length && data?.upserted === 0) {
        setGoogleBackfillStatus(`bloqueado: ${data.errors[0]}`);
        toast({ title: "Backfill con errores", description: data.errors[0], variant: "destructive" });
      } else {
        const failedCount = data?.failed_accounts?.length ?? 0;
        setGoogleBackfillStatus(`success: ${data?.upserted ?? 0} rows${failedCount ? `, ${failedCount} fallidas` : ""}`);
        toast({ title: "Backfill completado", description: `${data?.upserted ?? 0} registros (${days} días).` });
      }
      refreshData();
    } catch (err) {
      setGoogleBackfillStatus(`fail: ${err instanceof Error ? err.message : "error"}`);
      toast({ title: "Error en backfill", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setGoogleBackfilling(false); }
  };

  const handleToggleGoogleAccountEnabled = async (acct: Account) => {
    if (!currentWorkspace) return;
    setSavingAllowlist(true);
    try {
      const meta = (acct.metadata as Record<string, Json | undefined>) || {};
      const currentlyEnabled = getMetaBool(acct.metadata, "enabled") !== false;
      const newMeta = { ...meta, enabled: !currentlyEnabled };
      const { error } = await supabase.from("accounts").update({ metadata: newMeta }).eq("id", acct.id);
      if (error) throw error;
      setGoogleAccounts(prev => prev.map(a => a.id === acct.id ? { ...a, metadata: newMeta } : a));
      toast({ title: `Cuenta ${!currentlyEnabled ? "habilitada" : "deshabilitada"} para sync` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setSavingAllowlist(false); }
  };

  const handleOpenNewTab = () => {
    if (!oauthDiag?.url) return;
    const ok = openAuthWindow(oauthDiag.url);
    if (!ok) { setOauthBlocked(true); toast({ title: "Popup bloqueado", description: "Usá 'Copiar URL' y pegala en una pestaña nueva.", variant: "destructive" }); }
  };

  const handleCopyUrl = async () => {
    if (!oauthDiag?.url) return;
    try { await navigator.clipboard.writeText(oauthDiag.url); toast({ title: "URL copiada" }); } catch { toast({ title: "Error al copiar", variant: "destructive" }); }
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
      toast({ title: "Sync completado", description: `${data?.upserted ?? 0} registros.${failedCount ? ` ${failedCount} cuentas con errores.` : ""}`, variant: failedCount ? "destructive" : "default" });
      refreshData();
    } catch (err) {
      toast({ title: "Error al sincronizar", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setSyncing(false); }
  };

  const handleBackfillMeta = async () => {
    if (!currentWorkspace || !session) return;
    const days = Math.min(Math.max(1, backfillDays), 90);
    setBackfilling(true); setBackfillStatus("started");
    try {
      const { data, error } = await supabase.functions.invoke("sync-meta-daily", {
        body: { workspace_id: currentWorkspace.id, days_back: days, triggered_by: "manual" },
      });
      if (error) throw error;
      if (data?.errors?.length && data?.upserted === 0) {
        setBackfillStatus(`bloqueado: ${data.errors[0]}`);
        toast({ title: "Backfill con errores", description: data.errors[0], variant: "destructive" });
      } else {
        const failedCount = data?.failed_accounts?.length ?? 0;
        setBackfillStatus(`success: ${data?.upserted ?? 0} rows${failedCount ? `, ${failedCount} fallidas` : ""}`);
        toast({ title: "Backfill completado", description: `${data?.upserted ?? 0} registros (${days} días).` });
      }
      refreshData();
    } catch (err) {
      setBackfillStatus(`fail: ${err instanceof Error ? err.message : "error"}`);
      toast({ title: "Error en backfill", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setBackfilling(false); }
  };

  const handleRunDiagnostics = async () => {
    if (!currentWorkspace || !session) return;
    setDiagRunning(true); setDiagResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("meta-diagnostics", {
        body: { workspace_id: currentWorkspace.id },
      });
      if (error) throw error;
      setDiagResults(data?.results || []);
      toast({ title: "Diagnóstico completo", description: `${data?.results?.length || 0} cuentas verificadas.` });
      refreshData();
    } catch (err) {
      toast({ title: "Error en diagnóstico", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setDiagRunning(false); }
  };

  // ── BM/Account allowlist handlers ──
  const handleToggleBusiness = async (biz: AllowedBusiness) => {
    if (!currentWorkspace) return;
    setSavingAllowlist(true);
    try {
      const { error } = await supabase.from("meta_allowed_businesses")
        .update({ enabled: !biz.enabled }).eq("id", biz.id);
      if (error) throw error;
      setAllowedBusinesses(prev => prev.map(b => b.id === biz.id ? { ...b, enabled: !b.enabled } : b));
      toast({ title: `BM "${biz.business_name}" ${!biz.enabled ? "habilitado" : "deshabilitado"}` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setSavingAllowlist(false); }
  };

  const handleToggleAccountOverride = async (acct: Account) => {
    if (!currentWorkspace) return;
    setSavingAllowlist(true);
    const existing = allowedAccounts.find(a => a.account_id === acct.id);
    try {
      if (existing) {
        const { error } = await supabase.from("meta_allowed_accounts")
          .update({ enabled: !existing.enabled }).eq("id", existing.id);
        if (error) throw error;
        setAllowedAccounts(prev => prev.map(a => a.id === existing.id ? { ...a, enabled: !a.enabled } : a));
      } else {
        const { data, error } = await supabase.from("meta_allowed_accounts")
          .insert({ workspace_id: currentWorkspace.id, account_id: acct.id, account_name: acct.name, enabled: true })
          .select().single();
        if (error) throw error;
        if (data) setAllowedAccounts(prev => [...prev, data as AllowedAccount]);
      }
      toast({ title: "Override actualizado" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setSavingAllowlist(false); }
  };

  const handleRemoveAccountOverride = async (overrideId: string) => {
    setSavingAllowlist(true);
    try {
      const { error } = await supabase.from("meta_allowed_accounts").delete().eq("id", overrideId);
      if (error) throw error;
      setAllowedAccounts(prev => prev.filter(a => a.id !== overrideId));
      toast({ title: "Override eliminado" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setSavingAllowlist(false); }
  };

  const isAdmin = workspaceRole === "admin";
  const metaStatusKey = metaIntegration?.status ?? "disconnected";
  const metaStatusInfo = STATUS_CONFIG[metaStatusKey as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.disconnected;
  const MetaStatusIcon = metaStatusInfo.icon;

  const googleStatusKey = googleIntegration?.status ?? "disconnected";
  const googleStatusInfo = STATUS_CONFIG[googleStatusKey as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.disconnected;
  const GoogleStatusIcon = googleStatusInfo.icon;

  // Group Meta accounts by business
  const accountsByBusiness = metaAccounts.reduce<Record<string, { bizName: string; bizId: string; accounts: Account[] }>>((acc, acct) => {
    const bizId = getMetaString(acct.metadata, "business_id") || "__none__";
    const bizName = getMetaString(acct.metadata, "business_name") || "Sin Business Manager";
    if (!acc[bizId]) acc[bizId] = { bizName, bizId, accounts: [] };
    acc[bizId].accounts.push(acct);
    return acc;
  }, {});

  const getAccountSyncEnabled = (acct: Account): { enabled: boolean; source: "biz" | "override" | "default" } => {
    const override = allowedAccounts.find(a => a.account_id === acct.id);
    if (override) return { enabled: override.enabled, source: "override" };
    const bizId = getMetaString(acct.metadata, "business_id");
    if (bizId) {
      const biz = allowedBusinesses.find(b => b.business_id === bizId);
      if (biz) return { enabled: biz.enabled, source: "biz" };
    }
    return { enabled: allowedBusinesses.length === 0, source: "default" };
  };

  const getSyncBadge = (status: string, message: string | null, lastError: Record<string, string> | null) => {
    if (status === "ok") return <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">OK</Badge>;
    if (status === "unknown") return <Badge variant="outline" className="text-xs">—</Badge>;
    const label = status === "blocked" ? "Blocked" : status === "error_token" ? "Token Error" : "Error";
    const tooltipContent = lastError
      ? `Code: ${lastError.code || "—"}, Subcode: ${lastError.subcode || "—"}\n${lastError.message || message || "Error desconocido"}${lastError.fbtrace_id ? `\nTrace: ${lastError.fbtrace_id}` : ""}`
      : message || "Error desconocido";
    return (
      <Tooltip>
        <TooltipTrigger asChild><Badge variant="destructive" className="text-xs cursor-help">{label}</Badge></TooltipTrigger>
        <TooltipContent className="max-w-sm text-xs whitespace-pre-wrap font-mono">{tooltipContent}</TooltipContent>
      </Tooltip>
    );
  };

  const enabledBizCount = allowedBusinesses.filter(b => b.enabled).length;
  const hasAllowlistConfig = allowedBusinesses.length > 0;

  // Google accounts: separate managers vs clients
  const googleClientAccounts = googleAccounts.filter(a => getMetaBool(a.metadata, "manager") !== true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Connections</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestioná tus integraciones con plataformas de ads.</p>
      </div>

      {/* OAuth Diagnostic Panel (shared) */}
      {oauthDiag && (
        <Card>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium flex items-center gap-1.5 text-sm"><Info className="h-4 w-4 text-muted-foreground" />OAuth Diagnóstico ({oauthDiag.provider})</span>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleOpenNewTab}><ExternalLink className="h-3 w-3 mr-1" />Abrir en nueva pestaña</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCopyUrl}><Copy className="h-3 w-3 mr-1" />Copiar URL</Button>
              </div>
            </div>
            {oauthDiag.diag && (
              <div className="space-y-1 font-mono">
                <p><span className="text-muted-foreground">redirect_uri:</span> {decodeURIComponent(oauthDiag.diag.redirectUri)}</p>
                <p><span className="text-muted-foreground">response_type:</span> {oauthDiag.diag.responseType}</p>
                <p><span className="text-muted-foreground">scope:</span> {oauthDiag.diag.scope}</p>
                <p><span className="text-muted-foreground">client_id:</span> {oauthDiag.diag.clientId}</p>
                <p><span className="text-muted-foreground">state:</span> {oauthDiag.diag.hasState ? "✓ presente" : "✗ FALTANTE"}</p>
              </div>
            )}
            {oauthBlocked && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 space-y-1.5">
                <p className="font-sans font-medium text-destructive">El navegador bloqueó la ventana de OAuth. Probá:</p>
                <ul className="list-disc list-inside font-sans space-y-0.5 text-foreground">
                  <li>Usá el botón <strong>"Copiar URL"</strong> y pegala en una pestaña nueva</li>
                  <li>Probá Chrome en perfil limpio / incógnito</li>
                  <li>Desactivá adblockers (uBlock, AdGuard, etc.)</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Meta Ads Card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg"><Plug className="h-5 w-5" />Meta Ads</CardTitle>
            <CardDescription>Facebook & Instagram Ads · Scopes: ads_read, business_management</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={metaStatusInfo.className}><MetaStatusIcon className="h-3 w-3 mr-1" />{metaStatusInfo.label}</Badge>
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
                    <TooltipContent className="max-w-xs text-xs">Force reauth: re-solicita permisos.</TooltipContent>
                  </Tooltip>
                )}
              </div>
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
                <div><span className="text-muted-foreground">Scopes:</span> <span className="font-mono text-xs">{metaIntegration.scopes?.join(", ") || "—"}</span></div>
                <div><span className="text-muted-foreground">Token expira:</span> <span>{metaIntegration.token_expires_at ? new Date(metaIntegration.token_expires_at).toLocaleDateString() : "—"}</span></div>
              </div>

              {/* BM Selection */}
              {isAdmin && allowedBusinesses.length > 0 && (
                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Business Managers</span>
                      <Badge variant="outline" className="text-xs">{enabledBizCount}/{allowedBusinesses.length} habilitados</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Seleccioná qué BMs se sincronizan.</p>
                  {!hasAllowlistConfig && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />Sin configuración: todas las cuentas se sincronizan por defecto.
                    </div>
                  )}
                  <div className="space-y-2">
                    {allowedBusinesses.map((biz) => {
                      const bizAccounts = accountsByBusiness[biz.business_id]?.accounts || [];
                      return (
                        <div key={biz.id} className="rounded-md border p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Switch checked={biz.enabled} onCheckedChange={() => handleToggleBusiness(biz)} disabled={savingAllowlist} />
                              <span className="text-sm font-medium">{biz.business_name || biz.business_id}</span>
                              <span className="text-xs text-muted-foreground font-mono">({biz.business_id})</span>
                            </div>
                            <Badge variant="outline" className="text-xs">{bizAccounts.length} cuentas</Badge>
                          </div>
                          {bizAccounts.length > 0 && (
                            <div className="ml-8 space-y-1">
                              {bizAccounts.map((acct) => {
                                const syncInfo = getAccountSyncEnabled(acct);
                                const override = allowedAccounts.find(a => a.account_id === acct.id);
                                const { status: syncSt, message: syncMsg, lastError } = getAccountSyncStatus(acct.metadata);
                                return (
                                  <div key={acct.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                                    <div className="flex items-center gap-2">
                                      <span className={syncInfo.enabled ? "text-foreground" : "text-muted-foreground line-through"}>{acct.name}</span>
                                      <span className="text-muted-foreground font-mono">({acct.external_account_id})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {getSyncBadge(syncSt, syncMsg, lastError)}
                                      {override ? (
                                        <div className="flex items-center gap-1">
                                          <Badge variant="secondary" className="text-[10px]">{override.enabled ? "Override: ON" : "Override: OFF"}</Badge>
                                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveAccountOverride(override.id)} disabled={savingAllowlist}>
                                            <XCircle className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 text-muted-foreground" onClick={() => handleToggleAccountOverride(acct)} disabled={savingAllowlist}>
                                              Override
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent className="text-xs">Crear override per-account</TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {accountsByBusiness["__none__"] && (
                    <div className="rounded-md border border-dashed p-2.5 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <AlertTriangle className="h-3.5 w-3.5" /> Sin Business Manager
                      </div>
                      <div className="ml-6 space-y-1">
                        {accountsByBusiness["__none__"].accounts.map((acct) => {
                          const override = allowedAccounts.find(a => a.account_id === acct.id);
                          const syncInfo = getAccountSyncEnabled(acct);
                          return (
                            <div key={acct.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                              <span className={syncInfo.enabled ? "text-foreground" : "text-muted-foreground line-through"}>{acct.name} <span className="font-mono text-muted-foreground">({acct.external_account_id})</span></span>
                              <div className="flex items-center gap-1">
                                {override ? (
                                  <>
                                    <Badge variant="secondary" className="text-[10px]">{override.enabled ? "ON" : "OFF"}</Badge>
                                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => handleRemoveAccountOverride(override.id)} disabled={savingAllowlist}><XCircle className="h-3 w-3" /></Button>
                                  </>
                                ) : (
                                  <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={() => handleToggleAccountOverride(acct)} disabled={savingAllowlist}>Override</Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {enabledBizCount === 0 && allowedAccounts.filter(a => a.enabled).length === 0 && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />Ningún BM habilitado.
                    </div>
                  )}
                </div>
              )}

              {/* Backfill Meta */}
              {isAdmin && metaIntegration.status === "connected" && (
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Backfill Meta</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={90} value={backfillDays} onChange={(e) => setBackfillDays(Number(e.target.value))} className="w-24 h-8 text-sm" />
                    <span className="text-xs text-muted-foreground">días</span>
                    <Button size="sm" variant="outline" onClick={handleBackfillMeta} disabled={backfilling}>
                      {backfilling ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}Run Backfill
                    </Button>
                  </div>
                  {backfillStatus && <p className={`text-xs ${backfillStatus.startsWith("fail") || backfillStatus.startsWith("bloqueado") ? "text-destructive" : "text-muted-foreground"}`}>Status: {backfillStatus}</p>}
                </div>
              )}

              {/* Meta Diagnostics */}
              {isAdmin && metaIntegration.status === "connected" && (
                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">Meta Diagnostics</span></div>
                    <Button size="sm" variant="outline" onClick={handleRunDiagnostics} disabled={diagRunning}>
                      {diagRunning ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Stethoscope className="h-3.5 w-3.5 mr-1.5" />}
                      {diagRunning ? "Verificando…" : "Verificar acceso"}
                    </Button>
                  </div>
                  {diagResults && (
                    <div className="rounded-md border overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b bg-muted/50"><th className="px-2 py-1.5 text-left font-medium">Account</th><th className="px-2 py-1.5 text-left font-medium">Business</th><th className="px-2 py-1.5 text-left font-medium">Status</th><th className="px-2 py-1.5 text-left font-medium">Error</th></tr></thead>
                        <tbody>{diagResults.map((r) => (
                          <tr key={r.account_id} className="border-b last:border-0">
                            <td className="px-2 py-1.5">{r.name} <span className="text-muted-foreground font-mono">({r.external_id})</span></td>
                            <td className="px-2 py-1.5">{r.business ? r.business.name : "—"}</td>
                            <td className="px-2 py-1.5">{r.status === "ok" ? <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">OK</Badge> : <Badge variant="destructive" className="text-xs">{r.status === "blocked" ? "Blocked" : "Error"}</Badge>}</td>
                            <td className="px-2 py-1.5 font-mono max-w-xs truncate">{r.error?.message || "—"}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Ad Accounts table (no-BM fallback) */}
              {metaAccounts.length > 0 && allowedBusinesses.length === 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Ad Accounts ({metaAccounts.length})</h3>
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/50"><th className="px-3 py-2 text-left font-medium">Nombre</th><th className="px-3 py-2 text-left font-medium">Account ID</th><th className="px-3 py-2 text-left font-medium">Business</th><th className="px-3 py-2 text-left font-medium">Moneda</th><th className="px-3 py-2 text-left font-medium">Estado</th><th className="px-3 py-2 text-left font-medium">Sync</th></tr></thead>
                      <tbody>{metaAccounts.map((acct) => {
                        const businessName = getMetaString(acct.metadata, "business_name");
                        const businessId = getMetaString(acct.metadata, "business_id");
                        const { status: syncSt, message: syncMsg, lastError } = getAccountSyncStatus(acct.metadata);
                        return (
                          <tr key={acct.id} className="border-b last:border-0">
                            <td className="px-3 py-2">{acct.name}</td>
                            <td className="px-3 py-2 font-mono text-xs">{acct.external_account_id}</td>
                            <td className="px-3 py-2 text-xs">{businessName || <span className="text-muted-foreground">—</span>}</td>
                            <td className="px-3 py-2">{acct.currency ?? "—"}</td>
                            <td className="px-3 py-2"><Badge variant={acct.status === "active" ? "default" : "secondary"} className="text-xs">{acct.status}</Badge></td>
                            <td className="px-3 py-2">{getSyncBadge(syncSt, syncMsg, lastError)}</td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {metaAccounts.length === 0 && <p className="text-sm text-muted-foreground">No se encontraron cuentas publicitarias.</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{isAdmin ? "Conectá tu cuenta de Meta para descubrir cuentas publicitarias." : "Pedile a un admin que conecte Meta Ads."}</p>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ Google Ads Card ═══════════ */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg"><Plug className="h-5 w-5" />Google Ads</CardTitle>
            <CardDescription>Search, Display, Shopping & YouTube Ads · Scope: adwords</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={googleStatusInfo.className}><GoogleStatusIcon className="h-3 w-3 mr-1" />{googleStatusInfo.label}</Badge>
            {isAdmin && googleIntegration?.status === "connected" && (
              <Button size="sm" variant="outline" onClick={handleSyncGoogle} disabled={syncingGoogle || loading}>
                {syncingGoogle ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                {syncingGoogle ? "Sincronizando…" : "Sync Now"}
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" onClick={handleConnectGoogle} disabled={connectingGoogle || loading}>
                {connectingGoogle && <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {googleIntegration ? "Reconectar" : "Conectar Google"}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {!currentWorkspace ? (
            <p className="text-sm text-muted-foreground">Seleccioná un workspace.</p>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : googleIntegration ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Scopes:</span> <span className="font-mono text-xs">{googleIntegration.scopes?.join(", ") || "—"}</span></div>
                <div><span className="text-muted-foreground">Token expira:</span> <span>{googleIntegration.token_expires_at ? new Date(googleIntegration.token_expires_at).toLocaleDateString() : "—"}</span></div>
              </div>

              {/* Google Accounts table with Enabled toggle */}
              {googleClientAccounts.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Accounts Discovered ({googleClientAccounts.length})</h3>
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium">Enabled</th>
                          <th className="px-3 py-2 text-left font-medium">Nombre</th>
                          <th className="px-3 py-2 text-left font-medium">Customer ID</th>
                          <th className="px-3 py-2 text-left font-medium">Moneda</th>
                          <th className="px-3 py-2 text-left font-medium">Timezone</th>
                          <th className="px-3 py-2 text-left font-medium">Estado</th>
                          <th className="px-3 py-2 text-left font-medium">Sync</th>
                        </tr>
                      </thead>
                      <tbody>{googleClientAccounts.map((acct) => {
                        const isEnabled = getMetaBool(acct.metadata, "enabled") !== false;
                        const { status: syncSt, message: syncMsg, lastError } = getAccountSyncStatus(acct.metadata);
                        return (
                          <tr key={acct.id} className="border-b last:border-0">
                            <td className="px-3 py-2">
                              {isAdmin ? (
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={() => handleToggleGoogleAccountEnabled(acct)}
                                  disabled={savingAllowlist}
                                />
                              ) : (
                                <Badge variant={isEnabled ? "default" : "secondary"} className="text-xs">{isEnabled ? "ON" : "OFF"}</Badge>
                              )}
                            </td>
                            <td className={`px-3 py-2 ${!isEnabled ? "text-muted-foreground line-through" : ""}`}>{acct.name}</td>
                            <td className="px-3 py-2 font-mono text-xs">{acct.external_account_id}</td>
                            <td className="px-3 py-2">{acct.currency ?? "—"}</td>
                            <td className="px-3 py-2 text-xs">{acct.timezone ?? "—"}</td>
                            <td className="px-3 py-2"><Badge variant={acct.status === "active" ? "default" : "secondary"} className="text-xs">{acct.status}</Badge></td>
                            <td className="px-3 py-2">{getSyncBadge(syncSt, syncMsg, lastError)}</td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Backfill Google */}
              {isAdmin && googleIntegration.status === "connected" && (
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Backfill Google Ads</span>
                    <Tooltip><TooltipTrigger asChild><span className="text-muted-foreground text-xs cursor-help">(?)</span></TooltipTrigger><TooltipContent className="max-w-xs text-xs">Máximo 90 días. Cooldown: 1 backfill cada 6h.</TooltipContent></Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={90} value={googleBackfillDays} onChange={(e) => setGoogleBackfillDays(Number(e.target.value))} className="w-24 h-8 text-sm" />
                    <span className="text-xs text-muted-foreground">días</span>
                    <Button size="sm" variant="outline" onClick={handleBackfillGoogle} disabled={googleBackfilling}>
                      {googleBackfilling ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}Run Backfill
                    </Button>
                  </div>
                  {googleBackfillStatus && <p className={`text-xs ${googleBackfillStatus.startsWith("fail") || googleBackfillStatus.startsWith("bloqueado") ? "text-destructive" : "text-muted-foreground"}`}>Status: {googleBackfillStatus}</p>}
                </div>
              )}

              {googleClientAccounts.length === 0 && <p className="text-sm text-muted-foreground">No se encontraron cuentas clientes.</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{isAdmin ? "Conectá tu cuenta de Google Ads para descubrir cuentas publicitarias." : "Pedile a un admin que conecte Google Ads."}</p>
          )}
        </CardContent>
      </Card>

      {/* GA4 Card */}
      <Card className="opacity-75">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1"><CardTitle className="flex items-center gap-2 text-lg"><Plug className="h-5 w-5" />Google Analytics 4</CardTitle><CardDescription>Sessions, Transactions & Revenue</CardDescription></div>
          <Badge variant="outline" className="text-xs">Coming next</Badge>
        </CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Requiere: OAuth Client ID/Secret. Scopes: <code className="text-xs font-mono">analytics.readonly</code>.</p></CardContent>
      </Card>
    </div>
  );
}
