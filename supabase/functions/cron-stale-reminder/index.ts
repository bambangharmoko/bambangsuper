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

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
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
  const toSign = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(toSign));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${toSign}.${base64UrlEncode(new Uint8Array(sig))}`,
    }),
  });
  if (!res.ok) throw new Error(`OAuth token failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const staleStatuses = [
      "Diagnosa",
      "Menunggu Persetujuan Pelanggan",
      "Menunggu Sparepart",
      "Perbaikan",
    ];

    // Ambil semua tiket aktif yang belum diupdate > 24 jam dan sudah ditugaskan ke teknisi
    const { data: staleOrders, error: staleError } = await supabase
      .from("service_orders")
      .select("id, ticket_number, customer_name, device_brand, device_model, status, assigned_technician, updated_at")
      .in("status", staleStatuses)
      .not("assigned_technician", "is", null)
      .lt("updated_at", oneDayAgo)
      .is("deleted_at", null);

    if (staleError) throw staleError;

    if (!staleOrders || staleOrders.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, reminded: 0, message: "Tidak ada tiket tertunda > 24 jam yang ditugaskan ke teknisi." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Kelompokkan tiket per teknisi
    const techOrdersMap: Record<string, typeof staleOrders> = {};
    for (const ord of staleOrders) {
      if (!ord.assigned_technician) continue;
      if (!techOrdersMap[ord.assigned_technician]) {
        techOrdersMap[ord.assigned_technician] = [];
      }
      techOrdersMap[ord.assigned_technician].push(ord);
    }

    let notificationsCreated = 0;
    let pushSentCount = 0;

    // Persiapan FCM Service Account jika tersedia
    let accessToken = "";
    let fcmProjectId = "";
    const fcmRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (fcmRaw) {
      try {
        const sa = JSON.parse(fcmRaw) as ServiceAccount;
        fcmProjectId = sa.project_id || Deno.env.get("FIREBASE_PROJECT_ID") || "";
        accessToken = await getAccessToken(sa);
      } catch (e) {
        console.warn("[FCM] Gagal inisialisasi token FCM:", e);
      }
    }

    // Loop per teknisi
    for (const [techId, orders] of Object.entries(techOrdersMap)) {
      const ticketNumbers = orders.map((o) => `#${o.ticket_number}`).join(", ");
      const title = "⚠️ Pengingat Tiket Tertunda";
      const message = `Anda memiliki ${orders.length} tiket tugas (${ticketNumbers}) yang belum di-update lebih dari 24 jam. Mohon segera ditindaklanjuti.`;

      // 1. Simpan ke tabel notifications DB internal untuk masing-masing tiket
      for (const ord of orders) {
        const { error: insertNotifError } = await supabase.from("notifications").insert({
          user_id: techId,
          title,
          message: `Tiket #${ord.ticket_number} (${ord.device_brand || ""} ${ord.device_model || ""}) belum di-update lebih dari 24 jam.`,
          order_id: ord.id,
          is_read: false,
        });

        if (!insertNotifError) {
          notificationsCreated++;
        }
      }

      // 2. Kirim Web Push via FCM jika token teknisi terdaftar
      if (accessToken && fcmProjectId) {
        const { data: pushTokens } = await supabase
          .from("staff_push_tokens")
          .select("id, fcm_token")
          .eq("user_id", techId)
          .eq("is_active", true);

        for (const tokenRow of pushTokens || []) {
          try {
            const fcmRes = await fetch(
              `https://fcm.googleapis.com/v1/projects/${fcmProjectId}/messages:send`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  message: {
                    token: tokenRow.fcm_token,
                    notification: {
                      title,
                      body: message,
                    },
                    data: {
                      ticket_number: orders[0].ticket_number,
                      url: `/dashboard/orders/${orders[0].ticket_number}`,
                    },
                  },
                }),
              }
            );

            if (fcmRes.ok) {
              pushSentCount++;
            }
          } catch (pushErr) {
            console.warn(`[FCM] Gagal kirim ke token teknisi ${techId}:`, pushErr);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        stale_tickets: staleOrders.length,
        technicians_notified: Object.keys(techOrdersMap).length,
        notifications_created: notificationsCreated,
        push_sent: pushSentCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[Cron Stale Reminder Error]:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Gagal memproses reminder otomatis." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
