import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, XCircle, HelpCircle, TrendingUp, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

type ExperimentStatus = "planned" | "running" | "done" | "killed";
type ExperimentDecision = "scale" | "iterate" | "stop" | "unknown" | null;

interface Experiment {
  id: string;
  hypothesis: string;
  metric_primary: string;
  status: ExperimentStatus;
  decision: ExperimentDecision;
  result_summary: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  owner_id: string;
  linked_changelog_id: string | null;
  changelog_title?: string | null;
}

interface ChangelogOption {
  id: string;
  title: string;
  change_type: string;
  created_at: string;
}

const statusConfig: Record<ExperimentStatus, { label: string; className: string; col: string }> = {
  planned: { label: "Planeado", className: "bg-muted text-muted-foreground border-0", col: "Planeados" },
  running: { label: "En curso", className: "bg-info/10 text-info border-info/20", col: "En Curso" },
  done: { label: "Terminado", className: "bg-success/10 text-success border-success/20", col: "Terminados" },
  killed: { label: "Cancelado", className: "bg-destructive/10 text-destructive border-destructive/20", col: "Cancelados" },
};

const decisionConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  scale: { label: "Escalar", icon: TrendingUp, className: "text-success" },
  iterate: { label: "Iterar", icon: HelpCircle, className: "text-warning" },
  stop: { label: "Detener", icon: XCircle, className: "text-destructive" },
  unknown: { label: "Sin decisión", icon: HelpCircle, className: "text-muted-foreground" },
};

const COLUMNS: ExperimentStatus[] = ["planned", "running", "done", "killed"];

function useExperiments() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["experiments", currentWorkspace?.id],
    queryFn: async (): Promise<Experiment[]> => {
      if (!currentWorkspace) return [];
      const { data, error } = await supabase
        .from("experiments")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const items = (data ?? []) as Experiment[];

      // Fetch linked changelog titles
      const changelogIds = items.map((e) => e.linked_changelog_id).filter(Boolean) as string[];
      if (changelogIds.length > 0) {
        const { data: cl } = await supabase.from("changelog").select("id, title").in("id", changelogIds);
        const clMap = new Map((cl ?? []).map((c) => [c.id, c.title]));
        return items.map((e) => ({ ...e, changelog_title: e.linked_changelog_id ? (clMap.get(e.linked_changelog_id) ?? null) : null }));
      }
      return items;
    },
    enabled: !!currentWorkspace,
  });
}

function useChangelogOptions() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["changelog-options", currentWorkspace?.id],
    queryFn: async (): Promise<ChangelogOption[]> => {
      if (!currentWorkspace) return [];
      const { data } = await supabase
        .from("changelog")
        .select("id, title, change_type, created_at")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as ChangelogOption[];
    },
    enabled: !!currentWorkspace,
  });
}

