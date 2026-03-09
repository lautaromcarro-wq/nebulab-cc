import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as ReTooltip,
} from "recharts";

// ── Helpers ────────────────────────────────────────────────────────────
const fmtUSD = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtK = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta Ads", google_ads: "Google Ads", tiktok: "TikTok Ads",
};
const PLATFORM_COLORS: Record<string, string> = {
  meta: "#1877F2", google_ads: "#34A853", tiktok: "#010101",
};
const PLATFORM_EMOJI: Record<string, string> = {
  meta: "📘", google_ads: "🎯", tiktok: "🎵",
};

// ── Period presets ─────────────────────────────────────────────────────
const today = new Date();
const PRESETS = [
  {
    key: "7d",
    label: "7 días",
    from: format(subDays(today, 6), "yyyy-MM-dd"),
    to: format(today, "yyyy-MM-dd"),
  },
  {
    key: "30d",
    label: "30 días",
    from: format(subDays(today, 29), "yyyy-MM-dd"),
    to: format(today, "yyyy-MM-dd"),
  },
  {
    key: "mtd",
    label: "Este mes",
    from: format(startOfMonth(today), "yyyy-MM-dd"),
    to: format(today, "yyyy-MM-dd"),
  },
];

// ── Aggregation ────────────────────────────────────────────────────────
function aggregate(rows: any[]) {
  const adRows = rows.filter((r) => r.provider !== "ga4");
  const ga4Rows = rows.filter((r) => r.provider === "ga4");

  const totalSpend = adRows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const totalRevenue = adRows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
  const totalPurchases = adRows.reduce((s, r) => s + (Number(r.purchases) || 0), 0);
  const totalImpressions = adRows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
  const totalClicks = adRows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
  const totalSessions = ga4Rows.reduce((s, r) => s + (Number(r.sessions) || 0), 0);
  const totalUsers = ga4Rows.reduce((s, r) => s + (Number(r.users_count) || 0), 0);
  const ga4Purchases = ga4Rows.reduce((s, r) => s + (Number(r.purchases) || 0), 0);

  const platformMap = new Map<string, any>();
  for (const r of adRows) {
    const ex = platformMap.get(r.provider) ?? { spend: 0, revenue: 0, purchases: 0, impressions: 0, clicks: 0 };
    ex.spend += Number(r.spend) || 0;
    ex.revenue += Number(r.revenue) || 0;
    ex.purchases += Number(r.purchases) || 0;
    ex.impressions += Number(r.impressions) || 0;
    ex.clicks += Number(r.clicks) || 0;
    platformMap.set(r.provider, ex);
  }

  const platforms = Array.from(platformMap.entries()).map(([provider, d]) => ({
    provider, ...d,
    roas: d.spend > 0 ? d.revenue / d.spend : 0,
    ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
  })).sort((a, b) => b.spend - a.spend);

  const dailyMap = new Map<string, { spend: number; revenue: number }>();
  for (const r of adRows) {
    const ex = dailyMap.get(r.date) ?? { spend: 0, revenue: 0 };
    ex.spend += Number(r.spend) || 0;
    ex.revenue += Number(r.revenue) || 0;
    dailyMap.set(r.date, ex);
  }
  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      label: format(new Date(date + "T00:00:00"), "d MMM", { locale: es }),
      ...d,
    }));

  return {
    totalSpend, totalRevenue, totalPurchases, totalImpressions, totalClicks,
    blendedROAS: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    totalSessions, totalUsers, ga4Purchases,
    convRate: totalSessions > 0 ? (ga4Purchases / totalSessions) * 100 : 0,
    platforms, daily,
  };
}

