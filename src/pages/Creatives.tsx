import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";
import { fmt, fmtCurrency, fmtCompact, fmtPercent } from "@/components/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, Image, Video, LayoutGrid, FileText, DollarSign, TrendingUp, MousePointerClick, ShoppingCart, Tag, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import StatCard from "@/components/StatCard";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

type SortKey = "spend" | "impressions" | "clicks" | "ctr" | "purchases" | "revenue" | "cpa" | "roas";

const creativeTypeIcon: Record<string, React.ElementType> = {
  video: Video,
  image: Image,
  carousel: LayoutGrid,
  text: FileText,
  other: FileText,
};

const creativeTypeLabel: Record<string, string> = {
  video: "Video",
  image: "Imagen",
  carousel: "Carousel",
  text: "Texto",
  other: "Otro",
};

const providerBadge: Record<string, { label: string; className: string }> = {
  meta: { label: "Meta", className: "bg-info/10 text-info border-info/20" },
  google_ads: { label: "Google", className: "bg-success/10 text-success border-success/20" },
};

interface CreativeRow {
  id: string;
  creative_type: string;
  canonical_url: string | null;
  headline: string | null;
  primary_text: string | null;
  cta: string | null;
  provider: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  purchases: number;
  revenue: number;
  cpa: number;
  roas: number;
  tags: string[];
}

function useCreativePerformance() {
  const { currentWorkspace, dateRange } = useWorkspace();
  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["creative-performance", currentWorkspace?.id, fromStr, toStr],
    queryFn: async (): Promise<CreativeRow[]> => {
      if (!currentWorkspace) return [];

      const [perfResult, tagsResult] = await Promise.all([
        supabase
          .from("creative_performance_daily")
          .select(`
            creative_id,
            provider,
            spend,
            impressions,
            clicks,
            purchases,
            revenue,
            creatives!inner (
              id,
              creative_type,
              canonical_url,
              headline,
              primary_text,
              cta
            )
          `)
          .eq("workspace_id", currentWorkspace.id)
          .gte("date", fromStr)
          .lte("date", toStr),
        supabase
          .from("creative_tag_links")
          .select(`
            creative_id,
            creative_tags ( name )
          `)
          .eq("workspace_id", currentWorkspace.id),
      ]);

      if (perfResult.error) throw perfResult.error;

      // Build tag map
      const tagMap = new Map<string, string[]>();
      for (const link of tagsResult.data ?? []) {
        const arr = tagMap.get(link.creative_id) ?? [];
        const tagName = (link.creative_tags as any)?.name;
        if (tagName) arr.push(tagName);
        tagMap.set(link.creative_id, arr);
      }

      // Aggregate by creative_id + provider
      const agg = new Map<string, CreativeRow>();
      for (const row of perfResult.data ?? []) {
        const key = `${row.creative_id}__${row.provider}`;
        const creative = row.creatives as any;
        const existing = agg.get(key);
        if (existing) {
          existing.spend += Number(row.spend) || 0;
          existing.impressions += Number(row.impressions) || 0;
          existing.clicks += Number(row.clicks) || 0;
          existing.purchases += Number(row.purchases) || 0;
          existing.revenue += Number(row.revenue) || 0;
        } else {
          agg.set(key, {
            id: row.creative_id,
            creative_type: creative?.creative_type ?? "other",
            canonical_url: creative?.canonical_url ?? null,
            headline: creative?.headline ?? null,
            primary_text: creative?.primary_text ?? null,
            cta: creative?.cta ?? null,
            provider: row.provider,
            spend: Number(row.spend) || 0,
            impressions: Number(row.impressions) || 0,
            clicks: Number(row.clicks) || 0,
            purchases: Number(row.purchases) || 0,
            revenue: Number(row.revenue) || 0,
            ctr: 0,
            cpa: 0,
            roas: 0,
            tags: tagMap.get(row.creative_id) ?? [],
          });
        }
      }

      return Array.from(agg.values()).map((c) => ({
        ...c,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpa: c.purchases > 0 ? c.spend / c.purchases : 0,
        roas: c.spend > 0 ? c.revenue / c.spend : 0,
        tags: tagMap.get(c.id) ?? c.tags,
      }));
    },
    enabled: !!currentWorkspace,
  });
}

