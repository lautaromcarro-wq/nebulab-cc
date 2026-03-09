import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Clock, FileText } from "lucide-react";
import { toast } from "sonner";

interface ChangelogEntry {
  id: string;
  title: string;
  change_type: string;
  platform: string | null;
  description: string | null;
  expected_impact: string | null;
  created_at: string;
  created_by: string;
  status: string;
  profile_name?: string;
}

// Matches DB enum exactly: budget | targeting | creative | landing | bidding | tracking | other
const changeTypeOptions = [
  { value: "budget", label: "Budget" },
  { value: "creative", label: "Creativo" },
  { value: "targeting", label: "Targeting" },
  { value: "landing", label: "Landing Page" },
  { value: "bidding", label: "Bidding" },
  { value: "tracking", label: "Tracking" },
  { value: "other", label: "Otro" },
] as const;

const changeTypeBadgeClass: Record<string, string> = {
  budget: "bg-warning/10 text-warning",
  creative: "bg-info/10 text-info",
  targeting: "bg-success/10 text-success",
  landing: "bg-destructive/10 text-destructive",
  bidding: "bg-primary/10 text-primary",
  tracking: "bg-accent/10 text-accent",
  other: "bg-muted text-muted-foreground",
};

const platformLabels: Record<string, string> = {
  meta: "Meta",
  google_ads: "Google Ads",
  ga4: "GA4",
};

const platformBadgeClass: Record<string, string> = {
  meta: "bg-info/10 text-info",
  google_ads: "bg-success/10 text-success",
  ga4: "bg-warning/10 text-warning",
};

const statusBadge: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  applied: "bg-success/10 text-success",
  reverted: "bg-destructive/10 text-destructive",
};

function NewChangelogDialog({ workspaceId, userId, onSuccess }: { workspaceId: string; userId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    change_type: "budget",
    platform: "none",
    description: "",
    expected_impact: "",
    status: "applied",
  });

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("changelog").insert({
      workspace_id: workspaceId,
      created_by: userId,
      title: form.title.trim(),
      change_type: form.change_type as any,
      platform: form.platform === "none" ? null : form.platform,
      description: form.description || null,
      expected_impact: form.expected_impact || null,
      status: form.status as any,
    });
    setLoading(false);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Cambio registrado");
    setOpen(false);
    setForm({ title: "", change_type: "budget", platform: "none", description: "", expected_impact: "", status: "applied" });
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs gap-1">
          <Plus className="h-3.5 w-3.5" /> Nuevo Cambio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Cambio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          <div>
            <Label>Título <span className="text-destructive">*</span></Label>
            <Input
              placeholder="Ej: Aumenté budget de campaña Prospecting +20%"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de Cambio</Label>
              <Select value={form.change_type} onValueChange={(v) => setForm((p) => ({ ...p, change_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {changeTypeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plataforma</Label>
              <Select value={form.platform} onValueChange={(v) => setForm((p) => ({ ...p, platform: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin plataforma</SelectItem>
                  <SelectItem value="meta">Meta</SelectItem>
                  <SelectItem value="google_ads">Google Ads</SelectItem>
                  <SelectItem value="ga4">GA4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="applied">Aplicado</SelectItem>
                  <SelectItem value="planned">Planeado</SelectItem>
                  <SelectItem value="reverted">Revertido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea
              placeholder="Qué se hizo exactamente y por qué..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
            />
          </div>
          <div>
            <Label>Impacto Esperado</Label>
            <Input
              placeholder="Ej: CPA baje de $15 a $12 en 7 días"
              value={form.expected_impact}
              onChange={(e) => setForm((p) => ({ ...p, expected_impact: e.target.value }))}
            />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={loading || !form.title.trim()}>
            {loading ? "Guardando…" : "Registrar Cambio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Changelog() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");

  const fetchData = useCallback(async () => {
    if (!currentWorkspace) { setEntries([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("changelog")
      .select("id, title, change_type, platform, description, expected_impact, created_at, created_by, status")
      .eq("workspace_id", currentWorkspace.id)
      .order("created_at", { ascending: false })
      .limit(200);

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
      setEntries(items.map((e) => ({ ...e, profile_name: profileMap.get(e.created_by) ?? "—" })));
    } else {
      setEntries([]);
    }
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = filterType === "all" ? entries : entries.filter((e) => e.change_type === filterType);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentCount = entries.filter((e) => new Date(e.created_at) >= sevenDaysAgo).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        badge="Bitácora"
        title="Bitácora de Cambios"
        subtitle={`${entries.length} cambio(s) · ${recentCount} últimos 7 días`}
        action={
          currentWorkspace && user && (
            <div className="flex gap-2 items-center">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {changeTypeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <NewChangelogDialog workspaceId={currentWorkspace.id} userId={user.id} onSuccess={fetchData} />
            </div>
          )
        }
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Sin cambios registrados"
          description='Registrá el primer cambio con el botón "Nuevo Cambio".'
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Título</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Plataforma</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                  <TableHead className="text-xs">Impacto Esperado</TableHead>
                  <TableHead className="text-xs">Por</TableHead>
                  <TableHead className="text-xs">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => {
                  const typeOption = changeTypeOptions.find((o) => o.value === entry.change_type);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs font-medium max-w-[220px]">
                        <p className="truncate" title={entry.title}>{entry.title}</p>
                        {entry.description && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={entry.description}>
                            {entry.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("text-[10px] border-0 whitespace-nowrap", changeTypeBadgeClass[entry.change_type] ?? "bg-muted text-muted-foreground")}>
                          {typeOption?.label ?? entry.change_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {entry.platform ? (
                          <Badge variant="secondary" className={cn("text-[10px] border-0", platformBadgeClass[entry.platform] ?? "")}>
                            {platformLabels[entry.platform] ?? entry.platform}
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("text-[10px] border-0 capitalize", statusBadge[entry.status] ?? "bg-muted")}>
                          {entry.status === "applied" ? "Aplicado" : entry.status === "planned" ? "Planeado" : "Revertido"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                        {entry.expected_impact || "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{entry.profile_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(entry.created_at), "dd MMM, HH:mm", { locale: es })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
