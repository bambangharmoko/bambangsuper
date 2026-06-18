import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { UserPlus, Mail, Eye, EyeOff } from "lucide-react";
import { getErrorMessage } from "@/lib/utils";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"owner" | "admin" | "technician">("technician");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const navigate = useNavigate();

  const handleRequestOtp = async () => {
    if (!email) {
      toast.error("Masukkan email akun terlebih dahulu.");
      return;
    }
    setOtpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { action: "request", purpose: "owner_register", email },
      });

      if (error) {
        const msg = await getErrorMessage(error);
        throw new Error(msg);
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      setOtpCode("");
      setOtpSent(true);
      toast.success("OTP berhasil dikirim ke email otorisasi Owner.");
    } catch (error) {
      console.error("request owner OTP error:", error);
      toast.error(error instanceof Error ? error.message : "Gagal mengirim email OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim() || !username.trim() || !email.trim() || !password) {
      toast.error("Semua kolom wajib diisi (Nama Lengkap, Username, Email, Password)!");
      return;
    }

    setLoading(true);

    try {
      if (role === "owner") {
        if (!otpSent || !otpCode) {
          toast.error("Minta dan masukkan OTP terlebih dahulu.");
          return;
        }

        const { data: verifyData, error: verifyError } = await supabase.functions.invoke("send-otp", {
          body: { action: "verify", purpose: "owner_register", email, otp_code: otpCode },
        });

        if (verifyError) {
          const msg = await getErrorMessage(verifyError);
          throw new Error(msg);
        }
        if (verifyData?.error) {
          throw new Error(verifyData.error);
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            requested_role: role,
            username: username,
          },
        },
      });

      if (error) throw error;

      if (data.user && username) {
        await supabase.from("profiles").update({ username }).eq("id", data.user.id);
      }

      if (role === "owner") {
        toast.success("Registrasi berhasil! Silakan login.");
      } else {
        toast.success("Registrasi berhasil! Akun Anda perlu persetujuan Owner sebelum bisa login.");
      }
      navigate("/login");
    } catch (error) {
      console.error("register error:", error);
      toast.error(error instanceof Error ? error.message : "Registrasi gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Registrasi Staff</CardTitle>
          <p className="text-sm text-muted-foreground">Super Computer Apps</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nama Lengkap</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username untuk login alternatif"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <RadioGroup value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="owner" id="owner" />
                  <Label htmlFor="owner" className="text-sm">
                    Owner (perlu verifikasi OTP)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="admin" id="admin" />
                  <Label htmlFor="admin" className="text-sm">
                    Admin (perlu persetujuan Owner)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="technician" id="technician" />
                  <Label htmlFor="technician" className="text-sm">
                    Teknisi (perlu persetujuan Owner)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {role === "owner" && (
              <div className="space-y-2">
                <Label htmlFor="otp">Kode Verifikasi OTP</Label>
                <div className="flex gap-2">
                  <Input
                    id="otp"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Masukkan kode 6 digit"
                    required
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRequestOtp}
                    disabled={otpLoading || otpSent}
                    className="whitespace-nowrap"
                  >
                    <Mail className="h-4 w-4 mr-1" />
                    {otpLoading ? "Mengirim..." : otpSent ? "Terkirim ✓" : "Minta OTP"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Kode akan dikirim ke bambanghrmko@gmail.com</p>
              </div>
            )}

            <Button type="submit" className="w-full gradient-primary" disabled={loading}>
              <UserPlus className="h-4 w-4 mr-2" />
              {loading ? "Loading..." : "Daftar"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">Sudah punya akun? </span>
            <Link to="/login" className="text-primary hover:underline">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
