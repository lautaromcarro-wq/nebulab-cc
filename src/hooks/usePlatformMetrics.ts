import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { format, subDays, differenceInDays } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GA4Metrics {
  sessions: number;
  users: number;
  pagesPerSession: number;
  avgSessionDuration: number; // seconds
  bounceRate: number;         // 0-100
  byChannel: { channel: string; sessions: number; revenue: number }[];
}

export interface MetaMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  reach: number;
  landingPageViews: number;
  videoViews3s: number;
  outboundClicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  hookRate: number;  // video_views_3s / impressions * 100
  visitRate: number; // landing_page_views / clicks * 100
}

export interface GoogleMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  purchases: number;
  revenue: number;
  ctr: number;
  cpc: number;
  conversionsBreakdown: Record<string, number>;
}

export interface PlatformMetricsResult {
  ga4: { current: GA4Metrics; prev: GA4Metrics };
  meta: { current: MetaMetrics; prev: MetaMetrics };
  google: { current: GoogleMetrics; prev: GoogleMetrics };
}

// ── Empty constants ───────────────────────────────────────────────────────────

const EMPTY_GA4: GA4Metrics = {
  sessions: 0, users: 0, pagesPerSession: 0, avgSessionDuration: 0, bounceRate: 0, byChannel: [],
};
const EMPTY_META: MetaMetrics = {
  spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0, reach: 0,
  landingPageViews: 0, videoViews3s: 0, outboundClicks: 0,
  ctr: 0, cpc: 0, cpm: 0, roas: 0, hookRate: 0, visitRate: 0,
};
const EMPTY_GOOGLE: GoogleMetrics = {
  spend: 0, impressions: 0, clicks: 0, conversions: 0, purchases: 0, revenue: 0,
  ctr: 0, cpc: 0, conversionsBreakdown: {},
};
const EMPTY_RESULT: PlatformMetricsResult = {
  ga4: { current: EMPTY_GA4, prev: EMPTY_GA4 },
  meta: { current: EMPTY_META, prev: EMPTY_META },
  google: { current: EMPTY_GOOGLE, prev: EMPTY_GOOGLE },
};

// ── Aggregators ───────────────────────────────────────────────────────────────

function aggGA4(rows: any[]): Omit<GA4Metrics, "byChannel"> {
  const agg = rows.reduce(
    (acc, r) => {
      const s = Number(r.sessions) || 0;
      return {
        sessions: acc.sessions + s,
        users: acc.users + (Number(r.users) || 0),
        pageViews: acc.pageViews + (Number(r.screen_page_views) || 0),
        engSecs: acc.engSecs + (Number(r.engagement_duration_secs) || 0),
        bounceWeighted: acc.bounceWeighted + (Number(r.bounce_rate) || 0) * s,
      };
    },
    { sessions: 0, users: 0, pageViews: 0, engSecs: 0, bounceWeighted: 0 },
  );
  return {
    sessions: agg.sessions,
    users: agg.users,
    pagesPerSession: agg.sessions > 0 ? agg.pageViews / agg.sessions : 0,
    avgSessionDuration: agg.sessions > 0 ? agg.engSecs / agg.sessions : 0,
    bounceRate: agg.sessions > 0 ? agg.bounceWeighted / agg.sessions : 0,
  };
}

