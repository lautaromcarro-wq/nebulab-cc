import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Job definitions ──────────────────────────────────────────────────
// Each job has: name, provider, phase (controls execution order),
// and the actual handler function.

type Provider = "meta" | "google_ads" | "ga4";

interface JobDef {
  name: string;
  provider: Provider | null; // null = cross-provider
  phase: number; // lower = runs first; same phase = parallel within concurrency limit
}

const JOB_DEFS: JobDef[] = [
  // Phase 1: Account & catalog sync (can be parallel within provider limit)
  { name: "sync_meta_accounts",         provider: "meta",       phase: 1 },
  { name: "sync_meta_catalog",          provider: "meta",       phase: 1 },
  { name: "sync_google_accounts",       provider: "google_ads", phase: 1 },
  { name: "sync_google_catalog",        provider: "google_ads", phase: 1 },
  // Phase 2: Metrics sync (depends on catalog)
  { name: "sync_meta_daily_metrics",    provider: "meta",       phase: 2 },
  { name: "sync_google_daily_metrics",  provider: "google_ads", phase: 2 },
  { name: "sync_ga4_daily",            provider: "ga4",        phase: 2 },
  // Phase 3: Post-processing
  { name: "resolve_creatives",         provider: null,         phase: 3 },
  // Phase 4: Revenue aggregation
  { name: "aggregate_revenue",           provider: null,       phase: 4 },
  // Phase 5: Segment computation (map first, then daily)
  { name: "compute_campaign_segment_map", provider: null,      phase: 5 },
  { name: "compute_segment_daily",       provider: null,       phase: 6 },
  // Phase 7: Health checks + workspace health score
  { name: "health_checks",             provider: null,         phase: 7 },
  { name: "compute_workspace_health",  provider: null,         phase: 7 },
  // Phase 8: Ecommerce sync (after all ad platform jobs)
  { name: "sync_ecommerce_daily",        provider: null, phase: 8 },
  // Phase 9: Ecommerce revenue aggregation
  { name: "aggregate_ecommerce_revenue", provider: null, phase: 9 },
];

const MAX_RETRIES = 3;
const MAX_CONCURRENT_PER_PROVIDER = 2;

// ── Retry helper with exponential backoff ────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number
): Promise<{ result: T | null; attempts: number; error: string | null }> {
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, attempts: attempt, error: null };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
  return { result: null, attempts: maxRetries, error: lastError };
}

// ── Concurrency limiter ──────────────────────────────────────────────
class ConcurrencyLimiter {
  private running = new Map<string, number>();

  constructor(private maxPerKey: number) {}

  async acquire(key: string): Promise<void> {
    while ((this.running.get(key) ?? 0) >= this.maxPerKey) {
      await new Promise((r) => setTimeout(r, 200));
    }
    this.running.set(key, (this.running.get(key) ?? 0) + 1);
  }

  release(key: string): void {
    const current = this.running.get(key) ?? 1;
    this.running.set(key, Math.max(0, current - 1));
  }
}

// ── Individual job handlers ──────────────────────────────────────────

