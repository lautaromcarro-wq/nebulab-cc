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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import ClientSwitcher from "@/components/ClientSwitcher";
import SegmentFilter from "@/components/SegmentFilter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/clients", label: "Client Hub", icon: Users },
  { to: "/performance", label: "Performance", icon: BarChart3 },
  { to: "/creatives", label: "Creativos", icon: Palette },
  { to: "/finance", label: "Finance", icon: DollarSign },
  { to: "/budget", label: "Budget Tracker", icon: PiggyBank },
  { to: "/analytics", label: "Analytics", icon: LineChart },
  { to: "/tasks", label: "Tareas", icon: CheckSquare },
  { to: "/changelog", label: "Bitácora", icon: ClipboardList },
  { to: "/changelog/dashboard", label: "Dashboard Cambios", icon: Activity },
  { to: "/experiments", label: "Experiments", icon: FlaskConical },
  { to: "/connections", label: "Connections", icon: Plug },
  { to: "/settings/segments", label: "Segments", icon: Settings },
  { to: "/settings/financial", label: "Financial", icon: DollarSign },
  { to: "/settings/workspace", label: "Workspace", icon: Building2 },
  { to: "/settings/members", label: "Miembros", icon: Users },
  { to: "/admin/billing", label: "Facturación", icon: Receipt },
  { to: "/admin/ops", label: "Ops", icon: ShieldAlert },
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

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
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
          ))}
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
          <SegmentFilter />
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
