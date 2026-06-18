import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Send, Eye, EyeOff } from "lucide-react";

export function ForgotPasswordDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"request" | "verify" | "reset">("request");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async () => {
    if (!email) {
      toast.error("Masukkan email Anda.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { action: "request", purpose: "password_reset", email },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message || "Gagal mengirim email OTP");

      setOtpCode("");
      setStep("verify");
      toast.success("OTP reset password dikirim ke email otorisasi Owner.");
    } catch (error) {
      console.error("request reset OTP error:", error);
      toast.error(error instanceof Error ? error.message : "Gagal mengirim email OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { action: "verify", purpose: "password_reset", email, otp_code: otpCode },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message || "OTP salah");

      setStep("reset");
      toast.success("Kode OTP terverifikasi!");
    } catch (error) {
      console.error("verify reset OTP error:", error);
      toast.error(error instanceof Error ? error.message : "OTP salah");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password minimal 6 karakter.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { action: "reset-password", purpose: "password_reset", email, otp_code: otpCode, new_password: newPassword },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message || "Gagal memperbarui password");

      toast.success("Password berhasil diperbarui. Silakan login dengan password baru.");
      setOpen(false);
      resetState();
    } catch (error) {
      console.error("reset password error:", error);
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui password");
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setStep("request");
    setEmail("");
    setOtpCode("");
    setNewPassword("");
    setShowPassword(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      <DialogTrigger asChild>
        <button className="text-sm text-primary hover:underline">Lupa Password?</button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Lupa Password
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {step === "request" && (
            <>
              <p className="text-sm text-muted-foreground">
                Masukkan email Anda. Kode OTP akan dikirim ke Owner untuk persetujuan reset password.
              </p>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@contoh.com"
                />
              </div>
              <Button onClick={handleRequestReset} disabled={loading} className="w-full gradient-primary">
                <Send className="h-4 w-4 mr-2" />
                {loading ? "Mengirim..." : "Kirim Permintaan OTP"}
              </Button>
            </>
          )}

          {step === "verify" && (
            <>
              <p className="text-sm text-muted-foreground">
                Masukkan kode OTP yang diberikan oleh Owner. Hubungi Owner via WhatsApp atau langsung untuk mendapatkan kode otorisasi.
              </p>
              <div className="space-y-2">
                <Label>Kode OTP</Label>
                <Input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Masukkan kode 6 digit"
                  maxLength={6}
                />
              </div>
              <Button onClick={handleVerifyOtp} disabled={loading || otpCode.length !== 6} className="w-full gradient-primary">
                {loading ? "Memverifikasi..." : "Verifikasi OTP"}
              </Button>
            </>
          )}

          {step === "reset" && (
            <>
              <p className="text-sm text-muted-foreground">
                OTP terverifikasi. Masukkan password baru untuk akun ini.
              </p>
              <div className="space-y-2">
                <Label>Password Baru</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
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
              <Button onClick={handleResetPassword} disabled={loading || newPassword.length < 6} className="w-full gradient-primary">
                {loading ? "Menyimpan..." : "Simpan Password Baru"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
