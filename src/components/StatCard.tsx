import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle?: string;
  tooltip?: string;
  status?: "success" | "warning" | "destructive" | "primary" | "neutral";
  hero?: boolean;
  className?: string;
  onClick?: () => void;
}

const statusBorderMap: Record<string, string> = {
  success: "border-l-success",
  warning: "border-l-warning",
  destructive: "border-l-destructive",
  primary: "border-l-primary",
  neutral: "border-l-border",
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  subtitle,
  tooltip,
  status = "neutral",
  hero = false,
  className,
  onClick,
}: StatCardProps) => {
  return (
    <Card
      className={cn(
        "shadow-sm border-l-4 transition-colors",
        statusBorderMap[status],
        onClick && "cursor-pointer hover:bg-muted/50",
        className
      )}
      onClick={onClick}
    >
      <CardContent className={cn("flex items-center gap-3", hero ? "p-5" : "p-4")}>
        <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">
              {label}
            </p>
            {tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className={cn("font-bold tracking-tight leading-tight", hero ? "text-3xl" : "text-xl")}>
            {value}
          </p>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;
