import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { format, subDays, differenceInDays } from "date-fns";

export interface CampaignRow {
  campaignId: string;
  campaignName: string;
  provider: string;
  accountName: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  purchases: number;
  revenue: number;
  cpa: number;
  roas: number;
  cpc: number;
  currency: string;
}

export interface DailyPoint {
  date: string;
  spend: number;
  purchases: number;
  impressions: number;
  clicks: number;
  revenue: number;
  cpa: number;
  cpc: number;
  ctr: number;
}

export interface PlatformTotals {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  purchases: number;
  revenue: number;
  cpa: number;
  roas: number;
  cpc: number;
}

const EMPTY_TOTALS: PlatformTotals = {
  spend: 0, impressions: 0, clicks: 0, ctr: 0,
  purchases: 0, revenue: 0, cpa: 0, roas: 0, cpc: 0,
};

export interface PerformanceResult {
  meta: {
    totals: PlatformTotals;
    prevTotals: PlatformTotals;
    campaigns: CampaignRow[];
    daily: DailyPoint[];
  };
  google: {
    totals: PlatformTotals;
    prevTotals: PlatformTotals;
    campaigns: CampaignRow[];
    daily: DailyPoint[];
  };
}

function aggregateRows(rows: any[], campaignNames: Map<string, string>, accountNames: Map<string, string>) {
  const campaignMap = new Map<string, {
    name: string; provider: string; accountName: string;
    spend: number; impressions: number; clicks: number;
    purchases: number; revenue: number; currency: string;
  }>();
  const dailyMap = new Map<string, DailyPoint>();

  for (const row of rows) {
    const cId = row.entity_id ?? row.id;
    const existing = campaignMap.get(cId);
    if (existing) {
      existing.spend += Number(row.spend) || 0;
      existing.impressions += Number(row.impressions) || 0;
      existing.clicks += Number(row.clicks) || 0;
      existing.purchases += Number(row.purchases) || 0;
      existing.revenue += Number(row.revenue) || 0;
    } else {
      campaignMap.set(cId, {
        name: campaignNames.get(cId) ?? "Unknown",
        provider: row.provider,
        accountName: accountNames.get(row.account_id) ?? "Unknown",
        spend: Number(row.spend) || 0,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        purchases: Number(row.purchases) || 0,
        revenue: Number(row.revenue) || 0,
        currency: row.currency ?? "USD",
      });
    }

    const d = row.date;
    const dp = dailyMap.get(d);
    const daySpend = Number(row.spend) || 0;
    const dayClicks = Number(row.clicks) || 0;
    const dayImpr = Number(row.impressions) || 0;
    const dayPurch = Number(row.purchases) || 0;
    const dayRev = Number(row.revenue) || 0;
    if (dp) {
      dp.spend += daySpend;
      dp.purchases += dayPurch;
      dp.impressions += dayImpr;
      dp.clicks += dayClicks;
      dp.revenue += dayRev;
    } else {
      dailyMap.set(d, {
        date: d,
        spend: daySpend,
        purchases: dayPurch,
        impressions: dayImpr,
        clicks: dayClicks,
        revenue: dayRev,
        cpa: 0, cpc: 0, ctr: 0,
      });
    }
  }

  // Compute derived daily metrics
  const daily: DailyPoint[] = Array.from(dailyMap.values())
    .map((dp) => ({
      ...dp,
      cpa: dp.purchases > 0 ? dp.spend / dp.purchases : 0,
      cpc: dp.clicks > 0 ? dp.spend / dp.clicks : 0,
      ctr: dp.impressions > 0 ? (dp.clicks / dp.impressions) * 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const campaigns: CampaignRow[] = Array.from(campaignMap.entries())
    .map(([id, c]) => ({
      campaignId: id,
      campaignName: c.name,
      provider: c.provider,
      accountName: c.accountName,
      spend: c.spend,
      impressions: c.impressions,
      clicks: c.clicks,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      purchases: c.purchases,
      revenue: c.revenue,
      cpa: c.purchases > 0 ? c.spend / c.purchases : 0,
      roas: c.spend > 0 ? c.revenue / c.spend : 0,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
      currency: c.currency,
    }))
    .sort((a, b) => b.spend - a.spend);

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalPurchases = campaigns.reduce((s, c) => s + c.purchases, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);

  const totals: PlatformTotals = {
    spend: totalSpend,
    impressions: totalImpressions,
    clicks: totalClicks,
    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    purchases: totalPurchases,
    revenue: totalRevenue,
    cpa: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
    roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
  };

  return { campaigns, daily, totals };
}

function computePrevTotals(rows: any[]): PlatformTotals {
  const spend = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const impressions = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
  const clicks = rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
  const purchases = rows.reduce((s, r) => s + (Number(r.purchases) || 0), 0);
  const revenue = rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
  return {
    spend, impressions, clicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    purchases, revenue,
    cpa: purchases > 0 ? spend / purchases : 0,
    roas: spend > 0 ? revenue / spend : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
  };
}

export function usePerformanceData() {
  const { currentWorkspace, dateRange, platformFilter } = useWorkspace();
  const { selectedClient } = useClient();

  const rangeDays = differenceInDays(dateRange.to, dateRange.from);
  const prevTo = subDays(dateRange.from, 1);
  const prevFrom = subDays(dateRange.from, rangeDays + 1);

  return useQuery<PerformanceResult>({
    queryKey: [
      "performance-v2",
      currentWorkspace?.id,
      selectedClient?.id,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
      platformFilter,
    ],
    enabled: !!currentWorkspace,
    queryFn: async () => {
      const wsId = currentWorkspace!.id;
      const from = format(dateRange.from, "yyyy-MM-dd");
      const to = format(dateRange.to, "yyyy-MM-dd");
      const pFrom = format(prevFrom, "yyyy-MM-dd");
      const pTo = format(prevTo, "yyyy-MM-dd");

      // Resolve linked account UUIDs for selected client
      let linkedAccountIds: string[] | null = null;
      if (selectedClient) {
        const { data: cas } = await supabase
          .from("client_account_settings")
          .select("external_account_id, platform")
          .eq("client_id", selectedClient.id)
          .eq("is_enabled", true);

        if (cas && cas.length > 0) {
          const { data: accts } = await supabase
            .from("accounts")
            .select("id, external_account_id, provider")
            .eq("workspace_id", wsId);
          linkedAccountIds = (accts ?? [])
            .filter((a) => cas.some((c) => c.external_account_id === a.external_account_id && c.platform === a.provider))
            .map((a) => a.id);
        } else {
          linkedAccountIds = [];
        }
      }

      if (linkedAccountIds !== null && linkedAccountIds.length === 0) {
        return {
          meta: { totals: EMPTY_TOTALS, prevTotals: EMPTY_TOTALS, campaigns: [], daily: [] },
          google: { totals: EMPTY_TOTALS, prevTotals: EMPTY_TOTALS, campaigns: [], daily: [] },
        };
      }

      const buildQuery = (dateFrom: string, dateTo: string, provider?: string) => {
        let q = supabase
          .from("performance_daily")
          .select("*")
          .eq("workspace_id", wsId)
          .eq("entity_type", "campaign")
          .gte("date", dateFrom)
          .lte("date", dateTo);
        if (provider) q = q.eq("provider", provider);
        if (linkedAccountIds) q = q.in("account_id", linkedAccountIds);
        return q;
      };

      const [campRes, acctRes, metaRes, googleRes, metaPrevRes, googlePrevRes] = await Promise.all([
        supabase.from("campaigns").select("id, name").eq("workspace_id", wsId),
        supabase.from("accounts").select("id, name").eq("workspace_id", wsId),
        // Only fetch if platformFilter allows it
        platformFilter === "google_ads" ? Promise.resolve({ data: [] }) : buildQuery(from, to, "meta"),
        platformFilter === "meta" ? Promise.resolve({ data: [] }) : buildQuery(from, to, "google_ads"),
        platformFilter === "google_ads" ? Promise.resolve({ data: [] }) : buildQuery(pFrom, pTo, "meta"),
        platformFilter === "meta" ? Promise.resolve({ data: [] }) : buildQuery(pFrom, pTo, "google_ads"),
      ]);

      const campaignNames = new Map((campRes.data ?? []).map((c) => [c.id, c.name]));
      const accountNames = new Map((acctRes.data ?? []).map((a) => [a.id, a.name]));

      const metaAgg = aggregateRows(metaRes.data ?? [], campaignNames, accountNames);
      const googleAgg = aggregateRows(googleRes.data ?? [], campaignNames, accountNames);
      const metaPrevTotals = computePrevTotals(metaPrevRes.data ?? []);
      const googlePrevTotals = computePrevTotals(googlePrevRes.data ?? []);

      return {
        meta: { ...metaAgg, prevTotals: metaPrevTotals },
        google: { ...googleAgg, prevTotals: googlePrevTotals },
      };
    },
  });
}
