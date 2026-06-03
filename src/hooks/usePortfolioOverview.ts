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
  purchases: number;
  revenue: number;
  ctr: number;
  cpa: number;
  roas: number;
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
        .gte("date", from)
        .lte("date", to);

      if (error) throw error;

      // Fetch client names
      const { data: clientRows } = await supabase
        .from("clients")
        .select("id, name, status")
        .eq("workspace_id", wsId)
        .eq("status", "active");

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

        const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
        const cpa = metrics.purchases > 0 ? metrics.spend / metrics.purchases : 0;
        const roas = metrics.spend > 0 ? metrics.revenue / metrics.spend : 0;

        clients.push({
          clientId, clientName: name,
          spend: metrics.spend, impressions: metrics.impressions,
          clicks: metrics.clicks, purchases: metrics.purchases,
          revenue: metrics.revenue, ctr, cpa, roas,
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
