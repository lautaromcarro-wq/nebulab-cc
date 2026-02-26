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
  MAX_ROWS_PER_RUN: 20_000,
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
    const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN")!;
    const loginCustomerId = (Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID") || "").replace(/-/g, "");
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
      .from("integrations")
      .select("id, workspace_id")
      .eq("provider", "google_ads")
      .eq("status", "connected");
    if (workspaceId) intQuery = intQuery.eq("workspace_id", workspaceId);
    const { data: integrations, error: intErr } = await intQuery;
    if (intErr) throw intErr;
    if (!integrations?.length) {
      return jsonResponse({ success: true, message: "No connected Google Ads integrations", upserted: 0 });
    }

    let totalUpserted = 0;
    const errors: string[] = [];
    const failedAccounts: Array<{ account_id: string; external_id: string; error: string }> = [];
    let hitLimit = false;

    for (const integration of integrations) {
      if (hitLimit) break;
      const wsId = integration.workspace_id;
      const JOB_NAME = "sync_google_daily";
      const PROVIDER = "google_ads";

      // ── Lock check ──
      const { data: existingLock } = await supabase
        .from("sync_locks").select("id, locked_until")
        .eq("workspace_id", wsId).eq("provider", PROVIDER).eq("job_name", JOB_NAME)
        .maybeSingle();

      if (existingLock && new Date(existingLock.locked_until) > new Date()) {
        errors.push(`Workspace ${wsId}: locked until ${existingLock.locked_until}`);
        await supabase.from("sync_runs").insert({
          workspace_id: wsId, provider: PROVIDER, integration_id: integration.id,
          job_name: JOB_NAME, status: "error", items_upserted: 0,
          details: { skipped: true, reason: "lock_active" },
          ended_at: new Date().toISOString(), triggered_by: triggeredBy,
        });
        continue;
      }

      // ── Rate limit check ──
      const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
      const { count: recentRuns } = await supabase
        .from("sync_runs").select("id", { count: "exact", head: true })
        .eq("workspace_id", wsId).eq("provider", PROVIDER).eq("job_name", JOB_NAME)
        .gte("started_at", oneHourAgo);

      if ((recentRuns ?? 0) >= LIMITS.MAX_RUNS_PER_HOUR) {
        errors.push(`Workspace ${wsId}: rate limit`);
        await supabase.from("sync_runs").insert({
          workspace_id: wsId, provider: PROVIDER, integration_id: integration.id,
          job_name: JOB_NAME, status: "error", items_upserted: 0,
          details: { skipped: true, reason: "rate_limit" },
          ended_at: new Date().toISOString(), triggered_by: triggeredBy,
        });
        continue;
      }

      // ── Manual cooldown ──
      if (triggeredBy === "manual") {
        const cooldownAgo = new Date(Date.now() - LIMITS.MANUAL_COOLDOWN_HOURS * 3600_000).toISOString();
        const { count: recentManual } = await supabase
          .from("sync_runs").select("id", { count: "exact", head: true })
          .eq("workspace_id", wsId).eq("provider", PROVIDER).eq("job_name", JOB_NAME)
          .eq("triggered_by", "manual").gte("started_at", cooldownAgo);

        if ((recentManual ?? 0) >= 1) {
          errors.push(`Workspace ${wsId}: manual cooldown`);
          await supabase.from("sync_runs").insert({
            workspace_id: wsId, provider: PROVIDER, integration_id: integration.id,
            job_name: JOB_NAME, status: "error", items_upserted: 0,
            details: { skipped: true, reason: "manual_cooldown" },
            ended_at: new Date().toISOString(), triggered_by: triggeredBy,
          });
          continue;
        }
      }

      // ── Acquire lock ──
      await supabase.from("sync_locks").upsert({
        workspace_id: wsId, provider: PROVIDER, job_name: JOB_NAME,
        locked_until: new Date(Date.now() + 300_000).toISOString(),
        lock_reason: `sync started by ${triggeredBy}`,
      }, { onConflict: "workspace_id,provider,job_name" });

      try {
        // Get credentials
        const { data: cred } = await supabase
          .from("credentials").select("access_token, refresh_token, expires_at")
          .eq("integration_id", integration.id).maybeSingle();

        if (!cred) {
          errors.push(`No credential for integration ${integration.id}`);
          continue;
        }

        // Refresh token if expired
        let accessToken = cred.access_token;
        if (cred.expires_at && new Date(cred.expires_at) < new Date()) {
          if (!cred.refresh_token) {
            errors.push(`Token expired and no refresh_token for integration ${integration.id}`);
            continue;
          }
          const refreshed = await refreshAccessToken(clientId, clientSecret, cred.refresh_token);
          if (refreshed.error) {
            errors.push(`Token refresh failed: ${refreshed.error}`);
            await supabase.from("integrations").update({ status: "degraded" }).eq("id", integration.id);
            continue;
          }
          accessToken = refreshed.access_token!;
          const newExpiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
          await supabase.from("credentials").update({
            access_token: accessToken, expires_at: newExpiry, updated_at: new Date().toISOString(),
          }).eq("integration_id", integration.id);
          await supabase.from("integrations").update({ token_expires_at: newExpiry }).eq("id", integration.id);
        }

        // Get enabled accounts (non-manager, enabled in metadata)
        const { data: allAccounts } = await supabase
          .from("accounts").select("id, external_account_id, metadata, status")
          .eq("workspace_id", wsId).eq("provider", "google_ads");

        if (!allAccounts?.length) continue;

        // Filter: only active, non-manager, enabled accounts
        const accounts = allAccounts.filter((a: any) => {
          if (a.status !== "active") return false;
          const meta = a.metadata as Record<string, unknown> | null;
          if (meta?.manager === true) return false;
          if (meta?.enabled === false) return false;
          return true;
        });

        if (!accounts.length) {
          await supabase.from("sync_runs").insert({
            workspace_id: wsId, provider: PROVIDER, integration_id: integration.id,
            job_name: JOB_NAME, status: "success", items_upserted: 0,
            details: { skipped: true, reason: "no_enabled_accounts", total: allAccounts.length },
            ended_at: new Date().toISOString(), triggered_by: triggeredBy,
          });
          continue;
        }

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);
        const since = formatDate(startDate);
        const until = formatDate(endDate);

        for (const account of accounts) {
          if (hitLimit || Date.now() - startTime > LIMITS.MAX_RUNTIME_MS) {
            hitLimit = true;
            break;
          }

          const custId = account.external_account_id.replace(/-/g, "");

          try {
            // ── Fetch campaigns ──
            const campQuery = `
              SELECT campaign.id, campaign.name, campaign.status
              FROM campaign
              WHERE campaign.status != 'REMOVED'
            `;
            const campData = await gaqlSearch(accessToken, developerToken, loginCustomerId, custId, campQuery);
            if (campData.error) {
              throw new Error(campData.error.message || JSON.stringify(campData.error));
            }

            const campaigns: Array<{ id: string; name: string; status: string }> = [];
            for (const batch of campData) {
              for (const result of batch.results || []) {
                campaigns.push({
                  id: String(result.campaign.id),
                  name: result.campaign.name || "",
                  status: result.campaign.status || "UNKNOWN",
                });
              }
            }

            // Upsert campaigns
            for (const camp of campaigns) {
              await supabase.from("campaigns").upsert({
                workspace_id: wsId, account_id: account.id, provider: "google_ads",
                external_id: camp.id, name: camp.name,
                status: camp.status === "ENABLED" ? "active" : "paused",
              }, { onConflict: "workspace_id,provider,external_id" });
            }

            // ── Fetch daily metrics (account level) ──
            const metricsQuery = `
              SELECT
                segments.date,
                metrics.cost_micros,
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.conversions_value
              FROM customer
              WHERE segments.date BETWEEN '${since}' AND '${until}'
            `;
            const metricsData = await gaqlSearch(accessToken, developerToken, loginCustomerId, custId, metricsQuery);

            const rows: Array<Record<string, unknown>> = [];

            if (!metricsData.error) {
              for (const batch of metricsData) {
                for (const result of batch.results || []) {
                  const costMicros = Number(result.metrics?.costMicros || 0);
                  rows.push({
                    workspace_id: wsId,
                    account_id: account.id,
                    provider: "google_ads",
                    entity_type: "account",
                    entity_id: account.id,
                    date: result.segments?.date,
                    spend: costMicros / 1_000_000,
                    impressions: Number(result.metrics?.impressions || 0),
                    clicks: Number(result.metrics?.clicks || 0),
                    conversions: Math.round(Number(result.metrics?.conversions || 0)),
                    revenue: Number(result.metrics?.conversionsValue || 0),
                    purchases: Math.round(Number(result.metrics?.conversions || 0)),
                  });
                }
              }
            }

            // ── Campaign-level metrics ──
            const campMetricsQuery = `
              SELECT
                campaign.id,
                campaign.name,
                segments.date,
                metrics.cost_micros,
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.conversions_value
              FROM campaign
              WHERE segments.date BETWEEN '${since}' AND '${until}'
                AND campaign.status != 'REMOVED'
            `;
            const campMetricsData = await gaqlSearch(accessToken, developerToken, loginCustomerId, custId, campMetricsQuery);

            if (!campMetricsData.error) {
              for (const batch of campMetricsData) {
                for (const result of batch.results || []) {
                  const campExtId = String(result.campaign?.id);
                  // Get the campaign record
                  const { data: campRecord } = await supabase
                    .from("campaigns").select("id")
                    .eq("workspace_id", wsId).eq("provider", "google_ads").eq("external_id", campExtId)
                    .maybeSingle();

                  if (!campRecord) continue;

                  const costMicros = Number(result.metrics?.costMicros || 0);
                  rows.push({
                    workspace_id: wsId,
                    account_id: account.id,
                    provider: "google_ads",
                    entity_type: "campaign",
                    entity_id: campRecord.id,
                    date: result.segments?.date,
                    spend: costMicros / 1_000_000,
                    impressions: Number(result.metrics?.impressions || 0),
                    clicks: Number(result.metrics?.clicks || 0),
                    conversions: Math.round(Number(result.metrics?.conversions || 0)),
                    revenue: Number(result.metrics?.conversionsValue || 0),
                    purchases: Math.round(Number(result.metrics?.conversions || 0)),
                  });
                }
              }
            }

            // Check row limit
            if (totalUpserted + rows.length > LIMITS.MAX_ROWS_PER_RUN) {
              hitLimit = true;
              const allowed = LIMITS.MAX_ROWS_PER_RUN - totalUpserted;
              if (allowed > 0) {
                await deleteAndInsert(supabase, rows.slice(0, allowed), wsId, account.id, since, until);
                totalUpserted += allowed;
              }
              break;
            }

            await deleteAndInsert(supabase, rows, wsId, account.id, since, until);
            totalUpserted += rows.length;

            // Update account sync status
            const meta = (account.metadata as Record<string, unknown>) || {};
            await supabase.from("accounts").update({
              metadata: { ...meta, sync_status: "ok", sync_last_attempt: new Date().toISOString() },
            }).eq("id", account.id);

          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            errors.push(`Account ${custId}: ${errMsg}`);
            failedAccounts.push({ account_id: account.id, external_id: custId, error: errMsg });

            // Update account metadata with error
            const meta = (account.metadata as Record<string, unknown>) || {};
            await supabase.from("accounts").update({
              metadata: { ...meta, sync_status: "error", sync_error: errMsg, sync_last_attempt: new Date().toISOString() },
            }).eq("id", account.id);

            await supabase.from("health_events").insert({
              workspace_id: wsId, provider: "google_ads",
              check_type: "google_ads_sync_error", severity: "warn",
              entity_type: "account", entity_id: account.id,
              message: errMsg,
            });
          }
        }

        // Log sync run
        const hasFailures = failedAccounts.length > 0;
        const status = hitLimit ? "partial" : (hasFailures ? "partial" : "success");
        await supabase.from("sync_runs").insert({
          workspace_id: wsId, provider: PROVIDER, integration_id: integration.id,
          job_name: JOB_NAME, status, items_upserted: totalUpserted,
          details: {
            days_back: daysBack, hit_limit: hitLimit,
            synced_accounts: accounts.map((a: any) => a.id),
            failed_accounts: failedAccounts.length > 0 ? failedAccounts : undefined,
            errors: errors.length > 0 ? errors : undefined,
            duration_ms: Date.now() - startTime,
          },
          ended_at: new Date().toISOString(), triggered_by: triggeredBy,
        });
      } finally {
        await supabase.from("sync_locks").delete()
          .eq("workspace_id", wsId).eq("provider", PROVIDER).eq("job_name", JOB_NAME);
      }
    }

    return jsonResponse({
      success: true,
      upserted: totalUpserted,
      hit_limit: hitLimit,
      failed_accounts: failedAccounts.length > 0 ? failedAccounts : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("sync-google-daily error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Helpers ──

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
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) return { error: data.error_description || data.error };
  return { access_token: data.access_token, expires_in: data.expires_in };
}

async function gaqlSearch(
  accessToken: string, developerToken: string, loginCustomerId: string,
  customerId: string, query: string
): Promise<any> {
  const res = await fetch(
    `https://googleads.googleapis.com/v22/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "login-customer-id": loginCustomerId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );
  return res.json();
}

async function deleteAndInsert(
  supabase: ReturnType<typeof createClient>,
  rows: Array<Record<string, unknown>>,
  wsId: string, accountId: string, since: string, until: string,
) {
  if (rows.length === 0) return;

  await supabase.from("performance_daily").delete()
    .eq("workspace_id", wsId).eq("account_id", accountId).eq("provider", "google_ads")
    .gte("date", since).lte("date", until);

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from("performance_daily").insert(batch);
    if (error) console.error(`Insert error: ${error.message}`);
  }
}
