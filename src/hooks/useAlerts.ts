import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { subDays, format, differenceInDays, getDate, getDaysInMonth } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────
export type AlertType =
  | "roas_drop"
  | "budget_warning"
  | "budget_critical"
  | "no_data"
  | "zero_spend"
  | "spend_spike";

export type AlertSeverity = "warning" | "critical";

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  client_id?: string;
  client_name?: string;
  value?: number;
  threshold?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────
const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");
const fmtUSD = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function groupByClient(rows: any[]): Map<string, { id: string; name: string; rows: any[] }> {
  const map = new Map<string, { id: string; name: string; rows: any[] }>();
  for (const r of rows) {
    const key = r.client_id ?? "__global__";
    const ex = map.get(key) ?? { id: r.client_id, name: r.client_name ?? "Sin cliente", rows: [] };
    ex.rows.push(r);
    map.set(key, ex);
  }
  return map;
}

// ── Main hook ──────────────────────────────────────────────────────────
export function useAlerts() {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id ?? "";

  const today = new Date();
  const from14 = fmtDate(subDays(today, 14));
  const toToday = fmtDate(today);

  // Fetch last 14 days of ad performance (exclude ga4)
  const { data: perfRows = [], isLoading: perfLoading } = useQuery({
    queryKey: ["alerts-perf", wsId],
    enabled: !!wsId,
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
    queryFn: async () => {
      const { data } = await supabase
        .from("performance_daily")
        .select("date, client_id, provider, spend, revenue, purchases, client_name:clients(name)")
        .eq("workspace_id", wsId)
        .neq("provider", "ga4")
        .gte("date", from14)
        .lte("date", toToday)
        .order("date");
      // Flatten client name
      return (data ?? []).map((r: any) => ({
        ...r,
        client_name: r.client_name?.name ?? null,
      }));
    },
  });

  // Fetch segments with budgets for budget alerts
  const { data: segments = [], isLoading: segLoading } = useQuery({
    queryKey: ["alerts-segments", wsId],
    enabled: !!wsId,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("segments")
        .select("id, name, monthly_budget, currency, client_id, clients(name)")
        .eq("workspace_id", wsId)
        .gt("monthly_budget", 0);
      return (data ?? []).map((s: any) => ({
        ...s,
        client_name: s.clients?.name ?? null,
      }));
    },
  });

  // Fetch MTD spend per segment via campaign_segment_map
  const { data: segmentSpend = [], isLoading: spendLoading } = useQuery({
    queryKey: ["alerts-segment-spend", wsId],
    enabled: !!wsId && segments.length > 0,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const mtdFrom = fmtDate(new Date(today.getFullYear(), today.getMonth(), 1));
      const { data: maps } = await supabase
        .from("campaign_segment_map")
        .select("segment_id, account_id")
        .in("segment_id", segments.map((s: any) => s.id));

      if (!maps?.length) return [];

      const accountIds = [...new Set(maps.map((m: any) => m.account_id))];
      const { data: spendData } = await supabase
        .from("performance_daily")
        .select("account_id, spend")
        .eq("workspace_id", wsId)
        .in("account_id", accountIds)
        .gte("date", mtdFrom)
        .lte("date", toToday);

      // Sum spend per account
      const spendByAccount = new Map<string, number>();
      for (const r of spendData ?? []) {
        spendByAccount.set(r.account_id, (spendByAccount.get(r.account_id) ?? 0) + (Number(r.spend) || 0));
      }

      // Sum spend per segment
      return segments.map((seg: any) => {
        const accountsForSeg = maps.filter((m: any) => m.segment_id === seg.id).map((m: any) => m.account_id);
        const spendMTD = accountsForSeg.reduce((s: number, acc: string) => s + (spendByAccount.get(acc) ?? 0), 0);
        return { ...seg, spendMTD };
      });
    },
  });

  // ── Compute alerts ─────────────────────────────────────────────────
  const alerts = useMemo<Alert[]>(() => {
    if (!perfRows.length && !segmentSpend.length) return [];

    const result: Alert[] = [];
    const yesterdayStr = fmtDate(subDays(today, 1));
    const threeDaysAgoStr = fmtDate(subDays(today, 3));
    const sevenDaysAgoStr = fmtDate(subDays(today, 7));

    const byClient = groupByClient(perfRows);

    for (const [, client] of byClient) {
      const { id: clientId, name: clientName, rows } = client;
      if (!clientId || clientId === "__global__") continue;

      // ── 1. No data alert ──────────────────────────────────────────
      const sortedDates = [...new Set(rows.map((r) => r.date))].sort();
      const lastDataDate = sortedDates[sortedDates.length - 1];
      const daysSinceData = lastDataDate
        ? differenceInDays(today, new Date(lastDataDate + "T00:00:00"))
        : 999;

      // Only alert if they had data in the first part of the window (not a new client)
      const hadRecentData = rows.some((r) => r.date <= sevenDaysAgoStr);
      if (daysSinceData >= 3 && hadRecentData) {
        result.push({
          id: `no_data_${clientId}`,
          type: "no_data",
          severity: daysSinceData >= 5 ? "critical" : "warning",
          title: "Sin datos de performance",
          description: `${clientName} no tiene datos hace ${daysSinceData} días. Verificá la conexión de la cuenta.`,
          client_id: clientId,
          client_name: clientName,
          value: daysSinceData,
        });
        continue; // skip other alerts if no data
      }

      // ── 2. Zero spend alert ───────────────────────────────────────
      const recentRows = rows.filter((r) => r.date >= threeDaysAgoStr);
      const recentSpend = recentRows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
      const baselineRows = rows.filter((r) => r.date < threeDaysAgoStr);
      const baselineSpend = baselineRows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
      const avgDailyBaseline = baselineRows.length > 0 ? baselineSpend / Math.max(differenceInDays(new Date(threeDaysAgoStr), new Date(from14 + "T00:00:00")), 1) : 0;

      if (recentSpend === 0 && avgDailyBaseline > 10) {
        result.push({
          id: `zero_spend_${clientId}`,
          type: "zero_spend",
          severity: "critical",
          title: "Gasto $0 en los últimos 3 días",
          description: `${clientName} tiene $0 de gasto. El promedio anterior era ${fmtUSD(avgDailyBaseline)}/día.`,
          client_id: clientId,
          client_name: clientName,
          value: 0,
          threshold: avgDailyBaseline,
        });
        continue;
      }

      // ── 3. ROAS drop alert ────────────────────────────────────────
      const recentAdRows = recentRows.filter((r) => r.spend > 0);
      const baselineAdRows = baselineRows.filter((r) => r.spend > 0);

      const recentRoasSpend = recentAdRows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
      const recentRoasRevenue = recentAdRows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
      const baselineRoasSpend = baselineAdRows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
      const baselineRoasRevenue = baselineAdRows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);

      const recentROAS = recentRoasSpend > 0 ? recentRoasRevenue / recentRoasSpend : null;
      const baselineROAS = baselineRoasSpend > 0 ? baselineRoasRevenue / baselineRoasSpend : null;

      if (recentROAS !== null && baselineROAS !== null && baselineROAS > 0.5) {
        const drop = (baselineROAS - recentROAS) / baselineROAS;
        if (drop >= 0.5) {
          result.push({
            id: `roas_drop_${clientId}`,
            type: "roas_drop",
            severity: "critical",
            title: "ROAS caído >50%",
            description: `${clientName}: ROAS últimos 3 días ${recentROAS.toFixed(2)}x vs baseline ${baselineROAS.toFixed(2)}x (−${(drop * 100).toFixed(0)}%).`,
            client_id: clientId,
            client_name: clientName,
            value: recentROAS,
            threshold: baselineROAS,
          });
        } else if (drop >= 0.3) {
          result.push({
            id: `roas_drop_${clientId}`,
            type: "roas_drop",
            severity: "warning",
            title: "ROAS cayó >30%",
            description: `${clientName}: ROAS últimos 3 días ${recentROAS.toFixed(2)}x vs baseline ${baselineROAS.toFixed(2)}x (−${(drop * 100).toFixed(0)}%).`,
            client_id: clientId,
            client_name: clientName,
            value: recentROAS,
            threshold: baselineROAS,
          });
        }
      }

      // ── 4. Spend spike alert ──────────────────────────────────────
      const yesterdaySpend = rows
        .filter((r) => r.date === yesterdayStr)
        .reduce((s, r) => s + (Number(r.spend) || 0), 0);

      const avgDailySpend = baselineRows.length > 0
        ? baselineSpend / Math.max(differenceInDays(new Date(threeDaysAgoStr), new Date(from14 + "T00:00:00")), 1)
        : 0;

      if (yesterdaySpend > 0 && avgDailySpend > 0 && yesterdaySpend > avgDailySpend * 2) {
        result.push({
          id: `spend_spike_${clientId}`,
          type: "spend_spike",
          severity: "warning",
          title: "Spike de gasto detectado",
          description: `${clientName}: ayer se gastaron ${fmtUSD(yesterdaySpend)} (${(yesterdaySpend / avgDailySpend).toFixed(1)}x el promedio diario de ${fmtUSD(avgDailySpend)}).`,
          client_id: clientId,
          client_name: clientName,
          value: yesterdaySpend,
          threshold: avgDailySpend,
        });
      }
    }

    // ── 5. Budget alerts (from segments) ─────────────────────────────
    const daysElapsed = getDate(today);
    const daysInMonth = getDaysInMonth(today);
    const expectedPacePct = daysElapsed / daysInMonth;

    for (const seg of segmentSpend) {
      const pct = seg.monthly_budget > 0 ? seg.spendMTD / seg.monthly_budget : 0;
      const overPace = pct - expectedPacePct;

      if (pct >= 1.0) {
        result.push({
          id: `budget_critical_${seg.id}`,
          type: "budget_critical",
          severity: "critical",
          title: "Budget superado",
          description: `Segmento "${seg.name}" (${seg.client_name ?? "sin cliente"}): ${fmtUSD(seg.spendMTD)} gastados de ${fmtUSD(seg.monthly_budget)} (${(pct * 100).toFixed(0)}%).`,
          client_id: seg.client_id,
          client_name: seg.client_name,
          value: pct * 100,
          threshold: 100,
        });
      } else if (pct >= 0.9 || overPace >= 0.2) {
        result.push({
          id: `budget_warning_${seg.id}`,
          type: "budget_warning",
          severity: "warning",
          title: pct >= 0.9 ? "Budget casi agotado" : "Ritmo de gasto acelerado",
          description: `Segmento "${seg.name}" (${seg.client_name ?? "sin cliente"}): ${(pct * 100).toFixed(0)}% consumido. Ritmo actual: ${(overPace * 100).toFixed(0)}% por encima del esperado.`,
          client_id: seg.client_id,
          client_name: seg.client_name,
          value: pct * 100,
          threshold: 90,
        });
      }
    }

    // Sort: critical first, then warning
    return result.sort((a, b) => {
      if (a.severity === b.severity) return 0;
      return a.severity === "critical" ? -1 : 1;
    });
  }, [perfRows, segmentSpend]);

  return {
    alerts,
    count: alerts.length,
    criticalCount: alerts.filter((a) => a.severity === "critical").length,
    isLoading: perfLoading || segLoading || spendLoading,
  };
}
