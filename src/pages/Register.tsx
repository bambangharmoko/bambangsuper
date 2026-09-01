import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { UserPlus, Mail, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
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

  const inputClass = "w-full h-10 px-3.5 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all";
  const labelClass = "text-xs font-medium text-slate-400 tracking-wide";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090d16] p-4 relative overflow-hidden">
      {/* Background grid + glow */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-blue-600/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-sm py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <AppLogo className="h-10" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Registrasi Staff</h1>
          <p className="text-[10px] sm:text-xs text-slate-500 leading-tight mt-1 tracking-wide uppercase">
            Super Ultima Management, Tracking & Real-Time Application
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/8 bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl">
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Nama Lengkap */}
            <div className="space-y-1.5">
              <label htmlFor="fullName" className={labelClass}>Nama Lengkap</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Masukkan nama lengkap"
                className={inputClass}
              />
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className={labelClass}>Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Masukkan username"
                className={inputClass}
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className={labelClass}>Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Masukkan email"
                className={inputClass}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className={labelClass}>Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  required
                  minLength={6}
                  className={`${inputClass} pr-10`}
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

            {/* Role */}
            <div className="space-y-2">
              <label className={labelClass}>Role</label>
              <RadioGroup value={role} onValueChange={(v) => setRole(v as typeof role)} className="space-y-1">
                {[
                  { value: "owner", label: "Owner" },
                  { value: "admin", label: "Admin" },
                  { value: "technician", label: "Teknisi" },
                ].map((r) => (
                  <div key={r.value} className="flex items-center gap-2.5">
                    <RadioGroupItem value={r.value} id={r.value} className="border-white/20 text-blue-500" />
                    <label
                      htmlFor={r.value}
                      className="text-sm text-slate-300 cursor-pointer select-none"
                    >
                      {r.label}
                    </label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* OTP Section (Owner only) */}
            {role === "owner" && (
              <div className="space-y-2 p-3.5 rounded-xl border border-blue-500/20 bg-blue-600/5">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                  <label htmlFor="otp" className="text-xs font-medium text-blue-300">Kode Verifikasi OTP</label>
                </div>
                <div className="flex gap-2">
                  <input
                    id="otp"
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Kode 6 digit"
                    required
                    className="flex-1 h-9 px-3 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-blue-500/60 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={otpLoading || otpSent}
                    className="h-9 px-3 rounded-lg border border-blue-500/30 bg-blue-600/15 hover:bg-blue-600/25 text-blue-300 text-xs font-medium disabled:opacity-50 transition-all flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {otpLoading ? "Mengirim..." : otpSent ? "Terkirim ✓" : "Minta OTP"}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">Kode akan dikirim ke bambanghrmko@gmail.com</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 mt-1 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {loading ? "Memproses..." : "Daftar"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-4 border-t border-white/6" />

          {/* Links */}
          <div className="space-y-2 text-center text-xs">
            <div>
              <span className="text-slate-500">Sudah punya akun? </span>
              <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Login
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

