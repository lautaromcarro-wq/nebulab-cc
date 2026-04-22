// supabase/functions/_shared/metering.ts
//
// Usage metering for edge functions. Call trackUsage() from any function that
// does billing-relevant work (API calls to Meta/Google, AI tokens, rows
// ingested, etc). Errors are swallowed and logged — metering failures must
// never fail the caller.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface TrackUsageArgs {
  supabase: SupabaseClient;
  workspaceId: string;
  metricKey: string;
  increment?: number;
  date?: string; // YYYY-MM-DD, defaults to today UTC
}

export async function trackUsage({
  supabase,
  workspaceId,
  metricKey,
  increment = 1,
  date,
}: TrackUsageArgs): Promise<void> {
  try {
    const { error } = await supabase.rpc("track_usage", {
      p_workspace_id: workspaceId,
      p_metric_key: metricKey,
      p_increment: increment,
      p_date: date ?? new Date().toISOString().slice(0, 10),
    });
    if (error) {
      console.error("[metering] track_usage failed", {
        metric: metricKey,
        workspace: workspaceId,
        error: error.message,
      });
    }
  } catch (err) {
    console.error("[metering] track_usage threw", {
      metric: metricKey,
      workspace: workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// Batch variant for hot paths — accumulate metrics in-memory, flush once.
export class UsageBatch {
  private readonly counters = new Map<string, number>();

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly workspaceId: string,
  ) {}

  add(metricKey: string, increment = 1): void {
    this.counters.set(metricKey, (this.counters.get(metricKey) ?? 0) + increment);
  }

  async flush(date?: string): Promise<void> {
    const entries = Array.from(this.counters.entries());
    this.counters.clear();
    await Promise.all(
      entries.map(([metricKey, increment]) =>
        trackUsage({
          supabase: this.supabase,
          workspaceId: this.workspaceId,
          metricKey,
          increment,
          date,
        })
      ),
    );
  }
}
