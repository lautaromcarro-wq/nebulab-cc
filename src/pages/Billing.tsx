import { useState, useEffect } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import SectionHeader from "@/components/SectionHeader";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Calculator,
  Copy,
  Check,
  CreditCard,
  FileText,
  Plus,
  Trash2,
  Send,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Formatters ──
const fmtARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtNum = (n: number) =>
  new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

// ── Google Ads Calculator ──
function GoogleAdsCalc() {
  const [net, setNet] = useState("");
  const [copied, setCopied] = useState(false);

  const netVal = parseFloat(net.replace(/\./g, "").replace(",", ".")) || 0;
  const iva = netVal * 0.21;
  const iibb = netVal * 0.05;
  const total = netVal + iva + iibb;

  const message = netVal > 0
    ? `💰 Carga Google Ads\n\n• Inversión neta en plataforma: ${fmtARS(netVal)}\n• IVA (21%): ${fmtARS(iva)}\n• IIBB (5%): ${fmtARS(iibb)}\n${"─".repeat(32)}\n✅ Total a abonar: ${fmtARS(total)}`
    : "";

  const handleCopy = () => {
    if (!message) return;
    navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success("Mensaje copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Inversión neta en plataforma (ARS)</Label>
        <Input
          className="mt-1 text-lg font-mono"
          placeholder="1.000.000"
          value={net}
          onChange={(e) => setNet(e.target.value)}
        />
      </div>

      {netVal > 0 && (
        <div className="space-y-3">
          {/* Breakdown */}
          <div className="rounded-lg border bg-muted/30 divide-y">
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Inversión neta</span>
              <span className="text-sm font-mono font-medium">{fmtARS(netVal)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-sm text-muted-foreground">IVA (21%)</span>
              <span className="text-sm font-mono text-orange-600">+ {fmtARS(iva)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-sm text-muted-foreground">IIBB (5%)</span>
              <span className="text-sm font-mono text-orange-600">+ {fmtARS(iibb)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 bg-primary/5 rounded-b-lg">
              <span className="text-sm font-bold">Total a abonar</span>
              <span className="text-base font-bold font-mono text-primary">{fmtARS(total)}</span>
            </div>
          </div>

          {/* Message preview */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Mensaje para el cliente</Label>
            <pre className="text-xs font-mono bg-muted/50 rounded-lg p-3 whitespace-pre-wrap border leading-relaxed">
              {message}
            </pre>
          </div>

          <Button className="w-full gap-2" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "¡Copiado!" : "Copiar mensaje"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Meta Ads Calculator ──
function MetaAdsCalc() {
  const [net, setNet] = useState("");
  const [feePercent, setFeePercent] = useState("30");
  const [copied, setCopied] = useState(false);

  const netVal = parseFloat(net.replace(/\./g, "").replace(",", ".")) || 0;
  const feeRate = (parseFloat(feePercent) || 0) / 100;
  const fee = netVal * feeRate;
  const subtotal = netVal + fee;
  const iva = subtotal * 0.21;
  const total = subtotal + iva;

  const message = netVal > 0
    ? `💰 Carga Meta Ads\n\n• Inversión neta en plataforma: ${fmtARS(netVal)}\n• Fee de gestión (${feePercent}%): ${fmtARS(fee)}\n• IVA (21%): ${fmtARS(iva)}\n${"─".repeat(32)}\n✅ Total a abonar: ${fmtARS(total)}`
    : "";

  const handleCopy = () => {
    if (!message) return;
    navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success("Mensaje copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Inversión neta en plataforma (ARS)</Label>
          <Input
            className="mt-1 text-lg font-mono"
            placeholder="1.000.000"
            value={net}
            onChange={(e) => setNet(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Fee gestión (%)</Label>
          <Input
            className="mt-1 text-center font-mono"
            type="number"
            min={0}
            max={100}
            value={feePercent}
            onChange={(e) => setFeePercent(e.target.value)}
          />
        </div>
      </div>

      {netVal > 0 && (
        <div className="space-y-3">
          {/* Breakdown */}
          <div className="rounded-lg border bg-muted/30 divide-y">
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Inversión neta</span>
              <span className="text-sm font-mono font-medium">{fmtARS(netVal)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Fee gestión ({feePercent}%)</span>
              <span className="text-sm font-mono text-blue-600">+ {fmtARS(fee)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-sm text-muted-foreground">IVA 21% sobre {fmtARS(subtotal)}</span>
              <span className="text-sm font-mono text-orange-600">+ {fmtARS(iva)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 bg-primary/5 rounded-b-lg">
              <span className="text-sm font-bold">Total a abonar</span>
              <span className="text-base font-bold font-mono text-primary">{fmtARS(total)}</span>
            </div>
          </div>

          {/* Message preview */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Mensaje para el cliente</Label>
            <pre className="text-xs font-mono bg-muted/50 rounded-lg p-3 whitespace-pre-wrap border leading-relaxed">
              {message}
            </pre>
          </div>

          <Button className="w-full gap-2" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "¡Copiado!" : "Copiar mensaje"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Balance Loads Tab ──
function BalanceLoadsTab({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const { clients } = useClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Form state
  const [form, setForm] = useState({
    client_id: "",
    platform: "google_ads",
    amount: "",
    currency: "ARS",
    load_date: format(new Date(), "yyyy-MM-dd"),
    status: "pendiente",
    notes: "",
  });

  const fetchData = async () => {
    let q = supabase
      .from("balance_loads")
      .select("*, clients(name)")
      .eq("workspace_id", workspaceId)
      .order("load_date", { ascending: false });
    const { data } = await q;
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [workspaceId]);

  const handleSave = async () => {
    if (!form.client_id || !form.amount) { toast.error("Completá cliente y monto"); return; }
    const { error } = await supabase.from("balance_loads").insert({
      workspace_id: workspaceId,
      client_id: form.client_id,
      platform: form.platform,
      amount: parseFloat(form.amount.replace(/\./g, "").replace(",", ".")),
      currency: form.currency,
      load_date: form.load_date,
      status: form.status,
      notes: form.notes || null,
    });
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Carga registrada");
    setOpen(false);
    setForm({ client_id: "", platform: "google_ads", amount: "", currency: "ARS", load_date: format(new Date(), "yyyy-MM-dd"), status: "pendiente", notes: "" });
    fetchData();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("balance_loads").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("balance_loads").delete().eq("id", id);
    fetchData();
    toast.success("Registro eliminado");
  };

  const visible = items.filter((i) => {
    if (filterClient !== "all" && i.client_id !== filterClient) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    return true;
  });

  const statusBadge = (s: string) => {
    if (s === "acreditado") return "bg-success/10 text-success border-success/30";
    if (s === "rechazado") return "bg-destructive/10 text-destructive border-destructive/30";
    return "bg-warning/10 text-warning border-warning/30";
  };

  const platformLabel = (p: string) => ({ google_ads: "Google Ads", meta: "Meta Ads" })[p] ?? p;

  if (loading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="acreditado">Acreditado</SelectItem>
              <SelectItem value="rechazado">Rechazado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" />Nueva Carga
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Registrar Carga de Saldo</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Cliente <span className="text-destructive">*</span></Label>
                    <Select value={form.client_id} onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}>
                      <SelectTrigger className="mt-1 text-xs h-8"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Plataforma</Label>
                    <Select value={form.platform} onValueChange={(v) => setForm((f) => ({ ...f, platform: v }))}>
                      <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google_ads">Google Ads</SelectItem>
                        <SelectItem value="meta">Meta Ads</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Monto <span className="text-destructive">*</span></Label>
                    <Input className="mt-1 h-8 font-mono" placeholder="1.000.000" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Moneda</Label>
                    <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                      <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["ARS", "USD", "MXN", "BRL"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Fecha</Label>
                    <Input type="date" className="mt-1 h-8 text-xs" value={form.load_date} onChange={(e) => setForm((f) => ({ ...f, load_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Estado</Label>
                    <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                      <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="acreditado">Acreditado</SelectItem>
                        <SelectItem value="rechazado">Rechazado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notas</Label>
                  <Textarea className="mt-1 text-xs" rows={2} placeholder="Ej: transferencia enviada a las 14hs…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
                <Button className="w-full" onClick={handleSave}>Guardar Carga</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Sin cargas registradas.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                  {isAdmin && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      {format(new Date(item.load_date), "dd MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="text-xs font-medium">{item.clients?.name ?? "–"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[9px]", item.platform === "google_ads" ? "border-blue-200 text-blue-700" : "border-[#1877F2]/30 text-[#1877F2]")}>
                        {platformLabel(item.platform)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums font-mono font-medium">
                      {new Intl.NumberFormat("es-AR", { style: "currency", currency: item.currency, minimumFractionDigits: 0 }).format(item.amount)}
                    </TableCell>
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
                        <Badge variant="outline" className={cn("text-[9px]", statusBadge(item.status))}>{item.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{item.notes || "–"}</TableCell>
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
    </div>
  );
}

// ── Invoices Tab ──
function InvoicesTab({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const { clients } = useClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [form, setForm] = useState({
    client_id: "",
    invoice_number: "",
    concept: "",
    amount_net: "",
    amount_total: "",
    currency: "ARS",
    period: "",
    status: "borrador",
    due_date: "",
    notes: "",
  });

  const fetchData = async () => {
    const { data } = await supabase
      .from("client_invoices")
      .select("*, clients(name)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [workspaceId]);

  const handleSave = async () => {
    if (!form.client_id) { toast.error("Seleccioná un cliente"); return; }
    const { error } = await supabase.from("client_invoices").insert({
      workspace_id: workspaceId,
      client_id: form.client_id,
      invoice_number: form.invoice_number || null,
      concept: form.concept || null,
      amount_net: form.amount_net ? parseFloat(form.amount_net.replace(/\./g, "").replace(",", ".")) : null,
      amount_total: form.amount_total ? parseFloat(form.amount_total.replace(/\./g, "").replace(",", ".")) : null,
      currency: form.currency,
      period: form.period || null,
      status: form.status,
      due_date: form.due_date || null,
      notes: form.notes || null,
    });
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Factura registrada");
    setOpen(false);
    setForm({ client_id: "", invoice_number: "", concept: "", amount_net: "", amount_total: "", currency: "ARS", period: "", status: "borrador", due_date: "", notes: "" });
    fetchData();
  };

  const markSent = async (id: string) => {
    await supabase.from("client_invoices").update({ status: "enviada", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    fetchData();
    toast.success("Factura marcada como enviada");
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
    toast.success("Registro eliminado");
  };

  const visible = items.filter((i) => {
    if (filterClient !== "all" && i.client_id !== filterClient) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    return true;
  });

  const statusBadge = (s: string) => {
    if (s === "cobrada") return "bg-success/10 text-success border-success/30";
    if (s === "enviada") return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-muted text-muted-foreground border-border";
  };

  if (loading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="enviada">Enviada</SelectItem>
              <SelectItem value="cobrada">Cobrada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" />Nueva Factura
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Registrar Factura</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Cliente <span className="text-destructive">*</span></Label>
                    <Select value={form.client_id} onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}>
                      <SelectTrigger className="mt-1 text-xs h-8"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">N° Factura</Label>
                    <Input className="mt-1 h-8 text-xs" placeholder="0001-00001234" value={form.invoice_number} onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Concepto</Label>
                  <Input className="mt-1 h-8 text-xs" placeholder="Servicios de publicidad digital – Febrero 2025" value={form.concept} onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Monto neto</Label>
                    <Input className="mt-1 h-8 font-mono text-xs" placeholder="0" value={form.amount_net} onChange={(e) => setForm((f) => ({ ...f, amount_net: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Total c/imp.</Label>
                    <Input className="mt-1 h-8 font-mono text-xs" placeholder="0" value={form.amount_total} onChange={(e) => setForm((f) => ({ ...f, amount_total: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Moneda</Label>
                    <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                      <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["ARS", "USD", "MXN", "BRL"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Período</Label>
                    <Input className="mt-1 h-8 text-xs" placeholder="Febrero 2025" value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Vencimiento</Label>
                    <Input type="date" className="mt-1 h-8 text-xs" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Estado inicial</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="borrador">Borrador</SelectItem>
                      <SelectItem value="enviada">Enviada</SelectItem>
                      <SelectItem value="cobrada">Cobrada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Notas</Label>
                  <Textarea className="mt-1 text-xs" rows={2} placeholder="Observaciones…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
                <Button className="w-full" onClick={handleSave}>Guardar Factura</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Sin facturas registradas.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Enviada</TableHead>
                  {isAdmin && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs font-mono font-medium">{item.invoice_number || "–"}</TableCell>
                    <TableCell className="text-xs font-medium">{item.clients?.name ?? "–"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.period || "–"}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums font-mono">
                      {item.amount_total
                        ? new Intl.NumberFormat("es-AR", { style: "currency", currency: item.currency, minimumFractionDigits: 0 }).format(item.amount_total)
                        : "–"}
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
                        <Badge variant="outline" className={cn("text-[9px]", statusBadge(item.status))}>{item.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.sent_at ? format(new Date(item.sent_at), "dd MMM", { locale: es }) : "–"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {item.status === "borrador" && (
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1" onClick={() => markSent(item.id)}>
                              <Send className="h-3 w-3" />Enviar
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
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

// ── Main Page ──
export default function Billing() {
  const { currentWorkspace, workspaceRole } = useWorkspace();
  const isAdmin = workspaceRole === "admin";

  if (!currentWorkspace) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader badge="Admin" title="Facturación" subtitle="Calculadora de impuestos, cargas de saldo y gestión de facturas" />

      <Tabs defaultValue="calculator" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="calculator" className="text-xs gap-1.5">
            <Calculator className="h-3.5 w-3.5" />Calculadora
          </TabsTrigger>
          <TabsTrigger value="loads" className="text-xs gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />Cargas de Saldo
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" />Facturas
          </TabsTrigger>
        </TabsList>

        {/* Calculator */}
        <TabsContent value="calculator">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Google Ads */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                    <Calculator className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold">Google Ads</CardTitle>
                    <CardDescription className="text-xs">IVA 21% + IIBB 5%</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <GoogleAdsCalc />
              </CardContent>
            </Card>

            {/* Meta Ads */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-[#1877F2]/10 flex items-center justify-center">
                    <Receipt className="h-4 w-4 text-[#1877F2]" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold">Meta Ads</CardTitle>
                    <CardDescription className="text-xs">Fee gestión + IVA 21%</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <MetaAdsCalc />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Balance Loads */}
        <TabsContent value="loads">
          <BalanceLoadsTab workspaceId={currentWorkspace.id} isAdmin={isAdmin} />
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices">
          <InvoicesTab workspaceId={currentWorkspace.id} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
