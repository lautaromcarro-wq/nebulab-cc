import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Users, ShieldCheck, Eye, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type AppRole = "admin" | "analyst" | "viewer";
type MemberStatus = "active" | "invited" | "disabled";

interface Member {
  id: string;
  user_id: string;
  role: AppRole;
  status: MemberStatus;
  created_at: string;
  full_name: string | null;
  email: string | null;
}

const roleConfig: Record<AppRole, { label: string; icon: React.ElementType; className: string }> = {
  admin: { label: "Admin", icon: ShieldCheck, className: "bg-destructive/10 text-destructive" },
  analyst: { label: "Analyst", icon: BarChart3, className: "bg-primary/10 text-primary" },
  viewer: { label: "Viewer", icon: Eye, className: "bg-muted text-muted-foreground" },
};

const statusConfig: Record<MemberStatus, { label: string; className: string }> = {
  active: { label: "Activo", className: "bg-success/10 text-success" },
  invited: { label: "Invitado", className: "bg-warning/10 text-warning" },
  disabled: { label: "Deshabilitado", className: "bg-muted text-muted-foreground" },
};

const WorkspaceMembers = () => {
  const { currentWorkspace, workspaceRole } = useWorkspace();
  const { user } = useAuth();
  const isAdmin = workspaceRole === "admin";
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    const { data: membersData, error } = await supabase
      .from("workspace_members")
      .select("id, user_id, role, status, created_at")
      .eq("workspace_id", currentWorkspace.id)
      .order("created_at");

    if (error) { setLoading(false); return; }

    const items = membersData ?? [];
    if (items.length > 0) {
      const userIds = items.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      setMembers(items.map((m) => ({
        ...m,
        full_name: profileMap.get(m.user_id)?.full_name ?? null,
        email: profileMap.get(m.user_id)?.email ?? null,
      })));
    } else {
      setMembers([]);
    }
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const updateRole = async (memberId: string, newRole: AppRole) => {
    setUpdating(memberId);
    const { error } = await supabase
      .from("workspace_members")
      .update({ role: newRole })
      .eq("id", memberId);
    if (error) toast.error("Error al actualizar rol");
    else { toast.success("Rol actualizado"); fetchMembers(); }
    setUpdating(null);
  };

  const updateStatus = async (memberId: string, newStatus: MemberStatus) => {
    setUpdating(memberId);
    const { error } = await supabase
      .from("workspace_members")
      .update({ status: newStatus })
      .eq("id", memberId);
    if (error) toast.error("Error al actualizar estado");
    else { toast.success("Estado actualizado"); fetchMembers(); }
    setUpdating(null);
  };

  const activeCount = members.filter((m) => m.status === "active").length;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Miembros del Workspace</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestioná los roles y accesos del equipo.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Equipo ({activeCount} activos)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Los cambios de rol toman efecto en el próximo login del usuario.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Desde</TableHead>
                  {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const role = roleConfig[member.role];
                  const RoleIcon = role.icon;
                  const status = statusConfig[member.status];
                  const isSelf = member.user_id === user?.id;
                  const isDisabled = updating === member.id;

                  return (
                    <TableRow key={member.id} className={member.status === "disabled" ? "opacity-50" : ""}>
                      <TableCell>
                        <div>
                          <p className="text-xs font-medium">
                            {member.full_name || member.email || member.user_id.slice(0, 8)}
                            {isSelf && <span className="ml-1.5 text-[10px] text-muted-foreground">(vos)</span>}
                          </p>
                          {member.full_name && member.email && (
                            <p className="text-[10px] text-muted-foreground">{member.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("text-[10px] gap-1", role.className)}>
                          <RoleIcon className="h-3 w-3" />
                          {role.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("text-[10px]", status.className)}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(member.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isSelf && (
                              <>
                                <Select
                                  value={member.role}
                                  onValueChange={(v) => updateRole(member.id, v as AppRole)}
                                  disabled={isDisabled}
                                >
                                  <SelectTrigger className="w-28 h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="analyst">Analyst</SelectItem>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-muted-foreground"
                                  disabled={isDisabled}
                                  onClick={() => updateStatus(member.id, member.status === "disabled" ? "active" : "disabled")}
                                >
                                  {member.status === "disabled" ? "Activar" : "Deshabilitar"}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Roles explanation */}
      <Card className="border-dashed">
        <CardContent className="py-4 px-4 space-y-2">
          <p className="text-xs font-medium">Roles disponibles:</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <ShieldCheck className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-medium">Admin</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Control total: workspace, miembros, integraciones, configuración.</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">Analyst</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Lee y escribe: bitácora, experiments, creativos, finanzas.</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Viewer</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Solo lectura. No puede modificar ni registrar cambios.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkspaceMembers;
