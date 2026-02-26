import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface WorkspaceHealth {
  score: number;
  status: "healthy" | "attention" | "critical";
  penalties: Array<{ rule: string; points: number; detail: string }>;
  computed_at: string;
}

export function useWorkspaceHealth() {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id;

  return useQuery({
    queryKey: ["workspace-health", wsId],
    queryFn: async (): Promise<WorkspaceHealth | null> => {
      if (!wsId) return null;
      const { data } = await supabase
        .from("workspace_health")
        .select("*")
        .eq("workspace_id", wsId)
        .maybeSingle();
      if (!data) return null;
      return {
        score: data.score,
        status: data.status as WorkspaceHealth["status"],
        penalties: (data.penalties as any[]) ?? [],
        computed_at: data.computed_at,
      };
    },
    enabled: !!wsId,
  });
}
