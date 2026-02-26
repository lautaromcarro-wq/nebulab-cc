import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface FinancialSettings {
  avg_cogs_percent: number;
  shipping_percent: number;
  payment_fee_percent: number;
  refund_percent: number;
  iva_percent: number;
}

const defaultSettings: FinancialSettings = {
  avg_cogs_percent: 0,
  shipping_percent: 0,
  payment_fee_percent: 0,
  refund_percent: 0,
  iva_percent: 0,
};

export function useFinancialSettings() {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const wsId = currentWorkspace?.id;

  const query = useQuery({
    queryKey: ["financial-settings", wsId],
    queryFn: async (): Promise<FinancialSettings> => {
      if (!wsId) return defaultSettings;
      const { data } = await supabase
        .from("workspace_financial_settings")
        .select("*")
        .eq("workspace_id", wsId)
        .maybeSingle();
      if (!data) return defaultSettings;
      return {
        avg_cogs_percent: Number(data.avg_cogs_percent) || 0,
        shipping_percent: Number(data.shipping_percent) || 0,
        payment_fee_percent: Number(data.payment_fee_percent) || 0,
        refund_percent: Number(data.refund_percent) || 0,
        iva_percent: Number(data.iva_percent) || 0,
      };
    },
    enabled: !!wsId,
  });

  const mutation = useMutation({
    mutationFn: async (settings: FinancialSettings) => {
      if (!wsId) throw new Error("No workspace");
      const { error } = await supabase
        .from("workspace_financial_settings")
        .upsert({
          workspace_id: wsId,
          ...settings,
          updated_at: new Date().toISOString(),
        }, { onConflict: "workspace_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-settings", wsId] });
      queryClient.invalidateQueries({ queryKey: ["scorecard"] });
    },
  });

  return { settings: query.data ?? defaultSettings, isLoading: query.isLoading, save: mutation.mutateAsync, isSaving: mutation.isPending };
}
