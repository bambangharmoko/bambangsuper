import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, UserCheck, UserX, Trash2, Eye } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  username: string | null;
  is_approved: boolean | null;
  requested_role: string;
  created_at: string;
  updated_at: string;
}

interface UserRoleRow {
  user_id: string;
  role: string;
}

export default function UserManagementPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [viewTarget, setViewTarget] = useState<UserProfile | null>(null);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setUsers(profiles || []);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");
    setUserRoles(roles || []);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const approveUser = async (userId: string, requestedRole: string) => {
    const target = users.find((u) => u.id === userId);
    try {
      await supabase.from("profiles").update({ is_approved: true }).eq("id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: requestedRole as any });

      if (target?.email) {
        const { data, error } = await supabase.functions.invoke("send-otp", {
          body: { action: "confirm-email", purpose: "password_reset", email: target.email },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message || "Gagal mengonfirmasi email akun");
      }

      toast.success("User berhasil disetujui dan email akun sudah dikonfirmasi!");
      fetchUsers();
    } catch (error) {
      console.error("approve user error:", error);
      toast.error(error instanceof Error ? error.message : "Gagal menyetujui user");
    }
  };

  const revokeUser = async (userId: string) => {
    await supabase.from("profiles").update({ is_approved: false }).eq("id", userId);
    await supabase.from("user_roles").delete().eq("user_id", userId);
    toast.success("Akses user dicabut!");
    fetchUsers();
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    
    // Safety check to prevent deleting own account
    if (deleteTarget.id === user?.id) {
      toast.error("Tidak dapat menghapus akun Anda sendiri!");
      setDeleteTarget(null);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { action: "delete-user", userId: deleteTarget.id, email: deleteTarget.email },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Gagal menghapus user");
      }

      toast.success(`Akun ${deleteTarget.full_name} berhasil dihapus`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (error) {
      console.error("delete user error:", error);
      toast.error(error instanceof Error ? error.message : "Gagal menghapus user");
    }
  };

  const getUserRole = (userId: string) => {
    const role = userRoles.find((r) => r.user_id === userId);
    return role?.role || null;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMMM yyyy, HH:mm", { locale: idLocale });
    } catch {
      return dateStr;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Kelola User</h1>

        <div className="space-y-2">
          {users.map((u) => {
            const currentRole = getUserRole(u.id);
            return (
              <Card key={u.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{u.full_name}</p>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {u.requested_role}
                        </Badge>
                        {u.is_approved ? (
                          <Badge className="bg-success text-success-foreground text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" /> Approved
                          </Badge>
                        ) : (
                          <Badge className="bg-warning text-warning-foreground text-xs">
                            Pending Approval
                          </Badge>
                        )}
                        {currentRole && (
                          <Badge variant="secondary" className="text-xs">
                            Role: {currentRole}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setViewTarget(u)}>
                        <Eye className="h-3 w-3 mr-1" /> Detail
                      </Button>
                      {user && u.id !== user.id && (
                        <>
                          {!u.is_approved ? (
                            <Button size="sm" onClick={() => approveUser(u.id, u.requested_role)} className="gradient-primary">
                              <UserCheck className="h-3 w-3 mr-1" /> Approve
                            </Button>
                          ) : (
                            <Button size="sm" variant="destructive" onClick={() => revokeUser(u.id)}>
                              <UserX className="h-3 w-3 mr-1" /> Revoke
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(u)}
                            title="Hapus akun"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* View Profile Detail Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detail Profil Pengguna</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-3">
              <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                <span className="text-muted-foreground font-medium">Nama Lengkap</span>
                <span>{viewTarget.full_name}</span>

                <span className="text-muted-foreground font-medium">Email</span>
                <span>{viewTarget.email}</span>

                <span className="text-muted-foreground font-medium">Username</span>
                <span>{viewTarget.username || <span className="italic text-muted-foreground">Belum diatur</span>}</span>

                <span className="text-muted-foreground font-medium">Role Diminta</span>
                <span><Badge variant="outline" className="text-xs">{viewTarget.requested_role}</Badge></span>

                <span className="text-muted-foreground font-medium">Role Aktif</span>
                <span>
                  {getUserRole(viewTarget.id) ? (
                    <Badge variant="secondary" className="text-xs">{getUserRole(viewTarget.id)}</Badge>
                  ) : (
                    <span className="italic text-muted-foreground text-xs">Belum ditetapkan</span>
                  )}
                </span>

                <span className="text-muted-foreground font-medium">Status</span>
                <span>
                  {viewTarget.is_approved ? (
                    <Badge className="bg-success text-success-foreground text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Approved
                    </Badge>
                  ) : (
                    <Badge className="bg-warning text-warning-foreground text-xs">Pending</Badge>
                  )}
                </span>

                <span className="text-muted-foreground font-medium">Terdaftar</span>
                <span className="text-xs">{formatDate(viewTarget.created_at)}</span>

                <span className="text-muted-foreground font-medium">Terakhir Update</span>
                <span className="text-xs">{formatDate(viewTarget.updated_at)}</span>
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground italic">
                  🔒 Kata sandi pengguna tidak ditampilkan demi keamanan data pribadi.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Hapus Akun Pengguna</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">
            Anda akan menghapus akun <strong>{deleteTarget?.full_name}</strong> ({deleteTarget?.email}) secara permanen dari sistem. 
            Role dan profil pengguna akan dihapus. Tindakan ini <strong>tidak dapat dibatalkan</strong>.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}