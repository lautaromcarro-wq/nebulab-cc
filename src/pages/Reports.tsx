import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import {
  format, subDays, getDay, startOfWeek, endOfWeek,
  subWeeks, differenceInDays,
} from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SectionHeader from "@/components/SectionHeader";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, Check, MessageSquare, FileText, Sparkles, Clock,
  TrendingUp, DollarSign, ShoppingCart, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────
const fmtUSD = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtK = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1000 ? `${(n / 1000).toFixed(1)}K`
  : String(Math.round(n));
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta Ads", google_ads: "Google Ads", tiktok: "TikTok Ads",
};
const PLATFORM_EMOJI: Record<string, string> = {
  meta: "📘", google_ads: "🎯", tiktok: "🎵",
};

// ── Period presets ─────────────────────────────────────────────────────
function getLastWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const lastMonday = subDays(today, daysToLastMonday + 7);
  const lastSunday = subDays(today, daysToLastMonday + 1);
  return { from: lastMonday, to: lastSunday };
}

function getThisWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = subDays(today, daysToMonday);
  const yesterday = subDays(today, 1);
  return { from: monday, to: yesterday };
}

function getLast30Days() {
  const today = new Date();
  return { from: subDays(today, 29), to: today };
}

const PERIOD_PRESETS = [
  { key: "last_week", label: "Semana pasada (lun–dom)", fn: getLastWeekRange },
  { key: "this_week", label: "Esta semana (lun–hoy)", fn: getThisWeekRange },
  { key: "last_30", label: "Últimos 30 días", fn: getLast30Days },
];

// ── Aggregation ────────────────────────────────────────────────────────
function aggregate(rows: any[]) {
  const adRows = rows.filter((r) => r.provider !== "ga4");
  const ga4Rows = rows.filter((r) => r.provider === "ga4");

  const totalSpend = adRows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const totalRevenue = adRows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
  const totalImpressions = adRows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
  const totalClicks = adRows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
  const totalPurchases = adRows.reduce((s, r) => s + (Number(r.purchases) || 0), 0);
  const totalSessions = ga4Rows.reduce((s, r) => s + (Number(r.sessions) || 0), 0);
  const totalUsers = ga4Rows.reduce((s, r) => s + (Number(r.users_count) || 0), 0);
  const totalGA4Purchases = ga4Rows.reduce((s, r) => s + (Number(r.purchases) || 0), 0);

  const platformMap = new Map<string, { spend: number; revenue: number; impressions: number; clicks: number; purchases: number }>();
  for (const r of adRows) {
    const ex = platformMap.get(r.provider) ?? { spend: 0, revenue: 0, impressions: 0, clicks: 0, purchases: 0 };
    ex.spend += Number(r.spend) || 0;
    ex.revenue += Number(r.revenue) || 0;
    ex.impressions += Number(r.impressions) || 0;
    ex.clicks += Number(r.clicks) || 0;
    ex.purchases += Number(r.purchases) || 0;
    platformMap.set(r.provider, ex);
  }

  const platforms = Array.from(platformMap.entries())
    .map(([provider, d]) => ({
      provider,
      label: PLATFORM_LABELS[provider] ?? provider,
      emoji: PLATFORM_EMOJI[provider] ?? "📊",
      ...d,
      roas: d.spend > 0 ? d.revenue / d.spend : 0,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
    }))
    .sort((a, b) => b.spend - a.spend);

  return {
    totalSpend, totalRevenue, totalImpressions, totalClicks, totalPurchases,
    blendedROAS: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    totalSessions, totalUsers, totalGA4Purchases,
    convRate: totalSessions > 0 ? (totalGA4Purchases / totalSessions) * 100 : 0,
    platforms,
  };
}

