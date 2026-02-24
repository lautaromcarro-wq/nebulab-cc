import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Hard limits ──
const LIMITS = {
  CRON_MAX_DAYS_BACK: 3,
  MANUAL_MAX_DAYS_BACK: 90,
  MAX_RUNTIME_MS: 120_000,
  MAX_ROWS_PER_RUN: 20_000,
  MAX_API_PAGES: 50,
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

    // Clamp days_back
    const maxDays = triggeredBy === "manual" ? LIMITS.MANUAL_MAX_DAYS_BACK : LIMITS.CRON_MAX_DAYS_BACK;
    daysBack = Math.min(daysBack, maxDays);

    // Get workspaces with connected Meta integrations
    let intQuery = supabase
      .from("integrations")
      .select("id, workspace_id")
      .eq("provider", "meta")
      .eq("status", "connected");
    if (workspaceId) intQuery = intQuery.eq("workspace_id", workspaceId);
    const { data: integrations, error: intErr } = await intQuery;
    if (intErr) throw intErr;
    if (!integrations?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No connected Meta integrations", upserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalUpserted = 0;
    const errors: string[] = [];
    const riskEvents: Array<{ workspace_id: string; code: string; severity: string; message: string; metadata_json: Record<string, unknown> }> = [];
    let hitLimit = false;
    let totalPages = 0;

    for (const integration of integrations) {
      if (hitLimit) break;
      const wsId = integration.workspace_id;
      const JOB_NAME = "sync_meta_daily";
      const PROVIDER = "meta";

      // ── Lock check ──
      const { data: existingLock } = await supabase
        .from("sync_locks")
        .select("id, locked_until")
        .eq("workspace_id", wsId)
        .eq("provider", PROVIDER)
        .eq("job_name", JOB_NAME)
        .maybeSingle();

      if (existingLock && new Date(existingLock.locked_until) > new Date()) {
        errors.push(`Workspace ${wsId}: locked until ${existingLock.locked_until}`);
        await supabase.from("sync_runs").insert({
          workspace_id: wsId, provider: PROVIDER, integration_id: integration.id,
          job_name: JOB_NAME, status: "error", items_upserted: 0,
          details: { skipped: true, reason: "lock_active", locked_until: existingLock.locked_until },
          ended_at: new Date().toISOString(), triggered_by: triggeredBy,
        });
        continue;
      }

      // ── Rate limit check ──
      const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
      const { count: recentRuns } = await supabase
        .from("sync_runs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", wsId)
        .eq("provider", PROVIDER)
        .eq("job_name", JOB_NAME)
        .gte("started_at", oneHourAgo);

      if ((recentRuns ?? 0) >= LIMITS.MAX_RUNS_PER_HOUR) {
        errors.push(`Workspace ${wsId}: rate limit (${LIMITS.MAX_RUNS_PER_HOUR}/hr)`);
        await supabase.from("sync_runs").insert({
          workspace_id: wsId, provider: PROVIDER, integration_id: integration.id,
          job_name: JOB_NAME, status: "error", items_upserted: 0,
          details: { skipped: true, reason: "rate_limit", max_runs_per_hour: LIMITS.MAX_RUNS_PER_HOUR },
          ended_at: new Date().toISOString(), triggered_by: triggeredBy,
        });
        continue;
      }

      // ── Manual cooldown ──
      if (triggeredBy === "manual") {
        const cooldownAgo = new Date(Date.now() - LIMITS.MANUAL_COOLDOWN_HOURS * 3600_000).toISOString();
        const { count: recentManual } = await supabase
          .from("sync_runs")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", wsId)
          .eq("provider", PROVIDER)
          .eq("job_name", JOB_NAME)
          .eq("triggered_by", "manual")
          .gte("started_at", cooldownAgo);

        if ((recentManual ?? 0) >= 1) {
          errors.push(`Workspace ${wsId}: manual cooldown (1 per ${LIMITS.MANUAL_COOLDOWN_HOURS}h)`);
          await supabase.from("sync_runs").insert({
            workspace_id: wsId, provider: PROVIDER, integration_id: integration.id,
            job_name: JOB_NAME, status: "error", items_upserted: 0,
            details: { skipped: true, reason: "manual_cooldown", cooldown_hours: LIMITS.MANUAL_COOLDOWN_HOURS },
            ended_at: new Date().toISOString(), triggered_by: triggeredBy,
          });
          continue;
        }
      }

      // ── Acquire lock (5 min) ──
      await supabase.from("sync_locks").upsert({
        workspace_id: wsId, provider: PROVIDER, job_name: JOB_NAME,
        locked_until: new Date(Date.now() + 300_000).toISOString(),
        lock_reason: `sync started by ${triggeredBy}`,
      }, { onConflict: "workspace_id,provider,job_name" });

      try {
        // Get credential
        const { data: cred } = await supabase
          .from("credentials")
          .select("access_token, meta_long_lived_token")
          .eq("integration_id", integration.id)
          .maybeSingle();

        const accessToken = cred?.meta_long_lived_token || cred?.access_token;
        if (!accessToken) {
          errors.push(`No credential for integration ${integration.id}`);
          continue;
        }

        // Get active ad accounts
        const { data: accounts } = await supabase
          .from("accounts")
          .select("id, external_account_id")
          .eq("workspace_id", wsId)
          .eq("provider", "meta")
          .eq("status", "active");

        if (!accounts?.length) continue;

        // Date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);
        const since = startDate.toISOString().split("T")[0];
        const until = endDate.toISOString().split("T")[0];

        for (const account of accounts) {
          if (hitLimit) break;

          // Runtime check
          if (Date.now() - startTime > LIMITS.MAX_RUNTIME_MS) {
            hitLimit = true;
            riskEvents.push({
              workspace_id: wsId, code: "MAX_RUNTIME_EXCEEDED", severity: "warn",
              message: `Sync stopped after ${LIMITS.MAX_RUNTIME_MS / 1000}s runtime limit`,
              metadata_json: { elapsed_ms: Date.now() - startTime, total_upserted: totalUpserted },
            });
            break;
          }

          try {
            const actId = account.external_account_id.startsWith("act_")
              ? account.external_account_id
              : `act_${account.external_account_id}`;

            const fields = "spend,impressions,clicks,actions,action_values";
            const rows: Array<Record<string, unknown>> = [];

            // ── Account-level insights ──
            const insightsUrl =
              `https://graph.facebook.com/v21.0/${actId}/insights` +
              `?fields=${fields}` +
              `&time_range={"since":"${since}","until":"${until}"}` +
              `&time_increment=1&level=account&limit=500` +
              `&access_token=${accessToken}`;

            const res = await fetch(insightsUrl);
            totalPages++;
            const data = await res.json();

            if (data.error) {
              errors.push(`Account ${actId}: ${data.error.message}`);
              continue;
            }

            for (const row of data.data ?? []) {
              rows.push(parseInsightRow(row, wsId, account.id, "account", account.id));
            }

            // ── Campaign-level insights ──
            const campFields = `${fields},campaign_id,campaign_name`;
            let campUrl: string | null =
              `https://graph.facebook.com/v21.0/${actId}/insights` +
              `?fields=${campFields}` +
              `&time_range={"since":"${since}","until":"${until}"}` +
              `&time_increment=1&level=campaign&limit=500` +
              `&access_token=${accessToken}`;

            while (campUrl && !hitLimit) {
              if (totalPages >= LIMITS.MAX_API_PAGES) {
                hitLimit = true;
                riskEvents.push({
                  workspace_id: wsId, code: "MAX_API_PAGES_EXCEEDED", severity: "warn",
                  message: `Stopped after ${LIMITS.MAX_API_PAGES} API pages`,
                  metadata_json: { total_pages: totalPages, total_rows: totalUpserted + rows.length },
                });
                break;
              }

              if (Date.now() - startTime > LIMITS.MAX_RUNTIME_MS) {
                hitLimit = true;
                riskEvents.push({
                  workspace_id: wsId, code: "MAX_RUNTIME_EXCEEDED", severity: "warn",
                  message: `Sync stopped after ${LIMITS.MAX_RUNTIME_MS / 1000}s runtime limit`,
                  metadata_json: { elapsed_ms: Date.now() - startTime },
                });
                break;
              }

              const campRes = await fetch(campUrl);
              totalPages++;
              const campData = await campRes.json();

              if (campData.error || !campData.data) break;

              for (const row of campData.data) {
                const { data: campRecord } = await supabase
                  .from("campaigns")
                  .upsert({
                    workspace_id: wsId, account_id: account.id, provider: "meta",
                    external_id: row.campaign_id, name: row.campaign_name || "", status: "active",
                  }, { onConflict: "workspace_id,provider,external_id" })
                  .select("id").single();

                if (!campRecord) continue;
                rows.push(parseInsightRow(row, wsId, account.id, "campaign", campRecord.id));
              }

              campUrl = campData.paging?.next || null;
            }

            // ── Max rows check ──
            if (totalUpserted + rows.length > LIMITS.MAX_ROWS_PER_RUN) {
              hitLimit = true;
              riskEvents.push({
                workspace_id: wsId, code: "MAX_ROWS_EXCEEDED", severity: "critical",
                message: `Stopped: would exceed ${LIMITS.MAX_ROWS_PER_RUN} row limit (attempted ${totalUpserted + rows.length})`,
                metadata_json: { attempted: totalUpserted + rows.length, limit: LIMITS.MAX_ROWS_PER_RUN },
              });
              // Insert what we have so far up to the limit
              const allowed = LIMITS.MAX_ROWS_PER_RUN - totalUpserted;
              if (allowed > 0) {
                await deleteAndInsert(supabase, rows.slice(0, allowed), wsId, account.id, since, until);
                totalUpserted += allowed;
              }
              break;
            }

            // Delete + insert
            await deleteAndInsert(supabase, rows, wsId, account.id, since, until);
            totalUpserted += rows.length;
          } catch (err) {
            errors.push(`Account ${account.external_account_id}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        // Log sync run
        const status = hitLimit ? "partial" : (errors.length > 0 ? "partial" : "success");
        await supabase.from("sync_runs").insert({
          workspace_id: wsId, provider: PROVIDER, integration_id: integration.id,
          job_name: JOB_NAME, status,
          items_upserted: totalUpserted,
          details: {
            days_back: daysBack,
            pages_fetched: totalPages,
            hit_limit: hitLimit,
            errors: errors.length > 0 ? errors : undefined,
          },
          ended_at: new Date().toISOString(), triggered_by: triggeredBy,
        });
      } finally {
        // ── Release lock ──
        await supabase.from("sync_locks")
          .delete()
          .eq("workspace_id", wsId)
          .eq("provider", PROVIDER)
          .eq("job_name", JOB_NAME);
      }
    }

    // ── Persist risk events ──
    if (riskEvents.length > 0) {
      await supabase.from("risk_events").insert(
        riskEvents.map((e) => ({ ...e, provider: "meta" }))
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        upserted: totalUpserted,
        pages: totalPages,
        hit_limit: hitLimit,
        risk_events: riskEvents.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-meta-daily error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Helpers ──

function parseInsightRow(
  row: Record<string, unknown>,
  wsId: string, accountId: string, entityType: string, entityId: string,
): Record<string, unknown> {
  const spend = parseFloat(String(row.spend || "0"));
  const impressions = parseInt(String(row.impressions || "0"), 10);
  const clicks = parseInt(String(row.clicks || "0"), 10);
  let purchases = 0, revenue = 0;

  for (const action of (row.actions as Array<{ action_type: string; value: string }>) ?? []) {
    if (action.action_type === "purchase" || action.action_type === "omni_purchase") {
      purchases += parseInt(action.value || "0", 10);
    }
  }
  for (const av of (row.action_values as Array<{ action_type: string; value: string }>) ?? []) {
    if (av.action_type === "purchase" || av.action_type === "omni_purchase") {
      revenue += parseFloat(av.value || "0");
    }
  }

  return {
    workspace_id: wsId, account_id: accountId, provider: "meta",
    entity_type: entityType, entity_id: entityId,
    date: (row as Record<string, string>).date_start,
    spend, impressions, clicks, purchases, revenue, conversions: purchases,
  };
}

async function deleteAndInsert(
  supabase: ReturnType<typeof createClient>,
  rows: Array<Record<string, unknown>>,
  wsId: string, accountId: string, since: string, until: string,
) {
  if (rows.length === 0) return;

  await supabase
    .from("performance_daily")
    .delete()
    .eq("workspace_id", wsId)
    .eq("account_id", accountId)
    .eq("provider", "meta")
    .gte("date", since)
    .lte("date", until);

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from("performance_daily").insert(batch);
    if (error) console.error(`Insert error: ${error.message}`);
  }
}
