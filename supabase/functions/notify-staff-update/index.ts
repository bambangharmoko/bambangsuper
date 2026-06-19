import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

// APP_ORIGIN diambil dari environment variable atau dikosongkan (FCM tetap berjalan tanpa link)
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") || "";

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now };
  const toSign = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(toSign));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${toSign}.${base64UrlEncode(new Uint8Array(sig))}` }),
  });
  if (!res.ok) throw new Error(`OAuth token failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { order_id, status, updated_by } = await req.json();
    if (!order_id || !status || !updated_by) {
      return new Response(JSON.stringify({ error: "order_id, status and updated_by required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: order, error: orderError } = await supabase
      .from("service_orders")
      .select("id, ticket_number, device_brand, device_model, assigned_technician")
      .eq("id", order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return new Response(JSON.stringify({ ok: true, sent: 0, message: "order not found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: actorProfile, error: actorProfileError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", updated_by)
      .maybeSingle();
    const { data: actorRoles, error: actorRoleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", updated_by);
    if (actorProfileError) throw actorProfileError;
    if (actorRoleError) throw actorRoleError;
    const roleNames = (actorRoles || []).map((item) => item.role);
    const actorRole = roleNames.includes("owner") ? "owner" : roleNames.includes("admin") ? "admin" : roleNames.includes("technician") ? "technician" : null;
    const actorName = actorRole === "admin" ? "Admin" : actorRole === "owner" ? "Owner" : actorProfile?.full_name || "Teknisi";

    let targetUserIds: string[] = [];
    let title = "Update Status Tiket";
    let body = `Status tiket ${order.ticket_number} menjadi ${status}.`;

    // Count status updates to detect if it's the initial ticket creation
    const { count, error: countError } = await supabase
      .from("service_updates")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order_id);
    if (countError) throw countError;

    if (count !== null && count <= 1) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "initial ticket creation, no notification" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch all approved staff users except the one who updated
    const { data: staffRoles, error: staffError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "owner", "technician"]);
    if (staffError) throw staffError;
    const staffIds = [...new Set((staffRoles || []).map((row) => row.user_id).filter((id) => id !== updated_by))];
    
    const { data: approvedProfiles, error: approvedError } = await supabase
      .from("profiles")
      .select("id")
      .in("id", staffIds)
      .eq("is_approved", true);
    if (approvedError) throw approvedError;
    targetUserIds = (approvedProfiles || []).map((row) => row.id);

    targetUserIds = [...new Set(targetUserIds)];
    if (targetUserIds.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0, message: "no staff targets" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: tokens, error: tokenError } = await supabase
      .from("staff_push_tokens")
      .select("id, fcm_token, user_id")
      .in("user_id", targetUserIds)
      .eq("is_active", true);
    if (tokenError) throw tokenError;
    if (!tokens || tokens.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0, message: "no active staff tokens" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sa: ServiceAccount = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "{}");
    const accessToken = await getAccessToken(sa);
    const projectId = sa.project_id || Deno.env.get("FIREBASE_PROJECT_ID")!;
    const invalidTokenIds: string[] = [];
    let sent = 0;

    await Promise.all(tokens.map(async ({ id, fcm_token, user_id }) => {
      const isAssignedTech = user_id === order.assigned_technician;
      const userTitle = isAssignedTech ? "Update Tugas Anda" : "Update Status Tiket";
      const userBody = isAssignedTech
        ? `${actorName} mengubah status tiket ${order.ticket_number} (Tugas Anda) menjadi ${status}.`
        : `Tiket ${order.ticket_number} (${order.device_brand} ${order.device_model}): ${actorName} mengubah status menjadi ${status}.`;

      const targetPath = `/dashboard/orders/${order.ticket_number}`;
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { token: fcm_token, data: { title: userTitle, body: userBody, order_id, status, url: targetPath }, webpush: { notification: { title: userTitle, body: userBody, icon: "/icon-192.png", badge: "/icon-192.png", tag: `staff-ticket-${order_id}`, requireInteraction: true, data: { order_id, status, url: targetPath } }, fcm_options: { link: `${APP_ORIGIN}${targetPath}` } } } }),
      });
      if (res.ok) sent++;
      else if (res.status === 404 || res.status === 400) invalidTokenIds.push(id);
    }));

    if (invalidTokenIds.length > 0) await supabase.from("staff_push_tokens").update({ is_active: false }).in("id", invalidTokenIds);
    return new Response(JSON.stringify({ ok: true, sent, total: tokens.length, invalidated: invalidTokenIds.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-staff-update error:", err);
    const msg = err instanceof Error ? err.message : "unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});