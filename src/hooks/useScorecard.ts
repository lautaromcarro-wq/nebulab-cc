import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
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

export interface ScorecardTotals {
  totalSpend: number;
  totalRevenue: number;
  totalImpressions: number;
  totalClicks: number;
  totalPurchases: number;
  roas: number;
  ctr: number;
  // New: per-platform ROAS
  roasMeta: number;
  roasGoogle: number;
  roasGa4: number;
  blendedRoas: number;
  revenueGa4: number;
  spendMeta: number;
  spendGoogle: number;
}

export function useScorecard() {
  const {
    currentWorkspace,
    segments,
    selectedSegmentId,
    dateRange,
  } = useWorkspace();

  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["scorecard", currentWorkspace?.id, selectedSegmentId, fromStr, toStr],
    queryFn: async (): Promise<{ cards: SegmentScorecard[]; totals: ScorecardTotals }> => {
      if (!currentWorkspace) return { cards: [], totals: emptyTotals() };

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

      const [segResult, revResult] = await Promise.all([
        segQuery,
        supabase
          .from("workspace_revenue_daily")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .gte("date", fromStr)
          .lte("date", toStr),
      ]);

      if (segResult.error) throw segResult.error;

      const rows = segResult.data ?? [];
      const revenueRows = revResult.data ?? [];

      // Workspace-level revenue from workspace_revenue_daily
      const wsRevenueGa4 = revenueRows.reduce((s, r) => s + (Number(r.total_revenue) || 0), 0);
      const wsPurchases = revenueRows.reduce((s, r) => s + (Number(r.total_purchases) || 0), 0);

      // Group segment_daily by segment_id
      const grouped = new Map<string, typeof rows>();
      for (const row of rows) {
        const arr = grouped.get(row.segment_id) ?? [];
        arr.push(row);
        grouped.set(row.segment_id, arr);
      }

      const daysInRange = differenceInDays(dateRange.to, dateRange.from) + 1;
      const daysInMonth = getDaysInMonth(dateRange.from);

      const filteredSegments = selectedSegmentId
        ? segments.filter((s) => s.id === selectedSegmentId)
        : segments;

      const cards: SegmentScorecard[] = filteredSegments.map((seg) => {
        const segRows = grouped.get(seg.id) ?? [];
        const totalSpend = sumNum(segRows, "spend");
        const spendMeta = sumNum(segRows, "spend_meta");
        const spendGoogle = sumNum(segRows, "spend_google");
        const revenuePlatform = sumNum(segRows, "revenue_platform");
        const revenueGa4 = sumNum(segRows, "revenue_ga4");
        const impressions = sumInt(segRows, "impressions");
        const clicks = sumInt(segRows, "clicks");
        const purchases = sumInt(segRows, "purchases");

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

      const totalSpend = cards.reduce((s, c) => s + c.totalSpend, 0);
      const totalRevenue = cards.reduce((s, c) => s + (c.revenueGa4 || c.revenuePlatform), 0);
      const totalImpressions = cards.reduce((s, c) => s + c.impressions, 0);
      const totalClicks = cards.reduce((s, c) => s + c.clicks, 0);
      const totalPurchases = cards.reduce((s, c) => s + c.purchases, 0);
      const totalSpendMeta = cards.reduce((s, c) => s + c.spendMeta, 0);
      const totalSpendGoogle = cards.reduce((s, c) => s + c.spendGoogle, 0);
      const totalRevPlatform = cards.reduce((s, c) => s + c.revenuePlatform, 0);
      const totalRevGa4 = cards.reduce((s, c) => s + c.revenueGa4, 0);

      // Use workspace_revenue_daily as fallback if segments have no GA4 revenue
      const effectiveRevGa4 = totalRevGa4 > 0 ? totalRevGa4 : wsRevenueGa4;

      return {
        cards,
        totals: {
          totalSpend,
          totalRevenue: totalRevenue > 0 ? totalRevenue : wsRevenueGa4,
          totalImpressions,
          totalClicks,
          totalPurchases: totalPurchases > 0 ? totalPurchases : wsPurchases,
          roas: totalSpend > 0 ? (totalRevenue > 0 ? totalRevenue : wsRevenueGa4) / totalSpend : 0,
          ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          roasMeta: totalSpendMeta > 0 ? totalRevPlatform / totalSpendMeta : 0,
          roasGoogle: totalSpendGoogle > 0 ? totalRevPlatform / totalSpendGoogle : 0,
          roasGa4: totalSpend > 0 ? effectiveRevGa4 / totalSpend : 0,
          blendedRoas: totalSpend > 0 ? effectiveRevGa4 / totalSpend : 0,
          revenueGa4: effectiveRevGa4,
          spendMeta: totalSpendMeta,
          spendGoogle: totalSpendGoogle,
        },
      };
    },
    enabled: !!currentWorkspace,
  });
}

function sumNum(rows: any[], key: string): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function sumInt(rows: any[], key: string): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

function emptyTotals(): ScorecardTotals {
  return {
    totalSpend: 0, totalRevenue: 0, totalImpressions: 0, totalClicks: 0, totalPurchases: 0,
    roas: 0, ctr: 0, roasMeta: 0, roasGoogle: 0, roasGa4: 0, blendedRoas: 0,
    revenueGa4: 0, spendMeta: 0, spendGoogle: 0,
  };
}
