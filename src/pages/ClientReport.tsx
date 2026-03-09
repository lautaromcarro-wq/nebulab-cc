import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as ReTooltip,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtK = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));

const PLATFORM_LABELS: Record<string, string> = { meta: "Meta Ads", google_ads: "Google Ads", tiktok: "TikTok Ads" };
const PLATFORM_COLORS: Record<string, string> = { meta: "#1877F2", google_ads: "#34A853", tiktok: "#010101" };

interface ReportData {
  kpis: {
    spend: number; revenue: number; roas: number;
    impressions: number; clicks: number; purchases: number;
    sessions?: number; users?: number;
  };
  platforms: {
    provider: string; label: string; spend: number; revenue: number;
    roas: number; impressions: number; clicks: number; purchases: number;
  }[];
  daily: { label: string; spend: number; revenue: number }[];
  period: { from: string; to: string };
  client_name?: string;
  title?: string;
  workspace_name?: string;
}

interface Report {
  id: string;
  token: string;
  client_name: string | null;
  date_from: string;
  date_to: string;
  title: string | null;
  report_data: ReportData;
  created_at: string;
}

export default function ClientReport() {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    supabase
      .from("client_reports")
      .select("*")
      .eq("token", token)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); } else { setReport(data as any); }
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando reporte...</p>
        </div>
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <p className="text-3xl mb-3">🔍</p>
          <h1 className="text-xl font-bold text-gray-800 mb-1">Reporte no encontrado</h1>
          <p className="text-gray-500 text-sm">El link puede haber expirado o ser incorrecto.</p>
        </div>
      </div>
    );
  }

  const d = report.report_data;
  const periodLabel = `${format(new Date(report.date_from + "T00:00:00"), "d MMM yyyy", { locale: es })} – ${format(new Date(report.date_to + "T00:00:00"), "d MMM yyyy", { locale: es })}`;

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-8 print:py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-indigo-200 text-xs uppercase tracking-widest font-medium mb-1">
                {d.workspace_name ?? "Reporte de Performance"}
              </p>
              <h1 className="text-2xl font-bold mb-1">
                {report.title ?? report.client_name ?? "Reporte"}
              </h1>
              <p className="text-indigo-200 text-sm">{periodLabel}</p>
            </div>
            <button
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition print:hidden"
              onClick={() => window.print()}
            >
              Imprimir / PDF
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Summary */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Resumen del período</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Inversión total", value: fmtCurrency(d.kpis.spend) },
              { label: "Revenue generado", value: fmtCurrency(d.kpis.revenue) },
              { label: "ROAS blended", value: `${d.kpis.roas.toFixed(2)}x` },
              { label: "Compras", value: fmtK(d.kpis.purchases) },
              { label: "Impresiones", value: fmtK(d.kpis.impressions) },
              { label: "Clicks", value: fmtK(d.kpis.clicks) },
              ...(d.kpis.sessions !== undefined
                ? [{ label: "Sesiones web", value: fmtK(d.kpis.sessions) }]
                : []),
              ...(d.kpis.users !== undefined
                ? [{ label: "Usuarios únicos", value: fmtK(d.kpis.users) }]
                : []),
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
                <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Spend vs Revenue chart */}
        {d.daily.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Inversión vs Revenue diario</h2>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={d.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${fmtK(v)}`} />
                  <ReTooltip formatter={(v: any) => fmtCurrency(v)} />
                  <Line type="monotone" dataKey="spend" name="Inversión" stroke="#6366F1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#10B981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* By platform */}
        {d.platforms.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Performance por plataforma</h2>
            <div className="space-y-3">
              {d.platforms.map((p) => (
                <div key={p.provider} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: PLATFORM_COLORS[p.provider] ?? "#888" }}
                      />
                      <span className="font-semibold text-sm">{PLATFORM_LABELS[p.provider] ?? p.label}</span>
                    </div>
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                      ROAS {p.roas.toFixed(2)}x
                    </span>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Inversión</p>
                      <p className="font-semibold">{fmtCurrency(p.spend)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Revenue</p>
                      <p className="font-semibold">{fmtCurrency(p.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Impresiones</p>
                      <p className="font-semibold">{fmtK(p.impressions)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Clicks</p>
                      <p className="font-semibold">{fmtK(p.clicks)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Compras</p>
                      <p className="font-semibold">{fmtK(p.purchases)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Platform spend distribution */}
        {d.platforms.length > 1 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Distribución de inversión</h2>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={d.platforms} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${fmtK(v)}`} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={80} />
                  <ReTooltip formatter={(v: any) => fmtCurrency(v)} />
                  <Bar dataKey="spend" name="Inversión" radius={[0, 4, 4, 0]}>
                    {d.platforms.map((p) => (
                      <rect key={p.provider} fill={PLATFORM_COLORS[p.provider] ?? "#888"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
          <p>Reporte generado por <strong className="text-gray-600">Nebulab</strong> · {format(new Date(report.created_at), "d MMM yyyy", { locale: es })}</p>
        </footer>
      </div>
    </div>
  );
}