function NewExperimentDialog({ workspaceId, userId, onSuccess }: { workspaceId: string; userId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ hypothesis: "", metric_primary: "ROAS", start_date: "", end_date: "", linked_changelog_id: "none" });
  const [loading, setLoading] = useState(false);
  const { data: changelogOptions = [] } = useChangelogOptions();

  const handleSubmit = async () => {
    if (!form.hypothesis.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("experiments").insert({
      workspace_id: workspaceId,
      owner_id: userId,
      hypothesis: form.hypothesis.trim(),
      metric_primary: form.metric_primary || "ROAS",
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: "planned",
      linked_changelog_id: form.linked_changelog_id === "none" ? null : form.linked_changelog_id,
    });
    setLoading(false);
    if (error) { toast.error("Error al crear experimento"); return; }
    toast.success("Experimento creado");
    setOpen(false);
    setForm({ hypothesis: "", metric_primary: "ROAS", start_date: "", end_date: "", linked_changelog_id: "none" });
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs gap-1">
          <Plus className="h-3.5 w-3.5" /> Nuevo Experimento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nuevo Experimento</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label>Hipótesis <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Si hacemos X, esperamos que Y porque Z."
              value={form.hypothesis}
              onChange={(e) => setForm((p) => ({ ...p, hypothesis: e.target.value }))}
              rows={3}
            />
          </div>
          <div>
            <Label>Métrica Principal</Label>
            <Input placeholder="ROAS, CPA, CVR..." value={form.metric_primary} onChange={(e) => setForm((p) => ({ ...p, metric_primary: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Inicio</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <Label>Fin</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Vincular a Bitácora (opcional)</Label>
            <Select value={form.linked_changelog_id} onValueChange={(v) => setForm((p) => ({ ...p, linked_changelog_id: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin vincular</SelectItem>
                {changelogOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={loading || !form.hypothesis.trim()}>
            {loading ? "Creando…" : "Crear Experimento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditExperimentDialog({ exp, onSuccess }: { exp: Experiment; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    status: exp.status,
    decision: exp.decision ?? "unknown",
    result_summary: exp.result_summary ?? "",
    linked_changelog_id: exp.linked_changelog_id ?? "none",
  });
  const [loading, setLoading] = useState(false);
  const { data: changelogOptions = [] } = useChangelogOptions();

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase.from("experiments").update({
      status: form.status as ExperimentStatus,
      decision: form.decision === "unknown" ? null : form.decision as ExperimentDecision,
      result_summary: form.result_summary || null,
      linked_changelog_id: form.linked_changelog_id === "none" ? null : form.linked_changelog_id,
    }).eq("id", exp.id);
    setLoading(false);
    if (error) { toast.error("Error al actualizar"); return; }
    toast.success("Actualizado");
    setOpen(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Actualizar</button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Actualizar Experimento</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground line-clamp-2">{exp.hypothesis}</p>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as ExperimentStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planeado</SelectItem>
                  <SelectItem value="running">En curso</SelectItem>
                  <SelectItem value="done">Terminado</SelectItem>
                  <SelectItem value="killed">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Decisión</Label>
              <Select value={form.decision} onValueChange={(v) => setForm((p) => ({ ...p, decision: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Sin decisión</SelectItem>
                  <SelectItem value="scale">Escalar</SelectItem>
                  <SelectItem value="iterate">Iterar</SelectItem>
                  <SelectItem value="stop">Detener</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Resumen de Resultado</Label>
            <Textarea
              placeholder="¿Qué pasó? ¿Qué aprendimos?"
              value={form.result_summary}
              onChange={(e) => setForm((p) => ({ ...p, result_summary: e.target.value }))}
              rows={3}
            />
          </div>
          <div>
            <Label>Vincular a Bitácora</Label>
            <Select value={form.linked_changelog_id} onValueChange={(v) => setForm((p) => ({ ...p, linked_changelog_id: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin vincular</SelectItem>
                {changelogOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={handleSave} disabled={loading}>{loading ? "Guardando…" : "Guardar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExperimentCard({ exp, onSuccess }: { exp: Experiment; onSuccess: () => void }) {
  const status = statusConfig[exp.status];
  const decision = exp.decision ? decisionConfig[exp.decision] : null;
  const DecisionIcon = decision?.icon;

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 space-y-2">
        <p className="text-xs font-medium leading-snug">{exp.hypothesis}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={cn("text-[10px] font-medium", status.className)}>{status.label}</Badge>
          {exp.metric_primary && (
            <Badge variant="secondary" className="text-[10px]">{exp.metric_primary}</Badge>
          )}
          {decision && DecisionIcon && (
            <span className={cn("flex items-center gap-0.5 text-[10px] font-medium", decision.className)}>
              <DecisionIcon className="h-3 w-3" />{decision.label}
            </span>
          )}
        </div>
        {exp.changelog_title && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Link2 className="h-3 w-3 shrink-0" />
            <span className="truncate" title={exp.changelog_title}>{exp.changelog_title}</span>
          </div>
        )}
        {exp.result_summary && (
          <p className="text-[11px] text-muted-foreground line-clamp-2">{exp.result_summary}</p>
        )}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(exp.created_at), { locale: es, addSuffix: true })}
          </span>
          <EditExperimentDialog exp={exp} onSuccess={onSuccess} />
        </div>
      </CardContent>
    </Card>
  );
}

const Experiments = () => {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useExperiments();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["experiments"] });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <SectionHeader badge="Experimentos" title="Experiments Board" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const byStatus = COLUMNS.reduce((acc, col) => {
    acc[col] = (data ?? []).filter((e) => e.status === col);
    return acc;
  }, {} as Record<ExperimentStatus, Experiment[]>);

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        badge="Experimentos"
        title="Experiments Board"
        subtitle={`${(data ?? []).length} experimento(s)`}
        action={
          currentWorkspace && user && (
            <NewExperimentDialog workspaceId={currentWorkspace.id} userId={user.id} onSuccess={invalidate} />
          )
        }
      />

      {(!data || data.length === 0) ? (
        <EmptyState title="Sin experimentos aún" description="¿Qué querés probar esta semana? Creá tu primera hipótesis." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colConfig = statusConfig[col];
            return (
              <div key={col} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{colConfig.col}</h3>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5">{byStatus[col].length}</Badge>
                </div>
                <div className="space-y-2">
                  {byStatus[col].length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center">
                      <p className="text-[11px] text-muted-foreground/60">Vacío</p>
                    </div>
                  ) : (
                    byStatus[col].map((exp) => (
                      <ExperimentCard key={exp.id} exp={exp} onSuccess={invalidate} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Experiments;
