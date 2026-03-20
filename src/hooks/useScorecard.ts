import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { useFinancialSettings } from "@/hooks/useFinancialSettings";
import { format, getDaysInMonth, differenceInDays } from "date-fns";

export interface SegmentScorecard {
  segmentId: string;
  segmentName: string;
  currency: string;
  monthlyBudget: number;
  tolerancePercent: number;
  rollingAvgDays: number;
  totalSpend: number;
  spendMeta: number;
  spendGoogle: number;
  revenuePlatform: number;
  revenueGa4: number;
  impressions: number;
  clicks: number;
  purchases: number;
  roas: number;
  ctr: number;
  cpc: number;
  pacingStatus: "overpacing" | "on_track" | "underpacing";
  projectedEom: number;
  budgetUsedPercent: number;
  dailyAvgSpend: number;
}

export interface ScorecardDaily {
  date: string;
  spend: number;
  revenue: number;
}

export interface ScorecardTotals {
  totalSpend: number;
  totalRevenue: number;
  totalImpressions: number;
  totalClicks: number;
  totalPurchases: number;
  roas: number;
  ctr: number;
  roasMeta: number;
  roasGoogle: number;
  roasGa4: number;
  blendedRoas: number;
  revenueGa4: number;
  spendMeta: number;
  spendGoogle: number;
  contributionMargin: number;
  marginPercent: number;
}