async function executeJob(
  jobName: string,
  workspaceId: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ items_upserted: number; details: Record<string, unknown> }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  switch (jobName) {
    case "compute_campaign_segment_map": {
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/compute-campaign-segment-map`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ workspace_id: workspaceId }),
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "Unknown error");
      return {
        items_upserted: data.processed ?? 0,
        details: { conflicts: data.conflicts, unassigned: data.unassigned },
      };
    }

    case "compute_segment_daily": {
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/compute-segment-daily`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ workspace_id: workspaceId }),
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "Unknown error");
      return { items_upserted: data.upserted ?? 0, details: {} };
    }

    case "sync_meta_accounts":
    case "sync_meta_catalog": {
      const { data: metaAccInt } = await supabase
        .from("integrations")
        .select("id, status")
        .eq("workspace_id", workspaceId)
        .eq("provider", "meta")
        .eq("status", "connected")
        .maybeSingle();
      if (!metaAccInt) {
        return { items_upserted: 0, details: { skipped: true, reason: "no_connected_integration" } };
      }
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/sync-meta-accounts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ workspace_id: workspaceId, triggered_by: "cron" }),
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "sync-meta-accounts failed");
      return { items_upserted: data.upserted ?? 0, details: { errors: data.errors } };
    }

    case "sync_meta_daily_metrics": {
      // Call the real sync-meta-daily edge function
      const { data: metaInt } = await supabase
        .from("integrations")
        .select("id, status")
        .eq("workspace_id", workspaceId)
        .eq("provider", "meta")
        .eq("status", "connected")
        .maybeSingle();
      if (!metaInt) {
        return { items_upserted: 0, details: { skipped: true, reason: "no_connected_integration" } };
      }
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/sync-meta-daily`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ workspace_id: workspaceId, days_back: 3, triggered_by: "cron" }),
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "sync-meta-daily failed");
      return { items_upserted: data.upserted ?? 0, details: { errors: data.errors } };
    }

    case "sync_google_accounts":
    case "sync_google_catalog": {
      const { data: integration } = await supabase
        .from("integrations")
        .select("id, status")
        .eq("workspace_id", workspaceId)
        .eq("provider", "google_ads")
        .eq("status", "connected")
        .maybeSingle();
      if (!integration) {
        return { items_upserted: 0, details: { skipped: true, reason: "no_connected_integration" } };
      }
      return { items_upserted: 0, details: { stub: true, integration_id: integration.id } };
    }

    case "sync_google_daily_metrics": {
      const { data: gadsInt } = await supabase
        .from("integrations")
        .select("id, status")
        .eq("workspace_id", workspaceId)
        .eq("provider", "google_ads")
        .eq("status", "connected")
        .maybeSingle();
      if (!gadsInt) {
        return { items_upserted: 0, details: { skipped: true, reason: "no_connected_integration" } };
      }
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/sync-google-daily`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ workspace_id: workspaceId, days_back: 3, triggered_by: "cron" }),
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "sync-google-daily failed");
      return { items_upserted: data.upserted ?? 0, details: { errors: data.errors } };
    }

    case "sync_ga4_daily": {
      const { data: integration } = await supabase
        .from("integrations")
        .select("id, status")
        .eq("workspace_id", workspaceId)
        .eq("provider", "ga4")
        .eq("status", "connected")
        .maybeSingle();
      if (!integration) {
        return { items_upserted: 0, details: { skipped: true, reason: "no_connected_integration" } };
      }
      // Call both sync functions
      const [dailyResp, sourceResp] = await Promise.all([
        fetch(`${supabaseUrl}/functions/v1/sync-ga4-daily`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ workspace_id: workspaceId, days_back: 3, triggered_by: "cron" }),
        }),
        fetch(`${supabaseUrl}/functions/v1/sync-ga4-by-source`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ workspace_id: workspaceId, days_back: 3, triggered_by: "cron" }),
        }),
      ]);
      const dailyData = dailyResp.ok ? await dailyResp.json() : { upserted: 0 };
      const sourceData = sourceResp.ok ? await sourceResp.json() : { upserted: 0 };
      return {
        items_upserted: (dailyData.upserted ?? 0) + (sourceData.upserted ?? 0),
        details: { daily: dailyData, by_source: sourceData },
      };
    }

    case "resolve_creatives": {
      // Find all unresolved creative assets (no creative_id yet)
      const { data: unresolvedAssets, error: assetsErr } = await supabase
        .from("creative_assets")
        .select("id, workspace_id, provider, external_asset_id, asset_url, asset_hash, asset_type, thumbnail_url, metadata")
        .eq("workspace_id", workspaceId)
        .is("creative_id", null);

      if (assetsErr) throw assetsErr;
      if (!unresolvedAssets?.length) {
        return { items_upserted: 0, details: { message: "no unresolved assets" } };
      }

      let newCreatives = 0;
      let linked = 0;

      for (const asset of unresolvedAssets) {
        // Compute canonical_hash: prefer asset_hash, otherwise hash the URL or external_asset_id
        const rawKey = asset.asset_hash
          || asset.asset_url
          || `${asset.provider}:${asset.external_asset_id}`;

        const hashBuffer = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(`${workspaceId}:${rawKey}`)
        );
        const canonical_hash = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Map asset_type to creative_type (both share video/image/other)
        const creative_type = (asset.asset_type === "video" || asset.asset_type === "image")
          ? asset.asset_type
          : "other";

        // Upsert creative — do nothing on conflict (dedup)
        const { error: upsertErr } = await supabase
          .from("creatives")
          .upsert(
            { workspace_id: workspaceId, canonical_hash, creative_type, canonical_url: asset.asset_url ?? null },
            { onConflict: "workspace_id,canonical_hash", ignoreDuplicates: true }
          );
        if (upsertErr) {
          console.error(`[resolve_creatives] upsert error for asset ${asset.id}:`, upsertErr.message);
          continue;
        }

        // Fetch the creative id (newly created or already existing)
        const { data: creative } = await supabase
          .from("creatives")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("canonical_hash", canonical_hash)
          .single();

        if (!creative) continue;

        // Was this creative just created (not a duplicate)?
        // We count it as new if the asset_hash wasn't previously linked
        newCreatives++;

        // Link the asset to the resolved creative
        const { error: linkErr } = await supabase
          .from("creative_assets")
          .update({ creative_id: creative.id })
          .eq("id", asset.id);

        if (!linkErr) linked++;
      }

      return {
        items_upserted: newCreatives,
        details: { assets_processed: unresolvedAssets.length, assets_linked: linked },
      };
    }

    case "aggregate_revenue": {
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/aggregate-revenue`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ workspace_id: workspaceId, days_back: 7 }),
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      if (!data.success) throw new Error(data.errors?.join("; ") || "aggregate-revenue failed");
      return { items_upserted: data.upserted ?? 0, details: { errors: data.errors } };
    }

    case "health_checks": {
      // Check integration token health
      const { data: integrations } = await supabase
        .from("integrations")
        .select("id, provider, status, token_expires_at")
        .eq("workspace_id", workspaceId);

      const issues: string[] = [];
      for (const integ of integrations ?? []) {
        if (integ.token_expires_at) {
          const expiresAt = new Date(integ.token_expires_at);
          if (expiresAt < new Date()) {
            issues.push(`${integ.provider}: token expired`);
            // Insert health event
            await supabase.from("health_events").insert({
              workspace_id: workspaceId,
              provider: integ.provider,
              entity_type: "account",
              check_type: "token_expiry",
              message: `${integ.provider} integration token has expired`,
              severity: "critical",
            });
          }
        }
      }
      return { items_upserted: 0, details: { checked: integrations?.length ?? 0, issues } };
    }

    case "compute_workspace_health": {
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/compute-workspace-health`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ workspace_id: workspaceId }),
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      return { items_upserted: 0, details: { score: data.score, status: data.status, penalties: data.penalties?.length ?? 0 } };
    }

    case "sync_ecommerce_daily": {
      // Iterate over all ecommerce_connections for this workspace
      const { data: connections } = await supabase
        .from("ecommerce_connections")
        .select("id")
        .eq("workspace_id", workspaceId)
        .neq("status", "disconnected");

      if (!connections || connections.length === 0) {
        return { items_upserted: 0, details: { skipped: true, reason: "no_ecommerce_connections" } };
      }

      let totalUpserted = 0;
      const errors: string[] = [];
      for (const conn of connections) {
        const resp = await fetch(
          `${supabaseUrl}/functions/v1/sync-ecommerce-daily`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ connectionId: conn.id }),
          }
        );
        if (!resp.ok) {
          errors.push(`connection ${conn.id}: HTTP ${resp.status}`);
          continue;
        }
        const data = await resp.json();
        if (data.success) {
          totalUpserted += (data.ordersUpserted ?? 0);
        } else {
          errors.push(`connection ${conn.id}: ${data.error}`);
        }
      }
      return { items_upserted: totalUpserted, details: { errors } };
    }

    case "aggregate_ecommerce_revenue": {
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/aggregate-ecommerce-revenue`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ workspaceId }),
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "aggregate-ecommerce-revenue failed");
      return { items_upserted: data.rowsUpdated ?? 0, details: { groupsProcessed: data.groupsProcessed } };
    }

    default:
      throw new Error(`Unknown job: ${jobName}`);
  }
}

// ── Check consecutive failures & mark degraded ───────────────────────
async function checkAndMarkDegraded(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  provider: Provider
): Promise<void> {
  // Get last 3 sync runs for this provider
  const { data: recentRuns } = await supabase
    .from("sync_runs")
    .select("status")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .order("started_at", { ascending: false })
    .limit(3);

  if (
    recentRuns &&
    recentRuns.length >= 3 &&
    recentRuns.every((r) => r.status === "error")
  ) {
    await supabase
      .from("integrations")
      .update({ status: "degraded" })
      .eq("workspace_id", workspaceId)
      .eq("provider", provider);

    await supabase.from("health_events").insert({
      workspace_id: workspaceId,
      provider,
      check_type: "consecutive_failures",
      message: `${provider} marked as degraded after 3 consecutive job failures`,
      severity: "critical",
    });
  }
}

// ── Main orchestrator ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all active workspaces
    const { data: workspaces, error: wsErr } = await supabase
      .from("workspaces")
      .select("id")
      .eq("status", "active");
    if (wsErr) throw wsErr;

    const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_PER_PROVIDER);

    // Group jobs by phase
    const phases = new Map<number, JobDef[]>();
    for (const job of JOB_DEFS) {
      const list = phases.get(job.phase) ?? [];
      list.push(job);
      phases.set(job.phase, list);
    }
    const sortedPhases = [...phases.keys()].sort((a, b) => a - b);

    const results: Array<{
      job: string;
      workspace: string;
      status: string;
      attempts: number;
      items: number;
      error: string | null;
    }> = [];

    for (const phase of sortedPhases) {
      const phaseJobs = phases.get(phase)!;

      // Run all jobs in this phase across all workspaces, respecting concurrency
      const promises: Promise<void>[] = [];

      for (const ws of workspaces ?? []) {
        for (const job of phaseJobs) {
          const providerKey = job.provider ?? "global";

          const promise = (async () => {
            await limiter.acquire(providerKey);
            const syncRunStartedAt = new Date().toISOString();

            try {
              // Insert running sync_run
              const { data: syncRun } = await supabase
                .from("sync_runs")
                .insert({
                  workspace_id: ws.id,
                  provider: job.provider ?? "meta",
                  job_name: job.name,
                  status: "running",
                  started_at: syncRunStartedAt,
                  triggered_by: "cron",
                })
                .select("id")
                .single();

              const { result, attempts, error } = await withRetry(
                () => executeJob(job.name, ws.id, supabase),
                MAX_RETRIES
              );

              const finalStatus = error ? "error" : "success";

              // Update sync_run
              if (syncRun?.id) {
                await supabase
                  .from("sync_runs")
                  .update({
                    status: finalStatus,
                    ended_at: new Date().toISOString(),
                    items_upserted: result?.items_upserted ?? 0,
                    error_message: error,
                    retry_count: attempts - 1,
                    details: result?.details ?? { error },
                  })
                  .eq("id", syncRun.id);
              }

              // Check for degraded status on failure
              if (error && job.provider) {
                await checkAndMarkDegraded(supabase, ws.id, job.provider);
              }

              results.push({
                job: job.name,
                workspace: ws.id,
                status: finalStatus,
                attempts,
                items: result?.items_upserted ?? 0,
                error,
              });
            } finally {
              limiter.release(providerKey);
            }
          })();

          promises.push(promise);
        }
      }

      // Wait for all jobs in this phase to complete before moving to next
      await Promise.all(promises);
    }

    const elapsed = Date.now() - startTime;
    const summary = {
      success: true,
      elapsed_ms: elapsed,
      workspaces: workspaces?.length ?? 0,
      jobs_executed: results.length,
      failures: results.filter((r) => r.status === "error").length,
      results,
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("job-orchestrator error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
