import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plug, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Play, Clock, ExternalLink, ShieldAlert, Copy, Info, Stethoscope, Building2, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import type { Tables, Json } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;
type Account = Tables<"accounts">;

type AccountSetting = {
  id: string;
  workspace_id: string;
  provider: string;
  external_id: string;
  external_group_id: string | null;
  external_group_name: string | null;
  account_name: string;
  is_enabled: boolean;
};

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
  const [ga4Integration, setGa4Integration] = useState<Integration | null>(null);
  const [ga4Accounts, setGa4Accounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [connectingGa4, setConnectingGa4] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [syncingGa4, setSyncingGa4] = useState(false);
  const [backfillDays, setBackfillDays] = useState(30);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
  const [googleBackfillDays, setGoogleBackfillDays] = useState(30);
  const [googleBackfilling, setGoogleBackfilling] = useState(false);
  const [googleBackfillStatus, setGoogleBackfillStatus] = useState<string | null>(null);
  const [ga4BackfillDays, setGa4BackfillDays] = useState(30);
  const [ga4Backfilling, setGa4Backfilling] = useState(false);
  const [ga4BackfillStatus, setGa4BackfillStatus] = useState<string | null>(null);
  const [oauthDiag, setOauthDiag] = useState<{ url: string; diag: ReturnType<typeof parseOAuthDiagnostics>; provider: string } | null>(null);
  const [oauthBlocked, setOauthBlocked] = useState(false);
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResults, setDiagResults] = useState<DiagResult[] | null>(null);

  // Unified account settings
  const [accountSettings, setAccountSettings] = useState<AccountSetting[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  // Google Ads: show managers toggle
  const [showGoogleManagers, setShowGoogleManagers] = useState(false);
  // Google Ads: discovery state
  const [discovering, setDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<Record<string, unknown> | null>(null);

  const refreshData = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const [intMetaRes, intGoogleRes, intGa4Res, accMetaRes, accGoogleRes, accGa4Res, settingsRes] = await Promise.all([
      supabase.from("integrations").select("*").eq("workspace_id", currentWorkspace.id).eq("provider", "meta").maybeSingle(),
      supabase.from("integrations").select("*").eq("workspace_id", currentWorkspace.id).eq("provider", "google_ads").maybeSingle(),
      supabase.from("integrations").select("*").eq("workspace_id", currentWorkspace.id).eq("provider", "ga4").maybeSingle(),
      supabase.from("accounts").select("*").eq("workspace_id", currentWorkspace.id).eq("provider", "meta").order("name"),
      supabase.from("accounts").select("*").eq("workspace_id", currentWorkspace.id).eq("provider", "google_ads").order("name"),
      supabase.from("accounts").select("*").eq("workspace_id", currentWorkspace.id).eq("provider", "ga4").order("name"),
      supabase.from("workspace_account_settings").select("*").eq("workspace_id", currentWorkspace.id),
    ]);
    setMetaIntegration(intMetaRes.data);
    setGoogleIntegration(intGoogleRes.data);
    setGa4Integration(intGa4Res.data);
    setMetaAccounts(accMetaRes.data ?? []);
    setGoogleAccounts(accGoogleRes.data ?? []);
    setGa4Accounts(accGa4Res.data ?? []);
    setAccountSettings((settingsRes.data as AccountSetting[] | null) ?? []);
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
      const corrId = searchParams.get("correlation_id");
      if (status === "success") {
        toast({ title: "Google Ads conectado", description: "Cuentas descubiertas exitosamente." });
      } else if (status === "error") {
        const debugInfo = corrId ? `\n\nCorrelation ID: ${corrId}` : "";
        toast({
          title: "Error al conectar Google Ads",
          description: (message || "Ocurrió un error.") + debugInfo,
          variant: "destructive",
          action: corrId ? (
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => {
              navigator.clipboard.writeText(`correlation_id: ${corrId}\nerror: ${message || "unknown"}\nprovider: google_ads`);
              toast({ title: "Debug info copiada" });
            }}>
              <Copy className="h-3 w-3 mr-1" /> Copy debug
            </Button>
          ) : undefined,
        });
      }
      searchParams.delete("oauth"); searchParams.delete("status"); searchParams.delete("message"); searchParams.delete("correlation_id");
      setSearchParams(searchParams, { replace: true });
    }
    if (oauthProvider === "ga4") {
      if (status === "success") toast({ title: "GA4 conectado", description: "Properties descubiertas exitosamente." });
      else if (status === "error") toast({ title: "Error al conectar GA4", description: message || "Ocurrió un error.", variant: "destructive" });
      searchParams.delete("oauth"); searchParams.delete("status"); searchParams.delete("message"); searchParams.delete("correlation_id");
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
      } else if (provider === 'ga4') {
        if (event.data.status === 'success') toast({ title: "GA4 conectado", description: "Properties descubiertas." });
        else toast({ title: "Error al conectar GA4", description: event.data.message || "Error.", variant: "destructive" });
        setConnectingGa4(false);
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
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "hagggvnmwsnshkofhmmq";
      const startUrl = `https://${projectId}.supabase.co/functions/v1/oauth-start-google-ads?workspace_id=${encodeURIComponent(currentWorkspace.id)}`;
      const link = document.createElement("a");
      link.href = startUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo iniciar OAuth", variant: "destructive" });
    } finally {
      setTimeout(() => setConnectingGoogle(false), 3000);
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
    setSavingSettings(true);
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
    } finally { setSavingSettings(false); }
  };

  // ── GA4 handlers ──
  const handleConnectGa4 = async () => {
    if (!currentWorkspace || !session) return;
    setConnectingGa4(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "hagggvnmwsnshkofhmmq";
      const startUrl = `https://${projectId}.supabase.co/functions/v1/oauth-start-ga4?workspace_id=${encodeURIComponent(currentWorkspace.id)}`;
      const link = document.createElement("a");
      link.href = startUrl; link.target = "_blank"; link.rel = "noopener noreferrer";
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo iniciar OAuth GA4", variant: "destructive" });
    } finally { setTimeout(() => setConnectingGa4(false), 3000); }
  };

  const handleSyncGa4 = async () => {
    if (!currentWorkspace || !session) return;
    setSyncingGa4(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-ga4-daily", {
        body: { workspace_id: currentWorkspace.id, days_back: 3 },
      });
      if (error) throw error;
      toast({ title: "GA4 Sync completado", description: `${data?.upserted ?? 0} registros.` });
      refreshData();
    } catch (err) {
      toast({ title: "Error al sincronizar GA4", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setSyncingGa4(false); }
  };

  const handleBackfillGa4 = async () => {
    if (!currentWorkspace || !session) return;
    const days = Math.min(Math.max(1, ga4BackfillDays), 90);
    setGa4Backfilling(true); setGa4BackfillStatus("started");
    try {
      // Run both: daily + by-source
      const [dailyRes, sourceRes] = await Promise.all([
        supabase.functions.invoke("sync-ga4-daily", {
          body: { workspace_id: currentWorkspace.id, days_back: days, triggered_by: "manual" },
        }),
        supabase.functions.invoke("sync-ga4-by-source", {
          body: { workspace_id: currentWorkspace.id, days_back: days, triggered_by: "manual" },
        }),
      ]);
      if (dailyRes.error) throw dailyRes.error;
      const totalUpserted = (dailyRes.data?.upserted ?? 0) + (sourceRes.data?.upserted ?? 0);
      setGa4BackfillStatus(`success: ${totalUpserted} rows`);
      toast({ title: "GA4 Backfill completado", description: `${totalUpserted} registros (${days} días).` });
      refreshData();
    } catch (err) {
      setGa4BackfillStatus(`fail: ${err instanceof Error ? err.message : "error"}`);
      toast({ title: "Error en backfill GA4", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setGa4Backfilling(false); }
  };

  const handleToggleGa4Property = async (setting: AccountSetting) => {
    if (!currentWorkspace) return;
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from("workspace_account_settings")
        .update({ is_enabled: !setting.is_enabled })
        .eq("id", setting.id);
      if (error) throw error;
      setAccountSettings(prev => prev.map(s => s.id === setting.id ? { ...s, is_enabled: !s.is_enabled } : s));
      toast({ title: `Property ${!setting.is_enabled ? "habilitada" : "deshabilitada"} para sync` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setSavingSettings(false); }
  };

  const handleRunGoogleDiscovery = async () => {
    if (!currentWorkspace) return;
    setDiscovering(true);
    setDiscoveryResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("debug-google-ads-discovery", {
        body: { workspace_id: currentWorkspace.id, persist: true },
      });
      if (error) throw error;
      setDiscoveryResult(data);
      if (data?.success) {
        const leafCount = data.traversal?.leaf_accounts?.length ?? 0;
        const mgrCount = data.traversal?.managers?.length ?? 0;
        toast({ title: "Discovery completado", description: `${leafCount} cuentas, ${mgrCount} managers encontrados.` });
        refreshData();
      } else {
        toast({ title: "Discovery con errores", description: data?.error || "Error desconocido", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error en discovery", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setDiscovering(false); }
  };

  // ── Meta account settings toggle ──
  const handleToggleMetaAccount = async (setting: AccountSetting) => {
    if (!currentWorkspace) return;
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from("workspace_account_settings")
        .update({ is_enabled: !setting.is_enabled })
        .eq("id", setting.id);
      if (error) throw error;
      setAccountSettings(prev => prev.map(s => s.id === setting.id ? { ...s, is_enabled: !s.is_enabled } : s));
      toast({ title: `Cuenta ${!setting.is_enabled ? "habilitada" : "deshabilitada"} para sync` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setSavingSettings(false); }
  };

  const handleBulkToggleMetaBusiness = async (groupId: string, enable: boolean) => {
    if (!currentWorkspace) return;
    setSavingSettings(true);
    try {
      const toUpdate = metaSettings.filter(s => (s.external_group_id || "__none__") === groupId);
      for (const s of toUpdate) {
        await supabase.from("workspace_account_settings").update({ is_enabled: enable }).eq("id", s.id);
      }
      setAccountSettings(prev => prev.map(s => {
        if (s.provider === "meta" && (s.external_group_id || "__none__") === groupId) {
          return { ...s, is_enabled: enable };
        }
        return s;
      }));
      toast({ title: `${toUpdate.length} cuentas ${enable ? "habilitadas" : "deshabilitadas"}` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally { setSavingSettings(false); }
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

  const isAdmin = workspaceRole === "admin";
  const metaStatusKey = metaIntegration?.status ?? "disconnected";
  const metaStatusInfo = STATUS_CONFIG[metaStatusKey as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.disconnected;
  const MetaStatusIcon = metaStatusInfo.icon;

  const googleStatusKey = googleIntegration?.status ?? "disconnected";
  const googleStatusInfo = STATUS_CONFIG[googleStatusKey as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.disconnected;
  const GoogleStatusIcon = googleStatusInfo.icon;

  const ga4StatusKey = ga4Integration?.status ?? "disconnected";
  const ga4StatusInfo = STATUS_CONFIG[ga4StatusKey as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.disconnected;
  const Ga4StatusIcon = ga4StatusInfo.icon;

  // GA4 settings from workspace_account_settings
  const ga4Settings = accountSettings.filter(s => s.provider === "ga4");

  // Meta settings from workspace_account_settings
  const metaSettings = accountSettings.filter(s => s.provider === "meta");

  // Group Meta settings by business
  const metaSettingsByBusiness = metaSettings.reduce<Record<string, { bizName: string; bizId: string; settings: AccountSetting[] }>>((acc, s) => {
    const bizId = s.external_group_id || "__none__";
    const bizName = s.external_group_name || "Sin Business Manager";
    if (!acc[bizId]) acc[bizId] = { bizName, bizId, settings: [] };
    acc[bizId].settings.push(s);
    return acc;
  }, {});

  const metaEnabledCount = metaSettings.filter(s => s.is_enabled).length;

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

  // Google accounts: separate managers vs clients
  const googleManagerAccounts = googleAccounts.filter(a => getMetaBool(a.metadata, "manager") === true);
  const googleClientAccounts = googleAccounts.filter(a => getMetaBool(a.metadata, "manager") !== true);
  const googleDisplayAccounts = showGoogleManagers ? googleAccounts : googleClientAccounts;
  const googleHiddenCount = googleAccounts.filter(a => getMetaBool(a.metadata, "hidden") === true).length;

  // Find the matching account for a setting (to get sync status)
  const findMetaAccount = (externalId: string) => metaAccounts.find(a => a.external_account_id === externalId);

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

              {/* Meta Account Toggles (grouped by BM) */}
              {metaSettings.length > 0 && isAdmin && (
                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Ad Accounts</span>
                      <Badge variant="outline" className="text-xs">{metaEnabledCount}/{metaSettings.length} habilitados</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Seleccioná qué cuentas se sincronizan. Las cuentas nuevas se descubren deshabilitadas por defecto.</p>

                  {Object.entries(metaSettingsByBusiness).map(([bizId, group]) => {
                    const groupEnabled = group.settings.filter(s => s.is_enabled).length;
                    const allEnabled = groupEnabled === group.settings.length;
                    const noneEnabled = groupEnabled === 0;
                    return (
                      <div key={bizId} className="rounded-md border p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">{group.bizName}</span>
                            {bizId !== "__none__" && <span className="text-xs text-muted-foreground font-mono">({bizId})</span>}
                            <Badge variant="outline" className="text-xs">{groupEnabled}/{group.settings.length}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm" variant="ghost" className="h-6 text-xs px-2"
                              onClick={() => handleBulkToggleMetaBusiness(bizId, true)}
                              disabled={savingSettings || allEnabled}
                            >Enable all</Button>
                            <Button
                              size="sm" variant="ghost" className="h-6 text-xs px-2"
                              onClick={() => handleBulkToggleMetaBusiness(bizId, false)}
                              disabled={savingSettings || noneEnabled}
                            >Disable all</Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {group.settings.map((setting) => {
                            const acct = findMetaAccount(setting.external_id);
                            const { status: syncSt, message: syncMsg, lastError } = acct ? getAccountSyncStatus(acct.metadata) : { status: "unknown", message: null, lastError: null };
                            return (
                              <div key={setting.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={setting.is_enabled}
                                    onCheckedChange={() => handleToggleMetaAccount(setting)}
                                    disabled={savingSettings}
                                  />
                                  <span className={setting.is_enabled ? "text-foreground" : "text-muted-foreground line-through"}>
                                    {setting.account_name || setting.external_id}
                                  </span>
                                  <span className="text-muted-foreground font-mono">({setting.external_id})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {acct && <span className="text-muted-foreground">{acct.currency ?? ""}</span>}
                                  {getSyncBadge(syncSt, syncMsg, lastError)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {metaEnabledCount === 0 && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />Ninguna cuenta habilitada. El sync no procesará datos.
                    </div>
                  )}
                </div>
              )}

              {/* Fallback table for non-admin or no settings */}
              {metaSettings.length === 0 && metaAccounts.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Ad Accounts ({metaAccounts.length})</h3>
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/50"><th className="px-3 py-2 text-left font-medium">Nombre</th><th className="px-3 py-2 text-left font-medium">Account ID</th><th className="px-3 py-2 text-left font-medium">Business</th><th className="px-3 py-2 text-left font-medium">Moneda</th><th className="px-3 py-2 text-left font-medium">Estado</th><th className="px-3 py-2 text-left font-medium">Sync</th></tr></thead>
                      <tbody>{metaAccounts.map((acct) => {
                        const businessName = getMetaString(acct.metadata, "business_name");
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

              {metaAccounts.length === 0 && metaSettings.length === 0 && <p className="text-sm text-muted-foreground">No se encontraron cuentas publicitarias.</p>}
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

              {/* Discovery button */}
              {isAdmin && googleIntegration.status === "connected" && (
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Account Discovery (MCC Traversal)</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleRunGoogleDiscovery} disabled={discovering}>
                      {discovering ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Stethoscope className="h-3.5 w-3.5 mr-1.5" />}
                      {discovering ? "Descubriendo…" : "Run Discovery"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Traversal recursivo del MCC. Descubre managers intermedios y cuentas leaf.</p>

                  {discoveryResult && !discoveryResult.success && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                      <p className="font-medium">Error: {String(discoveryResult.error)}</p>
                      {String(discoveryResult.error).includes("login_customer_id") && (
                        <p className="mt-1">login_customer_id mismatch / no access — verificá que GOOGLE_ADS_LOGIN_CUSTOMER_ID sea un MCC válido con acceso para este token.</p>
                      )}
                    </div>
                  )}

                  {discoveryResult?.success && discoveryResult.traversal && (
                    <div className="text-xs space-y-1 font-mono bg-muted/50 rounded p-2">
                      <p>Leaf accounts: {(discoveryResult.traversal as any).leaf_accounts?.length ?? 0}</p>
                      <p>Managers: {(discoveryResult.traversal as any).managers?.length ?? 0}</p>
                      <p>MCCs visitados: {((discoveryResult.traversal as any).visited_mccs || []).join(", ")}</p>
                      {discoveryResult.accessible_customer_ids && (
                        <p>Token accessible IDs: {(discoveryResult.accessible_customer_ids as string[]).join(", ")}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Google Accounts table with Enabled toggle */}
              {googleAccounts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">
                      Accounts Discovered ({googleDisplayAccounts.length}
                      {showGoogleManagers ? "" : ` leaf / ${googleAccounts.length} total`})
                    </h3>
                    <div className="flex items-center gap-2">
                      {googleHiddenCount > 0 && (
                        <Badge variant="outline" className="text-xs">{googleHiddenCount} hidden</Badge>
                      )}
                      <Button
                        size="sm" variant="ghost" className="h-7 text-xs gap-1"
                        onClick={() => setShowGoogleManagers(!showGoogleManagers)}
                      >
                        <Eye className="h-3 w-3" />
                        {showGoogleManagers ? "Hide managers" : "Show managers"}
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium">Enabled</th>
                          <th className="px-3 py-2 text-left font-medium">Nombre</th>
                          <th className="px-3 py-2 text-left font-medium">Customer ID</th>
                          {showGoogleManagers && <th className="px-3 py-2 text-left font-medium">Tipo</th>}
                          {showGoogleManagers && <th className="px-3 py-2 text-left font-medium">Parent</th>}
                          <th className="px-3 py-2 text-left font-medium">Estado</th>
                          <th className="px-3 py-2 text-left font-medium">Sync</th>
                        </tr>
                      </thead>
                      <tbody>{googleDisplayAccounts.map((acct) => {
                        const isManager = getMetaBool(acct.metadata, "manager") === true;
                        const isHidden = getMetaBool(acct.metadata, "hidden") === true;
                        const isEnabled = getMetaBool(acct.metadata, "enabled") !== false;
                        const parentId = getMetaString(acct.metadata, "parent_customer_id");
                        const googleStatus = getMetaString(acct.metadata, "google_status");
                        const { status: syncSt, message: syncMsg, lastError } = getAccountSyncStatus(acct.metadata);
                        return (
                          <tr key={acct.id} className={`border-b last:border-0 ${isHidden ? "opacity-50" : ""}`}>
                            <td className="px-3 py-2">
                              {isManager ? (
                                <Badge variant="outline" className="text-xs">MCC</Badge>
                              ) : isAdmin ? (
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={() => handleToggleGoogleAccountEnabled(acct)}
                                  disabled={savingSettings}
                                />
                              ) : (
                                <Badge variant={isEnabled ? "default" : "secondary"} className="text-xs">{isEnabled ? "ON" : "OFF"}</Badge>
                              )}
                            </td>
                            <td className={`px-3 py-2 ${!isEnabled && !isManager ? "text-muted-foreground line-through" : ""}`}>
                              {acct.name}
                              {isHidden && <Badge variant="outline" className="text-xs ml-1">hidden</Badge>}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{acct.external_account_id}</td>
                            {showGoogleManagers && <td className="px-3 py-2 text-xs">{isManager ? "Manager" : "Client"}</td>}
                            {showGoogleManagers && <td className="px-3 py-2 font-mono text-xs">{parentId || "—"}</td>}
                            <td className="px-3 py-2">
                              <Badge variant={googleStatus === "ENABLED" ? "default" : "secondary"} className="text-xs">
                                {googleStatus || acct.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">{isManager ? "—" : getSyncBadge(syncSt, syncMsg, lastError)}</td>
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

              {googleAccounts.length === 0 && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>No se encontraron cuentas. Ejecutá "Run Discovery" para traversar el MCC.</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{isAdmin ? "Conectá tu cuenta de Google Ads para descubrir cuentas publicitarias." : "Pedile a un admin que conecte Google Ads."}</p>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ GA4 Card ═══════════ */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg"><Plug className="h-5 w-5" />Google Analytics 4</CardTitle>
            <CardDescription>Revenue, Purchases & Source/Medium breakdown · Scope: analytics.readonly</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={ga4StatusInfo.className}><Ga4StatusIcon className="h-3 w-3 mr-1" />{ga4StatusInfo.label}</Badge>
            {isAdmin && ga4Integration?.status === "connected" && (
              <Button size="sm" variant="outline" onClick={handleSyncGa4} disabled={syncingGa4 || loading}>
                {syncingGa4 ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                {syncingGa4 ? "Sincronizando…" : "Sync Now"}
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" onClick={handleConnectGa4} disabled={connectingGa4 || loading}>
                {connectingGa4 && <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {ga4Integration ? "Reconectar" : "Conectar GA4"}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {!currentWorkspace ? (
            <p className="text-sm text-muted-foreground">Seleccioná un workspace.</p>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : ga4Integration ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Scopes:</span> <span className="font-mono text-xs">{ga4Integration.scopes?.join(", ") || "—"}</span></div>
                <div><span className="text-muted-foreground">Token expira:</span> <span>{ga4Integration.token_expires_at ? new Date(ga4Integration.token_expires_at).toLocaleDateString() : "—"}</span></div>
              </div>

              {/* GA4 Property Selection */}
              {ga4Settings.length > 0 && isAdmin && (
                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">GA4 Properties</span>
                    <Badge variant="outline" className="text-xs">{ga4Settings.filter(s => s.is_enabled).length}/{ga4Settings.length} habilitados</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Seleccioná qué property se usa para revenue. Típicamente 1 por workspace.</p>

                  <div className="space-y-1">
                    {ga4Settings.map((setting) => (
                      <div key={setting.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={setting.is_enabled}
                            onCheckedChange={() => handleToggleGa4Property(setting)}
                            disabled={savingSettings}
                          />
                          <span className={setting.is_enabled ? "text-foreground" : "text-muted-foreground line-through"}>
                            {setting.account_name || setting.external_id}
                          </span>
                          <span className="text-muted-foreground font-mono">({setting.external_id})</span>
                          {setting.external_group_name && (
                            <span className="text-muted-foreground">· {setting.external_group_name}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {ga4Settings.filter(s => s.is_enabled).length === 0 && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />Ninguna property habilitada. El sync no procesará datos.
                    </div>
                  )}
                </div>
              )}

              {ga4Settings.length === 0 && ga4Accounts.length > 0 && (
                <div className="rounded-md border p-3 space-y-2">
                  <h3 className="text-sm font-medium">Properties ({ga4Accounts.length})</h3>
                  {ga4Accounts.map(a => (
                    <div key={a.id} className="text-xs flex items-center gap-2 py-1">
                      <span>{a.name}</span>
                      <span className="text-muted-foreground font-mono">({a.external_account_id})</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Backfill GA4 */}
              {isAdmin && ga4Integration.status === "connected" && (
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Backfill GA4 (Daily + Source/Medium)</span>
                    <Tooltip><TooltipTrigger asChild><span className="text-muted-foreground text-xs cursor-help">(?)</span></TooltipTrigger><TooltipContent className="max-w-xs text-xs">Ejecuta sync-ga4-daily + sync-ga4-by-source. Máx 90 días.</TooltipContent></Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={90} value={ga4BackfillDays} onChange={(e) => setGa4BackfillDays(Number(e.target.value))} className="w-24 h-8 text-sm" />
                    <span className="text-xs text-muted-foreground">días</span>
                    <Button size="sm" variant="outline" onClick={handleBackfillGa4} disabled={ga4Backfilling}>
                      {ga4Backfilling ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}Run Backfill
                    </Button>
                  </div>
                  {ga4BackfillStatus && <p className={`text-xs ${ga4BackfillStatus.startsWith("fail") ? "text-destructive" : "text-muted-foreground"}`}>Status: {ga4BackfillStatus}</p>}
                </div>
              )}

              {ga4Accounts.length === 0 && ga4Settings.length === 0 && <p className="text-sm text-muted-foreground">No se encontraron properties. Reconectá GA4 para descubrir.</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{isAdmin ? "Conectá tu cuenta de Google Analytics para sincronizar revenue." : "Pedile a un admin que conecte GA4."}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
