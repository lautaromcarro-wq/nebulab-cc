import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { format } from "date-fns";

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
  currency: string;
}

export interface DailyPoint {
  date: string;
  spend: number;
  purchases: number;
  impressions: number;
  clicks: number;
  revenue: number;
}

export interface PerformanceData {
  campaigns: CampaignRow[];
  daily: DailyPoint[];
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    purchases: number;
    revenue: number;
    cpa: number;
    roas: number;
  };
}

export function usePerformanceData() {
  const { currentWorkspace, dateRange, platformFilter } = useWorkspace();
  const { selectedClient } = useClient();

  return useQuery<PerformanceData>({
    queryKey: [
      "performance",
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

      // Fetch performance rows, campaigns, and accounts in parallel
      let perfQuery = supabase
        .from("performance_daily")
        .select("*")
        .eq("workspace_id", wsId)
        .eq("entity_type", "campaign")
        .gte("date", from)
        .lte("date", to);

      if (platformFilter !== "all") {
        perfQuery = perfQuery.eq("provider", platformFilter);
      }
      if (selectedClient) {
        perfQuery = perfQuery.eq("client_id", selectedClient.id);
      }

      const [perfRes, campRes, acctRes] = await Promise.all([
        perfQuery,
        supabase.from("campaigns").select("id, name").eq("workspace_id", wsId),
        supabase.from("accounts").select("id, name").eq("workspace_id", wsId),
      ]);

      if (perfRes.error) throw perfRes.error;

      const rows = perfRes.data ?? [];
      const campaignNames = new Map((campRes.data ?? []).map((c) => [c.id, c.name]));
      const accountNames = new Map((acctRes.data ?? []).map((a) => [a.id, a.name]));

      // Aggregate by campaign
      const campaignMap = new Map<string, {
        name: string;
        provider: string;
        accountName: string;
        spend: number;
        impressions: number;
        clicks: number;
        purchases: number;
        revenue: number;
        currency: string;
      }>();

      const dailyMap = new Map<string, DailyPoint>();

      for (const row of rows) {
        const cId = row.entity_id ?? row.id;
        const campName = campaignNames.get(cId) ?? "Unknown";
        const acctName = accountNames.get(row.account_id) ?? "Unknown";

        const existing = campaignMap.get(cId);
        if (existing) {
          existing.spend += Number(row.spend) || 0;
          existing.impressions += Number(row.impressions) || 0;
          existing.clicks += Number(row.clicks) || 0;
          existing.purchases += Number(row.purchases) || 0;
          existing.revenue += Number(row.revenue) || 0;
        } else {
          campaignMap.set(cId, {
            name: campName,
            provider: row.provider,
            accountName: acctName,
            spend: Number(row.spend) || 0,
            impressions: Number(row.impressions) || 0,
            clicks: Number(row.clicks) || 0,
            purchases: Number(row.purchases) || 0,
            revenue: Number(row.revenue) || 0,
            currency: row.currency,
          });
        }

        // Daily aggregation
        const d = row.date;
        const dp = dailyMap.get(d);
        if (dp) {
          dp.spend += Number(row.spend) || 0;
          dp.purchases += Number(row.purchases) || 0;
          dp.impressions += Number(row.impressions) || 0;
          dp.clicks += Number(row.clicks) || 0;
          dp.revenue += Number(row.revenue) || 0;
        } else {
          dailyMap.set(d, {
            date: d,
            spend: Number(row.spend) || 0,
            purchases: Number(row.purchases) || 0,
            impressions: Number(row.impressions) || 0,
            clicks: Number(row.clicks) || 0,
            revenue: Number(row.revenue) || 0,
          });
        }
      }

      const campaigns: CampaignRow[] = Array.from(campaignMap.entries()).map(
        ([id, c]) => ({
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
          currency: c.currency,
        })
      );

      campaigns.sort((a, b) => b.spend - a.spend);

      const daily = Array.from(dailyMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
      const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
      const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
      const totalPurchases = campaigns.reduce((s, c) => s + c.purchases, 0);
      const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);

      return {
        campaigns,
        daily,
        totals: {
          spend: totalSpend,
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          purchases: totalPurchases,
          revenue: totalRevenue,
          cpa: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
          roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
        },
      };
    },
  });
}
