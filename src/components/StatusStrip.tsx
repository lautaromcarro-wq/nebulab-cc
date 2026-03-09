import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { WorkspaceHealth } from "@/hooks/useWorkspaceHealth";

interface StatusStripProps {
  health: WorkspaceHealth;
}

const StatusStrip = ({ health }: StatusStripProps) => {
  const navigate = useNavigate();
  const isCritical = health.status === "critical";
  const isHealthy = health.status === "healthy";
  const topPenalties = health.penalties.slice(0, 2);
  const remaining = health.penalties.length - 2;

  if (isHealthy) {
    return (
      <div className="rounded-lg border border-success/20 bg-success/5 px-4 py-2.5 flex items-center gap-3 animate-fade-in">
        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
        <span className="text-xs font-medium text-success">
          Todos los sistemas operativos — Score {health.score}/100
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-2.5 flex items-center gap-3 animate-fade-in",
        isCritical
          ? "border-destructive/30 bg-destructive/5"
          : "border-warning/30 bg-warning/5"
      )}
    >
      <AlertTriangle
        className={cn(
          "h-4 w-4 shrink-0",
          isCritical ? "text-destructive" : "text-warning"
        )}
      />
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-bold uppercase tracking-wide border-0",
            isCritical
              ? "bg-destructive/10 text-destructive"
              : "bg-warning/10 text-warning"
          )}
        >
          {isCritical ? "Crítico" : "Atención"} · {health.score}/100
        </Badge>
        <span className="text-xs text-muted-foreground truncate">
          {topPenalties.map((p) => p.detail).join(" · ")}
        </span>
        {remaining > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="text-[10px] cursor-help">
                +{remaining}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs space-y-1">
              {health.penalties.slice(2).map((p, i) => (
                <p key={i}>{p.detail}</p>
              ))}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 shrink-0"
        onClick={() => navigate("/admin/ops")}
      >
        Ver causas <ChevronRight className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default StatusStrip;