function aggMeta(rows: any[]): MetaMetrics {
  const agg = rows.reduce(
    (acc, r) => ({
      spend: acc.spend + (Number(r.spend) || 0),
      impressions: acc.impressions + (Number(r.impressions) || 0),
      clicks: acc.clicks + (Number(r.clicks) || 0),
      purchases: acc.purchases + (Number(r.purchases) || 0),
      revenue: acc.revenue + (Number(r.revenue) || 0),
      reach: acc.reach + (Number(r.reach) || 0),
      landingPageViews: acc.landingPageViews + (Number(r.landing_page_views) || 0),
      videoViews3s: acc.videoViews3s + (Number(r.video_views_3s) || 0),
      outboundClicks: acc.outboundClicks + (Number(r.outbound_clicks) || 0),
    }),
    { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0, reach: 0, landingPageViews: 0, videoViews3s: 0, outboundClicks: 0 },
  );
  const { spend, impressions, clicks, purchases, revenue, reach, landingPageViews, videoViews3s, outboundClicks } = agg;
  return {
    spend, impressions, clicks, purchases, revenue, reach,
    landingPageViews, videoViews3s, outboundClicks,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    roas: spend > 0 ? revenue / spend : 0,
    hookRate: impressions > 0 ? (videoViews3s / impressions) * 100 : 0,
    visitRate: clicks > 0 ? (landingPageViews / clicks) * 100 : 0,
  };
}

function aggGoogle(rows: any[]): GoogleMetrics {
  const breakdown: Record<string, number> = {};
  const agg = rows.reduce(
    (acc, r) => {
      const bd = r.conversions_breakdown as Record<string, number> | null;
      if (bd && typeof bd === "object") {
        for (const [k, v] of Object.entries(bd)) {
          breakdown[k] = (breakdown[k] || 0) + Number(v);
        }
      }
      return {
        spend: acc.spend + (Number(r.spend) || 0),
        impressions: acc.impressions + (Number(r.impressions) || 0),
        clicks: acc.clicks + (Number(r.clicks) || 0),
        conversions: acc.conversions + (Number(r.conversions) || 0),
        purchases: acc.purchases + (Number(r.purchases) || 0),
        revenue: acc.revenue + (Number(r.revenue) || 0),
      };
    },
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, purchases: 0, revenue: 0 },
  );
  return {
    ...agg,
    ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
    cpc: agg.clicks > 0 ? agg.spend / agg.clicks : 0,
    conversionsBreakdown: breakdown,
  };
}

