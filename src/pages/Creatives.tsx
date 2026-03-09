import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";
import { fmt, fmtCurrency, fmtCompact, fmtPercent } from "@/components/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as ReTooltip, Cell,
} from "recharts";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowUpDown, Image, Video, LayoutGrid, FileText,
  DollarSign, TrendingUp, ShoppingCart, Tag, X, Plus,
  Crown, AlertTriangle, Zap, BarChart3, Trophy, MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import StatCard from "@/components/StatCard";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ── Constants ──────────────────────────────────────────────────────────
type SortKey = "spend" | "impressions" | "clicks" | "ctr" | "purchases" | "revenue" | "cpa" | "roas";

const TYPE_ICON: Record<string, React.ElementType> = {
  video: Video, image: Image, carousel: LayoutGrid, text: FileText, other: FileText,
};
const TYPE_LABEL: Record<string, string> = {
  video: "Video", image: "Imagen", carousel: "Carousel", text: "Texto", other: "Otro",
};
const TYPE_COLOR: Record<string, string> = {
  video: "#6366F1", image: "#10B981", carousel: "#F59E0B", text: "#EC4899", other: "#9CA3AF",
};
const PROVIDER_BADGE: Record<string, { label: string; className: string }> = {
  meta: { label: "Meta", className: "bg-blue-50 text-blue-600 border-blue-100" },
  google_ads: { label: "Google", className: "bg-green-50 text-green-600 border-green-100" },
};

// ── Types ──────────────────────────────────────────────────────────────
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
  purchases: number;
  revenue: number;
  ctr: number;
  cpa: number;
  roas: number;
  tags: string[];
  // daily buckets for fatigue
  earlySpend: number;
  earlyRevenue: number;
  lateSpend: number;
  lateRevenue: number;
  daysActive: number;
}

