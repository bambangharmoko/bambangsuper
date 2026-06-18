// Edge Function: notify-status-change
// Dipanggil otomatis oleh DB trigger saat status service_orders berubah.
// Mengambil semua FCM token aktif untuk ticket, lalu kirim via FCM HTTP v1 API.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

// APP_ORIGIN diambil dari environment variable atau dikosongkan (FCM tetap berjalan tanpa link)
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") || "";

// === Helpers untuk FCM HTTP v1 (OAuth2 via service account) ===

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(payload));
  const toSign = `${encHeader}.${encPayload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(toSign)
  );
  const jwt = `${toSign}.${base64UrlEncode(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OAuth token failed: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return data.access_token;
}

// === Status → message mapping ===

const STATUS_MESSAGES: Record<string, { title: string; body: (name: string, ticket: string) => string }> = {
  Diterima: {
    title: "Tiket Diterima ✅",
    body: (n, t) => `Halo ${n}, tiket ${t} telah kami terima dan akan segera diproses.`,
  },
  Diagnosa: {
    title: "Sedang Diagnosa 🔍",
    body: (n, t) => `Tiket ${t} sedang dalam tahap diagnosa oleh teknisi kami.`,
  },
  "Menunggu Konfirmasi": {
    title: "Menunggu Konfirmasi Anda ⏳",
    body: (n, t) => `Halo ${n}, hasil diagnosa tiket ${t} sudah siap. Silakan cek detailnya.`,
  },
  Pending: {
    title: "Tiket Pending ⏸️",
    body: (n, t) => `Tiket ${t} sementara dipending. Akan dilanjutkan secepatnya.`,
  },
  Perbaikan: {
    title: "Perbaikan Dimulai 🔧",
    body: (n, t) => `Teknisi sedang mengerjakan perbaikan untuk tiket ${t}.`,
  },
  Selesai: {
    title: "Perbaikan Selesai 🎉",
    body: (n, t) => `Tiket ${t} telah selesai diperbaiki.`,
  },
  "Siap diAmbil": {
    title: "Siap Diambil 📦",
    body: (n, t) => `Halo ${n}, perangkat tiket ${t} sudah siap untuk diambil!`,
  },
  Close: {
    title: "Tiket Selesai ✅",
    body: (n, t) => `Tiket ${t} telah ditutup. Terima kasih atas kepercayaan Anda!`,
  },
  Cancelled: {
    title: "Tiket Dibatalkan ❌",
    body: (n, t) => `Tiket ${t} telah dibatalkan.`,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { ticket_number, new_status, customer_name, order_id } = body;

    if (!ticket_number || !new_status) {
      return new Response(
        JSON.stringify({ error: "ticket_number and new_status required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Ambil semua FCM token aktif untuk tiket ini
    const { data: tokens, error: tokenErr } = await supabase
      .from("customer_push_tokens")
      .select("id, fcm_token")
      .eq("ticket_number", ticket_number)
      .eq("is_active", true);

    if (tokenErr) throw tokenErr;
    if (!tokens || tokens.length === 0) {
      console.log(`No active tokens for ticket ${ticket_number}`);
      return new Response(
        JSON.stringify({ ok: true, sent: 0, message: "no subscribers" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service account
    const saRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!saRaw) throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
    const sa: ServiceAccount = JSON.parse(saRaw);

    const accessToken = await getAccessToken(sa);
    const projectId = sa.project_id || Deno.env.get("FIREBASE_PROJECT_ID")!;

    const tmpl = STATUS_MESSAGES[new_status] || {
      title: "Update Tiket",
      body: (n: string, t: string) => `Tiket ${t} status: ${new_status}`,
    };
    const title = tmpl.title;
    const bodyText = tmpl.body(customer_name || "Pelanggan", ticket_number);
    const trackingPath = `/track/${encodeURIComponent(ticket_number)}`;
    const trackingUrl = `${APP_ORIGIN}${trackingPath}`;

    let sent = 0;
    const invalidTokenIds: string[] = [];

    await Promise.all(
      tokens.map(async ({ id, fcm_token }) => {
        try {
          const res = await fetch(
            `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: {
                  token: fcm_token,
                  data: {
                    title,
                    body: bodyText,
                    ticket_number,
                    status: new_status,
                    order_id: order_id || "",
                    url: trackingPath,
                  },
                  webpush: {
                    notification: {
                      title,
                      body: bodyText,
                      icon: "/icon-192.png",
                      badge: "/icon-192.png",
                      tag: ticket_number,
                      requireInteraction: true,
                      data: {
                        ticket_number,
                        status: new_status,
                        order_id: order_id || "",
                        url: trackingPath,
                      },
                    },
                    fcm_options: { link: trackingUrl },
                  },
                },
              }),
            }
          );

          if (res.ok) {
            sent++;
          } else {
            const errTxt = await res.text();
            console.warn(`FCM send failed for token ${id}: ${res.status} ${errTxt}`);
            // Token invalid → tandai inactive
            if (res.status === 404 || res.status === 400) {
              invalidTokenIds.push(id);
            }
          }
        } catch (e) {
          console.error("FCM send error:", e);
        }
      })
    );

    // Soft-disable token invalid
    if (invalidTokenIds.length > 0) {
      await supabase
        .from("customer_push_tokens")
        .update({ is_active: false })
        .in("id", invalidTokenIds);
    }

    return new Response(
      JSON.stringify({ ok: true, sent, total: tokens.length, invalidated: invalidTokenIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-status-change error:", err);
    const msg = err instanceof Error ? err.message : "unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
