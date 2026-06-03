// src/components/ClientTasksTab.tsx
// Recurring tasks checklist per client — integrated with bitácora.

import { useState } from "react";
import { useRecurringTasks, type CategoryGroup, type TaskInstance } from "@/hooks/useRecurringTasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, Circle, SkipForward, MessageSquare,
  ChevronDown, ChevronUp, Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const CATEGORY_COLORS: Record<string, string> = {
  meta_ads: "border-l-blue-500",
  google_ads: "border-l-green-500",
  analytics: "border-l-yellow-500",
  general: "border-l-gray-500",
};

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
};

function TaskRow({
  task,
  onComplete,
  onSkip,
  onReopen,
}: {
  task: TaskInstance;
  onComplete: (taskId: string, note?: string) => void;
  onSkip: (taskId: string) => void;
  onReopen: (taskId: string) => void;
}) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const isDone = task.status === "done";
  const isSkipped = task.status === "skipped";

  const handleComplete = () => {
    if (showNote && note.trim()) {
      onComplete(task.id, note.trim());
      setShowNote(false);
      setNote("");
    } else if (!showNote) {
      setShowNote(true);
    } else {
      // Complete without note
      onComplete(task.id);
      setShowNote(false);
      setNote("");
    }
  };

  return (
    <div className={cn(
      "group px-3 py-2.5 rounded-lg transition-colors",
      isDone ? "bg-success/5" : isSkipped ? "bg-muted/30" : "hover:bg-muted/30"
    )}>
      <div className="flex items-center gap-3">
        {/* Check button */}
        <button
          onClick={() => isDone || isSkipped ? onReopen(task.id) : handleComplete()}
          className="shrink-0"
        >
          {isDone ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : isSkipped ? (
            <SkipForward className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground" />
          )}
        </button>

        {/* Title + metadata */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium",
            isDone && "line-through text-muted-foreground",
            isSkipped && "line-through text-muted-foreground/50",
          )}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-0 bg-muted/50">
              {FREQUENCY_LABELS[task.frequency] ?? task.frequency}
            </Badge>
            {task.note && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                <MessageSquare className="h-2.5 w-2.5 inline mr-0.5" />
                {task.note}
              </span>
            )}
            {isDone && task.completed_by && (
              <span className="text-[10px] text-muted-foreground">
                {task.completed_by}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isDone && !isSkipped && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowNote(!showNote)}
            >
              <MessageSquare className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => onSkip(task.id)}
            >
              <SkipForward className="h-3 w-3" />
            </Button>
          </div>
        )}
        {(isDone || isSkipped) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100"
            onClick={() => onReopen(task.id)}
          >
            <Undo2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Note input */}
      {showNote && !isDone && !isSkipped && (
        <div className="mt-2 ml-8 space-y-2">
          <Textarea
            placeholder="¿Qué hiciste? Ej: Negativicé 12 términos, bajé CPC 8%..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="text-sm"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleComplete}>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {note.trim() ? "Completar con nota" : "Completar sin nota"}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowNote(false); setNote(""); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryCard({ group, onComplete, onSkip, onReopen }: {
  group: CategoryGroup;
  onComplete: (taskId: string, note?: string) => void;
  onSkip: (taskId: string) => void;
  onReopen: (taskId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(group.done === group.total && group.total > 0);
  const allDone = group.done === group.total && group.total > 0;
  const pct = group.total > 0 ? (group.done / group.total) * 100 : 0;

  return (
    <Card className={cn("border-l-4", CATEGORY_COLORS[group.category] ?? "border-l-gray-500")}>
      <CardHeader
        className="pb-2 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wide">
              {group.label}
            </CardTitle>
            <Badge
              variant={allDone ? "default" : "secondary"}
              className={cn(
                "text-[10px] px-1.5 py-0",
                allDone && "bg-success text-success-foreground"
              )}
            >
              {group.done}/{group.total}
            </Badge>
          </div>
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </div>
        <Progress value={pct} className="h-1 mt-2" />
      </CardHeader>
      {!collapsed && (
        <CardContent className="pt-0 space-y-0.5">
          {group.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onComplete={onComplete}
              onSkip={onSkip}
              onReopen={onReopen}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export default function ClientTasksTab({ clientId }: { clientId: string }) {
  const {
    categories, totalDone, totalTasks, weekPeriod,
    isLoading, completeTask, skipTask, reopenTask,
  } = useRecurringTasks(clientId);

  const handleComplete = (taskId: string, note?: string) => {
    completeTask.mutate(
      { taskId, note, analystName: "Jazmin Leiva" },
      { onSuccess: () => toast.success("Tarea completada" + (note ? " + nota en bitácora" : "")) }
    );
  };

  const handleSkip = (taskId: string) => {
    skipTask.mutate(taskId, { onSuccess: () => toast.info("Tarea omitida") });
  };

  const handleReopen = (taskId: string) => {
    reopenTask.mutate(taskId, { onSuccess: () => toast.info("Tarea reabierta") });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No hay tareas configuradas para este cliente.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Configurá los templates en la sección de administración.</p>
        </CardContent>
      </Card>
    );
  }

  const pct = totalTasks > 0 ? (totalDone / totalTasks) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide">Tareas Recurrentes</h3>
          {weekPeriod && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Semana {format(new Date(weekPeriod.start + "T00:00:00"), "d MMM", { locale: es })} — {format(new Date(weekPeriod.end + "T00:00:00"), "d MMM yyyy", { locale: es })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-bold">{totalDone}/{totalTasks}</p>
            <p className="text-[10px] text-muted-foreground">completadas</p>
          </div>
          <div className="w-24">
            <Progress value={pct} className="h-2" />
            <p className="text-[10px] text-muted-foreground text-center mt-0.5">{pct.toFixed(0)}%</p>
          </div>
        </div>
      </div>

      {/* Category cards */}
      {categories.map((group) => (
        <CategoryCard
          key={group.category}
          group={group}
          onComplete={handleComplete}
          onSkip={handleSkip}
          onReopen={handleReopen}
        />
      ))}
    </div>
  );
}
