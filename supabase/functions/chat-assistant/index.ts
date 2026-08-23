import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-auth-token",
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

// In-memory cache to eliminate repetitive Storage API roundtrips
let cachedConfig: any = null;
let lastConfigFetch = 0;
const CONFIG_CACHE_TTL_MS = 60 * 1000; // 60 detik

const DEFAULT_FALLBACK_KB = `
# PROFIL SUPER KOMPUTER BALIKPAPAN
- Super Komputer adalah pusat penjualan perangkat IT, jaringan, CCTV, dan Authorized Service Center terkemuka di Kalimantan Timur dengan pengalaman lebih dari 15 tahun.
- Aplikasi Resmi: SUMTRA (Super Ultima Management, Tracking & Real-Time Application).
- Alamat Toko: Jl. Ahmad Yani No.118, Gunung Sari Ilir, Balikpapan Tengah, Kota Balikpapan, Kalimantan Timur 76121.
- Google Maps: https://maps.app.goo.gl/37n98csWeGpB4siH8
- Kontak WhatsApp / Telepon: 08115404999 (0811-540-4999)
- Email: marketing@superkomputer.net
- Tokopedia Resmi: https://www.tokopedia.com/superkomputer
- Jam Operasional:
  * Senin s/d Sabtu: Pukul 09.00 - 20.00 WITA
  * Minggu & Hari Libur Nasional: Tutup

# 4 KATEGORI STATUS SERVIS UTAMA DI SUMTRA
1. **Belum Dikerjakan**: Status 'Diterima' (Unit baru masuk dan mengantre untuk diperiksa/dihandle teknisi).
2. **Sedang Dikerjakan**: Status 'Diagnosa', 'Menunggu Persetujuan Pelanggan', 'Menunggu Sparepart', 'Perbaikan'.
3. **Selesai Pengerjaan**: Status 'Selesai' (QC lolos) atau 'Siap diAmbil' (Unit siap diambil di toko).
4. **Unit Close**: Status 'Close' (Sudah diambil & transaksi lunas) atau 'Cancelled' (Batal servis).
`;

function getCategoryForStatus(status: string): string {
  switch (status) {
    case "Diterima": return "Belum Dikerjakan";
    case "Diagnosa":
    case "Menunggu Persetujuan Pelanggan":
    case "Menunggu Sparepart":
    case "Perbaikan": return "Sedang Dikerjakan";
    case "Selesai":
    case "Siap diAmbil": return "Selesai Pengerjaan";
    case "Close":
    case "Cancelled": return "Unit Close";
    default: return "Lainnya";
  }
}

function getDeviceName(o: any): string {
  const brand = (o.device_brand || "").trim();
  const model = (o.device_model || "").trim();
  if (brand && model) return `${brand} ${model}`;
  if (brand) return brand;
  if (model) return model;
  return o.device_type || "Perangkat";
}

