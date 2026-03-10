import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import SectionHeader from "@/components/SectionHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Clock,
  User,
  Building2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TaskStatus = "pending" | "wip" | "finished";

interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: TaskStatus;
  priority: string;
  due_date: string | null;
  client_id: string | null;
  workspace_id: string;
  created_at: string;
}

const COLUMNS: { key: TaskStatus; label: string; color: string; headerClass: string }[] = [
  { key: "pending",  label: "Pendiente", color: "text-muted-foreground", headerClass: "border-t-muted-foreground/40" },
  { key: "wip",      label: "En Progreso", color: "text-warning",        headerClass: "border-t-warning" },
  { key: "finished", label: "Terminado",  color: "text-success",         headerClass: "border-t-success" },
];

const PRIORITY_COLOR: Record<string, string> = {
  alta:  "bg-destructive/10 text-destructive border-destructive/30",
  media: "bg-warning/10 text-warning border-warning/30",
  baja:  "bg-muted text-muted-foreground",
};

function TaskCard({
  task,
  clientName,
  onMove,
  onDelete,
  isAdmin,
  onDragStart,
}: {
  task: Task;
  clientName: string;
  onMove: (id: string, dir: "prev" | "next") => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
  onDragStart: (id: string) => void;
}) {
  const isOverdue =
    task.due_date && new Date(task.due_date) < new Date() && task.status !== "finished";

  const colIdx = COLUMNS.findIndex((c) => c.key === task.status);
  const hasPrev = colIdx > 0;
  const hasNext = colIdx < COLUMNS.length - 1;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      className="group bg-card border rounded-lg p-3 space-y-2.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      {/* Title row */}
      <div className="flex items-start gap-2">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 mt-0.5 shrink-0 group-hover:text-muted-foreground/60 transition-colors" />
        <p className={cn("text-xs font-semibold leading-snug flex-1", task.status === "finished" && "line-through text-muted-foreground")}>
          {task.title}
        </p>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 pl-5">{task.description}</p>
      )}

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap pl-5">
        <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", PRIORITY_COLOR[task.priority])}>
          {task.priority}
        </Badge>
        {clientName && (
          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 gap-0.5">
            <Building2 className="h-2.5 w-2.5" />{clientName}
          </Badge>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between pl-5">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {task.assigned_to && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />{task.assigned_to}
            </span>
          )}
          {task.due_date && (
            <span className={cn("flex items-center gap-1", isOverdue && "text-destructive font-medium")}>
              <Clock className="h-3 w-3" />
              {format(new Date(task.due_date), "dd MMM", { locale: es })}
              {isOverdue && " ⚠️"}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {isAdmin && hasPrev && (
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onMove(task.id, "prev")}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
          )}
          {isAdmin && hasNext && (
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onMove(task.id, "next")}>
              <ChevronRight className="h-3 w-3" />
            </Button>
          )}
          {isAdmin && (
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onDelete(task.id)}>
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewTaskDialog({ workspaceId, clients, onCreated }: { workspaceId: string; clients: any[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", assigned_to: "", priority: "media",
    client_id: "none", due_date: "", status: "pending" as TaskStatus,
  });
  const [saving, setSaving] = useState(false);
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("El título es requerido"); return; }
    setSaving(true);
    const { error } = await supabase.from("tasks" as any).insert({
      workspace_id: workspaceId,
      title: form.title.trim(),
      description: form.description || null,
      assigned_to: form.assigned_to || null,
      priority: form.priority,
      client_id: form.client_id === "none" ? null : form.client_id,
      due_date: form.due_date || null,
      status: form.status,
    } as any);
    setSaving(false);
    if (error) { toast.error("Error al crear tarea"); return; }
    toast.success("Tarea creada");
    setOpen(false);
    setForm({ title: "", description: "", assigned_to: "", priority: "media", client_id: "none", due_date: "", status: "pending" });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" />Nueva Tarea
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nueva Tarea</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Título <span className="text-destructive">*</span></Label>
            <Input className="mt-1" value={form.title} onChange={(e) => setF("title", e.target.value)} placeholder="Qué hay que hacer…" onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }} />
          </div>
          <div>
            <Label className="text-xs">Descripción</Label>
            <Textarea className="mt-1" rows={2} value={form.description} onChange={(e) => setF("description", e.target.value)} placeholder="Detalles opcionales…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Cliente</Label>
              <Select value={form.client_id} onValueChange={(v) => setF("client_id", v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Sin cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cliente</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Asignado a</Label>
              <Input className="mt-1 h-8 text-xs" value={form.assigned_to} onChange={(e) => setF("assigned_to", e.target.value)} placeholder="Nombre…" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Prioridad</Label>
              <Select value={form.priority} onValueChange={(v) => setF("priority", v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Estado inicial</Label>
              <Select value={form.status} onValueChange={(v) => setF("status", v as TaskStatus)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="wip">En Progreso</SelectItem>
                  <SelectItem value="finished">Terminado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fecha límite</Label>
              <Input type="date" className="mt-1 h-8 text-xs" value={form.due_date} onChange={(e) => setF("due_date", e.target.value)} />
            </div>
          </div>
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? "Creando…" : "Crear Tarea"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Tasks() {
  const { currentWorkspace, workspaceRole } = useWorkspace();
  const { clients } = useClient();
  const queryClient = useQueryClient();
  const isAdmin = workspaceRole === "admin" || workspaceRole === "member";
  const wsId = currentWorkspace?.id ?? "";
  const [filterClient, setFilterClient] = useState("all");
  const dragTaskId = useRef<string | null>(null);

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks" as any)
        .select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as Task[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tasks", wsId] });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const { error } = await supabase.from("tasks" as any).update({ status, updated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Error al mover tarea"),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Tarea eliminada"); },
    onError: () => toast.error("Error al eliminar tarea"),
  });

  const handleMove = (id: string, dir: "prev" | "next") => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const colIdx = COLUMNS.findIndex((c) => c.key === task.status);
    const newIdx = dir === "prev" ? colIdx - 1 : colIdx + 1;
    if (newIdx < 0 || newIdx >= COLUMNS.length) return;
    updateStatus.mutate({ id, status: COLUMNS[newIdx].key });
  };

  const handleDrop = (targetStatus: TaskStatus) => {
    if (!dragTaskId.current) return;
    const task = tasks.find((t) => t.id === dragTaskId.current);
    if (task && task.status !== targetStatus) {
      updateStatus.mutate({ id: dragTaskId.current, status: targetStatus });
    }
    dragTaskId.current = null;
  };

  const clientName = (clientId: string | null) =>
    clientId ? (clients.find((c) => c.id === clientId)?.name ?? "") : "";

  const filtered = filterClient === "all" ? tasks : tasks.filter((t) => t.client_id === filterClient);

  const overdue = tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "finished").length;

  if (!currentWorkspace) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        badge="Tasks"
        title="Tablero de Tareas"
        subtitle={`${tasks.length} tarea(s) · ${tasks.filter((t) => t.status === "wip").length} en progreso`}
        action={
          <div className="flex items-center gap-2">
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <NewTaskDialog workspaceId={wsId} clients={clients} onCreated={invalidate} />
          </div>
        }
      />

      {/* Overdue alert */}
      {overdue > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive font-medium">
            {overdue} tarea(s) vencida(s) sin completar
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {COLUMNS.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.key);
            return (
              <div
                key={col.key}
                className="flex flex-col gap-2 min-h-[200px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.key)}
              >
                {/* Column header */}
                <div className={cn("rounded-t-md border-t-2 bg-muted/30 px-3 py-2.5 flex items-center justify-between", col.headerClass)}>
                  <span className={cn("text-xs font-bold", col.color)}>{col.label}</span>
                  <Badge variant="secondary" className="text-[10px] h-5 min-w-[20px] justify-center">
                    {colTasks.length}
                  </Badge>
                </div>

                {/* Drop zone */}
                <div className="flex flex-col gap-2 flex-1 min-h-[120px] rounded-b-md bg-muted/10 p-2">
                  {colTasks.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-[11px] text-muted-foreground/50 italic py-6">
                      Sin tareas
                    </div>
                  )}
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      clientName={clientName(task.client_id)}
                      onMove={handleMove}
                      onDelete={(id) => deleteTask.mutate(id)}
                      isAdmin={isAdmin}
                      onDragStart={(id) => { dragTaskId.current = id; }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
