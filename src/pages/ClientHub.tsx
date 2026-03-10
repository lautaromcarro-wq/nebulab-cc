import { useState, useEffect } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { fmt, fmtCurrency, fmtCompact, fmtPercent } from "@/components/formatters";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import SectionHeader from "@/components/SectionHeader";
import StatCard from "@/components/StatCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Globe,
  Users,
  Briefcase,
  Shield,
  Target,
  Swords,
  Building2,
  FileText,
  ExternalLink,
  Save,
  Link2,
  BarChart3,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  CheckSquare,
  ClipboardList,
  KeyRound,
  Package,
  Megaphone,
  Upload,
  Clock,
  AlertCircle,
  MessageSquare,
  Phone,
  Mail,
  Video,
  CreditCard,
  Receipt,
  Pencil,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ── Financial Settings per client ──
interface FinSettings {
  avg_cogs_percent: number;
  shipping_percent: number;
  payment_fee_percent: number;
  refund_percent: number;
  iva_percent: number;
}

const defaultFin: FinSettings = { avg_cogs_percent: 0, shipping_percent: 0, payment_fee_percent: 0, refund_percent: 0, iva_percent: 0 };

const finFields: Array<{ key: keyof FinSettings; label: string; desc: string }> = [
  { key: "avg_cogs_percent", label: "COGS (%)", desc: "Costo de producción" },
  { key: "shipping_percent", label: "Envío (%)", desc: "Costo de envío" },
  { key: "payment_fee_percent", label: "Comisión pago (%)", desc: "Fee procesador" },
  { key: "refund_percent", label: "Devoluciones (%)", desc: "Tasa reembolsos" },
  { key: "iva_percent", label: "IVA (%)", desc: "Impuestos" },
];