// ── KPI card ───────────────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const { token } = useParams<{ token: string }>();
  const [presetKey, setPresetKey] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashData, setDashData] = useState<any>(null);

  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[1];

  useEffect(() => {
    if (!token) { setError("Link inválido"); setLoading(false); return; }
    setLoading(true);
    supabase.functions
      .invoke("get-client-dashboard", {
        body: null,
        headers: {},
        method: "GET",
      })
      .then(() => {}) // unused — use fetch directly for GET with params
      .catch(() => {});

    fetch(
      `${(supabase as any).supabaseUrl}/functions/v1/get-client-dashboard?token=${token}&from=${preset.from}&to=${preset.to}`,
      {
        headers: {
          apikey: (supabase as any).supabaseKey,
          Authorization: `Bearer ${(supabase as any).supabaseKey}`,
        },
      },
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); } else { setDashData(data); }
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [token, presetKey]);

  const d = useMemo(() => (dashData?.rows ? aggregate(dashData.rows) : null), [dashData]);
  const periodLabel = `${format(new Date(preset.from + "T00:00:00"), "d 'de' MMMM", { locale: es })} – ${format(new Date(preset.to + "T00:00:00"), "d 'de' MMMM yyyy", { locale: es })}`;

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Cargando tu dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !dashData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <p className="text-4xl mb-4">🔒</p>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Acceso no disponible</h1>
          <p className="text-gray-500 text-sm">{error ?? "Este link no es válido o ha sido revocado."}</p>
        </div>
      </div>
    );
  }

  const { client, budgets } = dashData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-indigo-200 text-xs font-medium uppercase tracking-widest mb-2">
                {client.workspace_name}
              </p>
              <h1 className="text-3xl font-bold text-white mb-1">{client.name}</h1>
              <p className="text-indigo-200 text-sm">{periodLabel}</p>
            </div>

            {/* Period selector */}
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur rounded-xl p-1">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPresetKey(p.key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    presetKey === p.key
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {!d || dashData.rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-gray-600 font-medium">Sin datos para este período</p>
            <p className="text-gray-400 text-sm mt-1">Probá seleccionando otro rango de fechas</p>
          </div>
        ) : (
          <>
            {/* KPI grid */}
            <section>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Inversión" value={fmtUSD(d.totalSpend)} />
                <KpiCard label="Revenue" value={fmtUSD(d.totalRevenue)} />
                <KpiCard
                  label="ROAS"
                  value={`${d.blendedROAS.toFixed(2)}x`}
                  sub="Revenue / Inversión"
                />
                <KpiCard label="Compras" value={fmtK(d.totalPurchases)} />
              </div>
            </section>

            {/* Secondary KPIs */}
            {(d.totalImpressions > 0 || d.totalSessions > 0) && (
              <section>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {d.totalImpressions > 0 && (
                    <KpiCard label="Impresiones" value={fmtK(d.totalImpressions)} />
                  )}
                  {d.totalClicks > 0 && (
                    <KpiCard label="Clicks" value={fmtK(d.totalClicks)} />
                  )}
                  {d.totalSessions > 0 && (
                    <KpiCard label="Sesiones web" value={fmtK(d.totalSessions)} />
                  )}
                  {d.convRate > 0 && (
                    <KpiCard label="Conv. rate" value={`${d.convRate.toFixed(2)}%`} sub="compras / sesiones" />
                  )}
                </div>
              </section>
            )}

            {/* Spend vs Revenue chart */}
            {d.daily.length > 1 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Inversión vs Revenue — diario
                </h2>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={d.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} tickFormatter={(v) => `$${fmtK(v)}`} />
                      <ReTooltip
                        formatter={(v: any, name: string) => [fmtUSD(v), name]}
                        contentStyle={{ borderRadius: 10, fontSize: 12, border: "1px solid #f0f0f0" }}
                      />
                      <Line
                        type="monotone" dataKey="spend" name="Inversión"
                        stroke="#6366F1" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone" dataKey="revenue" name="Revenue"
                        stroke="#10B981" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-6 mt-3 justify-center">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />Inversión
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Revenue
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Platforms */}
            {d.platforms.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Performance por plataforma
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {d.platforms.map((p: any) => (
                    <div
                      key={p.provider}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: PLATFORM_COLORS[p.provider] ?? "#888" }}
                          />
                          <span className="font-semibold text-gray-800">
                            {PLATFORM_LABELS[p.provider] ?? p.provider}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                          ROAS {p.roas.toFixed(2)}x
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "Inversión", value: fmtUSD(p.spend) },
                          { label: "Revenue", value: fmtUSD(p.revenue) },
                          { label: "Compras", value: fmtK(p.purchases) },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                            <p className="text-lg font-bold text-gray-900">{value}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Spend bar */}
                      {d.totalSpend > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                            <span>% del presupuesto total</span>
                            <span>{((p.spend / d.totalSpend) * 100).toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${(p.spend / d.totalSpend) * 100}%`,
                                backgroundColor: PLATFORM_COLORS[p.provider] ?? "#6366F1",
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Budget meters */}
            {budgets?.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Presupuesto mensual
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {budgets.map((seg: any) => {
                    const pct = Math.min(seg.pct, 1);
                    const isOver = seg.pct > 1;
                    const isWarning = seg.pct >= 0.85;
                    return (
                      <div key={seg.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-semibold text-gray-800 text-sm">{seg.name}</p>
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                              isOver
                                ? "bg-red-50 text-red-600"
                                : isWarning
                                ? "bg-yellow-50 text-yellow-600"
                                : "bg-green-50 text-green-600"
                            }`}
                          >
                            {(seg.pct * 100).toFixed(0)}% usado
                          </span>
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isOver ? "bg-red-500" : isWarning ? "bg-yellow-400" : "bg-emerald-500"
                            }`}
                            style={{ width: `${pct * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>{fmtUSD(seg.spendMTD)} gastados</span>
                          <span>de {fmtUSD(seg.monthly_budget)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-gray-300 pt-4 pb-8 border-t border-gray-100">
          <p>
            Dashboard generado por{" "}
            <strong className="text-gray-500">{client.workspace_name}</strong>
            {" · "}Powered by{" "}
            <strong className="text-gray-500">Nebulab OS</strong>
          </p>
        </footer>
      </div>
    </div>
  );
}
