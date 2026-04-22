import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export type FeatureKey =
  | "ecommerce.tiendanube"
  | "ecommerce.woocommerce"
  | "ai.analyst"
  | "experiments"
  | "reports.weekly_email"
  | "segments.auto_mapping"
  | "diagnostics.advanced";

export interface WorkspaceFeature {
  feature_key: FeatureKey;
  enabled: boolean;
  config: Record<string, unknown>;
}

export function useFeatureFlags() {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;

  return useQuery({
    queryKey: ["workspace-features", wsId],
    enabled: !!wsId,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, WorkspaceFeature>> => {
      if (!wsId) return {};
      const { data, error } = await supabase
        .from("workspace_features")
        .select("feature_key, enabled, config")
        .eq("workspace_id", wsId);
      if (error) throw error;
      const map: Record<string, WorkspaceFeature> = {};
      for (const row of data ?? []) {
        map[row.feature_key] = {
          feature_key: row.feature_key as FeatureKey,
          enabled: row.enabled,
          config: (row.config as Record<string, unknown>) ?? {},
        };
      }
      return map;
    },
  });
}

export function useFeature(key: FeatureKey, fallback = false): boolean {
  const { data } = useFeatureFlags();
  return data?.[key]?.enabled ?? fallback;
}

export function useFeatureConfig<T extends Record<string, unknown>>(
  key: FeatureKey
): T | null {
  const { data } = useFeatureFlags();
  return (data?.[key]?.config as T) ?? null;
}
