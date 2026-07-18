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

const requireText = (value: unknown, field: string, max = 500) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} wajib diisi`);
  }
  return value.trim().slice(0, max);
};

/**
 * Decode JWT payload without verifying signature.
 * The Supabase edge runtime already validates the JWT before passing the request to us,
 * so we can safely read the payload claims to extract the user ID without an extra network call.
 */
const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url decode
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - payload.length % 4) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Sesi login tidak ditemukan" }, 401);
    }

    const token = authHeader.slice(7);
    const jwtPayload = decodeJwtPayload(token);
    const userId = typeof jwtPayload?.sub === "string" ? jwtPayload.sub : null;

    if (!userId) {
      return jsonResponse({ error: "Token sesi tidak valid" }, 401);
    }

    // Use admin client for all DB operations (bypasses RLS, faster)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Check profile and role in parallel (one round-trip instead of two)
    const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
      admin.from("profiles").select("is_approved").eq("id", userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", userId).in("role", ["owner", "admin"]),
    ]);

    if (profileError) console.error("Profile lookup error:", profileError.message);
    if (rolesError) console.error("Roles lookup error:", rolesError.message);

    if (!profile?.is_approved || !roles?.length) {
      console.error(`Permission denied: approved=${profile?.is_approved}, roles=${roles?.length}`);
      return jsonResponse({ error: "Akun belum punya izin membuat tiket" }, 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (_e) {
      return jsonResponse({ error: "Request body tidak valid (bukan JSON)" }, 400);
    }

    const orderId = typeof body.order_id === "string" && body.order_id ? body.order_id : crypto.randomUUID();
    const unitChecks = body.unit_checks && typeof body.unit_checks === "object" ? body.unit_checks : {};

    const orderPayload = {
      id: orderId,
      ticket_number: "",
      customer_name: requireText(body.customer_name, "Nama pelanggan", 160),
      customer_phone: requireText(body.customer_phone, "Nomor HP", 60),
      customer_email: typeof body.customer_email === "string" && body.customer_email.trim() ? body.customer_email.trim() : null,
      device_type: requireText(body.device_type, "Jenis device", 120),
      device_brand: requireText(body.device_brand, "Brand", 120),
      device_model: requireText(body.device_model, "Model", 160),
      device_password: typeof body.device_password === "string" && body.device_password.trim() ? body.device_password.trim() : null,
      damage_description:
        typeof body.damage_description === "string" && body.damage_description.trim() ? body.damage_description.trim() : null,
      unit_condition: requireText(body.unit_condition, "Kondisi unit", 160),
      unit_accessories:
        typeof body.unit_accessories === "string" && body.unit_accessories.trim() ? body.unit_accessories.trim() : null,
      unit_checks: unitChecks,
      service_type: requireText(body.service_type, "Tipe servis", 80),
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
      serial_number: typeof body.serial_number === "string" && body.serial_number.trim() ? body.serial_number.trim() : null,
      // saved_customer_id: links ticket to a saved customer record (null = manual customer)
      saved_customer_id: typeof body.saved_customer_id === "string" && body.saved_customer_id.trim() ? body.saved_customer_id.trim() : null,
      created_by: userId,
    };

    console.log("Inserting order:", orderId, "for user:", userId);

    const { data: order, error: insertError } = await admin
      .from("service_orders")
      .insert(orderPayload)
      .select("id, ticket_number")
      .single();

    if (insertError) {
      console.error("Insert error code:", insertError.code, "message:", insertError.message);

      // Handle idempotency: if same ID was already inserted by this user, return it
      if (insertError.code === "23505") {
        const { data: existing } = await admin
          .from("service_orders")
          .select("id, ticket_number, created_by")
          .eq("id", orderId)
          .maybeSingle();
        if (existing?.created_by === userId) {
          console.log("Returning existing order (idempotent):", existing.id);
          return jsonResponse({ ok: true, order: { id: existing.id, ticket_number: existing.ticket_number } });
        }
      }
      throw new Error(`Database error (${insertError.code}): ${insertError.message}`);
    }

    console.log("Order created:", order.id, "ticket:", order.ticket_number);

    // Insert initial service_updates — non-fatal if it fails
    const isInstallType = typeof body.service_type === "string" && body.service_type.includes("Install");
    const initialStatus = isInstallType ? "Perbaikan" : "Diterima";

    const { error: updateError } = await admin.from("service_updates").insert({
      order_id: order.id,
      status: initialStatus,
      description: isInstallType ? "Unit diterima untuk install" : "Unit diterima",
      updated_by: userId,
    });

    if (updateError) {
      console.error("service_updates insert warning:", updateError.message);
      // Non-fatal: return success anyway so the ticket is usable
    }

    return jsonResponse({ ok: true, order });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("create-service-order unhandled error:", message);
    return jsonResponse({ error: message }, 500);
  }
});