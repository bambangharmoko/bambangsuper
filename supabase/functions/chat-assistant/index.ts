import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-auth-token",
};

// ============================================================================
// RAG KNOWLEDGE BASE: SUPER KOMPUTER BALIKPAPAN & SUMTRA
// ============================================================================
const KNOWLEDGE_BASE = `
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

# SISTEM PENGECEKAN TIKET SERVIS DI SUMTRA
- SuperBot BISA DAN MAMPU mengecek tiket langsung melalui **Nomor Tiket** (contoh: A26001, G26052, K26001) ATAU **Nomor HP / WhatsApp terdaftar**.
- Format Nomor Tiket: [Huruf Bulan A-L][2 Digit Tahun][Nomor Urut 3+ Digit] (A=Januari s/d L=Desember).
- Jika pelanggan bertanya apakah bisa cek menggunakan nomor HP, jawab dengan tegas dan ramah: "Tentu saja bisa! Silakan ketikkan nomor HP Anda yang terdaftar saat servis, saya akan langsung bantu mengecek seluruh daftar tiket Anda."

# LAYANAN AUTHORIZED SERVICE CENTER & KLAIM GARANSI
1. AUTHORIZED SERVICE CENTER RESMI ASUS (EKSKLUSIF):
   - Super Komputer adalah **Authorized Service Center Resmi ASUS di Balikpapan** (satu-satunya brand mitra authorized resmi saat ini).
   - Melayani klaim garansi resmi dan perbaikan produk ASUS (Laptop ASUS ROG, TUF Gaming, ZenBook, VivoBook, ExpertBook, PC Desktop & All-in-One).
   - GRATIS 100% biaya jasa dan penggantian sparepart original jika unit masih dalam masa garansi resmi ASUS dan memenuhi syarat garansi.
   - Pengecekan Garansi Resmi ASUS Mandiri: https://www.asus.com/id/support/warranty-status-inquiry/
   - Bantuan Pengecekan Garansi ASUS: Pelanggan dapat mengirimkan foto Serial Number (SN) ke WhatsApp CS 0811-540-4999 untuk dicekkan langsung oleh staff via sistem internal ASUS Service Partner.

2. STATUS MEREK LAIN (TERMASUK LENOVO, ACER, HP, DELL, DLL):
   - **PENTING**: Super Komputer **SUDAH TIDAK LAGI** menjadi Authorized Service Partner Lenovo.
   - Super Komputer saat ini HANYA memegang lisensi Authorized Service Center resmi untuk **ASUS**.
   - Untuk merek lain (Lenovo, Acer, HP, Dell, MSI, Toshiba, Axioo, Apple MacBook, dll.), Super Komputer melayani sebagai **Multi-Brand Repair Profesional Non-Garansi (Out of Warranty)**:
     * Mati total (matot), short circuit motherboard, reballing/ganti IC power, BIOS corrupt.
     * Penggantian LCD/LED panel, keyboard, engsel/casing pecah, baterai original.
     * Cleaning fan & repaste thermal paste premium (Arctic / Noctua).
     * Upgrade SSD NVMe/SATA & RAM DDR4/DDR5.
     * Semua pengerjaan non-garansi diberikan Garansi Servis Toko resmi (1 hingga 3 bulan).

3. SERVIS PRINTER, CCTV, & SOLUSI IT KORPORAT:
   - Printer Epson, Canon, HP, Brother (head buntu, blinking waste ink pad, paper jam, sistem infus).
   - Pengadaan & Instalasi CCTV Online/Offline (Hikvision, Dahua).
   - Mesin Absensi Biometrik (Fingerprint & Face Recognition).
   - Infrastruktur Jaringan (LAN Cabling, Mikrotik, Cisco, WiFi Ubiquiti UniFi).

# PROSEDUR SERVIS TOKO & SLA
- Alur Pengerjaan: Unit Diterima -> Diagnosa Teknisi -> Konfirmasi Biaya & Kerusakan ke Pelanggan -> Pengerjaan / Penggantian Part -> Quality Control (QC) -> Selesai / Siap Diambil.
- Estimasi Waktu Diagnosa: 1 - 2 hari kerja.
- Estimasi Waktu Pengerjaan: 2 - 4 hari kerja (tergantung ketersediaan sparepart).
- Garansi Servis Toko: Setiap perbaikan mendapatkan garansi (1 bulan hingga 3 bulan sesuai jenis perbaikan/part).
`;

