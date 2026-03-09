import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  Palette,
  DollarSign,
  ClipboardList,
  FlaskConical,
  Plug,
  Settings,
  LogOut,
  ShieldAlert,
  Users,
  Activity,
  Building2,
  Receipt,
  PiggyBank,
  CheckSquare,
  LineChart,
  Mail,
  Sliders,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import ClientSwitcher from "@/components/ClientSwitcher";
import SegmentFilter from "@/components/SegmentFilter";
import { AlertsBell } from "@/components/AlertsPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem =
  | { type: "link"; to: string; label: string; icon: React.ElementType }
  | { type: "section"; label: string };

const navItems: NavItem[] = [
  // ── Principal ──
  { type: "section", label: "Principal" },
  { type: "link", to: "/", label: "Home", icon: LayoutDashboard },
  { type: "link", to: "/clients", label: "Client Hub", icon: Users },
  { type: "link", to: "/tasks", label: "Tareas", icon: CheckSquare },

  // ── Performance ──
  { type: "section", label: "Performance" },
  { type: "link", to: "/performance", label: "Performance", icon: BarChart3 },
  { type: "link", to: "/analytics", label: "Analytics", icon: LineChart },
  { type: "link", to: "/budget", label: "Budget Tracker", icon: PiggyBank },
  { type: "link", to: "/creatives", label: "Creativos", icon: Palette },

  // ── Operaciones ──
  { type: "section", label: "Operaciones" },
  { type: "link", to: "/finance", label: "Finanzas", icon: DollarSign },
  { type: "link", to: "/reports", label: "Reportes", icon: Mail },
  { type: "link", to: "/changelog", label: "Bitácora", icon: ClipboardList },
  { type: "link", to: "/changelog/dashboard", label: "Dashboard Cambios", icon: Activity },
  { type: "link", to: "/experiments", label: "Experimentos", icon: FlaskConical },
  { type: "link", to: "/connections", label: "Conexiones", icon: Plug },

  // ── Config ──
  { type: "section", label: "Configuración" },
  { type: "link", to: "/settings/segments", label: "Segmentos", icon: Settings },
  { type: "link", to: "/settings/financial", label: "Config. Finanzas", icon: Sliders },
  { type: "link", to: "/settings/workspace", label: "Workspace", icon: Building2 },
  { type: "link", to: "/settings/members", label: "Miembros", icon: Users },

  // ── Admin ──
  { type: "section", label: "Admin" },
  { type: "link", to: "/admin/billing", label: "Facturación", icon: Receipt },
  { type: "link", to: "/admin/ops", label: "Ops", icon: ShieldAlert },
];

const AppLayout = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
          <span className="font-bold text-sm text-sidebar-primary-foreground tracking-tight">
            Nebulab OS
          </span>
        </div>

        <div className="px-3 py-2 border-b border-sidebar-border space-y-2">
          <WorkspaceSwitcher />
          <ClientSwitcher />
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {navItems.map((item, i) => {
            if (item.type === "section") {
              return (
                <p
                  key={`section-${i}`}
                  className="px-3 pt-4 pb-1 text-[9px] font-bold uppercase tracking-widest text-sidebar-foreground/35 select-none"
                >
                  {item.label}
                </p>
              );
            }
            const { to, label, icon: Icon } = item;
            return (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-12 shrink-0 flex items-center justify-between px-6 bg-gradient-to-r from-primary to-accent border-b border-primary/20">
          <div />
          <div className="flex items-center gap-3">
            <SegmentFilter />
            <AlertsBell />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
