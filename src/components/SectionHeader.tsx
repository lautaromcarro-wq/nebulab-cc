import { Badge } from "@/components/ui/badge";

interface SectionHeaderProps {
  badge?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const SectionHeader = ({ badge, title, subtitle, action }: SectionHeaderProps) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      {badge && (
        <Badge variant="secondary" className="bg-primary/10 text-primary border-0 px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
          {badge}
        </Badge>
      )}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action && <div>{action}</div>}
  </div>
);

export default SectionHeader;
