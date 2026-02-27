import { useState, useEffect } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
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
  Unlink,
} from "lucide-react";
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
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" />Datos
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
        </TabsList>

        <TabsContent value="overview">
          <ClientOverviewTab client={selectedClient} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} refetch={refetch} />
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
        <TabsContent value="personas">
          <ClientPersonasTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="competitors">
          <ClientCompetitorsTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="vault">
          <ClientVaultTab clientId={selectedClient.id} workspaceId={currentWorkspace!.id} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Overview Tab ──
function ClientOverviewTab({ client, workspaceId, isAdmin, refetch }: { client: any; workspaceId: string; isAdmin: boolean; refetch: () => void }) {
  const [name, setName] = useState(client.name);
  const [website, setWebsite] = useState(client.website_url || "");
  const [notes, setNotes] = useState(client.notes || "");
  const [saving, setSaving] = useState(false);
  const [accountSettings, setAccountSettings] = useState<any[]>([]);

  useEffect(() => {
    setName(client.name);
    setWebsite(client.website_url || "");
    setNotes(client.notes || "");
  }, [client]);

  useEffect(() => {
    supabase
      .from("client_account_settings")
      .select("*")
      .eq("client_id", client.id)
      .eq("is_enabled", true)
      .then(({ data }) => setAccountSettings(data ?? []));
  }, [client.id]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({ name, website_url: website || null, notes: notes || null, updated_at: new Date().toISOString() })
      .eq("id", client.id);
    if (error) toast.error("Error al guardar");
    else {
      toast.success("Cliente actualizado");
      refetch();
    }
    setSaving(false);
  };

  const platformCounts = accountSettings.reduce<Record<string, number>>((acc, s) => {
    acc[s.platform] = (acc[s.platform] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Información General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} disabled={!isAdmin} className="mt-1" placeholder="https://..." />
          </div>
          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!isAdmin} className="mt-1" rows={3} placeholder="Notas sobre el cliente..." />
          </div>
          {isAdmin && (
            <div className="pt-2 flex justify-end">
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