// ── Message builders ───────────────────────────────────────────────────
function buildWhatsAppMessage(
  clientName: string,
  periodLabel: string,
  d: ReturnType<typeof aggregate>,
  reportUrl?: string,
): string {
  const lines: string[] = [
    `📊 *Resultados de la semana — ${clientName}*`,
    `📅 ${periodLabel}`,
    ``,
    `💰 Inversión: *${fmtUSD(d.totalSpend)}*`,
    `📈 Revenue: *${fmtUSD(d.totalRevenue)}*`,
    `🎯 ROAS blended: *${d.blendedROAS.toFixed(2)}x*`,
    `🛒 Compras: *${fmtK(d.totalPurchases)}*`,
  ];

  if (d.totalImpressions > 0) {
    lines.push(`👁 Impresiones: *${fmtK(d.totalImpressions)}*`);
    lines.push(`🖱 Clicks: *${fmtK(d.totalClicks)}*`);
  }

  if (d.platforms.length > 1) {
    lines.push(``);
    lines.push(`*Por plataforma:*`);
    for (const p of d.platforms) {
      lines.push(`${p.emoji} ${p.label} → ROAS *${p.roas.toFixed(2)}x* | ${fmtUSD(p.spend)} invertidos | ${fmtK(p.purchases)} compras`);
    }
  }

  if (d.totalSessions > 0) {
    lines.push(``);
    lines.push(`🌐 *Web (GA4)*`);
    lines.push(`📱 Sesiones: *${fmtK(d.totalSessions)}*`);
    if (d.convRate > 0) lines.push(`✅ Conv. rate: *${fmtPct(d.convRate)}*`);
  }

  if (reportUrl) {
    lines.push(``);
    lines.push(`🔗 Reporte completo: ${reportUrl}`);
  }

  return lines.join("\n");
}

function buildEmailText(
  clientName: string,
  periodLabel: string,
  d: ReturnType<typeof aggregate>,
  reportUrl?: string,
): string {
  const lines: string[] = [
    `Hola,`,
    ``,
    `Te compartimos los resultados de la semana para ${clientName} (${periodLabel}):`,
    ``,
    `📊 RESUMEN GENERAL`,
    `• Inversión total: ${fmtUSD(d.totalSpend)}`,
    `• Revenue generado: ${fmtUSD(d.totalRevenue)}`,
    `• ROAS blended: ${d.blendedROAS.toFixed(2)}x`,
    `• Compras: ${fmtK(d.totalPurchases)}`,
    `• Impresiones: ${fmtK(d.totalImpressions)}`,
    `• Clicks: ${fmtK(d.totalClicks)}`,
  ];

  if (d.platforms.length > 0) {
    lines.push(``, `📱 POR PLATAFORMA`);
    for (const p of d.platforms) {
      lines.push(`• ${p.label}: ${fmtUSD(p.spend)} invertidos | ${fmtUSD(p.revenue)} revenue | ROAS ${p.roas.toFixed(2)}x | ${fmtK(p.purchases)} compras`);
    }
  }

  if (d.totalSessions > 0) {
    lines.push(``, `🌐 WEB (GA4)`);
    lines.push(`• Sesiones: ${fmtK(d.totalSessions)}`);
    if (d.convRate > 0) lines.push(`• Tasa de conversión: ${fmtPct(d.convRate)}`);
  }

  if (reportUrl) {
    lines.push(``, `📎 Ver reporte completo: ${reportUrl}`);
  }

  lines.push(``, `Quedamos a disposición para cualquier consulta.`, `Saludos,`);

  return lines.join("\n");
}

// ── Copy button ────────────────────────────────────────────────────────
function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={copy}>
      {copied
        ? <><Check className="h-3.5 w-3.5 text-success" /> Copiado!</>
        : <><Copy className="h-3.5 w-3.5" /> {label}</>
      }
    </Button>
  );
}

// ── Report history row ─────────────────────────────────────────────────
interface ReportRecord {
  id: string;
  token: string;
  client_name: string | null;
  date_from: string;
  date_to: string;
  title: string | null;
  created_at: string;
}

