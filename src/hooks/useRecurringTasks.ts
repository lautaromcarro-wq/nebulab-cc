// src/hooks/useRecurringTasks.ts
// Manages recurring task instances per client with auto-renewal and bitacora integration.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface TaskInstance {
  id: string;
  template_id: string | null;
  client_id: string;
  title: string;
  category: string;
  frequency: string;
  period_start: string;
  period_end: string;
  status: string;
  completed_at: string | null;
  completed_by: string | null;
  note: string | null;
  bitacora_id: string | null;
  created_at: string;
}

export interface CategoryGroup {
  category: string;
  label: string;
  tasks: TaskInstance[];
  done: number;
  total: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  analytics: "Analytics",
  general: "General",
};

export function useRecurringTasks(clientId: string | undefined) {
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const queryKey = ["recurring-tasks", currentWorkspace?.id, clientId];

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!currentWorkspace && !!clientId,
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from("task_instances")
        .select("*")
        .eq("workspace_id", currentWorkspace!.id)
        .eq("client_id", clientId!)
        .order("category")
        .order("period_start", { ascending: false });

      if (error) throw error;

      // Group by period, then by category
      const byPeriod = new Map<string, TaskInstance[]>();
      for (const t of (tasks as TaskInstance[]) ?? []) {
        const key = `${t.period_start}|${t.period_end}|${t.frequency}`;
        const arr = byPeriod.get(key) ?? [];
        arr.push(t);
        byPeriod.set(key, arr);
      }

      // Current week tasks (most recent weekly period)
      const weeklyTasks = (tasks as TaskInstance[])?.filter((t) => t.frequency === "weekly") ?? [];
      const latestWeekStart = weeklyTasks.length > 0
        ? weeklyTasks.reduce((max, t) => t.period_start > max ? t.period_start : max, weeklyTasks[0].period_start)
        : null;

      const currentWeek = latestWeekStart
        ? weeklyTasks.filter((t) => t.period_start === latestWeekStart)
        : [];

      // Biweekly tasks (current period)
      const biweeklyTasks = (tasks as TaskInstance[])?.filter((t) => t.frequency === "biweekly") ?? [];
      const latestBiweeklyStart = biweeklyTasks.length > 0
        ? biweeklyTasks.reduce((max, t) => t.period_start > max ? t.period_start : max, biweeklyTasks[0].period_start)
        : null;
      const currentBiweekly = latestBiweeklyStart
        ? biweeklyTasks.filter((t) => t.period_start === latestBiweeklyStart)
        : [];

      // Monthly tasks (current period)
      const monthlyTasks = (tasks as TaskInstance[])?.filter((t) => t.frequency === "monthly") ?? [];
      const latestMonthStart = monthlyTasks.length > 0
        ? monthlyTasks.reduce((max, t) => t.period_start > max ? t.period_start : max, monthlyTasks[0].period_start)
        : null;
      const currentMonthly = latestMonthStart
        ? monthlyTasks.filter((t) => t.period_start === latestMonthStart)
        : [];

      // Combine all current tasks and group by category
      const allCurrent = [...currentWeek, ...currentBiweekly, ...currentMonthly];
      const grouped = new Map<string, TaskInstance[]>();
      for (const t of allCurrent) {
        const arr = grouped.get(t.category) ?? [];
        arr.push(t);
        grouped.set(t.category, arr);
      }

      const categories: CategoryGroup[] = Array.from(grouped.entries())
        .map(([cat, tasks]) => ({
          category: cat,
          label: CATEGORY_LABELS[cat] ?? cat,
          tasks,
          done: tasks.filter((t) => t.status === "done").length,
          total: tasks.length,
        }))
        .sort((a, b) => {
          const order = ["meta_ads", "google_ads", "analytics", "general"];
          return order.indexOf(a.category) - order.indexOf(b.category);
        });

      const totalDone = allCurrent.filter((t) => t.status === "done").length;
      const totalTasks = allCurrent.length;

      return {
        categories,
        totalDone,
        totalTasks,
        weekPeriod: latestWeekStart ? { start: latestWeekStart, end: currentWeek[0]?.period_end } : null,
        allTasks: tasks as TaskInstance[],
      };
    },
  });

  // Complete a task (with optional note → bitacora)
  const completeTask = useMutation({
    mutationFn: async ({ taskId, note, analystName }: { taskId: string; note?: string; analystName?: string }) => {
      const task = data?.allTasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");

      let bitacoraId: string | null = null;

      // If note provided, create bitacora entry
      if (note && note.trim()) {
        const { data: bitacora, error: bitErr } = await supabase
          .from("client_bitacora")
          .insert({
            workspace_id: currentWorkspace!.id,
            client_id: task.client_id,
            type: "task_completion",
            title: task.title,
            body: note.trim(),
            author_name: analystName ?? "Analista",
            task_instance_id: taskId,
          })
          .select("id")
          .single();

        if (bitErr) throw bitErr;
        bitacoraId = bitacora.id;
      }

      // Update task instance
      const { error } = await supabase
        .from("task_instances")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
          completed_by: analystName ?? "Analista",
          note: note?.trim() || null,
          bitacora_id: bitacoraId,
        })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Skip a task
  const skipTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("task_instances")
        .update({ status: "skipped" })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Reopen a task
  const reopenTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("task_instances")
        .update({ status: "pending", completed_at: null, completed_by: null, note: null })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    categories: data?.categories ?? [],
    totalDone: data?.totalDone ?? 0,
    totalTasks: data?.totalTasks ?? 0,
    weekPeriod: data?.weekPeriod ?? null,
    isLoading,
    completeTask,
    skipTask,
    reopenTask,
  };
}
