import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OWNER_AUTH_EMAIL = "bambanghrmko@gmail.com";
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

type OtpPurpose = "owner_register" | "password_reset";
type OtpAction = "request" | "verify" | "reset-password" | "confirm-email" | "delete-user";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeEmail = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) throw new Error("Email wajib diisi");
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Format email tidak valid");
  return email;
};

const normalizeOtp = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{6}$/.test(value.trim())) throw new Error("Kode OTP harus 6 digit");
  return value.trim();
};

const generateOtp = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");

const sendEmail = async (otp: string, purpose: OtpPurpose, requestedEmail: string) => {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) throw new Error("Konfigurasi email belum tersedia");

  const purposeLabel = purpose === "owner_register" ? "Registrasi Owner" : "Reset Password";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Super Computer Apps <onboarding@resend.dev>",
      to: [OWNER_AUTH_EMAIL],
      subject: `Kode OTP ${purposeLabel} - Super Computer Apps`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111827;">
          <h2 style="color: #2563EB; margin: 0 0 16px;">Super Computer Apps</h2>
          <p>Permintaan otorisasi: <strong>${purposeLabel}</strong></p>
          <p>Email akun/form: <strong>${requestedEmail}</strong></p>
          <div style="background: #eff6ff; padding: 22px; text-align: center; border-radius: 8px; margin: 22px 0; border: 1px solid #bfdbfe;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2563EB;">${otp}</span>
          </div>
          <p style="color: #4b5563; font-size: 14px;">Kode berlaku ${OTP_TTL_MINUTES} menit dan hanya boleh diberikan jika permintaan ini disetujui.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const details = await res.text();
    console.error("send OTP email failed:", details);
    throw new Error("Gagal mengirim email OTP");
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();

    const action = body.action as OtpAction;
    const purpose = body.purpose as OtpPurpose;
    if (!['request', 'verify', 'reset-password', 'confirm-email', 'delete-user'].includes(action)) throw new Error("Aksi tidak valid");
    
    if (action !== "delete-user" && !['owner_register', 'password_reset'].includes(purpose)) {
      throw new Error("Tujuan OTP tidak valid");
    }

    const email = normalizeEmail(body.email);

    if (action === "confirm-email") {
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id, is_approved")
        .eq("email", email)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) return jsonResponse({ error: "Email tidak ditemukan" }, 404);
      if (!profile.is_approved) return jsonResponse({ error: "Akun belum disetujui Owner" }, 403);

      const { error: confirmError } = await admin.auth.admin.updateUserById(profile.id, { email_confirm: true });
      if (confirmError) throw confirmError;
      return jsonResponse({ success: true });
    }

    if (action === "delete-user") {
      const userId = body.userId;
      if (!userId) throw new Error("User ID wajib diisi");

      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;
      return jsonResponse({ success: true });
    }

    if (action === "request") {
      if (purpose === "password_reset") {
        const { data: profile, error } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
        if (error) throw error;
        if (!profile) return jsonResponse({ error: "Email tidak ditemukan" }, 404);
      }

      const otp = generateOtp();
      const { data: hash, error: hashError } = await admin.rpc("hash_otp", { _code: otp });
      if (hashError || !hash) throw hashError ?? new Error("Gagal membuat OTP");

      await admin
        .from("otp_verifications")
        .update({ verified_at: new Date(Date.now() - 1000).toISOString() })
        .eq("purpose", purpose)
        .eq("email", email)
        .is("verified_at", null);

      const { error: insertError } = await admin.from("otp_verifications").insert({
        purpose,
        email,
        target_email: OWNER_AUTH_EMAIL,
        code_hash: hash,
        expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
      });
      if (insertError) throw insertError;

      await sendEmail(otp, purpose, email);
      return jsonResponse({ success: true, target_email: OWNER_AUTH_EMAIL });
    }

    const otpCode = normalizeOtp(body.otp_code);
    const { data: hash, error: hashError } = await admin.rpc("hash_otp", { _code: otpCode });
    if (hashError || !hash) throw hashError ?? new Error("Gagal memvalidasi OTP");

    const { data: record, error: recordError } = await admin
      .from("otp_verifications")
      .select("id, attempts, expires_at, code_hash, verified_at")
      .eq("purpose", purpose)
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recordError) throw recordError;
    if (!record) return jsonResponse({ error: "OTP belum diminta" }, 400);
    if (new Date(record.expires_at).getTime() < Date.now()) return jsonResponse({ error: "OTP sudah kedaluwarsa" }, 400);
    if ((record.attempts ?? 0) >= MAX_ATTEMPTS) return jsonResponse({ error: "Percobaan OTP terlalu banyak" }, 429);

    if (record.code_hash !== hash) {
      await admin.from("otp_verifications").update({ attempts: (record.attempts ?? 0) + 1 }).eq("id", record.id);
      return jsonResponse({ error: "OTP salah" }, 400);
    }

    if (action === "verify") {
      await admin.from("otp_verifications").update({ verified_at: new Date().toISOString() }).eq("id", record.id);
      return jsonResponse({ success: true });
    }

    if (purpose !== "password_reset") return jsonResponse({ error: "Aksi tidak valid untuk OTP ini" }, 400);
    const newPassword = typeof body.new_password === "string" ? body.new_password : "";
    if (newPassword.length < 6) return jsonResponse({ error: "Password minimal 6 karakter" }, 400);

    const { data: profile, error: profileError } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return jsonResponse({ error: "Email tidak ditemukan" }, 404);

    const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, {
      password: newPassword,
      email_confirm: true,
    });
    if (updateError) throw updateError;

    await admin.from("otp_verifications").update({ verified_at: new Date().toISOString() }).eq("id", record.id);
    return jsonResponse({ success: true });
  } catch (error) {
    console.error("send-otp error:", error);
    const message = error instanceof Error ? error.message : "Terjadi kesalahan pada OTP";
    return jsonResponse({ error: message }, 500);
  }
});
