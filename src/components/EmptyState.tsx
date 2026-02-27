import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState = ({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) => (
  <div className={cn("rounded-lg border border-dashed bg-muted/30 p-12 text-center animate-fade-in", className)}>
    <Icon className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
    <p className="text-sm font-semibold text-foreground">{title}</p>
    {description && <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
