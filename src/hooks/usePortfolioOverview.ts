// src/hooks/usePortfolioOverview.ts
// Cross-client portfolio overview — "Ojo de Águila"
// Queries performance_daily for ALL clients in the workspace for the current month.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { format, startOfMonth, endOfMonth, getDaysInMonth, differenceInDays } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClientSummary {
  clientId: string;
  clientName: string;
  spend: number;
  impressions: number;
  clicks: number;
  // Ventas REALES del sitio, medidas por GA4. Es la única fuente no inflada:
  // Meta y Google se atribuyen la misma venta cada uno por su lado, así que
  // sumar lo que reporta cada plataforma cuenta la misma plata dos veces.
  purchases: number;
  revenue: number;
  // Lo que las plataformas dicen haber generado. Sirve para medir cuánto se
  // sobre-atribuyen, nunca como facturación real.
  revenueAttributed: number;
  purchasesAttributed: number;
  ctr: number;
  cpa: number;
  roas: number; // blended: ventas reales / inversión total
  spendMeta: number;
  spendGoogle: number;
  // Budget & pacing
  budgetTotal: number;
  budgetNet: number;
  pacingPercent: number; // % budget consumed
  expectedPercent: number; // % month elapsed
  pacingDelta: number; // pacingPercent - expectedPercent
  pacingStatus: "on_track" | "overpacing" | "underpacing";
}

export interface PortfolioAlert {
  clientName: string;
  type: "overpacing" | "underpacing" | "high_cpa" | "low_roas";
  severity: "warning" | "critical";
  message: string;
}

export interface PortfolioTotals {
  totalSpend: number;
  totalRevenue: number;
  totalImpressions: number;
  totalClicks: number;
  totalPurchases: number;
  blendedRoas: number;
  blendedCpa: number;
  clientCount: number;
  feeRevenue: number;
}

export interface PortfolioOverview {
  clients: ClientSummary[];
  totals: PortfolioTotals;
  alerts: PortfolioAlert[];
  month: string;
  daysElapsed: number;
  daysInMonth: number;
}

// ── Budget config (static for now, will come from Supabase later) ────────────

const FEE_PCT = 0.30;

interface BudgetEntry {
  budget_performance: number;
  budget_awareness: number;
}

const BUDGETS: Record<string, Record<string, BudgetEntry>> = {
  Diana: {
    "2026-05": { budget_performance: 2320045, budget_awareness: 500000 },
    "2026-06": { budget_performance: 1780321, budget_awareness: 600000 },
  },
  Spinit: {
    "2026-05": { budget_performance: 2320045, budget_awareness: 900000 },
    "2026-06": { budget_performance: 700000, budget_awareness: 1050000 },
  },
  Casabutik: {
    "2026-05": { budget_performance: 2079692, budget_awareness: 1300000 },
    "2026-06": { budget_performance: 2079692, budget_awareness: 1100000 },
  },
  Trento: {
    "2026-05": { budget_performance: 515566, budget_awareness: 300000 },
    "2026-06": { budget_performance: 0, budget_awareness: 350000 },
  },
  Shilba: {
    "2026-05": { budget_performance: 0, budget_awareness: 350000 },
    "2026-06": { budget_performance: 0, budget_awareness: 350000 },
  },
  Infoauto: {
    "2026-05": { budget_performance: 0, budget_awareness: 0 },
    "2026-06": { budget_performance: 0, budget_awareness: 0 },
  },
  "Grupo MF": {
    "2026-05": { budget_performance: 0, budget_awareness: 0 },
    "2026-06": { budget_performance: 0, budget_awareness: 0 },
  },
};

