import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useWorkspace, type PlatformFilter } from "@/contexts/WorkspaceContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SegmentFilter = () => {
  const {
    segments,
    selectedSegmentId,
    setSelectedSegmentId,
    platformFilter,
    setPlatformFilter,
    dateRange,
    setDateRange,
  } = useWorkspace();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Segment selector */}
      <Select
        value={selectedSegmentId ?? "all"}
        onValueChange={(v) => setSelectedSegmentId(v === "all" ? null : v)}
      >
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Segment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los Segments</SelectItem>
          {segments.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Platform selector */}
      <Select
        value={platformFilter}
        onValueChange={(v) => setPlatformFilter(v as PlatformFilter)}
      >
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="meta">Meta</SelectItem>
          <SelectItem value="google_ads">Google Ads</SelectItem>
          <SelectItem value="ga4">GA4</SelectItem>
        </SelectContent>
      </Select>

      {/* Date range */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" />
            {format(dateRange.from, "dd MMM", { locale: es })} –{" "}
            {format(dateRange.to, "dd MMM", { locale: es })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={{ from: dateRange.from, to: dateRange.to }}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                setDateRange({ from: range.from, to: range.to });
              } else if (range?.from) {
                setDateRange({ from: range.from, to: range.from });
              }
            }}
            numberOfMonths={2}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default SegmentFilter;
