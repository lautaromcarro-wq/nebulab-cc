import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface UsageRow {
  date: string;
  metric_key: string;
  value: number;
}

interface Options {
  from?: string;
  to?: string;
  metricKeys?: string[];
}

export function useWorkspaceUsage({ from, to, metricKeys }: Options = {}) {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;

  return useQuery({
    queryKey: ["workspace-usage", wsId, from, to, metricKeys?.sort().join(",")],
    enabled: !!wsId,
    queryFn: async (): Promise<UsageRow[]> => {
      if (!wsId) return [];
      let q = supabase
        .from("workspace_usage_daily")
        .select("date, metric_key, value")
        .eq("workspace_id", wsId)
        .order("date", { ascending: false });
      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);
      if (metricKeys && metricKeys.length > 0) q = q.in("metric_key", metricKeys);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as UsageRow[];
    },
  });
}

export function sumUsage(rows: UsageRow[], metricKey: string): number {
  return rows
    .filter((r) => r.metric_key === metricKey)
    .reduce((acc, r) => acc + Number(r.value ?? 0), 0);
}