function ManageTagsDialog({ creativeId, currentTags, workspaceId, onSuccess }: {
  creativeId: string;
  currentTags: string[];
  workspaceId: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[]>(currentTags);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  const addTag = async () => {
    const name = newTag.trim().toLowerCase();
    if (!name || tags.includes(name)) { setNewTag(""); return; }
    setSaving(true);
    // Upsert tag
    const { data: tagRow, error: tagErr } = await supabase
      .from("creative_tags")
      .upsert({ workspace_id: workspaceId, name }, { onConflict: "workspace_id,name" })
      .select("id")
      .single();
    if (tagErr || !tagRow) { toast.error("Error al crear tag"); setSaving(false); return; }
    // Link
    const { error: linkErr } = await supabase
      .from("creative_tag_links")
      .upsert({ creative_id: creativeId, tag_id: tagRow.id, workspace_id: workspaceId }, { onConflict: "creative_id,tag_id" });
    if (linkErr) { toast.error("Error al vincular tag"); setSaving(false); return; }
    setTags((prev) => [...prev, name]);
    setNewTag("");
    setSaving(false);
    onSuccess();
  };

  const removeTag = async (tagName: string) => {
    setSaving(true);
    // Find tag id
    const { data: tagRow } = await supabase
      .from("creative_tags")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("name", tagName)
      .maybeSingle();
    if (tagRow) {
      await supabase.from("creative_tag_links").delete()
        .eq("creative_id", creativeId).eq("tag_id", tagRow.id);
    }
    setTags((prev) => prev.filter((t) => t !== tagName));
    setSaving(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setTags(currentTags); }}>
      <DialogTrigger asChild>
        <button className="p-1 rounded hover:bg-muted transition-colors" title="Gestionar tags">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Tags del Creativo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5 min-h-[32px]">
            {tags.length === 0 && <span className="text-xs text-muted-foreground">Sin tags</span>}
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs gap-1 pr-1">
                {tag}
                <button onClick={() => removeTag(tag)} disabled={saving} className="ml-0.5 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nuevo tag…"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              className="h-8 text-xs"
            />
            <Button size="sm" className="h-8" onClick={addTag} disabled={saving || !newTag.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Creatives = () => {
  const { currentWorkspace } = useWorkspace();
  const { data, isLoading } = useCreativePerformance();
  const qc = useQueryClient();
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["creative-performance"] });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <SectionHeader badge="Creativos" title="Creative Performance" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="space-y-8 animate-fade-in">
        <SectionHeader badge="Creativos" title="Creative Performance" />
        <EmptyState
          title="Sin datos de creativos"
          description="Los creativos aparecerán luego del primer sync con Meta o Google Ads."
        />
      </div>
    );
  }

  const filtered = data.filter((c) => {
    if (typeFilter !== "all" && c.creative_type !== typeFilter) return false;
    if (providerFilter !== "all" && c.provider !== providerFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortAsc ? diff : -diff;
  });

  const totals = {
    spend: filtered.reduce((s, c) => s + c.spend, 0),
    impressions: filtered.reduce((s, c) => s + c.impressions, 0),
    purchases: filtered.reduce((s, c) => s + c.purchases, 0),
    roas: 0,
    cpa: 0,
  };
  const totalRevenue = filtered.reduce((s, c) => s + c.revenue, 0);
  totals.roas = totals.spend > 0 ? totalRevenue / totals.spend : 0;
  totals.cpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0;

  const SortableHead = ({ label, colKey }: { label: string; colKey: SortKey }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => handleSort(colKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === colKey && <ArrowUpDown className="h-3 w-3 text-primary" />}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <SectionHeader
        badge="Creativos"
        title="Creative Performance"
        subtitle={`${filtered.length} creativo(s)`}
        action={
          <div className="flex gap-2">
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Plataforma</SelectItem>
                <SelectItem value="meta">Meta</SelectItem>
                <SelectItem value="google_ads">Google</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tipo</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="image">Imagen</SelectItem>
                <SelectItem value="carousel">Carousel</SelectItem>
                <SelectItem value="text">Texto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Spend" value={fmtCurrency(totals.spend)} status="primary" hero />
        <StatCard icon={ShoppingCart} label="Purchases" value={fmt(totals.purchases)} status="success" hero />
        <StatCard icon={TrendingUp} label="ROAS" value={`${fmt(totals.roas, 2)}x`} status={totals.roas >= 1 ? "success" : "warning"} hero />
        <StatCard icon={DollarSign} label="CPA" value={totals.cpa > 0 ? fmtCurrency(totals.cpa) : "–"} status="neutral" hero />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wide">Ranking de Creativos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creativo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Tags</TableHead>
                <SortableHead label="Spend" colKey="spend" />
                <SortableHead label="Impr." colKey="impressions" />
                <SortableHead label="Clicks" colKey="clicks" />
                <SortableHead label="CTR" colKey="ctr" />
                <SortableHead label="Purch." colKey="purchases" />
                <SortableHead label="CPA" colKey="cpa" />
                <SortableHead label="ROAS" colKey="roas" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c, i) => {
                const TypeIcon = creativeTypeIcon[c.creative_type] ?? FileText;
                const badge = providerBadge[c.provider] ?? { label: c.provider, className: "bg-muted text-muted-foreground" };
                const label = c.headline ?? c.primary_text ?? c.canonical_url ?? `Creativo #${i + 1}`;
                return (
                  <TableRow key={`${c.id}-${c.provider}`}>
                    <TableCell className="max-w-[220px]">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs font-medium truncate" title={label}>{label}</span>
                      </div>
                      {c.cta && <span className="text-[10px] text-muted-foreground">{c.cta}</span>}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{creativeTypeLabel[c.creative_type] ?? c.creative_type}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] border-0", badge.className)}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {c.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                        {currentWorkspace && (
                          <ManageTagsDialog
                            creativeId={c.id}
                            currentTags={c.tags}
                            workspaceId={currentWorkspace.id}
                            onSuccess={invalidate}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium tabular-nums">{fmtCurrency(c.spend)}</TableCell>
                    <TableCell className="text-xs tabular-nums">{fmtCompact(c.impressions)}</TableCell>
                    <TableCell className="text-xs tabular-nums">{fmtCompact(c.clicks)}</TableCell>
                    <TableCell className="text-xs tabular-nums">{fmtPercent(c.ctr)}</TableCell>
                    <TableCell className="text-xs tabular-nums">{fmt(c.purchases)}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {c.purchases > 0 ? fmtCurrency(c.cpa) : "–"}
                    </TableCell>
                    <TableCell className={cn(
                      "text-xs font-medium tabular-nums",
                      c.roas >= 1 ? "text-success" : c.roas > 0 ? "text-warning" : "text-muted-foreground"
                    )}>
                      {c.spend > 0 ? `${fmt(c.roas, 2)}x` : "–"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Creatives;
