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
    const { ticket_number, fcm_token, user_agent, action = "subscribe" } = await req.json();
    if (typeof ticket_number !== "string" || !ticket_number.trim()) {
      return jsonResponse({ error: "Nomor tiket wajib diisi" }, 400);
    }
    if (typeof fcm_token !== "string" || !fcm_token.trim()) {
      return jsonResponse({ error: "Token notifikasi wajib diisi" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ticket = ticket_number.trim();

    const { data: order, error: orderError } = await admin
      .from("service_orders")
      .select("ticket_number")
      .eq("ticket_number", ticket)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return jsonResponse({ error: "Tiket tidak ditemukan" }, 404);

    // Hapus token ini dari semua entitas lain untuk mencegah duplikasi
    await admin.rpc("remove_push_token", { token_to_remove: fcm_token.trim() });

    const { error } = await admin.from("customer_push_tokens").upsert(
      {
        ticket_number: ticket,
        fcm_token: fcm_token.trim(),
        user_agent: typeof user_agent === "string" ? user_agent.slice(0, 500) : null,
        is_active: action !== "unsubscribe",
      },
      { onConflict: "ticket_number,fcm_token" }
    );

    if (error) throw error;
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("subscribe-push-token error:", error);
    const message = error instanceof Error ? error.message : "Gagal menyimpan token notifikasi";
    return jsonResponse({ error: message }, 500);
  }
});