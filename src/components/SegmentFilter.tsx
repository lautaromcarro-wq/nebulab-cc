import { format, subDays, startOfMonth } from "date-fns";
import { useEffect } from "react";
import { es } from "date-fns/locale";
import { CalendarIcon, Users } from "lucide-react";
import { useWorkspace, type PlatformFilter } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
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

const DATE_PRESETS = [
  { label: "Hoy", fn: () => { const d = new Date(); return { from: d, to: d }; } },
  { label: "7D", fn: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "14D", fn: () => ({ from: subDays(new Date(), 13), to: new Date() }) },
  { label: "30D", fn: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "MTD", fn: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
];

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

  const { clients, selectedClient, setSelectedClient } = useClient();

  // Reset segment when client changes
  useEffect(() => {
    setSelectedSegmentId(null);
  }, [selectedClient?.id]);

  // Only show segments belonging to the selected client
  const visibleSegments = selectedClient
    ? segments.filter((s) => s.client_id === selectedClient.id)
    : segments;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Client selector */}
      <Select
        value={selectedClient?.id ?? "all"}
        onValueChange={(v) => {
          if (v === "all") setSelectedClient(null);
          else {
            const c = clients.find((cl) => cl.id === v) ?? null;
            setSelectedClient(c);
          }
        }}
      >
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <div className="flex items-center gap-1.5 truncate">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <SelectValue placeholder="Cliente" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los Clientes</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Segment selector */}
      <Select
        value={selectedSegmentId ?? "all"}
        onValueChange={(v) => setSelectedSegmentId(v === "all" ? null : v)}
      >
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Segment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            {selectedClient ? "Todas las marcas" : "Todos los Segments"}
          </SelectItem>
          {visibleSegments.map((s) => (
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
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="meta">Meta</SelectItem>
          <SelectItem value="google_ads">Google Ads</SelectItem>
          <SelectItem value="ga4">GA4</SelectItem>
        </SelectContent>
      </Select>

      {/* Date presets */}
      <div className="flex items-center gap-1">
        {DATE_PRESETS.map((p) => {
          const range = p.fn();
          const isActive =
            format(dateRange.from, "yyyy-MM-dd") === format(range.from, "yyyy-MM-dd") &&
            format(dateRange.to, "yyyy-MM-dd") === format(range.to, "yyyy-MM-dd");
          return (
            <Button
              key={p.label}
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-7 px-2 text-[11px] font-medium", isActive ? "bg-white/20 text-white" : "text-white/70 hover:text-white hover:bg-white/10")}
              onClick={() => setDateRange(range)}
            >
              {p.label}
            </Button>
          );
        })}
      </div>

      {/* Custom date range picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20">
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