// Standard GA4 channel group derivation from source/medium
function deriveChannelGroup(source: string, medium: string): string {
  const s = (source || "").toLowerCase();
  const m = (medium || "").toLowerCase();
  if (s === "(direct)" && (m === "(none)" || m === "(not set)")) return "Direct";
  if (m === "organic") return "Organic Search";
  if (["cpc", "ppc", "paid", "paidsearch"].includes(m) && ["google", "bing", "yahoo"].some((x) => s.includes(x))) return "Paid Search";
  if (["email", "e-mail", "e_mail", "newsletter"].includes(m)) return "Email";
  if (["facebook", "instagram", "fb", "ig", "tiktok", "twitter", "linkedin"].some((x) => s.includes(x)) && ["cpc", "paid"].includes(m)) return "Paid Social";
  if (["social", "social-network", "social_network"].includes(m)) return "Organic Social";
  if (m === "referral") return "Referral";
  if (["display", "banner", "cpm"].includes(m)) return "Display";
  return "(Other)";
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePlatformMetrics() {
  const { currentWorkspace, dateRange } = useWorkspace();
  const { selectedClient } = useClient();

  const rangeDays = differenceInDays(dateRange.to, dateRange.from);
  const prevTo = subDays(dateRange.from, 1);
  const prevFrom = subDays(dateRange.from, rangeDays + 1);

  return useQuery<PlatformMetricsResult>({
    queryKey: [
      "platform-metrics",
      currentWorkspace?.id,
      selectedClient?.id,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    enabled: !!currentWorkspace,
    queryFn: async (): Promise<PlatformMetricsResult> => {
      const wsId = currentWorkspace!.id;
      const from = format(dateRange.from, "yyyy-MM-dd");
      const to = format(dateRange.to, "yyyy-MM-dd");
      const pFrom = format(prevFrom, "yyyy-MM-dd");
      const pTo = format(prevTo, "yyyy-MM-dd");

      // Resolve linked account IDs for selected client
      let linkedAccountIds: string[] | null = null;
      if (selectedClient) {
        const [{ data: cas }, { data: accts }] = await Promise.all([
          supabase
            .from("client_account_settings")
            .select("external_account_id, platform")
            .eq("client_id", selectedClient.id)
            .eq("is_enabled", true),
          supabase
            .from("accounts")
            .select("id, external_account_id, provider")
            .eq("workspace_id", wsId),
        ]);
        linkedAccountIds = (cas && cas.length > 0)
          ? (accts ?? [])
              .filter((a) => cas.some((c) => c.external_account_id === a.external_account_id && c.platform === a.provider))
              .map((a) => a.id)
          : [];
      }

      if (linkedAccountIds !== null && linkedAccountIds.length === 0) {
        return EMPTY_RESULT;
      }

      const buildPerfQ = (dateFrom: string, dateTo: string, provider: string) => {
        let q = supabase
          .from("performance_daily")
          .select("spend,impressions,clicks,conversions,purchases,revenue,reach,landing_page_views,video_views_3s,outbound_clicks,conversions_breakdown")
          .eq("workspace_id", wsId)
          .eq("provider", provider)
          .eq("entity_type", "campaign")
          .gte("date", dateFrom)
          .lte("date", dateTo);
        if (linkedAccountIds) q = q.in("account_id", linkedAccountIds);
        return q;
      };

      const buildGA4Q = (dateFrom: string, dateTo: string) => {
        let q = supabase
          .from("ga4_daily")
          .select("sessions,users,screen_page_views,engagement_duration_secs,bounce_rate")
          .eq("workspace_id", wsId)
          .gte("date", dateFrom)
          .lte("date", dateTo);
        if (linkedAccountIds) q = q.in("account_id", linkedAccountIds);
        return q;
      };

      const buildGA4SrcQ = (dateFrom: string, dateTo: string) => {
        let q = supabase
          .from("ga4_by_source")
          .select("source,medium,channel_group,sessions,revenue")
          .eq("workspace_id", wsId)
          .gte("date", dateFrom)
          .lte("date", dateTo);
        if (linkedAccountIds) q = q.in("account_id", linkedAccountIds);
        return q;
      };

      const [ga4Curr, ga4Prev, ga4SrcCurr, metaCurr, metaPrev, gCurr, gPrev] =
        await Promise.all([
          buildGA4Q(from, to),
          buildGA4Q(pFrom, pTo),
          buildGA4SrcQ(from, to),
          buildPerfQ(from, to, "meta"),
          buildPerfQ(pFrom, pTo, "meta"),
          buildPerfQ(from, to, "google_ads"),
          buildPerfQ(pFrom, pTo, "google_ads"),
        ]);

      // Build channel groups from ga4_by_source
      const channelMap = new Map<string, { sessions: number; revenue: number }>();
      for (const r of ga4SrcCurr.data ?? []) {
        const cg = (r.channel_group && r.channel_group !== "(other)")
          ? r.channel_group
          : deriveChannelGroup(r.source, r.medium);
        const ex = channelMap.get(cg);
        const s = Number(r.sessions) || 0;
        const rev = Number(r.revenue) || 0;
        if (ex) { ex.sessions += s; ex.revenue += rev; }
        else { channelMap.set(cg, { sessions: s, revenue: rev }); }
      }
      const byChannel = Array.from(channelMap.entries())
        .map(([channel, v]) => ({ channel, ...v }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 8);

      return {
        ga4: {
          current: { ...aggGA4(ga4Curr.data ?? []), byChannel },
          prev: { ...aggGA4(ga4Prev.data ?? []), byChannel: [] },
        },
        meta: {
          current: aggMeta(metaCurr.data ?? []),
          prev: aggMeta(metaPrev.data ?? []),
        },
        google: {
          current: aggGoogle(gCurr.data ?? []),
          prev: aggGoogle(gPrev.data ?? []),
        },
      };
    },
  });
}
