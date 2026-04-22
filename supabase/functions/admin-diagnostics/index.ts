// supabase/functions/admin-diagnostics/index.ts
//
// Unified admin diagnostics endpoint. Consolidates what used to be:
//   - debug-env-google-ads
//   - debug-env-ga4
//   - debug-workspace-health
//
// Usage:
//   POST /admin-diagnostics  { check: "env_google" }
//   POST /admin-diagnostics  { check: "env_ga4" }
//   POST /admin-diagnostics  { check: "workspace_health", workspace_id: "..." }
//
// Requires authenticated admin user (role = 'admin' in user_roles).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CheckType = "env_google" | "env_ga4" | "env_meta" | "workspace_health";

function mask(val: string | undefined | null): string {
  if (!val) return "(not set)";
  if (val.length <= 12) return val.substring(0, 3) + "***" + val.substring(val.length - 3);
  return val.substring(0, 6) + "***" + val.substring(val.length - 6);
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: admin only ────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabaseAuth.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = claims.claims.sub as string;
    const { data: roleData } = await supabaseAuth
      .from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (roleData?.role !== "admin") {
      return json({ error: "Admin only" }, 403);
    }

    // ── Dispatch ───────────────────────────────────────────────────────────
    let body: { check?: CheckType; workspace_id?: string } = {};
    try { body = await req.json(); } catch { /* no body, default */ }
    const check = body.check ?? (new URL(req.url).searchParams.get("check") as CheckType | null);

    switch (check) {
      case "env_google":
        return json(dumpEnvGoogleAds());
      case "env_ga4":
        return json(dumpEnvGa4());
      case "env_meta":
        return json(dumpEnvMeta());
      case "workspace_health": {
        const wsId = body.workspace_id ?? new URL(req.url).searchParams.get("workspace_id");
        if (!wsId) return json({ error: "workspace_id required" }, 400);
        return json(await dumpWorkspaceHealth(wsId));
      }
      default:
        return json({
          error: "Unknown check",
          supported: ["env_google", "env_ga4", "env_meta", "workspace_health"],
        }, 400);
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function dumpEnvGoogleAds() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  return {
    check: "env_google",
    GOOGLE_ADS_CLIENT_ID: mask(Deno.env.get("GOOGLE_ADS_CLIENT_ID")),
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: mask(Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID")),
    GOOGLE_ADS_DEVELOPER_TOKEN_EXISTS: !!Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN"),
    GOOGLE_ADS_CLIENT_SECRET_EXISTS: !!Deno.env.get("GOOGLE_ADS_CLIENT_SECRET"),
    REDIRECT_URI: `${SUPABASE_URL}/functions/v1/oauth-callback-google-ads`,
    SUPABASE_URL: SUPABASE_URL || "(not set)",
    timestamp: new Date().toISOString(),
  };
}

function dumpEnvGa4() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  return {
    check: "env_ga4",
    GOOGLE_ADS_CLIENT_ID: mask(Deno.env.get("GOOGLE_ADS_CLIENT_ID")),
    GOOGLE_ADS_CLIENT_SECRET_EXISTS: !!Deno.env.get("GOOGLE_ADS_CLIENT_SECRET"),
    REDIRECT_URI: `${SUPABASE_URL}/functions/v1/oauth-callback-ga4`,
    SCOPE: "https://www.googleapis.com/auth/analytics.readonly",
    SUPABASE_URL: SUPABASE_URL || "(not set)",
    timestamp: new Date().toISOString(),
  };
}

function dumpEnvMeta() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  return {
    check: "env_meta",
    META_APP_ID: mask(Deno.env.get("META_APP_ID")),
    META_APP_SECRET_EXISTS: !!Deno.env.get("META_APP_SECRET"),
    META_BUSINESS_ACCOUNT_ID: mask(Deno.env.get("META_BUSINESS_ACCOUNT_ID")),
    REDIRECT_URI: `${SUPABASE_URL}/functions/v1/oauth-callback-meta`,
    SUPABASE_URL: SUPABASE_URL || "(not set)",
    timestamp: new Date().toISOString(),
  };
}

async function dumpWorkspaceHealth(workspaceId: string) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString().split("T")[0];

  const [perfResult, ga4Result, revenueResult, segmentsResult, healthResult] = await Promise.all([
    supabase.from("performance_daily")
      .select("date, provider, spend, impressions, clicks, conversions, currency")
      .eq("workspace_id", workspaceId).gte("date", since)
      .order("date", { ascending: false }),
    supabase.from("ga4_daily")
      .select("date, revenue, purchases, currency")
      .eq("workspace_id", workspaceId).gte("date", since)
      .order("date", { ascending: false }),
    supabase.from("workspace_revenue_daily")
      .select("date, total_revenue, total_purchases, source_breakdown, currency")
      .eq("workspace_id", workspaceId).gte("date", since)
      .order("date", { ascending: false }),
    supabase.from("segments").select("id").eq("workspace_id", workspaceId),
    supabase.from("health_events")
      .select("check_type, message, severity, created_at")
      .eq("workspace_id", workspaceId)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false }).limit(20),
  ]);

  const perfRows = perfResult.data ?? [];
  const ga4Rows = ga4Result.data ?? [];
  const revenueRows = revenueResult.data ?? [];

  return {
    check: "workspace_health",
    workspace_id: workspaceId,
    period: `${since} to today`,
    performance_daily: {
      rows: perfRows.length,
      total_spend_7d: perfRows.reduce((s, r) => s + (Number(r.spend) || 0), 0),
      sample: perfRows.slice(0, 5),
    },
    ga4_daily: { rows: ga4Rows.length, sample: ga4Rows.slice(0, 5) },
    workspace_revenue_daily: {
      rows: revenueRows.length,
      total_revenue_7d: revenueRows.reduce((s, r) => s + (Number(r.total_revenue) || 0), 0),
      sample: revenueRows.slice(0, 5),
    },
    segments_count: segmentsResult.data?.length ?? 0,
    recent_health_events: healthResult.data ?? [],
  };
}
