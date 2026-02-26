import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LIMITS = {
  CRON_MAX_DAYS_BACK: 3,
  MANUAL_MAX_DAYS_BACK: 90,
  MAX_RUNTIME_MS: 120_000,
  MAX_RUNS_PER_HOUR: 2,
  MANUAL_COOLDOWN_HOURS: 6,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("GOOGLE_ADS_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let workspaceId: string | null = null;
    let daysBack = 30;
    let triggeredBy: "cron" | "manual" = "cron";
    try {
      const body = await req.json();
      workspaceId = body.workspace_id ?? null;
      daysBack = body.days_back ?? 30;
      triggeredBy = body.triggered_by ?? (body.days_back ? "manual" : "cron");
    } catch { /* no body */ }

    const maxDays = triggeredBy === "manual" ? LIMITS.MANUAL_MAX_DAYS_BACK : LIMITS.CRON_MAX_DAYS_BACK;
    daysBack = Math.min(daysBack, maxDays);

    let intQuery = supabase
      .from("integrations").select("id, workspace_id")
      .eq("provider", "ga4").eq("status", "connected");
    if (workspaceId) intQuery = intQuery.eq("workspace_id", workspaceId);
    const { data: integrations, error: intErr } = await intQuery;
    if (intErr) throw intErr;
    if (!integrations?.length) {
      return jsonResponse({ success: true, message: "No connected GA4 integrations", upserted: 0 });
    }

    let totalUpserted = 0;
    const errors: string[] = [];

    for (const integration of integrations) {
      const wsId = integration.workspace_id;

      // Get credentials
      const { data: cred } = await supabase
        .from("credentials").select("access_token, refresh_token, expires_at")
        .eq("integration_id", integration.id).maybeSingle();
      if (!cred) { errors.push(`No credential for GA4 integration`); continue; }

      let accessToken = cred.access_token;
      if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
        if (!cred.refresh_token) { errors.push(`GA4 token expired`); continue; }
        const refreshed = await refreshAccessToken(clientId, clientSecret, cred.refresh_token);
        if (refreshed.error) { errors.push(`Token refresh: ${refreshed.error}`); continue; }
        accessToken = refreshed.access_token!;
        const newExpiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
        await supabase.from("credentials").update({
          access_token: accessToken, expires_at: newExpiry, updated_at: new Date().toISOString(),
        }).eq("integration_id", integration.id);
      }

      // Get enabled GA4 properties
      const { data: settings } = await supabase
        .from("workspace_account_settings").select("external_id")
        .eq("workspace_id", wsId).eq("provider", "ga4").eq("is_enabled", true);

      if (!settings?.length) continue;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      const since = formatDate(startDate);
      const until = formatDate(endDate);

      for (const setting of settings) {
        if (Date.now() - startTime > LIMITS.MAX_RUNTIME_MS) break;
        const propertyId = setting.external_id;

        try {
          const reportRes = await fetch(
            `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                dateRanges: [{ startDate: since, endDate: until }],
                dimensions: [
                  { name: "date" },
                  { name: "sessionSource" },
                  { name: "sessionMedium" },
                ],
                metrics: [
                  { name: "totalRevenue" },
                  { name: "ecommercePurchases" },
                ],
              }),
            }
          );

          if (!reportRes.ok) {
            const errText = await reportRes.text();
            errors.push(`Property ${propertyId}: HTTP ${reportRes.status}`);
            console.error(`[sync-ga4-by-source] Error ${propertyId}:`, errText.substring(0, 500));
            continue;
          }

          const reportData = await reportRes.json();
          const rows = reportData.rows || [];

          console.log(`[sync-ga4-by-source] Property ${propertyId}: ${rows.length} rows`);

          for (const row of rows) {
            const dateStr = row.dimensionValues?.[0]?.value;
            const source = row.dimensionValues?.[1]?.value || "(direct)";
            const medium = row.dimensionValues?.[2]?.value || "(none)";
            if (!dateStr) continue;
            const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
            const revenue = parseFloat(row.metricValues?.[0]?.value || "0");
            const purchases = parseInt(row.metricValues?.[1]?.value || "0", 10);

            await supabase.from("ga4_by_source").upsert({
              workspace_id: wsId,
              date: formattedDate,
              source,
              medium,
              revenue,
              purchases,
            }, { onConflict: "workspace_id,date,source,medium" });
            totalUpserted++;
          }
        } catch (err) {
          errors.push(`Property ${propertyId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      await supabase.from("sync_runs").insert({
        workspace_id: wsId, provider: "ga4", integration_id: integration.id,
        job_name: "sync_ga4_by_source", status: errors.length ? "partial" : "success",
        items_upserted: totalUpserted,
        details: { days_back: daysBack, properties: settings.map((s: any) => s.external_id) },
        ended_at: new Date().toISOString(), triggered_by: triggeredBy,
      });
    }

    return jsonResponse({ success: true, upserted: totalUpserted, errors: errors.length ? errors : undefined });
  } catch (error) {
    console.error("sync-ga4-by-source error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

async function refreshAccessToken(
  clientId: string, clientSecret: string, refreshToken: string
): Promise<{ access_token?: string; expires_in?: number; error?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) return { error: data.error_description || data.error };
  return { access_token: data.access_token, expires_in: data.expires_in };
}