// ── Data hook ──────────────────────────────────────────────────────────
function useCreativePerformance() {
  const { currentWorkspace, dateRange } = useWorkspace();
  const { selectedClient } = useClient();
  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");
  const periodDays = differenceInDays(dateRange.to, dateRange.from) + 1;
  const midpoint = format(subDays(dateRange.to, Math.floor(periodDays / 2)), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["creative-performance", currentWorkspace?.id, selectedClient?.id, fromStr, toStr],
    queryFn: async (): Promise<CreativeRow[]> => {
      if (!currentWorkspace) return [];

      const [perfResult, tagsResult] = await Promise.all([
        supabase
          .from("creative_performance_daily")
          .select(`
            creative_id, provider, spend, impressions, clicks, purchases, revenue, date,
            creatives!inner (id, creative_type, canonical_url, headline, primary_text, cta)
          `)
          .eq("workspace_id", currentWorkspace.id)
          .gte("date", fromStr)
          .lte("date", toStr)
          .then((r) => {
            if (selectedClient && !r.error) {
              // filter by client_id if available
              return { data: r.data, error: r.error };
            }
            return r;
          }),
        supabase
          .from("creative_tag_links")
          .select("creative_id, creative_tags ( name )")
          .eq("workspace_id", currentWorkspace.id),
      ]);

      if (perfResult.error) throw perfResult.error;

      const tagMap = new Map<string, string[]>();
      for (const link of tagsResult.data ?? []) {
        const arr = tagMap.get(link.creative_id) ?? [];
        const tagName = (link.creative_tags as any)?.name;
        if (tagName) arr.push(tagName);
        tagMap.set(link.creative_id, arr);
      }

      // Aggregate by creative_id + provider, track early/late halves for fatigue
      const agg = new Map<string, CreativeRow>();
      for (const row of perfResult.data ?? []) {
        const key = `${row.creative_id}__${row.provider}`;
        const creative = row.creatives as any;
        const isLate = row.date >= midpoint;
        const ex = agg.get(key);
        if (ex) {
          ex.spend += Number(row.spend) || 0;
          ex.impressions += Number(row.impressions) || 0;
          ex.clicks += Number(row.clicks) || 0;
          ex.purchases += Number(row.purchases) || 0;
          ex.revenue += Number(row.revenue) || 0;
          if (isLate) { ex.lateSpend += Number(row.spend) || 0; ex.lateRevenue += Number(row.revenue) || 0; }
          else { ex.earlySpend += Number(row.spend) || 0; ex.earlyRevenue += Number(row.revenue) || 0; }
          ex.daysActive += 1;
        } else {
          const spend = Number(row.spend) || 0;
          const revenue = Number(row.revenue) || 0;
          agg.set(key, {
            id: row.creative_id,
            creative_type: creative?.creative_type ?? "other",
            canonical_url: creative?.canonical_url ?? null,
            headline: creative?.headline ?? null,
            primary_text: creative?.primary_text ?? null,
            cta: creative?.cta ?? null,
            provider: row.provider,
            spend, impressions: Number(row.impressions) || 0,
            clicks: Number(row.clicks) || 0,
            purchases: Number(row.purchases) || 0,
            revenue, ctr: 0, cpa: 0, roas: 0,
            tags: tagMap.get(row.creative_id) ?? [],
            earlySpend: isLate ? 0 : spend,
            earlyRevenue: isLate ? 0 : revenue,
            lateSpend: isLate ? spend : 0,
            lateRevenue: isLate ? revenue : 0,
            daysActive: 1,
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

// ── Thumbnail ──────────────────────────────────────────────────────────
function CreativeThumbnail({
  url, type, size = "md",
}: { url: string | null; type: string; size?: "sm" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === "sm" ? "h-10 w-10" : size === "lg" ? "h-28 w-28" : "h-16 w-16";
  const Icon = TYPE_ICON[type] ?? FileText;

  if (url && !failed) {
    return (
      <div className={cn("rounded-lg overflow-hidden bg-muted shrink-0", sizeClass)}>
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg flex items-center justify-center shrink-0",
        sizeClass,
      )}
      style={{ backgroundColor: `${TYPE_COLOR[type] ?? "#9CA3AF"}15` }}
    >
      <Icon className="h-5 w-5" style={{ color: TYPE_COLOR[type] ?? "#9CA3AF" }} />
    </div>
  );
}

// ── Tags dialog ────────────────────────────────────────────────────────
function ManageTagsDialog({ creativeId, currentTags, workspaceId, onSuccess }: {
  creativeId: string; currentTags: string[]; workspaceId: string; onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[]>(currentTags);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  const addTag = async () => {
    const name = newTag.trim().toLowerCase();
    if (!name || tags.includes(name)) { setNewTag(""); return; }
    setSaving(true);
    const { data: tagRow, error: tagErr } = await supabase
      .from("creative_tags")
      .upsert({ workspace_id: workspaceId, name }, { onConflict: "workspace_id,name" })
      .select("id").single();
    if (tagErr || !tagRow) { toast.error("Error al crear tag"); setSaving(false); return; }
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
    const { data: tagRow } = await supabase
      .from("creative_tags").select("id")
      .eq("workspace_id", workspaceId).eq("name", tagName).maybeSingle();
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
        <DialogHeader><DialogTitle className="text-sm">Tags del Creativo</DialogTitle></DialogHeader>
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
            <Input placeholder="Nuevo tag…" value={newTag} onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              className="h-8 text-xs" />
            <Button size="sm" className="h-8" onClick={addTag} disabled={saving || !newTag.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Top Performers Tab ─────────────────────────────────────────────────
function TopPerformersTab({ creatives, onInvalidate, wsId }: {
  creatives: CreativeRow[]; onInvalidate: () => void; wsId: string;
}) {
  const top = [...creatives].sort((a, b) => b.roas - a.roas).slice(0, 10);

  return (
    <div className="space-y-3">
      {top.map((c, i) => {
        const label = c.headline ?? c.primary_text ?? c.canonical_url ?? `Creativo #${i + 1}`;
        const badge = PROVIDER_BADGE[c.provider] ?? { label: c.provider, className: "bg-muted text-muted-foreground" };
        const roasColor = c.roas >= 3 ? "text-emerald-600" : c.roas >= 1.5 ? "text-blue-600" : "text-orange-500";

        return (
          <Card key={`${c.id}-${c.provider}`} className={cn(i === 0 && "ring-2 ring-amber-400/60 ring-offset-1")}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-4">
                {/* Rank */}
                <div className="shrink-0 w-7 text-center">
                  {i === 0 ? (
                    <Crown className="h-5 w-5 text-amber-400 mx-auto" />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>
                  )}
                </div>

                {/* Thumbnail */}
                <CreativeThumbnail url={c.canonical_url} type={c.creative_type} size="md" />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className={cn("text-[9px] border-0 px-1.5", badge.className)}>
                      {badge.label}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] px-1.5">
                      {TYPE_LABEL[c.creative_type] ?? c.creative_type}
                    </Badge>
                    {c.tags.slice(0, 2).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[9px] px-1.5">{t}</Badge>
                    ))}
                  </div>
                  <p className="text-xs font-medium truncate" title={label}>{label}</p>
                  {c.cta && <p className="text-[10px] text-muted-foreground">{c.cta}</p>}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-4 shrink-0">
                  <div className="text-right">
                    <p className={cn("text-base font-bold tabular-nums", roasColor)}>{c.roas.toFixed(2)}x</p>
                    <p className="text-[9px] text-muted-foreground">ROAS</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{fmtCurrency(c.spend)}</p>
                    <p className="text-[9px] text-muted-foreground">Spend</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{fmtCurrency(c.revenue)}</p>
                    <p className="text-[9px] text-muted-foreground">Revenue</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{fmt(c.purchases)}</p>
                    <p className="text-[9px] text-muted-foreground">Compras</p>
                  </div>
                </div>

                {/* Tag button */}
                <div className="shrink-0">
                  <ManageTagsDialog creativeId={c.id} currentTags={c.tags} workspaceId={wsId} onSuccess={onInvalidate} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Format Analysis Tab ────────────────────────────────────────────────
function FormatTab({ creatives }: { creatives: CreativeRow[] }) {
  const formatStats = useMemo(() => {
    const map = new Map<string, { spend: number; revenue: number; impressions: number; clicks: number; purchases: number; count: number }>();
    for (const c of creatives) {
      const ex = map.get(c.creative_type) ?? { spend: 0, revenue: 0, impressions: 0, clicks: 0, purchases: 0, count: 0 };
      ex.spend += c.spend;
      ex.revenue += c.revenue;
      ex.impressions += c.impressions;
      ex.clicks += c.clicks;
      ex.purchases += c.purchases;
      ex.count += 1;
      map.set(c.creative_type, ex);
    }
    return Array.from(map.entries()).map(([type, d]) => ({
      type, label: TYPE_LABEL[type] ?? type, color: TYPE_COLOR[type] ?? "#888",
      count: d.count,
      roas: d.spend > 0 ? d.revenue / d.spend : 0,
      ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
      cpa: d.purchases > 0 ? d.spend / d.purchases : 0,
      spend: d.spend,
      avgROAS: d.spend > 0 ? d.revenue / d.spend : 0,
    })).sort((a, b) => b.roas - a.roas);
  }, [creatives]);

  const ChartCard = ({ title, dataKey, formatter, icon: Icon }: {
    title: string; dataKey: string; formatter: (v: number) => string; icon: any;
  }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />{title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={formatStats} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatter} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={65} />
            <ReTooltip formatter={(v: any) => formatter(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey={dataKey} radius={[0, 4, 4, 0]}>
              {formatStats.map((f) => <Cell key={f.type} fill={f.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Summary cards per format */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {formatStats.map((f) => {
          const Icon = TYPE_ICON[f.type] ?? FileText;
          return (
            <Card key={f.type}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${f.color}20` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: f.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{f.label}</p>
                    <p className="text-[10px] text-muted-foreground">{f.count} creativo{f.count !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <p className="text-sm font-bold tabular-nums">{f.roas.toFixed(2)}x</p>
                    <p className="text-[9px] text-muted-foreground">ROAS</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold tabular-nums">{f.ctr.toFixed(2)}%</p>
                    <p className="text-[9px] text-muted-foreground">CTR</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-3 gap-4">
        <ChartCard title="ROAS promedio" dataKey="roas" formatter={(v) => `${v.toFixed(2)}x`} icon={TrendingUp} />
        <ChartCard title="CTR promedio" dataKey="ctr" formatter={(v) => `${v.toFixed(2)}%`} icon={MousePointerClick} />
        <ChartCard title="CPA promedio" dataKey="cpa" formatter={(v) => `$${Math.round(v)}`} icon={DollarSign} />
      </div>
    </div>
  );
}

// ── Fatigue Tab ────────────────────────────────────────────────────────
function FatigueTab({ creatives }: { creatives: CreativeRow[] }) {
  const analyzed = useMemo(() => {
    return creatives
      .filter((c) => c.earlySpend > 0 && c.lateSpend > 0)
      .map((c) => {
        const earlyROAS = c.earlySpend > 0 ? c.earlyRevenue / c.earlySpend : 0;
        const lateROAS = c.lateSpend > 0 ? c.lateRevenue / c.lateSpend : 0;
        const drop = earlyROAS > 0 ? (earlyROAS - lateROAS) / earlyROAS : 0;
        return {
          ...c,
          earlyROAS,
          lateROAS,
          drop,
          fatigued: drop >= 0.3,
          critical: drop >= 0.5,
        };
      })
      .sort((a, b) => b.drop - a.drop);
  }, [creatives]);

  const fatigued = analyzed.filter((c) => c.fatigued);
  const healthy = analyzed.filter((c) => !c.fatigued);

  const FatigueCard = ({ c, i }: { c: typeof analyzed[0]; i: number }) => {
    const label = c.headline ?? c.primary_text ?? c.canonical_url ?? `Creativo #${i + 1}`;
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        c.critical ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200",
      )}>
        <CreativeThumbnail url={c.canonical_url} type={c.creative_type} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className={cn("text-[9px] border-0 px-1.5", PROVIDER_BADGE[c.provider]?.className)}>
              {PROVIDER_BADGE[c.provider]?.label ?? c.provider}
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1.5">{TYPE_LABEL[c.creative_type]}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-6 shrink-0 text-right">
          <div>
            <p className="text-xs font-semibold tabular-nums">{c.earlyROAS.toFixed(2)}x</p>
            <p className="text-[9px] text-muted-foreground">ROAS inicial</p>
          </div>
          <div>
            <p className="text-xs font-semibold tabular-nums">{c.lateROAS.toFixed(2)}x</p>
            <p className="text-[9px] text-muted-foreground">ROAS reciente</p>
          </div>
          <div>
            <p className={cn("text-sm font-bold tabular-nums", c.critical ? "text-red-600" : "text-yellow-600")}>
              −{(c.drop * 100).toFixed(0)}%
            </p>
            <p className="text-[9px] text-muted-foreground">Caída</p>
          </div>
        </div>
        <div className="shrink-0">
          {c.critical
            ? <AlertTriangle className="h-4 w-4 text-red-500" />
            : <Zap className="h-4 w-4 text-yellow-500" />
          }
        </div>
      </div>
    );
  };

  if (analyzed.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">Necesitás al menos 2 semanas de datos para el análisis de fatiga</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <div>
              <p className="text-lg font-bold">{analyzed.filter((c) => c.critical).length}</p>
              <p className="text-[10px] text-muted-foreground">Caída crítica &gt;50%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Zap className="h-4 w-4 text-yellow-500 shrink-0" />
            <div>
              <p className="text-lg font-bold">{analyzed.filter((c) => c.fatigued && !c.critical).length}</p>
              <p className="text-[10px] text-muted-foreground">Fatiga moderada 30–50%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <TrendingUp className="h-4 w-4 text-success shrink-0" />
            <div>
              <p className="text-lg font-bold">{healthy.length}</p>
              <p className="text-[10px] text-muted-foreground">Estables o mejorando</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {fatigued.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Creativos con fatiga — pausar o refrescar
          </p>
          {fatigued.map((c, i) => <FatigueCard key={`${c.id}-${c.provider}`} c={c} i={i} />)}
        </div>
      )}

      {healthy.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Creativos estables ✓
          </p>
          <div className="space-y-1">
            {healthy.map((c, i) => {
              const label = c.headline ?? c.primary_text ?? `Creativo #${i + 1}`;
              const change = c.drop < 0
                ? `+${(Math.abs(c.drop) * 100).toFixed(0)}% mejora`
                : `−${(c.drop * 100).toFixed(0)}% caída`;
              return (
                <div key={`${c.id}-${c.provider}`} className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg">
                  <CreativeThumbnail url={c.canonical_url} type={c.creative_type} size="sm" />
                  <p className="text-xs truncate flex-1">{label}</p>
                  <span className={cn(
                    "text-[10px] font-medium",
                    c.drop < 0 ? "text-success" : "text-muted-foreground",
                  )}>{change}</span>
                  <span className="text-xs font-semibold tabular-nums">{c.roas.toFixed(2)}x</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ranking Tab (full table) ───────────────────────────────────────────
function RankingTab({ sorted, onSort, sortKey, sortAsc, onInvalidate, wsId }: {
  sorted: CreativeRow[]; onSort: (k: SortKey) => void;
  sortKey: SortKey; sortAsc: boolean; onInvalidate: () => void; wsId: string;
}) {
  const SortHead = ({ label, col }: { label: string; col: SortKey }) => (
    <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => onSort(col)}>
      <div className="flex items-center gap-1">
        {label}
        {sortKey === col && <ArrowUpDown className="h-3 w-3 text-primary" />}
      </div>
    </TableHead>
  );

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Creativo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Plataforma</TableHead>
              <TableHead>Tags</TableHead>
              <SortHead label="Spend" col="spend" />
              <SortHead label="Impr." col="impressions" />
              <SortHead label="Clicks" col="clicks" />
              <SortHead label="CTR" col="ctr" />
              <SortHead label="Compras" col="purchases" />
              <SortHead label="CPA" col="cpa" />
              <SortHead label="ROAS" col="roas" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((c, i) => {
              const TypeIcon = TYPE_ICON[c.creative_type] ?? FileText;
              const badge = PROVIDER_BADGE[c.provider] ?? { label: c.provider, className: "bg-muted text-muted-foreground" };
              const label = c.headline ?? c.primary_text ?? c.canonical_url ?? `Creativo #${i + 1}`;
              return (
                <TableRow key={`${c.id}-${c.provider}`}>
                  <TableCell className="max-w-[200px]">
                    <div className="flex items-center gap-2">
                      <CreativeThumbnail url={c.canonical_url} type={c.creative_type} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate" title={label}>{label}</p>
                        {c.cta && <p className="text-[10px] text-muted-foreground">{c.cta}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{TYPE_LABEL[c.creative_type] ?? c.creative_type}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[10px] border-0", badge.className)}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      {c.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0">{tag}</Badge>
                      ))}
                      <ManageTagsDialog creativeId={c.id} currentTags={c.tags} workspaceId={wsId} onSuccess={onInvalidate} />
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-medium tabular-nums">{fmtCurrency(c.spend)}</TableCell>
                  <TableCell className="text-xs tabular-nums">{fmtCompact(c.impressions)}</TableCell>
                  <TableCell className="text-xs tabular-nums">{fmtCompact(c.clicks)}</TableCell>
                  <TableCell className="text-xs tabular-nums">{fmtPercent(c.ctr)}</TableCell>
                  <TableCell className="text-xs tabular-nums">{fmt(c.purchases)}</TableCell>
                  <TableCell className="text-xs tabular-nums">{c.purchases > 0 ? fmtCurrency(c.cpa) : "–"}</TableCell>
                  <TableCell className={cn(
                    "text-xs font-bold tabular-nums",
                    c.roas >= 2 ? "text-success" : c.roas >= 1 ? "text-primary" : c.roas > 0 ? "text-warning" : "text-muted-foreground",
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
  );
}

// ── Main ───────────────────────────────────────────────────────────────
const Creatives = () => {
  const { currentWorkspace } = useWorkspace();
  const { data, isLoading } = useCreativePerformance();
  const qc = useQueryClient();
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["creative-performance"] });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <SectionHeader badge="Creativos" title="Creative Analysis" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <SectionHeader badge="Creativos" title="Creative Analysis" />
        <EmptyState title="Sin datos de creativos" description="Los creativos aparecerán luego del primer sync con Meta o Google Ads." />
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

  const totalSpend = filtered.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = filtered.reduce((s, c) => s + c.revenue, 0);
  const totalPurchases = filtered.reduce((s, c) => s + c.purchases, 0);
  const blendedROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const blendedCPA = totalPurchases > 0 ? totalSpend / totalPurchases : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        badge="Creativos"
        title="Creative Analysis"
        subtitle={`${filtered.length} creativo${filtered.length !== 1 ? "s" : ""}`}
        action={
          <div className="flex gap-2">
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Plataforma</SelectItem>
                <SelectItem value="meta">Meta</SelectItem>
                <SelectItem value="google_ads">Google</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
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

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Spend total" value={fmtCurrency(totalSpend)} status="primary" hero />
        <StatCard icon={ShoppingCart} label="Compras" value={fmt(totalPurchases)} status="success" hero />
        <StatCard icon={TrendingUp} label="ROAS blended" value={`${fmt(blendedROAS, 2)}x`} status={blendedROAS >= 1 ? "success" : "warning"} hero />
        <StatCard icon={DollarSign} label="CPA promedio" value={blendedCPA > 0 ? fmtCurrency(blendedCPA) : "–"} status="neutral" hero />
      </div>

      <Tabs defaultValue="top" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="top" className="text-xs gap-1.5">
            <Trophy className="h-3.5 w-3.5" />Top Performers
          </TabsTrigger>
          <TabsTrigger value="format" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />Por Formato
          </TabsTrigger>
          <TabsTrigger value="fatigue" className="text-xs gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Fatiga
            {filtered.filter((c) => c.earlySpend > 0 && c.lateSpend > 0 && (c.earlySpend > 0 ? c.earlyRevenue / c.earlySpend : 0) - (c.lateSpend > 0 ? c.lateRevenue / c.lateSpend : 0) > 0).length > 0 && (
              <Badge variant="destructive" className="text-[9px] h-4 px-1.5 ml-1">
                {filtered.filter((c) => {
                  const er = c.earlySpend > 0 ? c.earlyRevenue / c.earlySpend : 0;
                  const lr = c.lateSpend > 0 ? c.lateRevenue / c.lateSpend : 0;
                  return er > 0 && (er - lr) / er >= 0.3;
                }).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ranking" className="text-xs gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5" />Ranking completo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="top">
          <TopPerformersTab creatives={filtered} onInvalidate={invalidate} wsId={currentWorkspace?.id ?? ""} />
        </TabsContent>

        <TabsContent value="format">
          <FormatTab creatives={filtered} />
        </TabsContent>

        <TabsContent value="fatigue">
          <FatigueTab creatives={filtered} />
        </TabsContent>

        <TabsContent value="ranking">
          <RankingTab
            sorted={sorted} onSort={handleSort}
            sortKey={sortKey} sortAsc={sortAsc}
            onInvalidate={invalidate} wsId={currentWorkspace?.id ?? ""}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Creatives;