export default function ClientHub() {
  const { selectedClient, refetch } = useClient();
  const { currentWorkspace, workspaceRole } = useWorkspace();
  const isAdmin = workspaceRole === "admin";
  const [activeTab, setActiveTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    website_url: "",
    notes: "",
    industria: "",
    status: "active",
    responsable_nebulab: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (selectedClient) {
      setEditForm({
        name: selectedClient.name,
        website_url: selectedClient.website_url ?? "",
        notes: selectedClient.notes ?? "",
        industria: selectedClient.industria ?? "",
        status: selectedClient.status ?? "active",
        responsable_nebulab: selectedClient.responsable_nebulab ?? "",
      });
    }
  }, [selectedClient]);

  if (!selectedClient) {
    return (
      <div className="space-y-6 animate-fade-in">
        <SectionHeader badge="Nebu" title="Client Hub" subtitle="Perfil completo del cliente" />
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No hay cliente seleccionado.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Seleccioná uno del selector en el panel lateral, o creá uno nuevo con el botón <strong>+</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleEditSave = async () => {
    if (!editForm.name.trim()) return;
    setEditSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({
        name: editForm.name.trim(),
        website_url: editForm.website_url || null,
        notes: editForm.notes || null,
        industria: editForm.industria || null,
        status: editForm.status,
        responsable_nebulab: editForm.responsable_nebulab || null,
      })
      .eq("id", selectedClient.id);
    setEditSaving(false);
    if (error) {
      toast.error("Error al guardar cambios");
    } else {
      toast.success("Cliente actualizado");
      refetch();
      setEditOpen(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Client Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{selectedClient.name}</h1>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase font-bold",
                  selectedClient.status === "active"
                    ? "bg-success/10 text-success border-success/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {selectedClient.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {selectedClient.website_url && (
                <a
                  href={selectedClient.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                >
                  <Globe className="h-3 w-3" />
                  {selectedClient.website_url}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
              {selectedClient.notes && (
                <span className="text-xs text-muted-foreground/70">
                  {selectedClient.notes}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEditOpen(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
      </div>

      {/* Edit Client Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nombre <span className="text-destructive">*</span></Label>
              <Input className="mt-1" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Estado</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="paused">Pausado</SelectItem>
                    <SelectItem value="offboarded">Offboarded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Industria</Label>
                <Input className="mt-1" value={editForm.industria} onChange={(e) => setEditForm((f) => ({ ...f, industria: e.target.value }))} placeholder="Ej: E-commerce, SaaS…" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Website</Label>
              <Input className="mt-1" value={editForm.website_url} onChange={(e) => setEditForm((f) => ({ ...f, website_url: e.target.value }))} placeholder="https://…" />
            </div>
            <div>
              <Label className="text-xs">Responsable Nebulab</Label>
              <Input className="mt-1" value={editForm.responsable_nebulab} onChange={(e) => setEditForm((f) => ({ ...f, responsable_nebulab: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Notas</Label>
              <Textarea className="mt-1" rows={3} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleEditSave} disabled={editSaving || !editForm.name.trim()}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {editSaving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" />Datos
          </TabsTrigger>
          <TabsTrigger value="brands" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />Brands
          </TabsTrigger>
          <TabsTrigger value="verticals" className="text-xs gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />Verticales
          </TabsTrigger>
          <TabsTrigger value="personas" className="text-xs gap-1.5">
            <Target className="h-3.5 w-3.5" />Personas
          </TabsTrigger>
          <TabsTrigger value="competitors" className="text-xs gap-1.5">
            <Swords className="h-3.5 w-3.5" />Competidores
          </TabsTrigger>
          <TabsTrigger value="vault" className="text-xs gap-1.5">
            <Shield className="h-3.5 w-3.5" />Vault
          </TabsTrigger>
          <TabsTrigger value="accounts" className="text-xs gap-1.5">
            <Link2 className="h-3.5 w-3.5" />Cuentas
          </TabsTrigger>
          <TabsTrigger value="financial" className="text-xs gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />Financial
          </TabsTrigger>
          <TabsTrigger value="billing-loads" className="text-xs gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />Cargas
          </TabsTrigger>
          <TabsTrigger value="billing-invoices" className="text-xs gap-1.5">
            <Receipt className="h-3.5 w-3.5" />Facturas
          </TabsTrigger>
          <TabsTrigger value="marca" className="text-xs gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />Marca
          </TabsTrigger>
          <TabsTrigger value="productos" className="text-xs gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" />Productos
          </TabsTrigger>
          <TabsTrigger value="bitacora" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" />Bitácora
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="text-xs gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />Onboarding
          </TabsTrigger>
          <TabsTrigger value="accesos" className="text-xs gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />Accesos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ClientOverviewTab client={selectedClient} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} refetch={refetch} setActiveTab={setActiveTab} />
        </TabsContent>
        <TabsContent value="brands">
          <ClientBrandsTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} />
        </TabsContent>
        <TabsContent value="verticals">
          <ClientVerticalsTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="accounts">
          <ClientAccountsTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="financial">
          <ClientFinancialTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="billing-loads">
          <ClientBalanceLoadsTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="billing-invoices">
          <ClientInvoicesTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="personas">
          <ClientPersonasTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="competitors">
          <ClientCompetitorsTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="vault">
          <ClientVaultTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="marca">
          <ClientMarcaTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="productos">
          <ClientProductosTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="bitacora">
          <ClientBitacoraTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="onboarding">
          <ClientOnboardingTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="accesos">
          <ClientAccesosTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── New Brand Dialog ──
function NewBrandDialog({ clientId, workspaceId, onSuccess }: { clientId: string; workspaceId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("segments").insert({
      workspace_id: workspaceId,
      client_id: clientId,
      name: name.trim(),
      currency,
      monthly_budget: Number(budget) || 0,
      tolerance_percent: 0.07,
      rolling_avg_days: 3,
    });
    setSaving(false);
    if (error) { toast.error("Error al crear brand"); return; }
    toast.success(`Brand "${name}" creado`);
    setOpen(false);
    setName(""); setBudget(""); setCurrency("USD");
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nuevo Brand
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nuevo Brand / Vertical</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Nombre <span className="text-destructive">*</span></Label>
            <Input
              className="mt-1"
              placeholder="Ej: Ropa, Accesorios, Skincare…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Budget mensual</Label>
              <Input className="mt-1" type="number" min={0} placeholder="0" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["USD", "ARS", "MXN", "BRL", "EUR"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Las reglas de clasificación de campañas se configuran desde <strong>Segments</strong> en el menú.
          </p>
          <Button className="w-full" onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? "Creando…" : "Crear Brand"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Brands / Performance by Segment Tab ──
function ClientBrandsTab({ clientId, workspaceId }: { clientId: string; workspaceId: string }) {
  const { segments, dateRange, refetchSegments } = useWorkspace();
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("all");

  const clientSegments = segments.filter((s) => s.client_id === clientId);
  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");

  // Reset selection when client changes
  useEffect(() => { setSelectedSegmentId("all"); }, [clientId]);

  const { data: segmentCampaignIds } = useQuery({
    queryKey: ["segment-campaigns", selectedSegmentId, workspaceId],
    enabled: selectedSegmentId !== "all",
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_segment_map")
        .select("campaign_id")
        .eq("workspace_id", workspaceId)
        .eq("segment_id", selectedSegmentId)
        .eq("match_status", "assigned");
      return (data ?? []).map((r) => r.campaign_id);
    },
  });

  const { data: allClientCampaignIds } = useQuery({
    queryKey: ["client-segment-campaigns", clientId, workspaceId, clientSegments.map((s) => s.id).join(",")],
    enabled: selectedSegmentId === "all" && clientSegments.length > 0,
    queryFn: async () => {
      const segIds = clientSegments.map((s) => s.id);
      const { data } = await supabase
        .from("campaign_segment_map")
        .select("campaign_id")
        .eq("workspace_id", workspaceId)
        .in("segment_id", segIds)
        .eq("match_status", "assigned");
      return (data ?? []).map((r) => r.campaign_id);
    },
  });

  const campaignIds = selectedSegmentId === "all" ? allClientCampaignIds : segmentCampaignIds;

  const { data: perfData, isLoading } = useQuery({
    queryKey: ["brand-performance", clientId, selectedSegmentId, fromStr, toStr, campaignIds?.length],
    enabled: !!campaignIds,
    queryFn: async () => {
      if (!campaignIds || campaignIds.length === 0) return { campaigns: [], totals: null };

      const [perfRes, campRes] = await Promise.all([
        supabase
          .from("performance_daily")
          .select("entity_id, provider, spend, impressions, clicks, purchases, revenue")
          .eq("workspace_id", workspaceId)
          .eq("client_id", clientId)
          .eq("entity_type", "campaign")
          .in("entity_id", campaignIds)
          .gte("date", fromStr)
          .lte("date", toStr),
        supabase.from("campaigns").select("id, name").eq("workspace_id", workspaceId),
      ]);

      const campNames = new Map((campRes.data ?? []).map((c) => [c.id, c.name]));
      const agg = new Map<string, { name: string; provider: string; spend: number; impressions: number; clicks: number; purchases: number; revenue: number }>();

      for (const row of perfRes.data ?? []) {
        const cId = row.entity_id;
        const existing = agg.get(cId);
        if (existing) {
          existing.spend += Number(row.spend) || 0;
          existing.impressions += Number(row.impressions) || 0;
          existing.clicks += Number(row.clicks) || 0;
          existing.purchases += Number(row.purchases) || 0;
          existing.revenue += Number(row.revenue) || 0;
        } else {
          agg.set(cId, {
            name: campNames.get(cId) ?? cId,
            provider: row.provider,
            spend: Number(row.spend) || 0,
            impressions: Number(row.impressions) || 0,
            clicks: Number(row.clicks) || 0,
            purchases: Number(row.purchases) || 0,
            revenue: Number(row.revenue) || 0,
          });
        }
      }

      const campaigns = Array.from(agg.values()).sort((a, b) => b.spend - a.spend);
      const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
      const totalPurchases = campaigns.reduce((s, c) => s + c.purchases, 0);
      const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);

      return {
        campaigns,
        totals: {
          spend: totalSpend,
          purchases: totalPurchases,
          roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
          cpa: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
        },
      };
    },
  });

  if (clientSegments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No hay brands configurados para este cliente.</p>
          <NewBrandDialog clientId={clientId} workspaceId={workspaceId} onSuccess={refetchSegments} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las marcas</SelectItem>
              {clientSegments.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{fromStr} → {toStr}</span>
        </div>
        <NewBrandDialog clientId={clientId} workspaceId={workspaceId} onSuccess={refetchSegments} />
      </div>

      {perfData?.totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={DollarSign} label="Spend" value={fmtCurrency(perfData.totals.spend)} status="primary" />
          <StatCard icon={ShoppingCart} label="Purchases" value={fmt(perfData.totals.purchases)} status="success" />
          <StatCard icon={TrendingUp} label="ROAS" value={`${fmt(perfData.totals.roas, 2)}x`} status={perfData.totals.roas >= 1 ? "success" : "warning"} />
          <StatCard icon={DollarSign} label="CPA" value={perfData.totals.cpa > 0 ? fmtCurrency(perfData.totals.cpa) : "–"} status="neutral" />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Cargando…</div>
          ) : !perfData?.campaigns.length ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Sin datos para el período seleccionado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaña</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Purch.</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perfData.campaigns.map((c, i) => {
                  const roas = c.spend > 0 ? c.revenue / c.spend : 0;
                  const cpa = c.purchases > 0 ? c.spend / c.purchases : 0;
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium max-w-[240px] truncate">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px]">{c.provider}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmtCurrency(c.spend)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(c.purchases)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{cpa > 0 ? fmtCurrency(cpa) : "–"}</TableCell>
                      <TableCell className={cn("text-xs text-right tabular-nums font-medium", roas >= 1 ? "text-success" : roas > 0 ? "text-warning" : "text-muted-foreground")}>
                        {c.spend > 0 ? `${fmt(roas, 2)}x` : "–"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Overview Tab ──
function ClientOverviewTab({ client, workspaceId, isAdmin, refetch, setActiveTab }: { client: any; workspaceId: string; isAdmin: boolean; refetch: () => void; setActiveTab: (t: string) => void }) {
  const [form, setForm] = useState({
    name: client.name,
    website_url: client.website_url || "",
    notes: client.notes || "",
    industria: client.industria || "",
    responsable_nebulab: client.responsable_nebulab || "",
    prioridad: client.prioridad || "media",
    fecha_kickoff: client.fecha_kickoff || "",
    presupuesto_mensual_estimado: client.presupuesto_mensual_estimado ? String(client.presupuesto_mensual_estimado) : "",
  });
  const [saving, setSaving] = useState(false);
  const [accountSettings, setAccountSettings] = useState<any[]>([]);
  const [checklistProgress, setChecklistProgress] = useState<{ total: number; completed: number } | null>(null);
  const [opsSummary, setOpsSummary] = useState<{
    cargasPendientes: number; cargasPendientesTotal: number;
    facturasSinCobrar: number; facturasSinCobrarTotal: number;
    accionablesVencidos: number;
  } | null>(null);

  useEffect(() => {
    setForm({
      name: client.name,
      website_url: client.website_url || "",
      notes: client.notes || "",
      industria: client.industria || "",
      responsable_nebulab: client.responsable_nebulab || "",
      prioridad: client.prioridad || "media",
      fecha_kickoff: client.fecha_kickoff || "",
      presupuesto_mensual_estimado: client.presupuesto_mensual_estimado ? String(client.presupuesto_mensual_estimado) : "",
    });
  }, [client]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    Promise.all([
      supabase.from("client_account_settings").select("*").eq("client_id", client.id).eq("is_enabled", true),
      supabase.from("onboarding_checklist").select("estado").eq("client_id", client.id),
      supabase.from("balance_loads").select("amount").eq("client_id", client.id).eq("status", "pendiente"),
      supabase.from("client_invoices").select("amount_total, status").eq("client_id", client.id).neq("status", "cobrada"),
      supabase.from("client_accionables").select("id").eq("client_id", client.id).neq("status", "completado").lt("due_date", today),
    ]).then(([accounts, checklist, cargas, facturas, accionables]) => {
      setAccountSettings(accounts.data ?? []);
      const cl = checklist.data ?? [];
      if (cl.length > 0) setChecklistProgress({ total: cl.length, completed: cl.filter((d: any) => d.estado === "completado").length });
      setOpsSummary({
        cargasPendientes: (cargas.data ?? []).length,
        cargasPendientesTotal: (cargas.data ?? []).reduce((s, r) => s + Number(r.amount), 0),
        facturasSinCobrar: (facturas.data ?? []).length,
        facturasSinCobrarTotal: (facturas.data ?? []).reduce((s, r) => s + Number(r.amount_total || 0), 0),
        accionablesVencidos: (accionables.data ?? []).length,
      });
    });
  }, [client.id]);

  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("clients").update({
      name: form.name,
      website_url: form.website_url || null,
      notes: form.notes || null,
      industria: form.industria || null,
      responsable_nebulab: form.responsable_nebulab || null,
      prioridad: form.prioridad,
      fecha_kickoff: form.fecha_kickoff || null,
      presupuesto_mensual_estimado: form.presupuesto_mensual_estimado ? Number(form.presupuesto_mensual_estimado) : null,
      updated_at: new Date().toISOString(),
    }).eq("id", client.id);
    if (error) toast.error("Error al guardar");
    else { toast.success("Cliente actualizado"); refetch(); }
    setSaving(false);
  };

  const progress = checklistProgress ? Math.round((checklistProgress.completed / checklistProgress.total) * 100) : null;

  const prioColor = (p: string) => p === "alta" ? "bg-destructive/10 text-destructive" : p === "baja" ? "bg-muted text-muted-foreground" : "bg-warning/10 text-warning";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Onboarding Progress */}
      {checklistProgress && (
        <Card className="md:col-span-2">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Progreso de Onboarding</span>
              </div>
              <span className="text-xs font-bold text-primary">{progress}% ({checklistProgress.completed}/{checklistProgress.total} completados)</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-success" : "bg-primary")} style={{ width: `${progress}%` }} />
            </div>
          </CardContent>
        </Card>
      )}
      {/* Ops Summary Cards */}
      {opsSummary && (
        <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Checklist */}
          <button
            onClick={() => setActiveTab("onboarding")}
            className="text-left rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Onboarding</span>
              <ClipboardList className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            {checklistProgress ? (
              <>
                <p className="text-lg font-bold tabular-nums">
                  {Math.round((checklistProgress.completed / checklistProgress.total) * 100)}%
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{checklistProgress.completed}/{checklistProgress.total} completados</p>
                <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-2">
                  <div
                    className={cn("h-full rounded-full", checklistProgress.completed === checklistProgress.total ? "bg-success" : "bg-primary")}
                    style={{ width: `${Math.round((checklistProgress.completed / checklistProgress.total) * 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Sin datos</p>
            )}
          </button>

          {/* Accionables vencidos */}
          <button
            onClick={() => setActiveTab("bitacora")}
            className={cn(
              "text-left rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors group",
              opsSummary.accionablesVencidos > 0 && "border-destructive/40 bg-destructive/5"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Accionables</span>
              <AlertCircle className={cn("h-3.5 w-3.5", opsSummary.accionablesVencidos > 0 ? "text-destructive" : "text-muted-foreground")} />
            </div>
            <p className={cn("text-lg font-bold tabular-nums", opsSummary.accionablesVencidos > 0 ? "text-destructive" : "text-foreground")}>
              {opsSummary.accionablesVencidos}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {opsSummary.accionablesVencidos === 0 ? "Sin vencidos" : `vencido${opsSummary.accionablesVencidos > 1 ? "s" : ""}`}
            </p>
          </button>

          {/* Cargas pendientes */}
          <button
            onClick={() => setActiveTab("billing-loads")}
            className={cn(
              "text-left rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors group",
              opsSummary.cargasPendientes > 0 && "border-warning/40 bg-warning/5"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Cargas</span>
              <CreditCard className={cn("h-3.5 w-3.5", opsSummary.cargasPendientes > 0 ? "text-warning" : "text-muted-foreground")} />
            </div>
            <p className={cn("text-lg font-bold tabular-nums", opsSummary.cargasPendientes > 0 ? "text-warning" : "text-foreground")}>
              {opsSummary.cargasPendientes}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {opsSummary.cargasPendientes === 0 ? "Sin pendientes" : `pendiente${opsSummary.cargasPendientes > 1 ? "s" : ""}`}
            </p>
          </button>

          {/* Facturas sin cobrar */}
          <button
            onClick={() => setActiveTab("billing-invoices")}
            className={cn(
              "text-left rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors group",
              opsSummary.facturasSinCobrar > 0 && "border-primary/40 bg-primary/5"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Facturas</span>
              <FileText className={cn("h-3.5 w-3.5", opsSummary.facturasSinCobrar > 0 ? "text-primary" : "text-muted-foreground")} />
            </div>
            <p className={cn("text-lg font-bold tabular-nums", opsSummary.facturasSinCobrar > 0 ? "text-primary" : "text-foreground")}>
              {opsSummary.facturasSinCobrar}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {opsSummary.facturasSinCobrar === 0 ? "Todo cobrado" : `sin cobrar`}
            </p>
          </button>
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Información General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Nombre</Label>
            <Input value={form.name} onChange={(e) => setF("name", e.target.value)} disabled={!isAdmin} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Website</Label>
            <Input value={form.website_url} onChange={(e) => setF("website_url", e.target.value)} disabled={!isAdmin} className="mt-1" placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Industria</Label>
              <Input value={form.industria} onChange={(e) => setF("industria", e.target.value)} disabled={!isAdmin} className="mt-1" placeholder="eCommerce, SaaS…" />
            </div>
            <div>
              <Label className="text-xs">Prioridad</Label>
              <Select value={form.prioridad} onValueChange={(v) => setF("prioridad", v)} disabled={!isAdmin}>
                <SelectTrigger className="mt-1 text-xs h-9">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold uppercase", prioColor(form.prioridad))}>{form.prioridad}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Responsable Nebulab</Label>
              <Input value={form.responsable_nebulab} onChange={(e) => setF("responsable_nebulab", e.target.value)} disabled={!isAdmin} className="mt-1" placeholder="Nombre del account…" />
            </div>
            <div>
              <Label className="text-xs">Fecha Kickoff</Label>
              <Input type="date" value={form.fecha_kickoff} onChange={(e) => setF("fecha_kickoff", e.target.value)} disabled={!isAdmin} className="mt-1 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Presupuesto mensual estimado (ARS)</Label>
            <Input value={form.presupuesto_mensual_estimado} onChange={(e) => setF("presupuesto_mensual_estimado", e.target.value)} disabled={!isAdmin} className="mt-1 font-mono" placeholder="0" type="number" />
          </div>
          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea value={form.notes} onChange={(e) => setF("notes", e.target.value)} disabled={!isAdmin} className="mt-1" rows={2} placeholder="Notas sobre el cliente..." />
          </div>
          {isAdmin && (
            <div className="pt-1 flex justify-end">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Cuentas Conectadas</CardTitle>
          <CardDescription className="text-xs">{accountSettings.length} cuenta(s) activa(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {accountSettings.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sin cuentas vinculadas</p>
          ) : (
            <div className="space-y-2">
              {accountSettings.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <div>
                    <p className="text-xs font-medium">{a.account_name || a.external_account_id}</p>
                    <p className="text-[10px] text-muted-foreground">{a.external_account_id}</p>
                  </div>
                  <Badge variant="secondary" className="text-[9px] uppercase">{a.platform}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Accounts Tab ──
function ClientAccountsTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [linked, setLinked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchData = async () => {
    const [{ data: accounts }, { data: settings }] = await Promise.all([
      supabase.from("accounts").select("id, name, external_account_id, provider, status").eq("workspace_id", workspaceId).eq("status", "active").order("provider, name"),
      supabase.from("client_account_settings").select("*").eq("client_id", clientId),
    ]);
    setAllAccounts(accounts ?? []);
    setLinked(settings ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [clientId]);

  const isLinked = (extId: string, platform: string) =>
    linked.some((l) => l.external_account_id === extId && l.platform === platform && l.is_enabled);

  const getSetting = (extId: string, platform: string) =>
    linked.find((l) => l.external_account_id === extId && l.platform === platform);

  const handleToggle = async (account: any, enable: boolean) => {
    if (!isAdmin) return;
    setToggling(account.id);
    const existing = getSetting(account.external_account_id, account.provider);
    if (existing) {
      await supabase.from("client_account_settings").update({ is_enabled: enable, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("client_account_settings").insert({
        client_id: clientId,
        workspace_id: workspaceId,
        external_account_id: account.external_account_id,
        account_name: account.name,
        platform: account.provider,
        is_enabled: enable,
      });
    }
    await fetchData();
    setToggling(null);
    toast.success(enable ? "Cuenta vinculada" : "Cuenta desvinculada");
  };

  if (loading) return <Skeleton className="h-32" />;

  const grouped = allAccounts.reduce<Record<string, any[]>>((acc, a) => {
    (acc[a.provider] = acc[a.provider] || []).push(a);
    return acc;
  }, {});

  const linkedCount = linked.filter((l) => l.is_enabled).length;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Vinculá las cuentas publicitarias del workspace a este cliente. Solo las cuentas habilitadas se usarán para reportes y sincronización.
        <span className="ml-2 font-medium">{linkedCount} vinculada(s)</span>
      </p>
      {Object.keys(grouped).length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <Link2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No hay cuentas en el workspace.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Conectá plataformas desde la sección Conexiones.</p>
          </CardContent>
        </Card>
      )}
      {Object.entries(grouped).map(([provider, accounts]) => (
        <Card key={provider}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wide">{provider}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {accounts.map((a: any) => {
              const enabled = isLinked(a.external_account_id, a.provider);
              return (
                <div key={a.id} className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{a.name || a.external_account_id}</p>
                    <p className="text-[10px] text-muted-foreground">{a.external_account_id}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {enabled && <Badge variant="secondary" className="text-[9px]">Vinculada</Badge>}
                    {isAdmin && (
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) => handleToggle(a, checked)}
                        disabled={toggling === a.id}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Verticals Tab ──
function ClientVerticalsTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const { data } = await supabase
      .from("client_verticals")
      .select("*")
      .eq("client_id", clientId)
      .order("name");
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [clientId]);

  const handleAdd = async () => {
    await supabase.from("client_verticals").insert({
      client_id: clientId,
      workspace_id: workspaceId,
      name: "Nueva Vertical",
      business_model: "ecom",
    });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("client_verticals").delete().eq("id", id);
    fetchData();
  };

  if (loading) return <Skeleton className="h-32" />;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Button size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />Agregar Vertical
        </Button>
      )}
      {items.length === 0 && <p className="text-sm text-muted-foreground">No hay verticales definidas.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((v) => (
          <Card key={v.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{v.name}</p>
                  <Badge variant="secondary" className="text-[10px] mt-1">{v.business_model}</Badge>
                  {v.notes && <p className="text-xs text-muted-foreground mt-2">{v.notes}</p>}
                </div>
                {isAdmin && (
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(v.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Financial Settings Tab ──
function ClientFinancialTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [form, setForm] = useState<FinSettings>(defaultFin);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("client_financial_settings")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            avg_cogs_percent: Number(data.avg_cogs_percent) || 0,
            shipping_percent: Number(data.shipping_percent) || 0,
            payment_fee_percent: Number(data.payment_fee_percent) || 0,
            refund_percent: Number(data.refund_percent) || 0,
            iva_percent: Number(data.iva_percent) || 0,
          });
        } else {
          setForm(defaultFin);
        }
        setLoading(false);
      });
  }, [clientId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("client_financial_settings")
        .upsert({ client_id: clientId, workspace_id: workspaceId, ...form, updated_at: new Date().toISOString() }, { onConflict: "client_id" });
      if (error) throw error;
      toast.success("Financial settings guardados");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const totalDeduction = Object.values(form).reduce((s, v) => s + (Number(v) || 0), 0);

  if (loading) return <Skeleton className="h-32" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold">Porcentajes de deducción</CardTitle>
        <CardDescription className="text-xs">Total: {totalDeduction.toFixed(1)}% — Revenue × (100% − deducciones) − Spend = Contribution Margin</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {finFields.map(({ key, label, desc }) => (
          <div key={key} className="grid grid-cols-2 gap-4 items-center">
            <div>
              <Label htmlFor={key} className="text-xs">{label}</Label>
              <p className="text-[10px] text-muted-foreground">{desc}</p>
            </div>
            <div className="relative">
              <Input id={key} type="number" min={0} max={100} step={0.1} value={form[key]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                className="pr-8" disabled={!isAdmin}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
        ))}
        {isAdmin && (
          <div className="pt-4 border-t flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Personas Tab ──
function ClientPersonasTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [personas, setPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const { data } = await supabase.from("buyer_personas").select("*").eq("client_id", clientId).order("created_at");
    setPersonas(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [clientId]);

  const handleAdd = async () => {
    await supabase.from("buyer_personas").insert({ client_id: clientId, workspace_id: workspaceId, name: "Nueva Persona" });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("buyer_personas").delete().eq("id", id);
    fetchData();
  };

  if (loading) return <Skeleton className="h-32" />;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Button size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />Agregar Persona
        </Button>
      )}
      {personas.length === 0 && <p className="text-sm text-muted-foreground">No hay buyer personas definidas.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {personas.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  {p.pain_points && p.pain_points.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.pain_points.map((point: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[9px]">{point}</Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">{p.notes || "Sin notas"}</p>
                </div>
                {isAdmin && (
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Competitors Tab ──
function ClientCompetitorsTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const { data } = await supabase.from("competitors").select("*").eq("client_id", clientId).order("name");
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [clientId]);

  const handleAdd = async () => {
    await supabase.from("competitors").insert({ client_id: clientId, workspace_id: workspaceId, name: "Nuevo Competidor" });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("competitors").delete().eq("id", id);
    fetchData();
  };

  if (loading) return <Skeleton className="h-32" />;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Button size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />Agregar Competidor
        </Button>
      )}
      {items.length === 0 && <p className="text-sm text-muted-foreground">No hay competidores registrados.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                      {c.url} <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                  {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
                </div>
                {isAdmin && (
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Marca Tab ──
function ClientMarcaTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [form, setForm] = useState({
    historia: "",
    propuesta_valor: "",
    diferenciales: "",
    principales_clientes: "",
    publico_objetivo: "",
    tono_comunicacion: "profesional",
    valores_marca: "",
    notas: "",
  });
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    supabase.from("client_marca_info").select("*").eq("client_id", clientId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRecordId(data.id);
          setForm({
            historia: data.historia || "",
            propuesta_valor: data.propuesta_valor || "",
            diferenciales: data.diferenciales || "",
            principales_clientes: data.principales_clientes || "",
            publico_objetivo: data.publico_objetivo || "",
            tono_comunicacion: data.tono_comunicacion || "profesional",
            valores_marca: data.valores_marca || "",
            notas: data.notas || "",
          });
        }
        setLoading(false);
      });
  }, [clientId]);

  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const payload = { client_id: clientId, workspace_id: workspaceId, ...form, updated_at: new Date().toISOString() };
    const { error } = recordId
      ? await supabase.from("client_marca_info").update(payload).eq("id", recordId)
      : await supabase.from("client_marca_info").insert(payload).select("id").single().then(async ({ data, error }) => {
          if (data) setRecordId(data.id);
          return { error };
        });
    if (error) toast.error("Error al guardar");
    else toast.success("Información de marca guardada");
    setSaving(false);
  };

  if (loading) return <Skeleton className="h-64" />;

  const tonos = ["profesional", "cercano", "aspiracional", "humorístico", "técnico", "inspirador"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold">Información de Marca</CardTitle>
            {isAdmin && (
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1.5" />{saving ? "Guardando…" : "Guardar todo"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Historia / Origen de la marca</Label>
            <Textarea value={form.historia} onChange={(e) => setF("historia", e.target.value)} disabled={!isAdmin} className="mt-1" rows={3} placeholder="Cuándo y por qué nació la marca…" />
          </div>
          <div>
            <Label className="text-xs">Propuesta de valor</Label>
            <Textarea value={form.propuesta_valor} onChange={(e) => setF("propuesta_valor", e.target.value)} disabled={!isAdmin} className="mt-1" rows={3} placeholder="Qué problema resuelve y por qué elegirnos…" />
          </div>
          <div>
            <Label className="text-xs">Diferenciales clave</Label>
            <Textarea value={form.diferenciales} onChange={(e) => setF("diferenciales", e.target.value)} disabled={!isAdmin} className="mt-1" rows={3} placeholder="Ventajas competitivas principales…" />
          </div>
          <div>
            <Label className="text-xs">Públicoobjetivo</Label>
            <Textarea value={form.publico_objetivo} onChange={(e) => setF("publico_objetivo", e.target.value)} disabled={!isAdmin} className="mt-1" rows={3} placeholder="Demografía, intereses, comportamientos…" />
          </div>
          <div>
            <Label className="text-xs">Principales clientes / casos de éxito</Label>
            <Textarea value={form.principales_clientes} onChange={(e) => setF("principales_clientes", e.target.value)} disabled={!isAdmin} className="mt-1" rows={3} placeholder="Nombres o categorías de clientes top…" />
          </div>
          <div>
            <Label className="text-xs">Valores de marca</Label>
            <Textarea value={form.valores_marca} onChange={(e) => setF("valores_marca", e.target.value)} disabled={!isAdmin} className="mt-1" rows={3} placeholder="Innovación, sustentabilidad, cercanía…" />
          </div>
          <div>
            <Label className="text-xs">Tono de comunicación</Label>
            <Select value={form.tono_comunicacion} onValueChange={(v) => setF("tono_comunicacion", v)} disabled={!isAdmin}>
              <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tonos.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Notas adicionales</Label>
            <Textarea value={form.notas} onChange={(e) => setF("notas", e.target.value)} disabled={!isAdmin} className="mt-1" rows={3} placeholder="Restricciones, guidelines, colores…" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Productos Tab ──
function ClientProductosTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nombre: "", sku: "", categoria: "", precio: "", margen_percent: "", notas: "" });
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const fetchData = async () => {
    const { data } = await supabase.from("client_productos").select("*").eq("client_id", clientId).order("nombre");
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [clientId]);

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
    const { error } = await supabase.from("client_productos").insert({
      client_id: clientId,
      workspace_id: workspaceId,
      nombre_producto: form.nombre.trim(),
      nombre: form.nombre.trim(),
      sku: form.sku || null,
      categoria: form.categoria || null,
      precio: form.precio ? Number(form.precio) : null,
      margen_percent: form.margen_percent ? Number(form.margen_percent) : null,
      notas: form.notas || null,
    });
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Producto agregado");
    setOpen(false);
    setForm({ nombre: "", sku: "", categoria: "", precio: "", margen_percent: "", notas: "" });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("client_productos").delete().eq("id", id);
    fetchData();
    toast.success("Producto eliminado");
  };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
      const rows = lines.slice(1).map((l) => {
        const vals = l.split(",").map((v) => v.trim().replace(/"/g, ""));
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
      }).filter((r) => r.nombre || r.name);

      if (rows.length === 0) { toast.error("No se encontraron filas válidas. Columna requerida: nombre"); return; }

      const inserts = rows.map((r) => ({
        client_id: clientId,
        workspace_id: workspaceId,
        nombre: r.nombre || r.name,
        sku: r.sku || null,
        categoria: r.categoria || r.category || null,
        precio: r.precio || r.price ? Number(r.precio || r.price) : null,
        margen_percent: r.margen_percent || r.margen ? Number(r.margen_percent || r.margen) : null,
        notas: r.notas || r.notes || null,
      }));

      const { error } = await supabase.from("client_productos").insert(inserts);
      if (error) { toast.error("Error al importar CSV"); return; }
      toast.success(`${inserts.length} productos importados`);
      fetchData();
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (loading) return <Skeleton className="h-32" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{items.length} producto(s) registrado(s)</p>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" asChild>
                <span><Upload className="h-3.5 w-3.5" />Importar CSV</span>
              </Button>
              <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={handleCSV} />
            </label>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 text-xs gap-1.5"><Plus className="h-3.5 w-3.5" />Agregar</Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>Agregar Producto</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div>
                    <Label className="text-xs">Nombre <span className="text-destructive">*</span></Label>
                    <Input className="mt-1" value={form.nombre} onChange={(e) => setF("nombre", e.target.value)} placeholder="Ej: Remera básica" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">SKU</Label>
                      <Input className="mt-1 h-8" value={form.sku} onChange={(e) => setF("sku", e.target.value)} placeholder="REM-001" />
                    </div>
                    <div>
                      <Label className="text-xs">Categoría</Label>
                      <Input className="mt-1 h-8" value={form.categoria} onChange={(e) => setF("categoria", e.target.value)} placeholder="Indumentaria" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Precio</Label>
                      <Input className="mt-1 h-8 font-mono" type="number" value={form.precio} onChange={(e) => setF("precio", e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <Label className="text-xs">Margen (%)</Label>
                      <Input className="mt-1 h-8 font-mono" type="number" value={form.margen_percent} onChange={(e) => setF("margen_percent", e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Notas</Label>
                    <Input className="mt-1 h-8" value={form.notas} onChange={(e) => setF("notas", e.target.value)} placeholder="Observaciones…" />
                  </div>
                  <Button className="w-full" onClick={handleSave}>Agregar Producto</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {isAdmin && items.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center space-y-2">
            <Package className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">Sin productos. Agregá manualmente o importá un CSV.</p>
            <p className="text-xs text-muted-foreground/60">Columnas CSV: nombre, sku, categoria, precio, margen_percent, notas</p>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead>Notas</TableHead>
                  {isAdmin && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs font-medium">{item.nombre}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{item.sku || "–"}</TableCell>
                    <TableCell className="text-xs">{item.categoria ? <Badge variant="secondary" className="text-[9px]">{item.categoria}</Badge> : "–"}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums font-mono">{item.precio != null ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(item.precio) : "–"}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{item.margen_percent != null ? `${item.margen_percent}%` : "–"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{item.notas || "–"}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Bitácora + Accionables Tab ──
const ENTRY_TYPES = [
  { value: "nota", label: "Nota", icon: MessageSquare },
  { value: "reunion", label: "Reunión", icon: Video },
  { value: "llamada", label: "Llamada", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "alerta", label: "Alerta", icon: AlertCircle },
];

function ClientBitacoraTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [accionables, setAccionables] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadingAcc, setLoadingAcc] = useState(true);

  // Bitácora form
  const [entryForm, setEntryForm] = useState({ type: "nota", title: "", body: "", author_name: "" });
  const setEF = (k: string, v: string) => setEntryForm((f) => ({ ...f, [k]: v }));

  // Accionables form
  const [accOpen, setAccOpen] = useState(false);
  const [accForm, setAccForm] = useState({ title: "", description: "", assigned_to: "", due_date: "", priority: "media" });
  const setAF = (k: string, v: string) => setAccForm((f) => ({ ...f, [k]: v }));

  const fetchEntries = async () => {
    const { data } = await supabase.from("client_bitacora").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    setEntries(data ?? []);
    setLoadingEntries(false);
  };

  const fetchAccionables = async () => {
    const { data } = await supabase.from("client_accionables").select("*").eq("client_id", clientId).order("due_date", { ascending: true }).order("created_at", { ascending: false });
    setAccionables(data ?? []);
    setLoadingAcc(false);
  };

  useEffect(() => { fetchEntries(); fetchAccionables(); }, [clientId]);

  const addEntry = async () => {
    if (!entryForm.body.trim()) { toast.error("El cuerpo es requerido"); return; }
    const { error } = await supabase.from("client_bitacora").insert({
      client_id: clientId, workspace_id: workspaceId,
      type: entryForm.type, title: entryForm.title || null,
      body: entryForm.body, author_name: entryForm.author_name || null,
    });
    if (error) { toast.error("Error al guardar"); return; }
    setEntryForm({ type: "nota", title: "", body: "", author_name: "" });
    fetchEntries();
    toast.success("Entrada agregada");
  };

  const deleteEntry = async (id: string) => {
    await supabase.from("client_bitacora").delete().eq("id", id);
    fetchEntries();
  };

  const addAccionable = async () => {
    if (!accForm.title.trim()) { toast.error("El título es requerido"); return; }
    const { error } = await supabase.from("client_accionables").insert({
      client_id: clientId, workspace_id: workspaceId,
      title: accForm.title, description: accForm.description || null,
      assigned_to: accForm.assigned_to || null,
      due_date: accForm.due_date || null,
      priority: accForm.priority, status: "pendiente",
    });
    if (error) { toast.error("Error al guardar"); return; }
    setAccOpen(false);
    setAccForm({ title: "", description: "", assigned_to: "", due_date: "", priority: "media" });
    fetchAccionables();
    toast.success("Accionable agregado");
  };

  const updateAccStatus = async (id: string, status: string) => {
    await supabase.from("client_accionables").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    fetchAccionables();
  };

  const deleteAcc = async (id: string) => {
    await supabase.from("client_accionables").delete().eq("id", id);
    fetchAccionables();
  };

  const prioColor = (p: string) => p === "alta" ? "bg-destructive/10 text-destructive border-destructive/30" : p === "baja" ? "bg-muted text-muted-foreground" : "bg-warning/10 text-warning border-warning/30";
  const statusColor = (s: string) => s === "completado" ? "text-success" : s === "en_progreso" ? "text-warning" : "text-muted-foreground";
  const entryTypeInfo = (type: string) => ENTRY_TYPES.find((t) => t.value === type) ?? ENTRY_TYPES[0];

  const pendingAcc = accionables.filter((a) => a.status !== "completado");
  const doneAcc = accionables.filter((a) => a.status === "completado");

  return (
    <div className="space-y-6">
      {/* ── Accionables ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            Accionables
            {pendingAcc.length > 0 && (
              <Badge variant="secondary" className="text-[9px] bg-warning/10 text-warning">{pendingAcc.length} pendiente(s)</Badge>
            )}
          </h3>
          {isAdmin && (
            <Dialog open={accOpen} onOpenChange={setAccOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"><Plus className="h-3.5 w-3.5" />Nuevo</Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>Nuevo Accionable</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div>
                    <Label className="text-xs">Título <span className="text-destructive">*</span></Label>
                    <Input className="mt-1" value={accForm.title} onChange={(e) => setAF("title", e.target.value)} placeholder="Qué hay que hacer…" />
                  </div>
                  <div>
                    <Label className="text-xs">Descripción</Label>
                    <Textarea className="mt-1" rows={2} value={accForm.description} onChange={(e) => setAF("description", e.target.value)} placeholder="Detalle…" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Asignado a</Label>
                      <Input className="mt-1 h-8" value={accForm.assigned_to} onChange={(e) => setAF("assigned_to", e.target.value)} placeholder="Nombre…" />
                    </div>
                    <div>
                      <Label className="text-xs">Fecha límite</Label>
                      <Input type="date" className="mt-1 h-8 text-xs" value={accForm.due_date} onChange={(e) => setAF("due_date", e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Prioridad</Label>
                    <Select value={accForm.priority} onValueChange={(v) => setAF("priority", v)}>
                      <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="media">Media</SelectItem>
                        <SelectItem value="baja">Baja</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={addAccionable}>Agregar</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loadingAcc ? <Skeleton className="h-20" /> : (
          <div className="space-y-2">
            {pendingAcc.length === 0 && <p className="text-xs text-muted-foreground py-2">Sin accionables pendientes.</p>}
            {[...pendingAcc, ...doneAcc].map((a) => (
              <div key={a.id} className={cn("flex items-start gap-3 p-3 rounded-lg border bg-card", a.status === "completado" && "opacity-50")}>
                <button onClick={() => updateAccStatus(a.id, a.status === "completado" ? "pendiente" : "completado")} className="mt-0.5 shrink-0">
                  <CheckSquare className={cn("h-4 w-4", a.status === "completado" ? "text-success" : "text-muted-foreground/30 hover:text-muted-foreground")} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-xs font-medium", a.status === "completado" && "line-through text-muted-foreground")}>{a.title}</span>
                    <Badge variant="outline" className={cn("text-[9px] h-4 px-1", prioColor(a.priority))}>{a.priority}</Badge>
                    {a.status === "en_progreso" && <Badge variant="outline" className="text-[9px] h-4 px-1 text-warning border-warning/30">En progreso</Badge>}
                  </div>
                  {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    {a.assigned_to && <span>👤 {a.assigned_to}</span>}
                    {a.due_date && (
                      <span className={cn("flex items-center gap-1", new Date(a.due_date) < new Date() && a.status !== "completado" && "text-destructive font-medium")}>
                        <Clock className="h-3 w-3" />
                        {format(new Date(a.due_date), "dd MMM yyyy", { locale: es })}
                        {new Date(a.due_date) < new Date() && a.status !== "completado" && " ⚠️"}
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    {a.status === "pendiente" && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => updateAccStatus(a.id, "en_progreso")}>WIP</Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteAcc(a.id)}>
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t" />

      {/* ── Bitácora ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Bitácora
        </h3>

        {/* New entry form */}
        {isAdmin && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Select value={entryForm.type} onValueChange={(v) => setEF("type", v)}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="flex-1 h-8 text-xs" placeholder="Título (opcional)" value={entryForm.title} onChange={(e) => setEF("title", e.target.value)} />
                <Input className="w-28 h-8 text-xs" placeholder="Autor" value={entryForm.author_name} onChange={(e) => setEF("author_name", e.target.value)} />
              </div>
              <Textarea
                placeholder="Descripción, acuerdos, observaciones…"
                rows={2}
                value={entryForm.body}
                onChange={(e) => setEF("body", e.target.value)}
                className="text-xs"
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={addEntry} className="h-7 text-xs">Agregar entrada</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        {loadingEntries ? <Skeleton className="h-32" /> : (
          <div className="space-y-2">
            {entries.length === 0 && <p className="text-xs text-muted-foreground py-2">Sin entradas en la bitácora.</p>}
            {entries.map((entry) => {
              const typeInfo = entryTypeInfo(entry.type);
              const Icon = typeInfo.icon;
              return (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="w-px flex-1 bg-border mt-1" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[9px] h-4">{typeInfo.label}</Badge>
                          {entry.title && <span className="text-xs font-semibold">{entry.title}</span>}
                          {entry.author_name && <span className="text-[10px] text-muted-foreground">por {entry.author_name}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{entry.body}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {format(new Date(entry.created_at), "dd MMM yyyy · HH:mm", { locale: es })}
                        </p>
                      </div>
                      {isAdmin && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => deleteEntry(entry.id)}>
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Onboarding Checklist Tab ──
const DEFAULT_CHECKLIST = [
  { title: "Acceso Google Ads", category: "accesos", priority: "alta" },
  { title: "Acceso Meta Business", category: "accesos", priority: "alta" },
  { title: "Acceso GA4", category: "accesos", priority: "alta" },
  { title: "Acceso GTM", category: "accesos", priority: "media" },
  { title: "Acceso MercadoLibre", category: "accesos", priority: "media" },
  { title: "Excel / Feed de Productos", category: "info_cliente", priority: "alta" },
  { title: "Análisis de Competidores", category: "info_cliente", priority: "media" },
  { title: "Brief de Marca", category: "info_cliente", priority: "alta" },
  { title: "Margen Promedio", category: "info_cliente", priority: "alta" },
  { title: "Objetivo de Facturación", category: "info_cliente", priority: "alta" },
];

function ClientOnboardingTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pendiente" | "en_progreso" | "completado">("all");
  const [evidenceDialogId, setEvidenceDialogId] = useState<string | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState("");

  const fetchData = async () => {
    const { data } = await supabase
      .from("onboarding_checklist")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at");
    const fetched = data ?? [];

    if (fetched.length === 0) {
      const { error } = await supabase.from("onboarding_checklist").insert(
        DEFAULT_CHECKLIST.map((item) => ({
          client_id: clientId,
          workspace_id: workspaceId,
          item: item.title,
          categoria: item.category,
          category: item.category,
          title: item.title,
          prioridad: item.priority,
          estado: "pendiente",
        }))
      );
      if (!error) {
        const { data: newData } = await supabase
          .from("onboarding_checklist")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at");
        setItems(newData ?? []);
      }
    } else {
      setItems(fetched);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [clientId]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("onboarding_checklist").update({
      status,
      completed_at: status === "completado" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    fetchData();
  };

  const saveEvidence = async () => {
    if (!evidenceDialogId) return;
    await supabase.from("onboarding_checklist").update({
      evidence_url: evidenceUrl,
      updated_at: new Date().toISOString(),
    }).eq("id", evidenceDialogId);
    setEvidenceDialogId(null);
    setEvidenceUrl("");
    fetchData();
    toast.success("Evidencia guardada");
  };

  const visibleItems = filter === "all" ? items : items.filter((i) => i.status === filter);
  const completed = items.filter((i) => i.status === "completado").length;
  const progress = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

  const statusColor = (status: string) => {
    if (status === "completado") return "bg-success/10 text-success border-success/30";
    if (status === "en_progreso") return "bg-warning/10 text-warning border-warning/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const priorityColor = (priority: string) => {
    if (priority === "alta") return "bg-destructive/10 text-destructive border-destructive/30";
    if (priority === "media") return "bg-warning/10 text-warning border-warning/30";
    return "bg-muted text-muted-foreground";
  };

  if (loading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Progreso de Onboarding</span>
            <span className="text-xs font-bold text-primary">{progress}% ({completed}/{items.length})</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-success" : "bg-primary")}
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-1.5">
        {(["all", "pendiente", "en_progreso", "completado"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "secondary" : "ghost"}
            className="h-7 px-2.5 text-xs"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Todos" : f === "en_progreso" ? "En Progreso" : f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Items */}
      <div className="space-y-2">
        {visibleItems.map((item) => (
          <Card key={item.id} className={cn("border", item.status === "completado" && "opacity-60")}>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <button
                  className="mt-0.5 shrink-0"
                  onClick={() => updateStatus(item.id, item.status === "completado" ? "pendiente" : "completado")}
                >
                  <CheckSquare className={cn("h-4 w-4 transition-colors", item.status === "completado" ? "text-success" : "text-muted-foreground/30 hover:text-muted-foreground")} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-sm font-medium", item.status === "completado" && "line-through text-muted-foreground")}>
                      {item.title}
                    </span>
                    <Badge variant="outline" className={cn("text-[9px] h-4 px-1", priorityColor(item.priority))}>
                      {item.priority}
                    </Badge>
                    <Badge variant="outline" className={cn("text-[9px] h-4 px-1", statusColor(item.status))}>
                      {item.status === "en_progreso" ? "En Progreso" : item.status}
                    </Badge>
                  </div>
                  {item.evidence_url && (
                    <a href={item.evidence_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                      <ExternalLink className="h-2.5 w-2.5" /> Ver evidencia
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.status === "pendiente" && isAdmin && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => updateStatus(item.id, "en_progreso")}>
                      En progreso
                    </Button>
                  )}
                  {isAdmin && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEvidenceDialogId(item.id); setEvidenceUrl(item.evidence_url ?? ""); }}>
                      <Link2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Evidence Dialog */}
      <Dialog open={!!evidenceDialogId} onOpenChange={(o) => { if (!o) { setEvidenceDialogId(null); setEvidenceUrl(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Agregar Evidencia</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Label className="text-xs">URL de evidencia (Drive, Notion, screenshot…)</Label>
            <Input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://…" onKeyDown={(e) => { if (e.key === "Enter") saveEvidence(); }} />
            <Button className="w-full" onClick={saveEvidence}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Accesos Tab ──
const ACCESO_PLATFORMS = ["Google Ads", "Meta Business", "GA4", "GTM", "MercadoLibre", "Shopify", "CRM", "Email Marketing", "Analytics", "Otro"];

function ClientAccesosTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newPlatform, setNewPlatform] = useState("Google Ads");
  const [newNotes, setNewNotes] = useState("");

  const fetchData = async () => {
    const { data } = await supabase
      .from("client_accesos")
      .select("*")
      .eq("client_id", clientId)
      .order("platform");
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [clientId]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("client_accesos").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    fetchData();
  };

  const handleAdd = async () => {
    const { error } = await supabase.from("client_accesos").insert({
      client_id: clientId,
      workspace_id: workspaceId,
      plataforma: newPlatform,
      notes: newNotes || null,
      estado: "pendiente",
    });
    if (error) { toast.error("Error al agregar acceso"); return; }
    setAdding(false);
    setNewPlatform("Google Ads");
    setNewNotes("");
    fetchData();
    toast.success("Acceso agregado");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("client_accesos").delete().eq("id", id);
    fetchData();
  };

  const statusDot = (status: string) => {
    if (status === "aprobado") return "bg-success";
    if (status === "en_proceso") return "bg-warning";
    return "bg-destructive";
  };

  if (loading) return <Skeleton className="h-32" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive inline-block" /> Pendiente</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning inline-block" /> En proceso</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success inline-block" /> Aprobado</span>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />Agregar
          </Button>
        )}
      </div>

      {adding && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Plataforma</Label>
                <Select value={newPlatform} onValueChange={setNewPlatform}>
                  <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCESO_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Notas</Label>
                <Input className="mt-1 h-8" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Ej: cuenta manager" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAdd}>Agregar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No hay accesos registrados.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                  {isAdmin && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full shrink-0", statusDot(item.status))} />
                        {item.platform}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select value={item.status} onValueChange={(v) => updateStatus(item.id, v)}>
                          <SelectTrigger className="h-7 text-[10px] w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendiente">Pendiente</SelectItem>
                            <SelectItem value="en_proceso">En proceso</SelectItem>
                            <SelectItem value="aprobado">Aprobado</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="text-[9px]">{item.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.notes || "–"}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Client Dashboard Link ── */}
      <ClientDashboardLinkSection clientId={clientId} workspaceId={workspaceId} isAdmin={isAdmin} />
    </div>
  );
}

// ── Client Dashboard Link Section ──
function ClientDashboardLinkSection({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTokens = async () => {
    const { data } = await supabase
      .from("client_access_tokens")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setTokens(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTokens(); }, [clientId]);

  const handleCreate = async () => {
    setCreating(true);
    const { error } = await supabase.from("client_access_tokens").insert({
      client_id: clientId,
      workspace_id: workspaceId,
      label: newLabel.trim() || null,
      active: true,
    });
    if (error) { toast.error("Error al crear el link"); }
    else { toast.success("Link creado"); setNewLabel(""); fetchTokens(); }
    setCreating(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("client_access_tokens").update({ active }).eq("id", id);
    fetchTokens();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("client_access_tokens").delete().eq("id", id);
    fetchTokens();
  };

  const copyLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/c/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Dashboard para el cliente
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Links para que el cliente vea sus métricas sin necesitar login
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Skeleton className="h-12" />
        ) : (
          <>
            {tokens.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No hay links generados aún
              </p>
            )}
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{t.label || "Link de acceso"}</p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                    {window.location.origin}/c/{t.token}
                  </p>
                  {t.last_accessed_at && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Último acceso: {format(new Date(t.last_accessed_at), "d MMM yyyy HH:mm", { locale: es })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!t.active && <Badge variant="secondary" className="text-[9px]">Inactivo</Badge>}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] gap-1 px-2"
                    onClick={() => copyLink(t.token, t.id)}
                  >
                    {copiedId === t.id
                      ? <><CheckSquare className="h-3 w-3 text-success" /> Copiado</>
                      : <><KeyRound className="h-3 w-3" /> Copiar link</>
                    }
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] px-2"
                    onClick={() => window.open(`/c/${t.token}`, "_blank")}
                  >
                    Ver
                  </Button>
                  {isAdmin && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] px-2 text-muted-foreground"
                        onClick={() => toggleActive(t.id, !t.active)}
                      >
                        {t.active ? "Pausar" : "Activar"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {isAdmin && (
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder="Etiqueta (ej: Link para CEO)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="text-xs h-8 flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <Button size="sm" className="h-8 text-xs gap-1" onClick={handleCreate} disabled={creating}>
                  <Plus className="h-3 w-3" />
                  {creating ? "..." : "Generar link"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Client Balance Loads Tab ──
function ClientBalanceLoadsTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ platform: "google_ads", amount: "", currency: "ARS", load_date: format(new Date(), "yyyy-MM-dd"), status: "pendiente", notes: "" });
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const fetchData = async () => {
    const { data } = await supabase.from("balance_loads").select("*").eq("client_id", clientId).order("load_date", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [clientId]);

  const handleSave = async () => {
    if (!form.amount) { toast.error("Ingresá el monto"); return; }
    const { error } = await supabase.from("balance_loads").insert({
      workspace_id: workspaceId, client_id: clientId,
      platform: form.platform, amount: parseFloat(form.amount.replace(/\./g, "").replace(",", ".")),
      currency: form.currency, load_date: form.load_date, status: form.status, notes: form.notes || null,
    });
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Carga registrada");
    setOpen(false);
    setForm({ platform: "google_ads", amount: "", currency: "ARS", load_date: format(new Date(), "yyyy-MM-dd"), status: "pendiente", notes: "" });
    fetchData();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("balance_loads").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("balance_loads").delete().eq("id", id);
    fetchData();
    toast.success("Eliminado");
  };

  const statusColor = (s: string) => s === "acreditado" ? "bg-success/10 text-success border-success/30" : s === "rechazado" ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-warning/10 text-warning border-warning/30";
  const platformLabel = (p: string) => ({ google_ads: "Google Ads", meta: "Meta Ads" })[p] ?? p;

  if (loading) return <Skeleton className="h-32" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{items.filter((i) => i.status === "pendiente").length} carga(s) pendiente(s)</p>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5"><Plus className="h-3.5 w-3.5" />Nueva Carga</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Registrar Carga de Saldo</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Plataforma</Label>
                    <Select value={form.platform} onValueChange={(v) => setF("platform", v)}>
                      <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google_ads">Google Ads</SelectItem>
                        <SelectItem value="meta">Meta Ads</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Estado</Label>
                    <Select value={form.status} onValueChange={(v) => setF("status", v)}>
                      <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="acreditado">Acreditado</SelectItem>
                        <SelectItem value="rechazado">Rechazado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Monto</Label>
                    <Input className="mt-1 h-8 font-mono" placeholder="1.000.000" value={form.amount} onChange={(e) => setF("amount", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Moneda</Label>
                    <Select value={form.currency} onValueChange={(v) => setF("currency", v)}>
                      <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["ARS", "USD", "MXN", "BRL"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Fecha</Label>
                  <Input type="date" className="mt-1 h-8 text-xs" value={form.load_date} onChange={(e) => setF("load_date", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Notas</Label>
                  <Input className="mt-1 h-8 text-xs" placeholder="Referencia de transferencia…" value={form.notes} onChange={(e) => setF("notes", e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleSave}>Guardar</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sin cargas registradas.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                  {isAdmin && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">{format(new Date(item.load_date), "dd MMM yyyy", { locale: es })}</TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-[9px]", item.platform === "google_ads" ? "border-blue-200 text-blue-700" : "border-blue-300 text-blue-600")}>{platformLabel(item.platform)}</Badge></TableCell>
                    <TableCell className="text-xs text-right tabular-nums font-mono font-medium">{new Intl.NumberFormat("es-AR", { style: "currency", currency: item.currency, minimumFractionDigits: 0 }).format(item.amount)}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select value={item.status} onValueChange={(v) => updateStatus(item.id, v)}>
                          <SelectTrigger className="h-6 w-28 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendiente">Pendiente</SelectItem>
                            <SelectItem value="acreditado">Acreditado</SelectItem>
                            <SelectItem value="rechazado">Rechazado</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={cn("text-[9px]", statusColor(item.status))}>{item.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{item.notes || "–"}</TableCell>
                    {isAdmin && <TableCell><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(item.id)}><Trash2 className="h-3 w-3 text-muted-foreground" /></Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Client Invoices Tab ──
function ClientInvoicesTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invoice_number: "", concept: "", amount_net: "", amount_total: "", currency: "ARS", period: "", status: "borrador", due_date: "", notes: "" });
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const fetchData = async () => {
    const { data } = await supabase.from("client_invoices").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [clientId]);

  const handleSave = async () => {
    const { error } = await supabase.from("client_invoices").insert({
      workspace_id: workspaceId, client_id: clientId,
      invoice_number: form.invoice_number || null, concept: form.concept || null,
      amount_net: form.amount_net ? parseFloat(form.amount_net.replace(/\./g, "").replace(",", ".")) : null,
      amount_total: form.amount_total ? parseFloat(form.amount_total.replace(/\./g, "").replace(",", ".")) : null,
      currency: form.currency, period: form.period || null, status: form.status,
      due_date: form.due_date || null, notes: form.notes || null,
    });
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Factura registrada");
    setOpen(false);
    setForm({ invoice_number: "", concept: "", amount_net: "", amount_total: "", currency: "ARS", period: "", status: "borrador", due_date: "", notes: "" });
    fetchData();
  };

  const updateStatus = async (id: string, status: string) => {
    const update: any = { status, updated_at: new Date().toISOString() };
    if (status === "enviada") update.sent_at = new Date().toISOString();
    await supabase.from("client_invoices").update(update).eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("client_invoices").delete().eq("id", id);
    fetchData();
    toast.success("Eliminado");
  };

  const statusColor = (s: string) => s === "cobrada" ? "bg-success/10 text-success border-success/30" : s === "enviada" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-muted text-muted-foreground border-border";

  if (loading) return <Skeleton className="h-32" />;

  const pending = items.filter((i) => i.status !== "cobrada");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{pending.length} factura(s) sin cobrar</p>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5"><Plus className="h-3.5 w-3.5" />Nueva Factura</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Registrar Factura</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">N° Factura</Label>
                    <Input className="mt-1 h-8 text-xs" placeholder="0001-00001234" value={form.invoice_number} onChange={(e) => setF("invoice_number", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Período</Label>
                    <Input className="mt-1 h-8 text-xs" placeholder="Marzo 2025" value={form.period} onChange={(e) => setF("period", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Concepto</Label>
                  <Input className="mt-1 h-8 text-xs" placeholder="Servicios de publicidad digital…" value={form.concept} onChange={(e) => setF("concept", e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Monto neto</Label>
                    <Input className="mt-1 h-8 font-mono text-xs" placeholder="0" value={form.amount_net} onChange={(e) => setF("amount_net", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Total c/imp.</Label>
                    <Input className="mt-1 h-8 font-mono text-xs" placeholder="0" value={form.amount_total} onChange={(e) => setF("amount_total", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Moneda</Label>
                    <Select value={form.currency} onValueChange={(v) => setF("currency", v)}>
                      <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{["ARS", "USD", "MXN", "BRL"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Estado</Label>
                    <Select value={form.status} onValueChange={(v) => setF("status", v)}>
                      <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="borrador">Borrador</SelectItem>
                        <SelectItem value="enviada">Enviada</SelectItem>
                        <SelectItem value="cobrada">Cobrada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Vencimiento</Label>
                    <Input type="date" className="mt-1 h-8 text-xs" value={form.due_date} onChange={(e) => setF("due_date", e.target.value)} />
                  </div>
                </div>
                <Button className="w-full" onClick={handleSave}>Guardar Factura</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sin facturas registradas.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Vto.</TableHead>
                  <TableHead>Estado</TableHead>
                  {isAdmin && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const overdue = item.due_date && new Date(item.due_date) < new Date() && item.status !== "cobrada";
                  return (
                    <TableRow key={item.id} className={cn(overdue && "bg-destructive/5")}>
                      <TableCell className="text-xs font-mono font-medium">{item.invoice_number || "–"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.period || item.concept || "–"}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums font-mono">{item.amount_total ? new Intl.NumberFormat("es-AR", { style: "currency", currency: item.currency, minimumFractionDigits: 0 }).format(item.amount_total) : "–"}</TableCell>
                      <TableCell className={cn("text-xs tabular-nums whitespace-nowrap", overdue && "text-destructive font-medium")}>
                        {item.due_date ? format(new Date(item.due_date), "dd MMM", { locale: es }) : "–"}{overdue && " ⚠️"}
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Select value={item.status} onValueChange={(v) => updateStatus(item.id, v)}>
                            <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="borrador">Borrador</SelectItem>
                              <SelectItem value="enviada">Enviada</SelectItem>
                              <SelectItem value="cobrada">Cobrada</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={cn("text-[9px]", statusColor(item.status))}>{item.status}</Badge>
                        )}
                      </TableCell>
                      {isAdmin && <TableCell><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(item.id)}><Trash2 className="h-3 w-3 text-muted-foreground" /></Button></TableCell>}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Vault Tab ──
function ClientVaultTab({ clientId, workspaceId, isAdmin }: { clientId: string; workspaceId: string; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const { data } = await supabase.from("client_access_vault").select("*").eq("client_id", clientId).order("system_name");
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [clientId]);

  const handleAdd = async () => {
    await supabase.from("client_access_vault").insert({ client_id: clientId, workspace_id: workspaceId, system_name: "Nuevo Sistema" });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("client_access_vault").delete().eq("id", id);
    fetchData();
  };

  if (loading) return <Skeleton className="h-32" />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Referencias a accesos (sin passwords). Usá un vault externo (1Password, Bitwarden) para credenciales.</p>
      {isAdmin && (
        <Button size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />Agregar Acceso
        </Button>
      )}
      {items.length === 0 && <p className="text-sm text-muted-foreground">No hay accesos registrados.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((v) => (
          <Card key={v.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{v.system_name}</p>
                  {v.username_or_email && <p className="text-xs text-muted-foreground mt-1">{v.username_or_email}</p>}
                  {v.vault_link && (
                    <a href={v.vault_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                      Abrir en Vault <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
                {isAdmin && (
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(v.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
