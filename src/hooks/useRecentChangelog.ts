import { useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";

interface ChangelogEntry {
  id: string;
  title: string;
  change_type: string;
  platform: string | null;
  description: string | null;
  created_at: string;
  created_by: string;
  status: string;
  profile_name?: string;
}

export function useRecentChangelog(limit = 7) {
  const { currentWorkspace } = useWorkspace();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("changelog")
        .select("id, title, change_type, platform, description, created_at, created_by, status")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      const items = data ?? [];

      // Fetch profile names for created_by
      if (items.length > 0) {
        const userIds = [...new Set(items.map((e) => e.created_by))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);

        const profileMap = new Map(
          (profiles ?? []).map((p) => [p.user_id, p.full_name || p.email || "—"])
        );

        setEntries(
          items.map((e) => ({
            ...e,
            profile_name: profileMap.get(e.created_by) ?? "—",
          }))
        );
      } else {
        setEntries([]);
      }

      setLoading(false);
    };

    fetch();
  }, [currentWorkspace, limit]);

  return { entries, loading };
}