let cachedModelsList: string[] = [];

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

    // Inisialisasi Supabase client dengan Service Role Key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // GABUNGKAN SEMUA TEKS DARI RIWAYAT PERCAKAPAN UNTUK MENDETEKSI MEMORI TIKET / NOMOR HP
    const allUserTexts = messages
      .filter((m) => m.role === "user" || m.sender === "user")
      .map((m) => String(m.parts?.[0]?.text || m.text || ""))
      .join(" ");

    // Ambil pesan terakhir user
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user" || m.sender === "user");
    const lastUserText = String(lastUserMsg?.parts?.[0]?.text || lastUserMsg?.text || "");

    let liveDynamicContext = "";
    let extractedPhone = "";
    let extractedTicket = "";
    let phoneOrdersFound: any[] = [];
    let ticketOrderFound: any = null;

    // 1. CEK NOMOR TIKET: fleksibel huruf A-Z diikuti digit (contoh: K26001, G26052, A24001, SK-2401)
    const ticketMatch =
      lastUserText.match(/\b([A-Za-z]\d{2}\d{3,6}|[A-Za-z]\d{4,8}|SK-\d{4})\b/i) ||
      allUserTexts.match(/\b([A-Za-z]\d{2}\d{3,6}|[A-Za-z]\d{4,8}|SK-\d{4})\b/i);

    // 2. CEK NOMOR TELEPON DARI PESAN TERAKHIR MAUPUN SELURUH RIWAYAT CHAT
    const phoneMatch =
      lastUserText.match(/(?:(?:\+?62)|0)[0-9\s\-]{8,16}/) ||
      allUserTexts.match(/(?:(?:\+?62)|0)[0-9\s\-]{8,16}/);

    if (ticketMatch) {
      extractedTicket = ticketMatch[1].toUpperCase();

      const { data: orderData, error: orderErr } = await supabase
        .from("service_orders")
        .select(`
          id,
          ticket_number,
          customer_name,
          customer_phone,
          device_type,
          device_brand,
          device_model,
          service_type,
          damage_description,
          unit_condition,
          unit_accessories,
          status,
          created_at,
          updated_at,
          final_cost,
          estimated_cost
        `)
        .ilike("ticket_number", extractedTicket)
        .is("deleted_at", null)
        .maybeSingle();

      if (!orderErr && orderData) {
        ticketOrderFound = orderData;

        const costStr =
          orderData.final_cost != null
            ? `Rp ${Number(orderData.final_cost).toLocaleString("id-ID")}`
            : orderData.estimated_cost != null
            ? `Estimasi Rp ${Number(orderData.estimated_cost).toLocaleString("id-ID")}`
            : "Belum ada rincian final";

        liveDynamicContext += `
[DATA TIKET RESMI DARI DATABASE: #${orderData.ticket_number}]
- Nomor Tiket: ${orderData.ticket_number}
- Nama Pelanggan: ${orderData.customer_name}
- Perangkat: ${orderData.device_brand || ""} ${orderData.device_model || ""} (${orderData.device_type || "Unit"})
- Status Terkini: ${orderData.status}
- Keluhan: ${orderData.damage_description || orderData.unit_condition || "-"}
- Total Biaya: ${costStr}
- Link Pelacakan: [Buka Pelacakan Tiket #${orderData.ticket_number}](/track/${orderData.ticket_number})
`;
      } else {
        liveDynamicContext += `
[HASIL PENCARIAN TIKET #${extractedTicket}]
- Status: Nomor tiket '${extractedTicket}' tidak ditemukan di database toko Super Komputer.
- Catatan: Sampaikan secara ramah bahwa nomor tiket tersebut belum terdaftar/tidak ditemukan di database toko kami. JANGAN menghakimi atau mempermasalahkan format huruf/angka tiket pengguna.
`;
      }
    }

    if (phoneMatch) {
      extractedPhone = phoneMatch[0].trim();
      const cleanPhone = extractedPhone.replace(/\D/g, "");

      if (cleanPhone.length >= 9) {
        let localPhone = cleanPhone;
        if (cleanPhone.startsWith("0")) {
          localPhone = cleanPhone.substring(1);
        } else if (cleanPhone.startsWith("62")) {
          localPhone = cleanPhone.substring(2);
        }

        const { data: phoneOrders, error: phoneErr } = await supabase
          .from("service_orders")
          .select(`
            id,
            ticket_number,
            customer_name,
            customer_phone,
            device_type,
            device_brand,
            device_model,
            service_type,
            damage_description,
            unit_condition,
            status,
            created_at,
            updated_at,
            final_cost,
            estimated_cost
          `)
          .or(`customer_phone.ilike.%${localPhone}%,customer_phone.ilike.%${cleanPhone}%`)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(30);

        if (!phoneErr && phoneOrders && phoneOrders.length > 0) {
          phoneOrdersFound = phoneOrders;
          const ordersList = phoneOrders
            .map((ord, idx) => {
              const cost =
                ord.final_cost != null
                  ? `Rp ${Number(ord.final_cost).toLocaleString("id-ID")}`
                  : ord.estimated_cost != null
                  ? `Estimasi Rp ${Number(ord.estimated_cost).toLocaleString("id-ID")}`
                  : "-";
              return `${idx + 1}. Tiket #${ord.ticket_number} (${ord.device_brand || ""} ${ord.device_model || ""}) - Status: "${ord.status}" - Biaya: ${cost} - Link: [Buka Pelacakan Tiket #${ord.ticket_number}](/track/${ord.ticket_number})`;
            })
            .join("\n");

          liveDynamicContext += `
[DATA PELANGGAN UNTUK NO HP: ${extractedPhone}]
- Total Tiket di Database: ${phoneOrders.length} tiket.
- Nama Pemilik: ${phoneOrders[0]?.customer_name || "Pelanggan"}
- Daftar Lengkap Semua Tiket:
${ordersList}
`;
        }
      }
    }

    const systemInstruction = `
Kamu adalah "SuperBot", asisten AI resmi dari Super Komputer Balikpapan (SUMTRA).

ATURAN PENTING & GAYA KOMUNIKASI:
1. **KEMAMPUAN PENGECEKAN TIKET (NOMOR TIKET & NOMOR HP)**:
   - SuperBot BISA DAN MAMPU mengecek tiket langsung melalui NOMOR TIKET maupun NOMOR HP/WhatsApp pelanggan.
   - Jika pelanggan bertanya apakah bisa cek tiket menggunakan nomor HP (contoh: "apakah bisa cek pakai no hp?", "kalau cek pakai nomor hp ku bisa?"), jawab: "Tentu saja bisa! Silakan ketikkan nomor HP atau nomor WhatsApp Anda yang terdaftar saat servis, saya akan langsung bantu carikan data tiket Anda di sistem."
   - JANGAN PERNAH mengatakan bahwa SuperBot "belum bisa melakukan pencarian langsung berdasarkan nomor HP secara mandiri".

2. **INFORMASI TIKET YANG DITAMPILKAN (JANGAN TAMPILKAN CATATAN INTERNAL)**:
   - Saat menampilkan data tiket pelanggan, HANYA tampilkan:
     • Nomor Tiket
     • Nama Pelanggan
     • Perangkat (Merk/Model)
     • Status Terkini
     • Keluhan
     • Total / Estimasi Biaya
     • Tombol Pelacakan: [Buka Pelacakan Tiket #{nomor_tiket}](/track/{nomor_tiket})
   - JANGAN menampilkan atau menyebutkan "Riwayat Progres" atau catatan teknisi internal karena bersifat internal.

3. **PENANGANAN NOMOR TIKET**:
   - Format nomor tiket SUMTRA adalah [Huruf Bulan A-L][2 Digit Tahun][Nomor Urut] (misal: A26001, F26016, K26001, dll.).
   - JANGAN PERNAH menyalahkan, mengoreksi, atau mempermasalahkan format huruf/angka nomor tiket pengguna (jangan pernah berkata "format resmi hanya F26 atau G26").
   - Jika nomor tiket tidak ditemukan di database, cukup katakan bahwa tiket tersebut tidak ditemukan di database, lalu sarankan cek nota fisik atau kirimkan nomor HP terdaftar.

4. **MEMORI PERCAKAPAN & MULTI-TURN**:
   - Jika percakapan sudah berlangsung, JANGAN MENGULANG salam pembuka awal.
   - Jawab langsung pertanyaan pengguna secara cerdas dan akurat berdasarkan data di "DATA DARI DATABASE SUMTRA".

DATA DARI DATABASE SUMTRA:
${liveDynamicContext || "- Tidak ada data tiket khusus pada percakapan ini."}

Knowledge Base Toko:
${KNOWLEDGE_BASE}
`;

    // ═══ FORMAT BROWSER/GEMINI CONVERSATION PAYLOAD ═══
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

    while (rawClean.length > 0 && rawClean[0].role === "model") {
      rawClean.shift();
    }

    if (rawClean.length === 0) {
      rawClean.push({ role: "user", text: "Halo" });
    }

    const cleanContents = rawClean.map((c) => ({
      role: c.role,
      parts: [{ text: c.text }],
    }));

    // Dynamic discovery of supported Gemini models
    if (cachedModelsList.length === 0) {
      try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const listJson = await listRes.json();
        if (Array.isArray(listJson.models)) {
          cachedModelsList = listJson.models
            .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
            .map((m: any) => m.name.replace(/^models\//, ""))
            .sort((a: string, b: string) => {
              if (a.includes("flash") && !b.includes("flash")) return -1;
              if (!a.includes("flash") && b.includes("flash")) return 1;
              return 0;
            });
        }
      } catch (err) {
        console.warn("Failed to list models:", err);
      }
    }

    const candidateModels = [
      ...cachedModelsList,
      "gemini-1.5-flash-8b",
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
    ].filter((v, i, arr) => v && arr.indexOf(v) === i);

    let replyText = "";
    let geminiErrors: string[] = [];

    for (const modelName of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: cleanContents,
            generationConfig: {
              maxOutputTokens: 1500,
              temperature: 0.3,
            },
          }),
        });

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

    console.error("[All Models Failed]", geminiErrors);

    // ═══ SMART FALLBACK JIKA MODEL SEDANG RATE-LIMITED ═══
    const isAskingAboutPhoneCapability =
      /(cek.*(nomor|no|nohp|hp|telepon|wa|whatsapp))|((nomor|no|nohp|hp|telepon|wa|whatsapp).*bisa)/i.test(lastUserText);

    if (isAskingAboutPhoneCapability && !extractedPhone) {
      return new Response(
        JSON.stringify({
          reply: "Tentu saja bisa! Silakan ketikkan nomor HP atau nomor WhatsApp Anda yang terdaftar saat menyerahkan unit servis di sini, saya akan langsung mengecek seluruh data tiket Anda di database.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (extractedTicket && !ticketOrderFound) {
      return new Response(
        JSON.stringify({
          reply: `Maaf, nomor tiket **#${extractedTicket}** tidak ditemukan di sistem database servis Super Komputer. Mohon periksa kembali nomor tiket pada nota fisik Anda, atau berikan nomor HP yang terdaftar saat servis, atau hubungi WhatsApp CS kami di [0811-540-4999](https://wa.me/628115404999).`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (ticketOrderFound) {
      const cost =
        ticketOrderFound.final_cost != null
          ? `Rp ${Number(ticketOrderFound.final_cost).toLocaleString("id-ID")}`
          : ticketOrderFound.estimated_cost != null
          ? `Estimasi Rp ${Number(ticketOrderFound.estimated_cost).toLocaleString("id-ID")}`
          : "-";

      return new Response(
        JSON.stringify({
          reply: `Halo! Berikut data resmi untuk tiket **#${ticketOrderFound.ticket_number}** atas nama **${ticketOrderFound.customer_name}**:\n\n• **Perangkat:** ${ticketOrderFound.device_brand || ""} ${ticketOrderFound.device_model || ""}\n• **Status Terkini:** ${ticketOrderFound.status}\n• **Keluhan:** ${ticketOrderFound.damage_description || ticketOrderFound.unit_condition || "-"}\n• **Total Biaya:** ${cost}\n\n[Buka Pelacakan Tiket #${ticketOrderFound.ticket_number}](/track/${ticketOrderFound.ticket_number})`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (phoneOrdersFound.length > 0) {
      const listStr = phoneOrdersFound
        .map((ord) => {
          const cost =
            ord.final_cost != null
              ? `Rp ${Number(ord.final_cost).toLocaleString("id-ID")}`
              : ord.estimated_cost != null
              ? `Estimasi Rp ${Number(ord.estimated_cost).toLocaleString("id-ID")}`
              : "-";
          return `• **Tiket #${ord.ticket_number}** (${ord.device_brand || ""} ${ord.device_model || ""})\n  - **Status:** ${ord.status}\n  - **Biaya:** ${cost}\n  [Buka Pelacakan Tiket #${ord.ticket_number}](/track/${ord.ticket_number})`;
        })
        .join("\n\n");

      return new Response(
        JSON.stringify({
          reply: `Halo! Berdasarkan pengecekan nomor telepon **${extractedPhone}**, berikut data tiket servis Anda di Super Komputer:\n\n${listStr}\n\nAda hal lain yang dapat kami bantu terkait tiket servis Anda?`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        reply: "Halo! Ada yang bisa kami bantu terkait servis komputer, laptop, klaim garansi ASUS, atau pengecekan status tiket Anda? Silakan tanyakan langsung di sini.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Chatbot Edge Function Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Terjadi kesalahan internal pada server AI." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});