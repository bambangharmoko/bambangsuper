import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { User, Eye, EyeOff, Save } from "lucide-react";

export function ProfileDialog() {
  const { user, profile, roles } = useAuth();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      setFullName(profile?.full_name || "");
      // Fetch username
      supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          setUsername(data?.username || "");
        });
      setOldPassword("");
      setNewPassword("");
    }
  }, [open, user, profile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Update profile data
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ full_name: fullName, username: username || null })
        .eq("id", user.id);

      if (profileErr) throw profileErr;

      // Change password if provided
      if (newPassword) {
        if (!oldPassword) {
          toast.error("Masukkan kata sandi lama untuk verifikasi.");
          setSaving(false);
          return;
        }

        // Verify old password by re-signing in
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: profile?.email || "",
          password: oldPassword,
        });

        if (signInErr) {
          toast.error("Kata sandi lama salah.");
          setSaving(false);
          return;
        }

        const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword });
        if (pwErr) throw pwErr;
      }

      toast.success("Profil berhasil diperbarui!");
      setOpen(false);
    } catch (err: any) {
      toast.error("Gagal: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const roleLabels = roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(", ");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground w-full transition-colors">
          <User className="h-4 w-4" />
          Profil
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profil Saya</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email || ""} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={roleLabels || "-"} disabled className="bg-muted" />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Masukkan username" />
          </div>
          <div className="space-y-2">
            <Label>Nama Lengkap</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <Separator />
          <p className="text-sm text-muted-foreground">Ubah Kata Sandi</p>

          <div className="space-y-2">
            <Label>Kata Sandi Lama</Label>
            <div className="relative">
              <Input
                type={showOld ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Masukkan sandi lama"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowOld(!showOld)}
              >
                {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Kata Sandi Baru</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Masukkan sandi baru"
                minLength={6}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button onClick={handleSaveProfile} disabled={saving} className="w-full gradient-primary">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