function getBudget(clientName: string, monthKey: string): { gross: number; net: number } {
  const entry = BUDGETS[clientName]?.[monthKey];
  if (!entry) return { gross: 0, net: 0 };
  const gross = entry.budget_performance + entry.budget_awareness;
  return { gross, net: gross / (1 + FEE_PCT) };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePortfolioOverview(targetDate?: Date) {
  const { currentWorkspace } = useWorkspace();

  const now = targetDate ?? new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthKey = format(monthStart, "yyyy-MM");
  const totalDays = getDaysInMonth(now);
  const daysElapsed = differenceInDays(now, monthStart) + 1; // includes today
  const expectedPercent = (daysElapsed / totalDays) * 100;

  return useQuery<PortfolioOverview>({
    queryKey: ["portfolio-overview", currentWorkspace?.id, monthKey],
    enabled: !!currentWorkspace,
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
    queryFn: async () => {
      const wsId = currentWorkspace!.id;
      const from = format(monthStart, "yyyy-MM-dd");
      const to = format(monthEnd, "yyyy-MM-dd");

      // Fetch all performance_daily rows for this month
      const { data: perfRows, error } = await supabase
        .from("performance_daily")
        .select("client_id, provider, spend, impressions, clicks, purchases, revenue")
        .eq("workspace_id", wsId)
        // Sin client_id son filas de nivel cuenta, cuyo total ya está contenido
        // en sus campañas. Incluirlas contaría la misma inversión dos veces.
        .not("client_id", "is", null)
        .gte("date", from)
        .lte("date", to);

      if (error) throw error;

      // Ventas reales del sitio. GA4 mide la transacción una sola vez, sin
      // importar qué plataforma se la adjudique.
      const { data: ga4Rows } = await supabase
        .from("ga4_daily")
        .select("client_id, revenue, purchases")
        .eq("workspace_id", wsId)
        .not("client_id", "is", null)
        .gte("date", from)
        .lte("date", to);

      const realSales = new Map<string, { revenue: number; purchases: number }>();
      for (const row of ga4Rows ?? []) {
        const e = realSales.get(row.client_id!) ?? { revenue: 0, purchases: 0 };
        e.revenue += Number(row.revenue) || 0;
        e.purchases += Number(row.purchases) || 0;
        realSales.set(row.client_id!, e);
      }

      // Fetch client names
      // Sin filtrar por status: los ex clientes tienen histórico y su nombre
      // tiene que resolverse igual, o aparecen como "Unknown" al mirar atrás.
      const { data: clientRows } = await supabase
        .from("clients")
        .select("id, name, status")
        .eq("workspace_id", wsId);

      const clientNameMap = new Map(
        (clientRows ?? []).map((c) => [c.id, c.name])
      );

      // Aggregate by client
      const clientMap = new Map<string, {
        spend: number; impressions: number; clicks: number;
        purchases: number; revenue: number; spendMeta: number; spendGoogle: number;
      }>();

      for (const row of perfRows ?? []) {
        const existing = clientMap.get(row.client_id) ?? {
          spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0,
          spendMeta: 0, spendGoogle: 0,
        };
        const spend = Number(row.spend) || 0;
        existing.spend += spend;
        existing.impressions += Number(row.impressions) || 0;
        existing.clicks += Number(row.clicks) || 0;
        existing.purchases += Number(row.purchases) || 0;
        existing.revenue += Number(row.revenue) || 0;
        if (row.provider === "meta") existing.spendMeta += spend;
        if (row.provider === "google_ads") existing.spendGoogle += spend;
        clientMap.set(row.client_id, existing);
      }

      // Build client summaries
      const clients: ClientSummary[] = [];
      const alerts: PortfolioAlert[] = [];

      for (const [clientId, metrics] of clientMap.entries()) {
        const name = clientNameMap.get(clientId) ?? "Unknown";
        const { gross, net: budgetNet } = getBudget(name, monthKey);
        const pacingPercent = budgetNet > 0 ? (metrics.spend / budgetNet) * 100 : 0;
        const pacingDelta = pacingPercent - expectedPercent;

        let pacingStatus: ClientSummary["pacingStatus"] = "on_track";
        if (budgetNet > 0) {
          if (pacingDelta > 15) pacingStatus = "overpacing";
          else if (pacingDelta > 5) pacingStatus = "overpacing";
          else if (pacingDelta < -15) pacingStatus = "underpacing";
          else if (pacingDelta < -5) pacingStatus = "underpacing";
        }

        const real = realSales.get(clientId) ?? { revenue: 0, purchases: 0 };

        const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
        // CPA y ROAS contra ventas reales, no contra lo que se atribuyen las
        // plataformas. Con revenue atribuido el ROAS de Diana daba 25x cuando
        // el real es 8x.
        const cpa = real.purchases > 0 ? metrics.spend / real.purchases : 0;
        const roas = metrics.spend > 0 ? real.revenue / metrics.spend : 0;

        clients.push({
          clientId, clientName: name,
          spend: metrics.spend, impressions: metrics.impressions,
          clicks: metrics.clicks,
          purchases: real.purchases, revenue: real.revenue,
          revenueAttributed: metrics.revenue, purchasesAttributed: metrics.purchases,
          ctr, cpa, roas,
          spendMeta: metrics.spendMeta, spendGoogle: metrics.spendGoogle,
          budgetTotal: gross, budgetNet, pacingPercent, expectedPercent,
          pacingDelta, pacingStatus,
        });

        // Generate alerts
        if (budgetNet > 0 && pacingDelta > 15) {
          alerts.push({
            clientName: name, type: "overpacing",
            severity: pacingDelta > 25 ? "critical" : "warning",
            message: `${name} va ${pacingDelta.toFixed(0)}pp por encima del pacing esperado`,
          });
        }
        if (budgetNet > 0 && pacingDelta < -15) {
          alerts.push({
            clientName: name, type: "underpacing",
            severity: pacingDelta < -25 ? "critical" : "warning",
            message: `${name} va ${Math.abs(pacingDelta).toFixed(0)}pp por debajo del pacing esperado`,
          });
        }
      }

      // Sort by spend descending
      clients.sort((a, b) => b.spend - a.spend);

      // Portfolio totals
      const totalSpend = clients.reduce((s, c) => s + c.spend, 0);
      const totalRevenue = clients.reduce((s, c) => s + c.revenue, 0);
      const totalImpressions = clients.reduce((s, c) => s + c.impressions, 0);
      const totalClicks = clients.reduce((s, c) => s + c.clicks, 0);
      const totalPurchases = clients.reduce((s, c) => s + c.purchases, 0);

      const totals: PortfolioTotals = {
        totalSpend, totalRevenue, totalImpressions, totalClicks, totalPurchases,
        blendedRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
        blendedCpa: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
        clientCount: clients.length,
        feeRevenue: totalSpend * FEE_PCT,
      };

      return {
        clients, totals, alerts,
        month: monthKey,
        daysElapsed,
        daysInMonth: totalDays,
      };
    },
  });
}