export function useScorecard() {
  const {
    currentWorkspace,
    segments,
    selectedSegmentId,
    dateRange,
  } = useWorkspace();
  const { selectedClient } = useClient();
  const { settings: fin } = useFinancialSettings();

  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");
  const clientId = selectedClient?.id ?? null;

  return useQuery({
    queryKey: ["scorecard", currentWorkspace?.id, clientId, selectedSegmentId, fromStr, toStr],
    queryFn: async (): Promise<{ cards: SegmentScorecard[]; totals: ScorecardTotals; daily: ScorecardDaily[] }> => {
      if (!currentWorkspace) return { cards: [], totals: emptyTotals(), daily: [] };

      // Filter segments by client if selected
      const filteredSegments = segments.filter((s) => {
        if (selectedSegmentId && s.id !== selectedSegmentId) return false;
        if (clientId && (s as any).client_id && (s as any).client_id !== clientId) return false;
        if (clientId && !(s as any).client_id) return false; // skip unassigned segments when client is selected
        return true;
      });

      // Fetch segment_daily and workspace_revenue_daily in parallel
      let segQuery = supabase
        .from("segment_daily")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .gte("date", fromStr)
        .lte("date", toStr);

      if (selectedSegmentId) {
        segQuery = segQuery.eq("segment_id", selectedSegmentId);
      }
      if (clientId) {
        segQuery = segQuery.eq("client_id", clientId);
      }

      let revQuery = supabase
        .from("workspace_revenue_daily")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .gte("date", fromStr)
        .lte("date", toStr);

      if (clientId) {
        revQuery = revQuery.eq("client_id", clientId);
      }

      const [segResult, revResult] = await Promise.all([segQuery, revQuery]);

      if (segResult.error) throw segResult.error;

      const rows = segResult.data ?? [];
      const revenueRows = revResult.data ?? [];

      // Daily totals for trend chart
      const dailyMap = new Map<string, ScorecardDaily>();
      for (const row of rows) {
        const d = row.date as string;
        const ex = dailyMap.get(d);
        const spend = Number(row.spend) || 0;
        const rev = (Number(row.revenue_ga4) || Number(row.revenue_platform) || 0);
        if (ex) { ex.spend += spend; ex.revenue += rev; }
        else { dailyMap.set(d, { date: d, spend, revenue: rev }); }
      }
      const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      const { wsRevenueGa4, wsPurchases } = revenueRows.reduce(
        (acc, r) => ({
          wsRevenueGa4: acc.wsRevenueGa4 + (Number(r.total_revenue) || 0),
          wsPurchases: acc.wsPurchases + (Number(r.total_purchases) || 0),
        }),
        { wsRevenueGa4: 0, wsPurchases: 0 },
      );

      // Group segment_daily by segment_id
      const grouped = new Map<string, typeof rows>();
      for (const row of rows) {
        const arr = grouped.get(row.segment_id) ?? [];
        arr.push(row);
        grouped.set(row.segment_id, arr);
      }

      const daysInRange = differenceInDays(dateRange.to, dateRange.from) + 1;
      const daysInMonth = getDaysInMonth(dateRange.from);

      const cards: SegmentScorecard[] = filteredSegments.map((seg) => {
        const segRows = grouped.get(seg.id) ?? [];
        const totalSpend = sumNum(segRows, "spend");
        const spendMeta = sumNum(segRows, "spend_meta");
        const spendGoogle = sumNum(segRows, "spend_google");
        const revenuePlatform = sumNum(segRows, "revenue_platform");
        const revenueGa4 = sumNum(segRows, "revenue_ga4");
        const impressions = sumNum(segRows, "impressions");
        const clicks = sumNum(segRows, "clicks");
        const purchases = sumNum(segRows, "purchases");

        const revenue = revenueGa4 || revenuePlatform;
        const roas = totalSpend > 0 ? revenue / totalSpend : 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpc = clicks > 0 ? totalSpend / clicks : 0;

        const uniqueDays = new Set(segRows.map((r) => r.date)).size;
        const dailyAvgSpend = uniqueDays > 0 ? totalSpend / uniqueDays : 0;
        const projectedEom = dailyAvgSpend * daysInMonth;
        const budget = Number(seg.monthly_budget) || 0;
        const tolerance = Number(seg.tolerance_percent) || 0.07;

        let pacingStatus: SegmentScorecard["pacingStatus"] = "on_track";
        if (budget > 0) {
          const ratio = projectedEom / budget;
          if (ratio > 1 + tolerance) pacingStatus = "overpacing";
          else if (ratio < 1 - tolerance) pacingStatus = "underpacing";
        }

        const budgetUsedPercent = budget > 0 ? (totalSpend / budget) * 100 : 0;

        return {
          segmentId: seg.id,
          segmentName: seg.name,
          currency: seg.currency,
          monthlyBudget: budget,
          tolerancePercent: tolerance,
          rollingAvgDays: seg.rolling_avg_days,
          totalSpend,
          spendMeta,
          spendGoogle,
          revenuePlatform,
          revenueGa4,
          impressions,
          clicks,
          purchases,
          roas,
          ctr,
          cpc,
          pacingStatus,
          projectedEom,
          budgetUsedPercent,
          dailyAvgSpend,
        };
      });

      const {
        totalSpend, totalRevenue, totalImpressions, totalClicks, totalPurchases,
        totalSpendMeta, totalSpendGoogle, totalRevPlatform, totalRevGa4,
      } = cards.reduce(
        (acc, c) => ({
          totalSpend: acc.totalSpend + c.totalSpend,
          totalRevenue: acc.totalRevenue + (c.revenueGa4 || c.revenuePlatform),
          totalImpressions: acc.totalImpressions + c.impressions,
          totalClicks: acc.totalClicks + c.clicks,
          totalPurchases: acc.totalPurchases + c.purchases,
          totalSpendMeta: acc.totalSpendMeta + c.spendMeta,
          totalSpendGoogle: acc.totalSpendGoogle + c.spendGoogle,
          totalRevPlatform: acc.totalRevPlatform + c.revenuePlatform,
          totalRevGa4: acc.totalRevGa4 + c.revenueGa4,
        }),
        { totalSpend: 0, totalRevenue: 0, totalImpressions: 0, totalClicks: 0, totalPurchases: 0, totalSpendMeta: 0, totalSpendGoogle: 0, totalRevPlatform: 0, totalRevGa4: 0 },
      );

      const effectiveRevGa4 = totalRevGa4 > 0 ? totalRevGa4 : wsRevenueGa4;
      const effectiveRev = totalRevenue > 0 ? totalRevenue : wsRevenueGa4;

      // Contribution margin calculation
      const totalDeductions =
        effectiveRev * (fin.avg_cogs_percent / 100) +
        effectiveRev * (fin.shipping_percent / 100) +
        effectiveRev * (fin.payment_fee_percent / 100) +
        effectiveRev * (fin.refund_percent / 100) +
        effectiveRev * (fin.iva_percent / 100);
      const contributionMargin = effectiveRev - totalSpend - totalDeductions;
      const marginPercent = effectiveRev > 0 ? (contributionMargin / effectiveRev) * 100 : 0;

      return {
        cards,
        daily,
        totals: {
          totalSpend,
          totalRevenue: effectiveRev,
          totalImpressions,
          totalClicks,
          totalPurchases: totalPurchases > 0 ? totalPurchases : wsPurchases,
          roas: totalSpend > 0 ? effectiveRev / totalSpend : 0,
          ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          roasMeta: totalSpendMeta > 0 ? totalRevPlatform / totalSpendMeta : 0,
          roasGoogle: totalSpendGoogle > 0 ? totalRevPlatform / totalSpendGoogle : 0,
          roasGa4: totalSpend > 0 ? effectiveRevGa4 / totalSpend : 0,
          blendedRoas: totalSpend > 0 ? effectiveRevGa4 / totalSpend : 0,
          revenueGa4: effectiveRevGa4,
          spendMeta: totalSpendMeta,
          spendGoogle: totalSpendGoogle,
          contributionMargin,
          marginPercent,
        },
      };
    },
    enabled: !!currentWorkspace,
  });
}

function sumNum(rows: any[], key: string): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function emptyTotals(): ScorecardTotals {
  return {
    totalSpend: 0, totalRevenue: 0, totalImpressions: 0, totalClicks: 0, totalPurchases: 0,
    roas: 0, ctr: 0, roasMeta: 0, roasGoogle: 0, roasGa4: 0, blendedRoas: 0,
    revenueGa4: 0, spendMeta: 0, spendGoogle: 0, contributionMargin: 0, marginPercent: 0,
  };
}
