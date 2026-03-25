import { useState } from "react";
import { Bell } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useWorkspaceHealth } from "@/hooks/useWorkspaceHealth";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const statusConfig = {
  healthy:   { label: "Saludable",  className: "bg-success/10 text-success border-success/20",   dot: "bg-success" },
  attention: { label: "Atención",   className: "bg-warning/10 text-warning border-warning/20",   dot: "bg-warning" },
  critical:  { label: "Crítico",    className: "bg-destructive/10 text-destructive border-destructive/20", dot: "bg-destructive" },
};

export function GlobalHealthBell() {
  const [open, setOpen] = useState(false);
  const { data: health } = useWorkspaceHealth();

  const hasPenalties = (health?.penalties?.length ?? 0) > 0;
  const status = health?.status ?? "healthy";
  const dotClass = statusConfig[status]?.dot ?? "bg-success";
  const showDot = status !== "healthy" || hasPenalties;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
        >
          <Bell className="h-4 w-4" />
          {showDot && (
            <span className={cn("absolute top-1 right-1 h-2 w-2 rounded-full border border-background", dotClass)} />
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-sm font-bold uppercase tracking-wide flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Salud del Workspace
          </SheetTitle>
        </SheetHeader>

        {!health ? (
          <p className="text-xs text-muted-foreground text-center py-8">Sin datos de salud disponibles.</p>
        ) : (
          <div className="space-y-5">
            {/* Score */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Score</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{health.score}</span>
                  <Badge variant="outline" className={cn("text-[10px] border", statusConfig[health.status]?.className)}>
                    {statusConfig[health.status]?.label}
                  </Badge>
                </div>
              </div>
              <Progress value={health.score} className="h-2" />
              {health.computed_at && (
                <p className="text-[10px] text-muted-foreground text-right">
                  Actualizado {formatDistanceToNow(new Date(health.computed_at), { locale: es, addSuffix: true })}
                </p>
              )}
            </div>

            {/* Penalties */}
            {health.penalties.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Issues detectados ({health.penalties.length})
                </p>
                <div className="space-y-2">
                  {health.penalties.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
                      <span className="text-destructive font-bold text-xs tabular-nums shrink-0">-{p.points}pts</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{p.rule}</p>
                        {p.detail && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{p.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 space-y-1">
                <p className="text-2xl">✅</p>
                <p className="text-xs font-medium">Todo en orden</p>
                <p className="text-[10px] text-muted-foreground">No hay issues pendientes.</p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