// ── Main ──────────────────────────────────────────────────────────────
export default function Reports() {
  const { currentWorkspace } = useWorkspace();
  const { clients, selectedClient } = useClient();
  const { toast } = useToast();
  const wsId = currentWorkspace?.id ?? "";

  const [clientId, setClientId] = useState<string>(selectedClient?.id ?? "all");
  const [periodKey, setPeriodKey] = useState("last_week");
  const [generated, setGenerated] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [savingLink, setSavingLink] = useState(false);

  const period = useMemo(
    () => PERIOD_PRESETS.find((p) => p.key === periodKey)?.fn() ?? getLastWeekRange(),
    [periodKey],
  );

  const fromStr = format(period.from, "yyyy-MM-dd");
  const toStr = format(period.to, "yyyy-MM-dd");

  const periodLabel = `${format(period.from, "d 'de' MMMM", { locale: es })} – ${format(period.to, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
  const clientName = clients.find((c) => c.id === clientId)?.name ?? "todos los clientes";

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["report-gen", wsId, clientId, fromStr, toStr],
    enabled: !!wsId && generated,
    queryFn: async () => {
      let q = supabase
        .from("performance_daily")
        .select("date, provider, spend, revenue, impressions, clicks, purchases, sessions, users_count, conversions")
        .eq("workspace_id", wsId)
        .gte("date", fromStr)
        .lte("date", toStr);
      if (clientId !== "all") q = q.eq("client_id", clientId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const data = useMemo(() => aggregate(rows), [rows]);
  const hasData = rows.length > 0;

  const waText = useMemo(
    () => hasData ? buildWhatsAppMessage(clientName, periodLabel, data, reportUrl ?? undefined) : "",
    [hasData, clientName, periodLabel, data, reportUrl],
  );
  const emailText = useMemo(
    () => hasData ? buildEmailText(clientName, periodLabel, data, reportUrl ?? undefined) : "",
    [hasData, clientName, periodLabel, data, reportUrl],
  );

  const handleGenerate = () => {
    setGenerated(true);
    setReportUrl(null);
  };

  const handleGenerateLink = async () => {
    if (!hasData) return;
    setSavingLink(true);
    const token = crypto.randomUUID();
    const { error } = await supabase.from("client_reports").insert({
      token,
      workspace_id: wsId,
      client_id: clientId !== "all" ? clientId : null,
      client_name: clientId !== "all" ? clientName : null,
      date_from: fromStr,
      date_to: toStr,
      title: `${clientName} — ${periodLabel}`,
      report_data: {
        kpis: {
          spend: data.totalSpend,
          revenue: data.totalRevenue,
          roas: data.blendedROAS,
          impressions: data.totalImpressions,
          clicks: data.totalClicks,
          purchases: data.totalPurchases,
          sessions: data.totalSessions,
          users: data.totalUsers,
        },
        platforms: data.platforms.map((p) => ({
          provider: p.provider,
          label: p.label,
          spend: p.spend,
          revenue: p.revenue,
          roas: p.roas,
          impressions: p.impressions,
          clicks: p.clicks,
          purchases: p.purchases,
        })),
        daily: [],
        period: { from: fromStr, to: toStr },
        client_name: clientId !== "all" ? clientName : null,
      },
    });
    setSavingLink(false);
    if (error) {
      toast({ title: "Error generando link", variant: "destructive" });
    } else {
      setReportUrl(`${window.location.origin}/report/${token}`);
      toast({ title: "Link generado" });
    }
  };

  // Report history
  const { data: reports = [] } = useQuery<ReportRecord[]>({
    queryKey: ["client-reports-history", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_reports")
        .select("id, token, client_name, date_from, date_to, title, created_at")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as ReportRecord[];
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        badge="Reportes"
        title="Reportes de performance"
        subtitle="Generá el resumen semanal y copialo para enviarlo por donde quieras"
      />

      <Tabs defaultValue="generate" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="generate" className="text-xs gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Generar reporte
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Historial
            {reports.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">{reports.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── GENERATE ── */}
        <TabsContent value="generate" className="space-y-4">
          {/* Config bar */}
          <Card>
            <CardContent className="py-4 px-5">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[180px]">
                  <p className="text-xs text-muted-foreground mb-1.5">Cliente</p>
                  <Select value={clientId} onValueChange={(v) => { setClientId(v); setGenerated(false); setReportUrl(null); }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Seleccionar cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los clientes</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[220px]">
                  <p className="text-xs text-muted-foreground mb-1.5">Período</p>
                  <Select value={periodKey} onValueChange={(v) => { setPeriodKey(v); setGenerated(false); setReportUrl(null); }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_PRESETS.map((p) => (
                        <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isFetching}
                  className="gap-1.5 h-9"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isFetching ? "Cargando..." : "Generar resumen"}
                </Button>
              </div>

              {generated && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  📅 {periodLabel} · {clientId === "all" ? "Todos los clientes" : clientName}
                </p>
              )}
            </CardContent>
          </Card>

          {/* No data state */}
          {generated && !isFetching && !hasData && (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">Sin datos para el período seleccionado</p>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {generated && !isFetching && hasData && (
            <div className="space-y-4">
              {/* KPI strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: DollarSign, label: "Inversión", value: fmtUSD(data.totalSpend) },
                  { icon: TrendingUp, label: "Revenue", value: fmtUSD(data.totalRevenue) },
                  { icon: TrendingUp, label: "ROAS blended", value: `${data.blendedROAS.toFixed(2)}x` },
                  { icon: ShoppingCart, label: "Compras", value: fmtK(data.totalPurchases) },
                ].map(({ icon: Icon, label, value }) => (
                  <Card key={label}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                      </div>
                      <p className="text-lg font-bold tabular-nums">{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Platform breakdown */}
              {data.platforms.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Por plataforma
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {data.platforms.map((p) => (
                        <div key={p.provider} className="flex items-center gap-3 py-2 border-b last:border-0">
                          <span className="text-lg">{p.emoji}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{p.label}</p>
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-right">
                            {[
                              { label: "Inversión", v: fmtUSD(p.spend) },
                              { label: "Revenue", v: fmtUSD(p.revenue) },
                              { label: "ROAS", v: `${p.roas.toFixed(2)}x` },
                              { label: "Compras", v: fmtK(p.purchases) },
                            ].map(({ label, v }) => (
                              <div key={label}>
                                <p className="text-[10px] text-muted-foreground">{label}</p>
                                <p className="text-xs font-semibold tabular-nums">{v}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* GA4 */}
              {data.totalSessions > 0 && (
                <Card>
                  <CardContent className="py-3 px-5">
                    <div className="flex items-center gap-4">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex gap-6 text-sm">
                        <div>
                          <p className="text-[10px] text-muted-foreground">Sesiones</p>
                          <p className="font-bold">{fmtK(data.totalSessions)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Usuarios</p>
                          <p className="font-bold">{fmtK(data.totalUsers)}</p>
                        </div>
                        {data.convRate > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground">Conv. rate</p>
                            <p className="font-bold">{fmtPct(data.convRate)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Link generator */}
              <Card className="border-dashed">
                <CardContent className="py-3 px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium">Link compartible (opcional)</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Genera un reporte visual que podés adjuntar al mensaje
                      </p>
                    </div>
                    {reportUrl ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-muted-foreground max-w-[200px] truncate">{reportUrl}</span>
                        <CopyButton text={reportUrl} label="Copiar link" />
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => window.open(reportUrl, "_blank")}>
                          Ver
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8 text-xs shrink-0"
                        onClick={handleGenerateLink}
                        disabled={savingLink}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {savingLink ? "Generando..." : "Generar link visual"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Message cards */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* WhatsApp */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-[#25D366]" />
                        WhatsApp / Mensaje
                      </CardTitle>
                      <CopyButton text={waText} label="Copiar mensaje" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans bg-muted/30 rounded-lg p-3 max-h-72 overflow-y-auto">
                      {waText}
                    </pre>
                  </CardContent>
                </Card>

                {/* Email */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        Email / Texto formal
                      </CardTitle>
                      <CopyButton text={emailText} label="Copiar texto" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans bg-muted/30 rounded-lg p-3 max-h-72 overflow-y-auto">
                      {emailText}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── HISTORY ── */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Reportes generados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aún no generaste reportes. Generá uno desde la pestaña anterior.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Título</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Cliente</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Período</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Generado</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">{r.title ?? "Sin título"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.client_name ?? "Todos"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {format(new Date(r.date_from + "T00:00:00"), "d MMM", { locale: es })} –{" "}
                          {format(new Date(r.date_to + "T00:00:00"), "d MMM yyyy", { locale: es })}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {format(new Date(r.created_at), "d MMM HH:mm", { locale: es })}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <CopyButton text={`${window.location.origin}/report/${r.token}`} label="Link" />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] px-2"
                              onClick={() => window.open(`/report/${r.token}`, "_blank")}
                            >
                              Ver
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
