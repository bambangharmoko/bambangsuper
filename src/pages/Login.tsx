import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const signIn = async (email: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { data, error: null };

    if (error.message.toLowerCase().includes("email not confirmed")) {
      const { data: confirmData, error: confirmError } = await supabase.functions.invoke("send-otp", {
        body: { action: "confirm-email", purpose: "password_reset", email },
      });
      if (confirmError || confirmData?.error) {
        throw new Error(confirmData?.error || confirmError?.message || "Email akun belum terkonfirmasi");
      }
      return await supabase.auth.signInWithPassword({ email, password });
    }

    return { data, error };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: emailLookup, error: lookupErr } = await supabase.rpc(
        "lookup_login_email",
        { _identifier: identifier.trim() },
      );

      if (lookupErr || !emailLookup) throw new Error("Username/Password salah");

      const { data, error } = await signIn(emailLookup as string);
      if (error) throw error;

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("id", data.user.id)
        .single();

      if (!profile?.is_approved) {
        await supabase.auth.signOut();
        throw new Error("Akun Anda belum disetujui oleh Owner. Silakan hubungi admin.");
      }

      toast.success("Login berhasil!");
      navigate("/dashboard");
    } catch (error) {
      console.error("login error:", error);
      let errorMessage = error instanceof Error ? error.message : "Login gagal";
      if (errorMessage.includes("Invalid login credentials") || errorMessage.includes("Invalid credentials")) {
        errorMessage = "Username/Password salah";
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Login Staff</CardTitle>
          <p className="text-sm text-muted-foreground">Super Computer Apps</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Email atau Username</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Masukkan Email atau username"
                required
              />
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
            <Button type="submit" className="w-full gradient-primary" disabled={loading}>
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? "Loading..." : "Login"}
            </Button>
          </form>
          <div className="mt-3 text-center">
            <ForgotPasswordDialog />
          </div>
          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">Belum punya akun? </span>
            <Link to="/register" className="text-primary hover:underline">Daftar</Link>
          </div>
          <div className="mt-2 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:underline">← Kembali ke Beranda</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
