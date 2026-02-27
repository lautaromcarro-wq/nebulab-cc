import { useState, useEffect } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import SectionHeader from "@/components/SectionHeader";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, Users, Clock, FileText } from "lucide-react";

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
  client_name?: string;
}

const changeTypeLabels: Record<string, string> = {
  strategic: "Cambio Estratégico",
  budget: "Cambio de Budget",
  creative: "Nuevo Creativo",
  targeting: "Cambio de Targeting",
  bid: "Cambio de Bid",
  landing: "Landing Page",
  copy: "Copy",
  new_adset: "Nuevo Conjunto de Anuncios",
  other: "Otro",
};

const changeTypeBadgeClass: Record<string, string> = {
  strategic: "bg-accent/10 text-accent",
  budget: "bg-warning/10 text-warning",
  creative: "bg-info/10 text-info",
  targeting: "bg-success/10 text-success",
  bid: "bg-primary/10 text-primary",
  landing: "bg-destructive/10 text-destructive",
  copy: "bg-muted text-muted-foreground",
  new_adset: "bg-info/10 text-info",
  other: "bg-muted text-muted-foreground",
};

const platformLabels: Record<string, string> = {
  meta: "Meta (Facebook/Instagram)",
  google_ads: "Google Ads",
  ga4: "GA4",
};

const platformBadgeClass: Record<string, string> = {
  meta: "bg-info/10 text-info",
  google_ads: "bg-success/10 text-success",
  ga4: "bg-warning/10 text-warning",
};

export default function Changelog() {
  const { currentWorkspace } = useWorkspace();
  const { clients } = useClient();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
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
        .select("id, title, change_type, platform, description, created_at, created_by, status")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const items = data ?? [];

      // Fetch profile names
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
  }, [currentWorkspace, clients]);

  // Group by client for summary
  const clientSummary = entries.reduce<Record<string, { count: number; lastDate: string }>>((acc, e) => {
    const name = e.client_name || "Sin cliente";
    if (!acc[name]) acc[name] = { count: 0, lastDate: e.created_at };
    acc[name].count++;
    if (e.created_at > acc[name].lastDate) acc[name].lastDate = e.created_at;
    return acc;
  }, {});

  // Last 7 days entries
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentEntries = entries.filter((e) => new Date(e.created_at) >= sevenDaysAgo);

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        badge="Herramientas"
        title="Bitácora de Cambios"
        subtitle="Registro centralizado de cambios estratégicos y de plataforma de todos los clientes"
      />

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Registrá tu primer cambio para empezar a correlacionar con métricas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Recent entries table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-bold">
                  Últimos Cambios (7 días)
                </CardTitle>
                <Badge variant="secondary" className="text-[10px]">{recentEntries.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay cambios en los últimos 7 días
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs">Plataforma</TableHead>
                      <TableHead className="text-xs">Comentarios</TableHead>
                      <TableHead className="text-xs">Registrado por</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[10px] border-0 whitespace-nowrap",
                              changeTypeBadgeClass[entry.change_type] || changeTypeBadgeClass.other
                            )}
                          >
                            {changeTypeLabels[entry.change_type] || entry.change_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-primary">
                          {entry.client_name || "—"}
                        </TableCell>
                        <TableCell>
                          {entry.platform ? (
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] border-0 whitespace-nowrap",
                                platformBadgeClass[entry.platform] || ""
                              )}
                            >
                              {platformLabels[entry.platform] || entry.platform}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {entry.description || entry.title}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {entry.profile_name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(entry.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Client Summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-bold">
                  Resumen por Cliente
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs">Cambios Registrados</TableHead>
                    <TableHead className="text-xs">Último Cambio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(clientSummary)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([name, { count, lastDate }]) => (
                      <TableRow key={name}>
                        <TableCell className="text-xs font-semibold">{name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] border-0">
                            {count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(lastDate), "dd MMM yyyy, HH:mm", { locale: es })}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
