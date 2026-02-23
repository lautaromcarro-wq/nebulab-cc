import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Workspace = Tables<"workspaces">;
type Segment = Tables<"segments">;

export type PlatformFilter = "all" | "meta" | "google_ads" | "ga4";

interface DateRange {
  from: Date;
  to: Date;
}

function getMonthToDate(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: now,
  };
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (ws: Workspace) => void;
  segments: Segment[];
  selectedSegmentId: string | null; // null = All
  setSelectedSegmentId: (id: string | null) => void;
  platformFilter: PlatformFilter;
  setPlatformFilter: (p: PlatformFilter) => void;
  dateRange: DateRange;
  setDateRange: (r: DateRange) => void;
  loading: boolean;
  workspaceRole: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaces: [],
  currentWorkspace: null,
  setCurrentWorkspace: () => {},
  segments: [],
  selectedSegmentId: null,
  setSelectedSegmentId: () => {},
  platformFilter: "all",
  setPlatformFilter: () => {},
  dateRange: getMonthToDate(),
  setDateRange: () => {},
  loading: true,
  workspaceRole: null,
});

export const useWorkspace = () => useContext(WorkspaceContext);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>(getMonthToDate());
  const [loading, setLoading] = useState(true);
  const [workspaceRole, setWorkspaceRole] = useState<string | null>(null);

  // Fetch workspaces
  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setLoading(false);
      return;
    }

    const fetchWorkspaces = async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("*")
        .eq("status", "active");
      
      const wsList = data ?? [];
      setWorkspaces(wsList);

      // Restore or pick first
      const savedId = localStorage.getItem("current_workspace_id");
      const found = wsList.find((w) => w.id === savedId);
      setCurrentWorkspace(found ?? wsList[0] ?? null);
      setLoading(false);
    };

    fetchWorkspaces();
  }, [user]);

  // Persist workspace choice
  useEffect(() => {
    if (currentWorkspace) {
      localStorage.setItem("current_workspace_id", currentWorkspace.id);
    }
  }, [currentWorkspace]);

  // Fetch segments + role when workspace changes
  useEffect(() => {
    if (!currentWorkspace || !user) {
      setSegments([]);
      setWorkspaceRole(null);
      return;
    }

    const fetchData = async () => {
      const [segRes, roleRes] = await Promise.all([
        supabase
          .from("segments")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .eq("status", "active")
          .order("name"),
        supabase.rpc("get_workspace_role", {
          _user_id: user.id,
          _workspace_id: currentWorkspace.id,
        }),
      ]);
      setSegments(segRes.data ?? []);
      setWorkspaceRole(roleRes.data ?? null);
    };

    fetchData();
  }, [currentWorkspace, user]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        setCurrentWorkspace,
        segments,
        selectedSegmentId,
        setSelectedSegmentId,
        platformFilter,
        setPlatformFilter,
        dateRange,
        setDateRange,
        loading,
        workspaceRole,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};
