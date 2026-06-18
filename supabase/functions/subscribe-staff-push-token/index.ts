import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const { fcm_token, user_agent } = await req.json();
    if (typeof fcm_token !== "string" || !fcm_token.trim()) {
      return jsonResponse({ error: "Token notifikasi wajib diisi" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, serviceKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: "Sesi login tidak valid" }, 401);

    const { data: allowed, error: allowedError } = await admin.rpc("is_staff", { _user_id: userData.user.id });
    const { data: approved, error: approvedError } = await admin.rpc("is_approved", { _user_id: userData.user.id });
    if (allowedError) throw allowedError;
    if (approvedError) throw approvedError;
    if (!allowed || !approved) return jsonResponse({ error: "Akun belum diizinkan menerima notifikasi staff" }, 403);

    const { error } = await admin.from("staff_push_tokens").upsert(
      {
        user_id: userData.user.id,
        fcm_token: fcm_token.trim(),
        user_agent: typeof user_agent === "string" ? user_agent.slice(0, 500) : null,
        is_active: true,
      },
      { onConflict: "user_id,fcm_token" }
    );

    if (error) throw error;
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("subscribe-staff-push-token error:", error);
    const message = error instanceof Error ? error.message : "Gagal menyimpan token notifikasi staff";
    return jsonResponse({ error: message }, 500);
  }
});