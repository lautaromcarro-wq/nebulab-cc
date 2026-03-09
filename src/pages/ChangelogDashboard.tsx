import { useState, useEffect, useMemo } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/StatCard";
import SectionHeader from "@/components/SectionHeader";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, TrendingUp, Users, BarChart3 } from "lucide-react";

const PIE_COLORS = [
  "hsl(239 84% 67%)",
  "hsl(160 84% 39%)",
  "hsl(38 92% 50%)",
  "hsl(199 89% 48%)",
  "hsl(263 70% 58%)",
  "hsl(350 89% 60%)",
];

const changeTypeLabels: Record<string, string> = {
  budget: "Cambio de Budget",
  targeting: "Cambio de Targeting",
  creative: "Creativo",
  landing: "Landing Page",
  bidding: "Estrategia de Puja",
  tracking: "Tracking",
  other: "Otro",
};

const platformLabels: Record<string, string> = {
  meta: "Meta (Facebook/Instagram)",
  google_ads: "Google Ads",
  ga4: "GA4",
};

interface Entry {
  id: string;
  change_type: string;
  platform: string | null;
  created_at: string;
  created_by: string;
  profile_name?: string;
}

export default function ChangelogDashboard() {
  const { currentWorkspace } = useWorkspace();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("changelog")
        .select("id, change_type, platform, created_at, created_by")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false })
        .limit(500);

      const items = data ?? [];

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

    fetchData();
  }, [currentWorkspace]);

  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const sevenDaysAgo = subDays(now, 7);

  const changesToday = entries.filter((e) => format(new Date(e.created_at), "yyyy-MM-dd") === today).length;
  const changesLast7 = entries.filter((e) => new Date(e.created_at) >= sevenDaysAgo).length;
  const totalChanges = entries.length;
  const uniqueSpecialists = new Set(entries.map((e) => e.profile_name).filter(Boolean)).size;

  // Changes by specialist
  const bySpecialist = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      const name = e.profile_name || "—";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [entries]);

  // Changes by type for pie chart
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      const label = changeTypeLabels[e.change_type] || e.change_type;
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [entries]);

  // Changes by platform
  const byPlatform = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      if (e.platform) {
        const label = platformLabels[e.platform] || e.platform;
        map[label] = (map[label] || 0) + 1;
      }
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [entries]);

  // Evolution line chart (last 14 days)
  const evolution = useMemo(() => {
    const start = subDays(now, 14);
    const days = eachDayOfInterval({ start, end: now });
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      const d = format(new Date(e.created_at), "yyyy-MM-dd");
      map[d] = (map[d] || 0) + 1;
    });
    return days.map((d) => ({
      date: format(d, "dd MMM", { locale: es }),
      total: map[format(d, "yyyy-MM-dd")] || 0,
    }));
  }, [entries]);

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <SectionHeader badge="Analytics" title="Dashboard de Modificaciones" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        badge="Analytics"
        title="Dashboard de Modificaciones"
        subtitle="Visualización en tiempo real de los cambios registrados en la bitácora"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Cambios Hoy" value={String(changesToday)} status="neutral" />
        <StatCard icon={TrendingUp} label="Últimos 7 días" value={String(changesLast7)} status="primary" />
        <StatCard icon={BarChart3} label="Total Cambios" value={String(totalChanges)} status="neutral" />
        <StatCard icon={Users} label="Especialistas" value={String(uniqueSpecialists)} status="neutral" />
      </div>

      {/* Evolution chart */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-bold">Evolución de Cambios</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={evolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <RechartsTooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                name="Total de Cambios"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Type + Client charts side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Type - Pie */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Cambios por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byType.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={byType}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {byType.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By Specialist - Bar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Cambios por Especialista
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bySpecialist.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={bySpecialist} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <RechartsTooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By Platform */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Cambios por Plataforma
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {byPlatform.map((p) => (
              <Card key={p.name} className="shadow-sm min-w-[200px]">
                <CardContent className="p-4 flex items-center gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{p.name}</p>
                    <p className="text-2xl font-bold">{p.count}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {byPlatform.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin datos de plataforma</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