function safeEncodeURIComponent(str: string): string {
  return encodeURIComponent(str)
    .replace(/\(/g, "%28").replace(/\)/g, "%29")
    .replace(/!/g, "%21").replace(/'/g, "%27")
    .replace(/\*/g, "%2A").replace(/~/g, "%7E");
}

// Model prioritas berdasarkan benchmark server-side (Supabase → Gemini API):
// gemini-3.5-flash-lite: 987ms | gemini-3.1-flash-lite: 980ms
// gemini-flash-lite-latest: 690ms | gemini-3.5-flash: 1629ms
const PRIORITY_FAST_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY belum disetel di Secrets Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Payload 'messages' tidak valid." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ═══ LOAD DYNAMIC AI TRAINING SETTINGS (WITH IN-MEMORY CACHE) ═══
    const now = Date.now();
    if (!cachedConfig || now - lastConfigFetch > CONFIG_CACHE_TTL_MS) {
      try {
        const { data: configData, error: configErr } = await supabase.storage
          .from("unit-photos")
          .download("config/ai_training_settings.json");
        if (!configErr && configData) {
          cachedConfig = JSON.parse(await configData.text());
          lastConfigFetch = now;
        }
      } catch (err) {
        console.warn("Could not load dynamic ai settings:", err);
      }
    }

    const dynamicKnowledgeBase = cachedConfig?.knowledge_base || DEFAULT_FALLBACK_KB;
    const dynamicSystemPrompt = cachedConfig?.system_prompt || "";
    const dynamicQaExamples = Array.isArray(cachedConfig?.qa_examples) ? cachedConfig.qa_examples : [];
    const dynamicTemperature = typeof cachedConfig?.temperature === "number" ? cachedConfig.temperature : 0.1;
    const waAdminPhone = cachedConfig?.wa_admin_phone || "628115404999";
    const staleUnassignedHours = cachedConfig?.stale_unassigned_hours || 24;
    const staleInProgressHours = cachedConfig?.stale_inprogress_hours || 48;

    // ═══ EXTRACT USER TEXTS ═══
    const allUserTexts = messages
      .filter((m: any) => m.role === "user" || m.sender === "user")
      .map((m: any) => String(m.parts?.[0]?.text || m.text || ""))
      .join(" ");

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user" || m.sender === "user");
    const lastUserText = String(lastUserMsg?.parts?.[0]?.text || lastUserMsg?.text || "");

    let liveDynamicContext = "";
    let extractedPhone = "";
    let extractedTicket = "";
    let phoneOrdersFound: any[] = [];
    let ticketOrderFound: any = null;
    let isStaleTicket = false;
    let isTechStaleTicket = false;
    let staleDurationStr = "";
    let staleWaDirectLink = "";
    let techReminderSent = false;

    // ═══ 1. CEK NOMOR TIKET ═══
    const ticketMatch =
      lastUserText.match(/\b([A-Za-z]\d{2}\d{3,6}|[A-Za-z]\d{4,8}|SK-\d{4})\b/i) ||
      allUserTexts.match(/\b([A-Za-z]\d{2}\d{3,6}|[A-Za-z]\d{4,8}|SK-\d{4})\b/i);

    if (ticketMatch) {
      extractedTicket = ticketMatch[1].toUpperCase();

      const { data: orderData, error: orderErr } = await supabase
        .from("service_orders")
        .select(`
          id, ticket_number, customer_name, customer_phone,
          device_type, device_brand, device_model, service_type,
          damage_description, unit_condition, unit_accessories,
          status, assigned_technician, created_at, updated_at,
          final_cost, estimated_cost
        `)
        .ilike("ticket_number", extractedTicket)
        .is("deleted_at", null)
        .maybeSingle();

      if (!orderErr && orderData) {
        ticketOrderFound = orderData;

        const costStr = orderData.final_cost != null
          ? `Rp ${Number(orderData.final_cost).toLocaleString("id-ID")}`
          : orderData.estimated_cost != null
          ? `Estimasi Rp ${Number(orderData.estimated_cost).toLocaleString("id-ID")}`
          : "Belum ada rincian final";

        const updatedAtDate = new Date(orderData.updated_at || orderData.created_at || Date.now());
        const diffMs = Math.max(0, Date.now() - updatedAtDate.getTime());
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        const remHours = diffHours % 24;
        staleDurationStr = diffDays > 0 ? `${diffDays} hari ${remHours} jam` : `${diffHours} jam`;

        const category = getCategoryForStatus(orderData.status);
        isStaleTicket = category === "Belum Dikerjakan" && diffHours >= staleUnassignedHours;
        isTechStaleTicket = category === "Sedang Dikerjakan" && diffHours >= staleInProgressHours;

        const waMessageText = `Halo Admin Super Komputer, saya ingin menanyakan progres tiket servis saya (${orderData.ticket_number}):\n\n* Nomor Tiket: #${orderData.ticket_number}\n* Nama: ${orderData.customer_name}\n* Unit: ${getDeviceName(orderData)}\n* Status: ${category} (${orderData.status})\n* Waktu Tunggu: ${staleDurationStr}\n* Keluhan: ${orderData.damage_description || orderData.unit_condition || "-"}\n\nMohon bantuannya untuk menindaklanjuti unit saya. Terima kasih!`;
        staleWaDirectLink = `https://wa.me/${waAdminPhone}?text=${safeEncodeURIComponent(waMessageText)}`;

        // Tech reminder logic
        const isUserAskingTechReminder =
          /(ingatkan|reminder|remind|colek|notif|dorong|percepat|follow\s*up).*teknisi/i.test(lastUserText) ||
          /reminder\s*tiket\s*ke\s*teknisi/i.test(lastUserText) ||
          lastUserText.includes(`/remind-tech/${extractedTicket}`) ||
          lastUserText.toLowerCase().includes("reminder ke teknisi");

        if (isUserAskingTechReminder && (isTechStaleTicket || category === "Sedang Dikerjakan")) {
          const targetTechId = orderData.assigned_technician;
          const notifTitle = "⚠️ Reminder Pelanggan: Tiket Perlu Ditindaklanjuti";
          const notifMessage = `Pelanggan menanyakan tiket #${orderData.ticket_number} (${getDeviceName(orderData)}) yang berstatus '${orderData.status}' dan belum ada pembaruan selama ${staleDurationStr}. Mohon segera ditindaklanjuti!`;

          if (targetTechId) {
            await supabase.from("notifications").insert({ user_id: targetTechId, title: notifTitle, message: notifMessage, order_id: orderData.id, is_read: false });
            const fcmRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
            if (fcmRaw) {
              try {
                const sa = JSON.parse(fcmRaw) as ServiceAccount;
                const fcmProjectId = sa.project_id || Deno.env.get("FIREBASE_PROJECT_ID") || "";
                const accessToken = await getAccessToken(sa);
                const { data: pushTokens } = await supabase.from("staff_push_tokens").select("fcm_token").eq("user_id", targetTechId).eq("is_active", true);
                for (const t of pushTokens || []) {
                  await fetch(`https://fcm.googleapis.com/v1/projects/${fcmProjectId}/messages:send`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ message: { token: t.fcm_token, notification: { title: notifTitle, body: notifMessage }, data: { ticket_number: orderData.ticket_number, url: `/dashboard/orders/${orderData.ticket_number}` } } }),
                  });
                }
              } catch (e) { console.warn("[FCM] Error dispatching push to tech:", e); }
            }
            techReminderSent = true;
          } else {
            const { data: adminRoles } = await supabase.from("user_roles").select("user_id").in("role", ["admin", "owner"]);
            for (const adm of adminRoles || []) {
              await supabase.from("notifications").insert({ user_id: adm.user_id, title: notifTitle, message: notifMessage, order_id: orderData.id, is_read: false });
            }
            techReminderSent = true;
          }
        }

        let staleWarningText = "";
        if (isStaleTicket) {
          staleWarningText = `\n- STATUS PENANGANAN KHUSUS (> ${staleUnassignedHours} JAM BELUM DIKERJAKAN):\n  * Tiket ini berstatus "Belum Dikerjakan" dan sudah masuk selama ${staleDurationStr}.\n  * Tautan Direct Chat WhatsApp Admin: [Chat WhatsApp Admin Super Komputer](${staleWaDirectLink})`;
        } else if (isTechStaleTicket) {
          staleWarningText = `\n- STATUS PENANGANAN KHUSUS (> ${staleInProgressHours} JAM SEDANG DIKERJAKAN BELUM ADA PERUBAHAN STATUS):\n  * Tiket ini berstatus "Sedang Dikerjakan" (${orderData.status}) dan belum ada pembaruan selama ${staleDurationStr}.\n  * Tombol Reminder Langsung ke Teknisi: [🔔 Reminder Tiket ke Teknisi](/remind-tech/${orderData.ticket_number})\n  * Tautan WhatsApp Admin: [Chat WhatsApp Admin Super Komputer](${staleWaDirectLink})`;
        }
        if (techReminderSent) {
          staleWarningText += `\n- STATUS PENGINGAT SUKSES DIKIRIMKAN:\n  * Pengingat telah BERHASIL dikirimkan langsung ke perangkat & akun internal teknisi yang menangani tiket #${orderData.ticket_number}.`;
        }

        liveDynamicContext += `
[DATA TIKET RESMI DARI DATABASE: #${orderData.ticket_number}]
- Nomor Tiket: #${orderData.ticket_number}
- Nama Pelanggan: ${orderData.customer_name}
- Perangkat: ${getDeviceName(orderData)} (${orderData.device_type || "Unit"})
- Kategori Status: ${category} (Status Resmi: ${orderData.status})
- Keluhan: ${orderData.damage_description || orderData.unit_condition || "-"}
- Total Biaya: ${costStr}
- Link Pelacakan: [Buka Pelacakan Tiket #${orderData.ticket_number}](/track/${orderData.ticket_number})
${staleWarningText}
`;
      } else {
        liveDynamicContext += `
[HASIL PENCARIAN TIKET #${extractedTicket}]
- Status: Nomor tiket '${extractedTicket}' tidak ditemukan di database toko Super Komputer. Sampaikan secara ramah.
`;
      }
    }

    // ═══ 2. CEK NOMOR TELEPON — Smart extraction + koreksi typo ═══
    const phoneRegex = /(?:(?:\+?62)|0)[0-9\s\-]{8,16}/g;

    // Kumpulkan SEMUA nomor telepon dari seluruh percakapan (urutan kronologis)
    const allPhoneMatches: string[] = [];
    for (const m of messages) {
      if (m.role !== "user" && m.sender !== "user") continue;
      const txt = String(m.parts?.[0]?.text || m.text || "");
      const matches = txt.match(phoneRegex);
      if (matches) {
        for (const ph of matches) {
          const clean = ph.replace(/[\s\-]/g, "").trim();
          if (clean.length >= 9) allPhoneMatches.push(clean);
        }
      }
    }

    // Deteksi KOREKSI NOMOR: "depan nya 0851", "harusnya 0851", "typo, depan nya 0851"
    const correctionPatterns = [
      /(?:depan|awal|prefix|awalan|harusnya|seharusnya|yang\s*benar|yang\s*bener|bukan\s*\d+\s*tapi|ganti\s*jadi|koreksi|ralat|salah[,.]?\s*(?:yang\s*benar|seharusnya)?)\s*(?:nya\s*)?(?:(?:\+?62)|0)?(\d{3,6})/gi,
      /(?:typo|salah\s*ketik|keliru)[,.]?\s*(?:depan|awal|prefix|awalan)?\s*(?:nya\s*)?(?:(?:\+?62)|0)?(\d{3,6})/gi,
    ];

    let correctedPhone = "";
    if (allPhoneMatches.length > 0) {
      const userMessages = messages
        .filter((m: any) => m.role === "user" || m.sender === "user")
        .map((m: any) => String(m.parts?.[0]?.text || m.text || ""));

      for (let i = 1; i < userMessages.length; i++) {
        for (const pattern of correctionPatterns) {
          pattern.lastIndex = 0;
          const match = pattern.exec(userMessages[i]);
          if (match && match[1]) {
            // Rekonstruksi: ganti prefix nomor lama dengan prefix baru
            // Contoh: 081183267911 → "depan nya 0851" → 085183267911
            const origDigits = allPhoneMatches[0].replace(/^(\+?62|0)/, "");
            const corrDigits = match[1];
            if (corrDigits.length <= origDigits.length) {
              const reconstructed = "0" + corrDigits + origDigits.substring(corrDigits.length);
              if (reconstructed.length >= 10) correctedPhone = reconstructed;
            }
          }
        }
      }
    }

    // Nomor dari pesan terakhir
    const lastPhoneMatches = lastUserText.match(phoneRegex);
    const lastPhoneClean = lastPhoneMatches
      ? lastPhoneMatches.map((p) => p.replace(/[\s\-]/g, "").trim()).filter((p) => p.length >= 9)
      : [];

    // Tentukan nomor yang akan dicari (prioritas: koreksi > pesan terakhir > semua)
    const phonesToQuery = new Set<string>();
    if (correctedPhone) phonesToQuery.add(correctedPhone);
    for (const p of lastPhoneClean) phonesToQuery.add(p);
    if (phonesToQuery.size === 0) {
      for (const p of allPhoneMatches) phonesToQuery.add(p);
    }

    // Query SEMUA nomor unik ke database, ambil hasil terbanyak
    let bestPhoneResult: { phone: string; orders: any[] } | null = null;

    for (const rawPhone of phonesToQuery) {
      const cleanPhone = rawPhone.replace(/\D/g, "");
      if (cleanPhone.length < 9) continue;

      let localPhone = cleanPhone;
      if (cleanPhone.startsWith("0")) localPhone = cleanPhone.substring(1);
      else if (cleanPhone.startsWith("62")) localPhone = cleanPhone.substring(2);

      const { data: phoneOrders, error: phoneErr } = await supabase
        .from("service_orders")
        .select(`
          id, ticket_number, customer_name, customer_phone,
          device_type, device_brand, device_model, service_type,
          damage_description, unit_condition, status,
          created_at, updated_at, final_cost, estimated_cost
        `)
        .or(`customer_phone.ilike.%${localPhone}%,customer_phone.ilike.%${cleanPhone}%`)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!phoneErr && phoneOrders && phoneOrders.length > 0) {
        if (!bestPhoneResult || phoneOrders.length > bestPhoneResult.orders.length) {
          bestPhoneResult = { phone: rawPhone, orders: phoneOrders };
        }
      }
    }

    if (bestPhoneResult) {
      extractedPhone = bestPhoneResult.phone;
      phoneOrdersFound = bestPhoneResult.orders;
      const phoneOrders = bestPhoneResult.orders;

      const belumDikerjakan = phoneOrders.filter((o) => getCategoryForStatus(o.status) === "Belum Dikerjakan");
      const sedangDikerjakan = phoneOrders.filter((o) => getCategoryForStatus(o.status) === "Sedang Dikerjakan");
      const selesaiPengerjaan = phoneOrders.filter((o) => getCategoryForStatus(o.status) === "Selesai Pengerjaan");
      const unitClose = phoneOrders.filter((o) => getCategoryForStatus(o.status) === "Unit Close");

      const formatGroup = (title: string, list: any[]) => {
        if (list.length === 0) return `* **${title}**: 0 unit (Tidak ada)`;
        return `* **${title}** (${list.length} unit):\n${list.map((o) => `  - #${o.ticket_number} (${getDeviceName(o)})`).join("\n")}`;
      };

      liveDynamicContext += `
[DATA TIKET LENGKAP DARI DATABASE UNTUK NO HP: ${extractedPhone}]
- Nama Pemilik: ${phoneOrders[0]?.customer_name || "Pelanggan"}
- Total Keseluruhan Tiket: ${phoneOrders.length} tiket.

JUMLAH DETAIL PER KATEGORI:
1. Belum Dikerjakan: ${belumDikerjakan.length} unit
2. Sedang Dikerjakan: ${sedangDikerjakan.length} unit
3. Selesai Pengerjaan: ${selesaiPengerjaan.length} unit
4. Unit Close: ${unitClose.length} unit

DAFTAR TIKET LENGKAP DENGAN NAMA PERANGKAT:
${formatGroup("1. Belum Dikerjakan", belumDikerjakan)}

${formatGroup("2. Sedang Dikerjakan", sedangDikerjakan)}

${formatGroup("3. Selesai Pengerjaan", selesaiPengerjaan)}

${formatGroup("4. Unit Close", unitClose)}
`;
    } else if (phonesToQuery.size > 0) {
      // Anti-hallucination: Beri tahu AI secara eksplisit nomor apa yang dicari dan TIDAK ditemukan
      const searchedNumbers = [...phonesToQuery].join(", ");
      liveDynamicContext += `
[HASIL PENCARIAN NOMOR HP DI DATABASE]
- Nomor HP yang dicari: ${searchedNumbers}
- Status: TIDAK DITEMUKAN di database SUMTRA. Tidak ada tiket servis yang terdaftar untuk nomor tersebut.
- PENTING: Sampaikan bahwa nomor '${searchedNumbers}' tidak ditemukan. JANGAN mengarang atau mengasumsikan nomor lain. Minta pelanggan mengecek ulang nomor HP yang didaftarkan saat servis, atau berikan alternatif cek menggunakan Nomor Tiket.
`;
    }

    // ═══ BUILD SYSTEM INSTRUCTION ═══
    let qaExamplesContext = "";
    if (dynamicQaExamples.length > 0) {
      qaExamplesContext = "\n\nCONTOH TANYA JAWAB IDEAL (FEW-SHOT TRAINING):\n" +
        dynamicQaExamples.map((q: any) => `Tanya: ${q.question}\nJawab: ${q.answer}`).join("\n\n");
    }

    const systemInstruction = `
${dynamicSystemPrompt || `Kamu adalah "SuperBot", asisten AI resmi dari Super Komputer Balikpapan (SUMTRA).`}

ATURAN PENTING ANTI-HALUSINASI:
- Hanya sampaikan data tiket/nomor HP yang BENAR-BENAR tercantum di bagian "DATA DARI DATABASE SUMTRA" di bawah.
- Jika tidak ada data tiket/nomor HP di bawah, JANGAN mengarang atau mengklaim sudah mencari. Tanyakan ulang nomor HP/tiket yang benar.
- Jika pelanggan mengoreksi nomor (misal "typo, depan nya 0851"), akui koreksinya dan sampaikan hasil pencarian yang sesuai dari data di bawah.

DATA DARI DATABASE SUMTRA:
${liveDynamicContext || "- Tidak ada data tiket khusus pada percakapan ini."}

KNOWLEDGE BASE TOKO (DYNAMIC TRAINED):
${dynamicKnowledgeBase}${qaExamplesContext}
`;

    // ═══ BUILD CLEAN CONTENTS ═══
    const rawClean: { role: "user" | "model"; text: string }[] = [];
    for (const m of messages) {
      const role = m.role === "user" || m.sender === "user" ? "user" : "model";
      const text = String(m.parts?.[0]?.text || m.text || "").trim();
      if (!text) continue;
      if (rawClean.length > 0 && rawClean[rawClean.length - 1].role === role) {
        rawClean[rawClean.length - 1].text += "\n" + text;
      } else {
        rawClean.push({ role, text });
      }
    }
    while (rawClean.length > 0 && rawClean[0].role === "model") rawClean.shift();
    if (rawClean.length === 0) rawClean.push({ role: "user", text: "Halo" });

    const cleanContents = rawClean.map((c) => ({
      role: c.role,
      parts: [{ text: c.text }],
    }));

    // ═══ CALL GEMINI API (priority model fallback) ═══
    let replyText = "";
    let geminiErrors: string[] = [];

    for (const modelName of PRIORITY_FAST_MODELS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: cleanContents,
            generationConfig: { maxOutputTokens: 1500, temperature: dynamicTemperature },
          }),
        });
        clearTimeout(timeoutId);
        const resJson = await res.json();
        if (!resJson.error && resJson.candidates?.[0]?.content?.parts?.[0]?.text) {
          replyText = resJson.candidates[0].content.parts[0].text;
          break;
        } else if (resJson.error) {
          geminiErrors.push(`${modelName}: ${resJson.error.message}`);
        }
      } catch (err: any) {
        geminiErrors.push(`${modelName}: ${err.message}`);
      }
    }

    if (replyText) {
      return new Response(JSON.stringify({ reply: replyText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error("[All Fast Models Failed]", geminiErrors);

    // ═══ SMART INSTANT FALLBACK ═══
    if (techReminderSent) {
      return new Response(
        JSON.stringify({
          reply: `✅ **Pengingat berhasil dikirim ke teknisi penanggung jawab!**\n\nNotifikasi sistem dan push notification (FCM) telah diteruskan langsung ke akun dan HP teknisi kami untuk tiket **#${ticketOrderFound?.ticket_number}** agar unit Anda segera diprioritaskan.\n\n[Chat WhatsApp Admin Super Komputer](${staleWaDirectLink})`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (ticketOrderFound) {
      const cost = ticketOrderFound.final_cost != null
        ? `Rp ${Number(ticketOrderFound.final_cost).toLocaleString("id-ID")}`
        : ticketOrderFound.estimated_cost != null
        ? `Estimasi Rp ${Number(ticketOrderFound.estimated_cost).toLocaleString("id-ID")}`
        : "-";
      return new Response(
        JSON.stringify({
          reply: `Halo! Berikut data resmi untuk tiket **#${ticketOrderFound.ticket_number}** atas nama **${ticketOrderFound.customer_name}**:\n\n• **Perangkat:** ${getDeviceName(ticketOrderFound)}\n• **Kategori:** ${getCategoryForStatus(ticketOrderFound.status)} (${ticketOrderFound.status})\n• **Keluhan:** ${ticketOrderFound.damage_description || ticketOrderFound.unit_condition || "-"}\n• **Total Biaya:** ${cost}\n\n[Buka Pelacakan Tiket #${ticketOrderFound.ticket_number}](/track/${ticketOrderFound.ticket_number})`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        reply: "Halo! Ada yang bisa kami bantu terkait servis laptop, komputer, klaim garansi ASUS, atau pengecekan status tiket servis Anda di Super Komputer Balikpapan?",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Chatbot Edge Function Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Terjadi kesalahan internal pada server AI." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});