import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_RUNTIME_MS = 240_000; // 4 min safety

interface BackfillRequest {
  workspace_id: string;
  provider: "meta" | "google_ads" | "ga4" | "all";
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  chunk_size_days?: number;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function buildChunks(start: Date, end: Date, chunkDays: number): Array<{ start: string; end: string }> {
  const chunks: Array<{ start: string; end: string }> = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const chunkEnd = new Date(Math.min(addDays(cursor, chunkDays - 1).getTime(), end.getTime()));
    chunks.push({ start: formatDate(cursor), end: formatDate(chunkEnd) });
    cursor = addDays(chunkEnd, 1);
  }
  return chunks;
}

function getProviders(provider: string): string[] {
  if (provider === "all") return ["meta", "google_ads", "ga4"];
  return [provider];
}

function getSyncFunctionName(provider: string): string {
  switch (provider) {
    case "meta": return "sync-meta-daily";
    case "google_ads": return "sync-google-daily";
    case "ga4": return "sync-ga4-daily";
    default: return "";
  }
}

function daysBetween(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / (86400_000)) + 1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: BackfillRequest = await req.json();
    const { workspace_id, provider, start_date, end_date, chunk_size_days = 30 } = body;

    if (!workspace_id || !provider || !start_date || !end_date) {
      return jsonResponse({ success: false, error: "Missing required fields: workspace_id, provider, start_date, end_date" }, 400);
    }

    const startDt = new Date(start_date);
    const endDt = new Date(end_date);
    if (isNaN(startDt.getTime()) || isNaN(endDt.getTime()) || startDt > endDt) {
      return jsonResponse({ success: false, error: "Invalid date range" }, 400);
    }

    // Check for existing running backfill
    const { data: running } = await supabase
      .from("backfill_runs")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("status", "running")
      .limit(1);

    if (running && running.length > 0) {
      return jsonResponse({ success: false, error: "A backfill is already running for this workspace" }, 409);
    }

    const providers = getProviders(provider);
    const chunks = buildChunks(startDt, endDt, chunk_size_days);

    // Create backfill_run record
    const { data: backfillRun, error: insertErr } = await supabase
      .from("backfill_runs")
      .insert({
        workspace_id,
        provider,
        start_date,
        end_date,
        chunk_size_days,
        status: "running",
        chunks_total: chunks.length * providers.length,
        chunks_completed: 0,
        items_inserted: 0,
        current_chunk_start: chunks[0]?.start,
        current_chunk_end: chunks[0]?.end,
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;
    const runId = backfillRun!.id;

    console.log(`[backfill] Started run ${runId}: ${provider} from ${start_date} to ${end_date}, ${chunks.length} chunks × ${providers.length} providers`);

    // Log start event
    await supabase.from("health_events").insert({
      workspace_id,
      check_type: "backfill_started",
      message: `Backfill ${provider}: ${start_date} → ${end_date} (${chunks.length} chunks)`,
      severity: "info",
    });

    let totalItems = 0;
    let chunksCompleted = 0;
    const errors: string[] = [];

    for (const chunk of chunks) {
      // Runtime guard
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        errors.push("Runtime limit reached, stopping early");
        break;
      }

      const chunkDays = daysBetween(new Date(chunk.start), new Date(chunk.end));

      // Update current chunk progress
      await supabase.from("backfill_runs").update({
        current_chunk_start: chunk.start,
        current_chunk_end: chunk.end,
      }).eq("id", runId);

      for (const prov of providers) {
        const fnName = getSyncFunctionName(prov);
        if (!fnName) continue;

        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              workspace_id,
              days_back: chunkDays,
              start_date: chunk.start,
              end_date: chunk.end,
              triggered_by: "manual",
            }),
          });

          if (!resp.ok) {
            const errText = await resp.text();
            errors.push(`${prov} chunk ${chunk.start}-${chunk.end}: HTTP ${resp.status} ${errText.substring(0, 200)}`);
          } else {
            const data = await resp.json();
            const upserted = data.upserted ?? data.items_upserted ?? 0;
            totalItems += upserted;

            // Also run ga4-by-source for GA4
            if (prov === "ga4") {
              try {
                const srcResp = await fetch(`${supabaseUrl}/functions/v1/sync-ga4-by-source`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${serviceKey}`,
                  },
                  body: JSON.stringify({
                    workspace_id,
                    days_back: chunkDays,
                    start_date: chunk.start,
                    end_date: chunk.end,
                    triggered_by: "manual",
                  }),
                });
                if (srcResp.ok) {
                  const srcData = await srcResp.json();
                  totalItems += srcData.upserted ?? 0;
                }
              } catch { /* non-critical */ }
            }
          }

          chunksCompleted++;

          // Update progress
          await supabase.from("backfill_runs").update({
            items_inserted: totalItems,
            chunks_completed: chunksCompleted,
          }).eq("id", runId);

          // Log chunk completion
          await supabase.from("health_events").insert({
            workspace_id,
            check_type: "backfill_chunk_completed",
            message: `${prov} chunk ${chunk.start}→${chunk.end}: +${data?.upserted ?? 0} rows`,
            severity: "info",
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${prov} chunk ${chunk.start}-${chunk.end}: ${msg}`);
          chunksCompleted++;
        }
      }
    }

    // Run aggregate-revenue after all chunks
    try {
      await fetch(`${supabaseUrl}/functions/v1/aggregate-revenue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          workspace_id,
          days_back: daysBetween(startDt, endDt),
        }),
      });
    } catch { /* non-critical */ }

    const finalStatus = errors.length > 0 ? (totalItems > 0 ? "completed" : "failed") : "completed";

    await supabase.from("backfill_runs").update({
      status: finalStatus,
      items_inserted: totalItems,
      chunks_completed: chunksCompleted,
      error_message: errors.length > 0 ? errors.join("; ") : null,
      details: { errors, providers, chunks_total: chunks.length },
    }).eq("id", runId);

    // Log completion
    await supabase.from("health_events").insert({
      workspace_id,
      check_type: errors.length > 0 ? "backfill_failed" : "backfill_completed",
      message: `Backfill ${provider}: ${totalItems} rows, ${chunksCompleted} chunks, ${errors.length} errors`,
      severity: errors.length > 0 ? "warn" : "info",
    });

    console.log(`[backfill] Run ${runId} finished: ${finalStatus}, ${totalItems} rows, ${errors.length} errors`);

    return jsonResponse({
      success: true,
      backfill_run_id: runId,
      status: finalStatus,
      items_inserted: totalItems,
      chunks_completed: chunksCompleted,
      chunks_total: chunks.length * providers.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[backfill] Fatal error:", error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
