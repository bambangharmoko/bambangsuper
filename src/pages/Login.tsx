import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
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
    <div className="min-h-screen flex items-center justify-center bg-[#090d16] p-4 relative overflow-hidden">
      {/* Background grid + glow */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <AppLogo className="h-10" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Login Staff</h1>
          <p className="text-[10px] sm:text-xs text-slate-500 leading-tight mt-1 tracking-wide uppercase">
            Super Ultima Management, Tracking & Real-Time Application
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/8 bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Identifier */}
            <div className="space-y-1.5">
              <label htmlFor="identifier" className="text-xs font-medium text-slate-400 tracking-wide">
                Email atau Username
              </label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Masukkan email atau username"
                required
                className="w-full h-10 px-3.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-slate-400 tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-10 px-3.5 pr-10 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 mt-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              {loading ? "Memproses..." : "Login"}
            </button>
          </form>

          {/* Forgot password */}
          <div className="mt-4 text-center">
            <ForgotPasswordDialog />
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-white/6" />

          {/* Links */}
          <div className="space-y-2 text-center text-xs">
            <div>
              <span className="text-slate-500">Belum punya akun? </span>
              <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Daftar
              </Link>
            </div>
            <div>
              <Link to="/" className="text-slate-600 hover:text-slate-400 transition-colors">
                ← Kembali ke Beranda
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
