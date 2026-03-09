import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SectionHeader from "@/components/SectionHeader";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Plus, Play, Trash2, Clock, CheckCircle2, XCircle,
  Calendar, Users, FileText, Send, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Schedule {
  id: string;
  workspace_id: string;
  client_id: string | null;
  client_name: string | null;
  frequency: string;
  send_day_of_week: number;
  send_hour: number;
  recipient_emails: string[];
  reply_to: string | null;
  subject_template: string | null;
  active: boolean;
  last_sent_at: string | null;
  created_at: string;
}

interface SentLog {
  id: string;
  schedule_id: string | null;
  client_name: string | null;
  recipient_emails: string[];
  period_from: string;
  period_to: string;
  status: string;
  error_message: string | null;
  sent_at: string;
}

interface Report {
  id: string;
  token: string;
  client_name: string | null;
  date_from: string;
  date_to: string;
  title: string | null;
  created_at: string;
}

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ── Schedule Card ─────────────────────────────────────────────────────
function ScheduleCard({
  schedule,
  onSend,
  onToggle,
  onDelete,
  sending,
}: {
  schedule: Schedule;
  onSend: () => void;
  onToggle: () => void;
  onDelete: () => void;
  sending: boolean;
}) {
  const dayLabel = DAYS[schedule.send_day_of_week] ?? "Lun";
  const hourLabel = `${String(schedule.send_hour).padStart(2, "0")}:00 UTC`;

  return (
    <Card className={cn("transition-opacity", !schedule.active && "opacity-60")}>
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm truncate">
                {schedule.client_name ?? "Todos los clientes"}
              </span>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {schedule.frequency === "weekly" ? "Semanal" : "Mensual"}
              </Badge>
              {!schedule.active && (
                <Badge variant="secondary" className="text-[10px] shrink-0">Pausado</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {dayLabel} a las {hourLabel}
              </span>
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {schedule.recipient_emails.length} destinatario{schedule.recipient_emails.length !== 1 ? "s" : ""}
              </span>
              {schedule.last_sent_at && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  Enviado {format(new Date(schedule.last_sent_at), "d MMM HH:mm", { locale: es })}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {schedule.recipient_emails.map((e) => (
                <span key={e} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{e}</span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={schedule.active}
              onCheckedChange={onToggle}
              className="scale-90"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={onSend}
              disabled={sending}
            >
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Enviar ahora
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── New Schedule Dialog ───────────────────────────────────────────────
function NewScheduleDialog({
  open,
  onClose,
  wsId,
  clients,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  wsId: string;
  clients: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [clientId, setClientId] = useState<string>("all");
  const [emails, setEmails] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [hour, setHour] = useState("9");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const emailList = emails.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
    if (!emailList.length) {
      toast({ title: "Ingresá al menos un email", variant: "destructive" });
      return;
    }

    setSaving(true);
    const client = clients.find((c) => c.id === clientId);
    const { error } = await supabase.from("report_schedules").insert({
      workspace_id: wsId,
      client_id: clientId === "all" ? null : clientId,
      client_name: client?.name ?? null,
      frequency,
      send_day_of_week: Number(dayOfWeek),
      send_hour: Number(hour),
      recipient_emails: emailList,
      reply_to: replyTo.trim() || null,
      subject_template: subjectTemplate.trim() || null,
      active: true,
    });
    setSaving(false);

    if (error) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Reporte programado creado" });
      onCreated();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" /> Nuevo reporte programado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label className="text-xs mb-1.5 block">Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="text-sm h-9">
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Emails destinatarios</Label>
            <Input
              placeholder="cliente@empresa.com, otro@empresa.com"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Separar con comas o espacios</p>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Reply-to (opcional)</Label>
            <Input
              placeholder="tu@agencia.com"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">Frecuencia</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Día</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Hora (UTC)</Label>
              <Select value={hour} onValueChange={setHour}>
                <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Asunto personalizado (opcional)</Label>
            <Input
              placeholder="📊 Resultados {{client_name}} — semana {{week}}"
              value={subjectTemplate}
              onChange={(e) => setSubjectTemplate(e.target.value)}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Variables: <code>{"{{client_name}}"}</code> <code>{"{{week}}"}</code>
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
            <strong>Nota:</strong> Los envíos automáticos requieren configurar <strong>RESEND_API_KEY</strong> y <strong>APP_URL</strong> en Supabase → Settings → Edge Functions → Secrets.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Crear reporte programado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function Reports() {
  const { currentWorkspace } = useWorkspace();
  const { clients } = useClient();
  const qc = useQueryClient();
  const { toast } = useToast();
  const wsId = currentWorkspace?.id ?? "";

  const [newOpen, setNewOpen] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Schedules
  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["report-schedules", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("report_schedules")
        .select("*")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Schedule[];
    },
  });

  // Sent log
  const { data: logs = [] } = useQuery<SentLog[]>({
    queryKey: ["sent-report-log", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("sent_report_log")
        .select("*")
        .eq("workspace_id", wsId)
        .order("sent_at", { ascending: false })
        .limit(50);
      return (data ?? []) as SentLog[];
    },
  });

  // Report history (generated shareable links)
  const { data: reports = [] } = useQuery<Report[]>({
    queryKey: ["client-reports", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_reports")
        .select("id, token, client_name, date_from, date_to, title, created_at")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as Report[];
    },
  });

  const toggleSchedule = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await supabase.from("report_schedules").update({ active }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report-schedules", wsId] }),
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("report_schedules").delete().eq("id", id);
    },
    onSuccess: () => {
      toast({ title: "Reporte eliminado" });
      qc.invalidateQueries({ queryKey: ["report-schedules", wsId] });
    },
  });

  const sendNow = async (scheduleId: string) => {
    setSendingId(scheduleId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("send-weekly-report", {
        body: { schedule_id: scheduleId },
      });
      if (res.error) throw res.error;
      const result = res.data as any;
      if (result?.results?.[0]?.status === "sent") {
        toast({ title: "Reporte enviado correctamente" });
      } else {
        toast({ title: "Error al enviar", description: result?.results?.[0]?.error ?? "Unknown error", variant: "destructive" });
      }
      qc.invalidateQueries({ queryKey: ["report-schedules", wsId] });
      qc.invalidateQueries({ queryKey: ["sent-report-log", wsId] });
    } catch (err: any) {
      toast({ title: "Error al enviar", description: err.message, variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        badge="Reportes"
        title="Reportes automáticos"
        subtitle="Enviá resultados semanales a tus clientes automáticamente"
        action={
          <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nuevo reporte programado
          </Button>
        }
      />

      <NewScheduleDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        wsId={wsId}
        clients={clients}
        onCreated={() => qc.invalidateQueries({ queryKey: ["report-schedules", wsId] })}
      />

      <Tabs defaultValue="schedules" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="schedules" className="text-xs gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Programados
            {schedules.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">{schedules.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Historial de envíos
          </TabsTrigger>
          <TabsTrigger value="links" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Links generados
          </TabsTrigger>
        </TabsList>

        {/* ── SCHEDULES ── */}
        <TabsContent value="schedules" className="space-y-3">
          {schedules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No hay reportes programados</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Configurá envíos automáticos semanales o mensuales para tus clientes
                </p>
                <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Crear primer reporte
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary bar */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Reportes activos", value: schedules.filter((s) => s.active).length, icon: Play },
                  { label: "Total destinatarios", value: [...new Set(schedules.flatMap((s) => s.recipient_emails))].length, icon: Users },
                  { label: "Envíos realizados", value: logs.length, icon: Send },
                ].map(({ label, value, icon: Icon }) => (
                  <Card key={label}>
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-lg font-bold tabular-nums">{value}</p>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {schedules.map((s) => (
                <ScheduleCard
                  key={s.id}
                  schedule={s}
                  onSend={() => sendNow(s.id)}
                  onToggle={() => toggleSchedule.mutate({ id: s.id, active: !s.active })}
                  onDelete={() => deleteSchedule.mutate(s.id)}
                  sending={sendingId === s.id}
                />
              ))}
            </>
          )}
        </TabsContent>

        {/* ── HISTORY ── */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Historial de envíos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin envíos registrados aún</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Cliente</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Período</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Destinatarios</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Enviado</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium">{log.client_name ?? "Todos"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {log.period_from && log.period_to
                            ? `${format(new Date(log.period_from + "T00:00:00"), "d MMM", { locale: es })} – ${format(new Date(log.period_to + "T00:00:00"), "d MMM", { locale: es })}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {log.recipient_emails?.length ?? 0} email{(log.recipient_emails?.length ?? 0) !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {format(new Date(log.sent_at), "d MMM yyyy HH:mm", { locale: es })}
                        </td>
                        <td className="px-4 py-2.5">
                          {log.status === "sent" ? (
                            <span className="inline-flex items-center gap-1 text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Enviado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive" title={log.error_message ?? ""}>
                              <XCircle className="h-3.5 w-3.5" /> Fallido
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── LINKS HISTORY ── */}
        <TabsContent value="links">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Reportes generados manualmente</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aún no generaste reportes compartibles. Podés hacerlo desde Analytics.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Título</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Cliente</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Período</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Creado</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium max-w-[200px] truncate">
                          {r.title ?? "Sin título"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.client_name ?? "Todos"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {format(new Date(r.date_from + "T00:00:00"), "d MMM", { locale: es })} – {format(new Date(r.date_to + "T00:00:00"), "d MMM yyyy", { locale: es })}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {format(new Date(r.created_at), "d MMM HH:mm", { locale: es })}
                        </td>
                        <td className="px-4 py-2.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] gap-1 px-2"
                            onClick={() => window.open(`/report/${r.token}`, "_blank")}
                          >
                            <FileText className="h-3 w-3" />
                            Ver
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
