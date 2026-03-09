import { useState } from "react";
import { Bell, X, AlertTriangle, AlertCircle, TrendingDown, Wallet, WifiOff, Zap, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAlerts, Alert, AlertType } from "@/hooks/useAlerts";
import { useNavigate } from "react-router-dom";

// ── Alert icon + color by type ─────────────────────────────────────────
const ALERT_META: Record<AlertType, { icon: any; color: string; bg: string }> = {
  roas_drop:       { icon: TrendingDown, color: "text-orange-500",   bg: "bg-orange-50 border-orange-200" },
  budget_warning:  { icon: Wallet,       color: "text-yellow-500",   bg: "bg-yellow-50 border-yellow-200" },
  budget_critical: { icon: Wallet,       color: "text-red-500",      bg: "bg-red-50 border-red-200" },
  no_data:         { icon: WifiOff,      color: "text-slate-500",    bg: "bg-slate-50 border-slate-200" },
  zero_spend:      { icon: AlertCircle,  color: "text-red-500",      bg: "bg-red-50 border-red-200" },
  spend_spike:     { icon: Zap,          color: "text-purple-500",   bg: "bg-purple-50 border-purple-200" },
};

function AlertCard({ alert, onNavigate }: { alert: Alert; onNavigate: () => void }) {
  const meta = ALERT_META[alert.type];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "flex gap-3 p-3 rounded-lg border text-left",
        meta.bg,
        alert.client_id && "cursor-pointer hover:brightness-95 transition-all"
      )}
      onClick={alert.client_id ? onNavigate : undefined}
    >
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", meta.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-xs font-semibold text-gray-800">{alert.title}</p>
          {alert.severity === "critical" && (
            <span className="text-[9px] font-bold uppercase tracking-wide text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
              Crítico
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-600 leading-relaxed">{alert.description}</p>
      </div>
      {alert.client_id && <ChevronRight className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />}
    </div>
  );
}

// ── Bell button (shown in header) ──────────────────────────────────────
export function AlertsBell() {
  const { count, criticalCount, isLoading } = useAlerts();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="relative p-1.5 rounded-md hover:bg-white/10 transition-colors"
        onClick={() => setOpen(true)}
        aria-label="Alertas"
      >
        <Bell className="h-4 w-4 text-white/80" />
        {!isLoading && count > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center",
              criticalCount > 0 ? "bg-red-500" : "bg-yellow-500"
            )}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && <AlertsPanel onClose={() => setOpen(false)} />}
    </>
  );
}

// ── Side panel ────────────────────────────────────────────────────────
function AlertsPanel({ onClose }: { onClose: () => void }) {
  const { alerts, criticalCount, isLoading } = useAlerts();
  const navigate = useNavigate();

  const handleNavigate = (alert: Alert) => {
    onClose();
    if (alert.type === "budget_warning" || alert.type === "budget_critical") {
      navigate("/budget");
    } else if (alert.client_id) {
      navigate("/clients");
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[380px] z-50 bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-semibold text-gray-800">Alertas</span>
            {alerts.length > 0 && (
              <div className="flex items-center gap-1">
                {criticalCount > 0 && (
                  <Badge className="text-[10px] h-4 px-1.5 bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                    {criticalCount} crítica{criticalCount !== 1 ? "s" : ""}
                  </Badge>
                )}
                {alerts.length - criticalCount > 0 && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {alerts.length - criticalCount} aviso{alerts.length - criticalCount !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
                <Bell className="h-6 w-6 text-green-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">Todo en orden</p>
              <p className="text-xs text-gray-400 mt-1">No hay alertas activas en este momento</p>
            </div>
          ) : (
            <>
              {/* Group: critical */}
              {alerts.filter((a) => a.severity === "critical").length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 px-1 mb-1.5">
                    Críticas
                  </p>
                  <div className="space-y-1.5">
                    {alerts
                      .filter((a) => a.severity === "critical")
                      .map((a) => (
                        <AlertCard key={a.id} alert={a} onNavigate={() => handleNavigate(a)} />
                      ))}
                  </div>
                </div>
              )}

              {/* Group: warning */}
              {alerts.filter((a) => a.severity === "warning").length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-600 px-1 mb-1.5 mt-3">
                    Avisos
                  </p>
                  <div className="space-y-1.5">
                    {alerts
                      .filter((a) => a.severity === "warning")
                      .map((a) => (
                        <AlertCard key={a.id} alert={a} onNavigate={() => handleNavigate(a)} />
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t bg-gray-50">
          <p className="text-[10px] text-gray-400 text-center">
            Se actualiza automáticamente cada 5 minutos
          </p>
        </div>
      </div>
    </>
  );
}
