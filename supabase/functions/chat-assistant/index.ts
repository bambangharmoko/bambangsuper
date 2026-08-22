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

let cachedWorkingModel = "";

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

    // Ambil pesan terakhir dari user
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user" || m.sender === "user");
    const userText = String(lastUserMsg?.parts?.[0]?.text || lastUserMsg?.text || "");

    let liveDynamicContext = "";
    let matchedOrder: any = null;
    let matchedPhoneOrders: any[] = [];
    let extractedPhone = "";
    let extractedTicket = "";

    // 1. CEK APAKAH ADA NOMOR TIKET SUMTRA PADA PESAN PENGGUNA (contoh: F26001, G26001, SK-2401)
    const ticketMatch = userText.match(/\b([FG]\d{5}|SK-\d{4}|\d{5})\b/i);

    // 2. CEK APAKAH ADA NOMOR TELEPON PADA PESAN PENGGUNA (contoh: 085183267911, +6285183267911, 0811-540-4999)
    const phoneMatch = userText.match(/(?:(?:\+?62)|0)[0-9\s\-]{8,16}/);

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
          notes,
          unit_checks,
          created_at,
          updated_at,
          invoice_items,
          final_cost,
          estimated_cost,
          warranty_duration,
          warranty_unit,
          warranty_expiry,
          warranty_notes
        `)
        .ilike("ticket_number", extractedTicket)
        .is("deleted_at", null)
        .maybeSingle();

      if (!orderErr && orderData) {
        matchedOrder = orderData;
        const { data: updatesData } = await supabase
          .from("service_updates")
          .select("status, description, created_at")
          .eq("order_id", orderData.id)
          .order("created_at", { ascending: false })
          .limit(5);

        const timelineStr = (updatesData || [])
          .map(
            (u) =>
              `- [${new Date(u.created_at).toLocaleDateString("id-ID")}] ${u.status}: ${u.description || "-"}`
          )
          .join("\n");

        const costStr =
          orderData.final_cost != null
            ? `Rp ${Number(orderData.final_cost).toLocaleString("id-ID")}`
            : orderData.estimated_cost != null
            ? `Estimasi Rp ${Number(orderData.estimated_cost).toLocaleString("id-ID")}`
            : "Belum ada rincian final";

        const warrantyStr = orderData.warranty_expiry
          ? `Aktif sampai ${new Date(orderData.warranty_expiry).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}`
          : orderData.warranty_duration
          ? `${orderData.warranty_duration} ${orderData.warranty_unit || "hari"}`
          : "Tidak ada garansi khusus";

        liveDynamicContext += `
[HASIL QUERY DATABASE RESMI SUMTRA UNTUK TIKET ${orderData.ticket_number}]
- Nomor Tiket: ${orderData.ticket_number}
- Nama Pelanggan: ${orderData.customer_name}
- Perangkat: ${orderData.device_brand || ""} ${orderData.device_model || ""} (${orderData.device_type || "Unit"})
- Status Terkini: ${orderData.status}
- Tipe Servis: ${orderData.service_type}
- Keluhan Awal: ${orderData.damage_description || orderData.unit_condition || "-"}
- Catatan Teknisi: ${orderData.notes || "-"}
- Total Biaya: ${costStr}
- Garansi Toko: ${warrantyStr}
- Riwayat Progres:
${timelineStr || "- Belum ada catatan timeline tambahan"}
- Link Pelacakan Detail: [Buka Pelacakan Tiket #${orderData.ticket_number}](/track/${orderData.ticket_number})
`;
      } else if (!orderErr && !orderData) {
        liveDynamicContext += `
[HASIL QUERY DATABASE RESMI SUMTRA UNTUK TIKET ${extractedTicket}]
- Status: Nomor tiket '${extractedTicket}' TIDAK DITEMUKAN di database Super Komputer. Beritahukan pelanggan secara sopan dan sarankan cek kembali nomor tiket di nota/tanda terima servis atau hubungi CS WhatsApp 08115404999.
`;
      }
    } else if (phoneMatch) {
      extractedPhone = phoneMatch[0].trim();
      const cleanPhone = extractedPhone.replace(/\D/g, "");

      if (cleanPhone.length >= 9) {
        let localPhone = cleanPhone;
        if (cleanPhone.startsWith("0")) {
          localPhone = cleanPhone.substring(1);
        } else if (cleanPhone.startsWith("62")) {
          localPhone = cleanPhone.substring(2);
        }

        // Query database servis berdasarkan nomor telepon
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
            notes,
            created_at,
            updated_at,
            final_cost,
            estimated_cost,
            warranty_duration,
            warranty_unit,
            warranty_expiry
          `)
          .or(`customer_phone.ilike.%${localPhone}%,customer_phone.ilike.%${cleanPhone}%`)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(6);

        if (!phoneErr && phoneOrders && phoneOrders.length > 0) {
          matchedPhoneOrders = phoneOrders;
          const ordersSummary = phoneOrders
            .map((ord, idx) => {
              const costStr =
                ord.final_cost != null
                  ? `Rp ${Number(ord.final_cost).toLocaleString("id-ID")}`
                  : ord.estimated_cost != null
                  ? `Estimasi Rp ${Number(ord.estimated_cost).toLocaleString("id-ID")}`
                  : "Belum ada rincian final";

              const createdDate = ord.created_at
                ? new Date(ord.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "-";

              return `
Tiket #${idx + 1}:
- Nomor Tiket: ${ord.ticket_number}
- Nama Pelanggan: ${ord.customer_name}
- Perangkat: ${ord.device_brand || ""} ${ord.device_model || ""} (${ord.device_type || "Unit"})
- Status Terkini: ${ord.status}
- Keluhan: ${ord.damage_description || ord.unit_condition || "-"}
- Total Biaya: ${costStr}
- Tanggal Masuk: ${createdDate}
- Tombol Pelacakan: [Buka Pelacakan Tiket #${ord.ticket_number}](/track/${ord.ticket_number})
`;
            })
            .join("\n------------------\n");

          liveDynamicContext += `
[HASIL QUERY DATABASE RESMI SUMTRA UNTUK NOMOR TELEPON ${extractedPhone}]
Ditemukan ${phoneOrders.length} riwayat tiket servis resmi di database:
${ordersSummary}
`;
        } else {
          liveDynamicContext += `
[HASIL QUERY DATABASE RESMI SUMTRA UNTUK NOMOR TELEPON ${extractedPhone}]
- Status: TIDAK DITEMUKAN tiket servis aktif maupun riwayat servis dengan nomor telepon '${extractedPhone}' di database Super Komputer.
- Tindakan: Beritahukan pelanggan secara sopan bahwa nomor telepon tersebut belum terdaftar pada sistem tiket kami. Sarankan untuk memeriksa kembali nomor telepon yang diberikan saat servis, atau berikan nomor tiket (contoh: F26001), atau hubungi CS WhatsApp di 08115404999.
`;
        }
      }
    }

    const dynamicSystemInstruction = `
Kamu adalah "SuperBot", AI Customer Care & Technical Assistant resmi dari "Super Komputer Balikpapan" (aplikasi SUMTRA).

PEDOMAN UTAMA & ATURAN ANTI-HALUSINASI (SANGAT KETAT):
1. **DILARANG MENGARANG ATAU MEMBUAT DATA TIKET/SERVIS PALSU**:
   - Anda HANYA boleh memberikan rincian tiket servis JIKA data tersebut ADA pada bagian "[HASIL QUERY DATABASE RESMI SUMTRA ...]" di bawah.
   - Format nomor tiket resmi Super Komputer / SUMTRA SELALU diawali huruf 'F' atau 'G' dengan 5 angka (contoh: F26016, F26001, G26052).
   - JANGAN PERNAH membuat atau mengarang nomor tiket fiktif (seperti #SRV-xxxx, #TK-xxxx), tanggal perkiraan selesai buatan sendiri, nama unit fiktif (misal Asus TUF fiktif jika data menyatakan Lenovo), atau status pengerjaan fiktif jika tidak tercantum di query database.
   - Jika pelanggan menanyakan status servis tapi belum menyebutkan nomor tiket atau nomor HP, mintalah nomor tiket (contoh: F26001) atau nomor HP yang terdaftar.
   - Jika hasil query menyatakan tiket/nomor telepon TIDAK DITEMUKAN, sampaikan dengan jujur dan sopan, lalu sarankan untuk cek nota atau hubungi CS WhatsApp 0811-540-4999.

2. **FORMAT PENYAJIAN TIKET DATABASE**:
   - Jika data tiket ditemukan, tampilkan nomor tiket yang asli, nama pemilik, perangkat, dan status terkini dengan jelas.
   - Sertakan link tombol pelacakan: [Buka Pelacakan Tiket #{nomor_tiket}](/track/{nomor_tiket}).

3. **LAYANAN SERVICE CENTER RESMI ASUS**:
   - Super Komputer adalah **Authorized Service Center Resmi ASUS di Balikpapan**.
   - Melayani klaim garansi resmi dan perbaikan untuk seluruh lini produk ASUS (ROG, TUF Gaming, ZenBook, VivoBook, ExpertBook, PC Desktop, All-in-One).
   - Jika pelanggan menanyakan cara cek garansi ASUS atau memberikan Serial Number (SN) ASUS:
     1) **Cek Mandiri Cepat**: Arahkan ke [Portal Cek Status Garansi ASUS Indonesia](https://www.asus.com/id/support/warranty-status-inquiry/)
     2) **Kirim Foto SN ke CS WhatsApp**: Pelanggan cukup mengirimkan foto Serial Number (SN) ke WhatsApp CS **[0811-540-4999](https://wa.me/628115404999)** untuk dicekkan langsung oleh staff di portal internal ASUS Service Partner.
     3) **Bawa ke Toko Fisik**: Jl. Ahmad Yani No. 118, Balikpapan (Senin - Sabtu: 09.00 - 20.00 WITA) untuk klaim garansi langsung GRATIS.

4. **STATUS LENOVO & MEREK LAIN (NON-GARANSI / OUT OF WARRANTY)**:
   - **PENTING TENTANG LENOVO**: Toko Super Komputer **SUDAH TIDAK MENJADI Authorized Service Partner Lenovo lagi**.
   - Super Komputer saat ini **HANYA** menjadi Authorized Service Center resmi untuk **ASUS**.
   - Untuk merek lain (Lenovo, Acer, HP, Dell, MSI, Apple MacBook, Axioo, dll.), dilayani sebagai perbaikan profesional multi-brand non-garansi toko (bergaransi 1-3 bulan).

DATA REALTIME DARI DATABASE SUMTRA SAAT INI:
${liveDynamicContext || "- Tidak ada data query tiket/telepon pada pesan ini (Gunakan pengetahuan umum toko atau minta nomor tiket/HP jika menanyakan servis)."}

Knowledge Base Toko:
${KNOWLEDGE_BASE}
`;

    // Filter messages: pastikan format rapi
    const cleanContents: any[] = [];
    for (const m of messages) {
      if (cleanContents.length === 0 && m.role === "model") {
        continue;
      }
      cleanContents.push({
        role: m.role === "user" ? "user" : "model",
        parts: m.parts || [{ text: m.text || "" }],
      });
    }

    if (cleanContents.length === 0) {
      cleanContents.push({
        role: "user",
        parts: [{ text: "Halo" }],
      });
    }

    // Dynamic model candidate discovery
    const candidates = [
      cachedWorkingModel,
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-flash-latest",
    ].filter(Boolean);

    let data: any = null;
    let lastError: any = null;

    for (const modelName of candidates) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: dynamicSystemInstruction }] },
            contents: cleanContents,
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.1,
              thinkingConfig: {
                thinkingBudget: 0,
              },
            },
          }),
        });

        const resJson = await res.json();
        if (!resJson.error && resJson.candidates?.[0]?.content?.parts?.[0]?.text) {
          data = resJson;
          cachedWorkingModel = modelName;
          break;
        }
        lastError = resJson.error;
      } catch (e: any) {
        lastError = e;
      }
    }

    // Jika AI model berhasil merespons
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const reply = data.candidates[0].content.parts[0].text;
      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GRACEFUL SMART FALLBACK:
    // Jika AI provider mengalami rate-limit atau error, berikan respons langsung berbasis database
    if (matchedPhoneOrders.length > 0) {
      const listStr = matchedPhoneOrders
        .map((ord) => {
          const cost =
            ord.final_cost != null
              ? `Rp ${Number(ord.final_cost).toLocaleString("id-ID")}`
              : ord.estimated_cost != null
              ? `Estimasi Rp ${Number(ord.estimated_cost).toLocaleString("id-ID")}`
              : "-";

          return `• **Tiket #${ord.ticket_number}**\n  - **Nama:** ${ord.customer_name}\n  - **Unit:** ${ord.device_brand || ""} ${ord.device_model || ""} (${ord.device_type || "Perangkat"})\n  - **Status:** ${ord.status}\n  - **Biaya:** ${cost}\n  [Buka Pelacakan Tiket #${ord.ticket_number}](/track/${ord.ticket_number})`;
        })
        .join("\n\n");

      return new Response(
        JSON.stringify({
          reply: `Halo! Berdasarkan pengecekan nomor telepon **${extractedPhone}**, berikut data tiket servis Anda di Super Komputer:\n\n${listStr}\n\nAda hal lain yang dapat kami bantu terkait tiket servis Anda?`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (matchedOrder) {
      const cost =
        matchedOrder.final_cost != null
          ? `Rp ${Number(matchedOrder.final_cost).toLocaleString("id-ID")}`
          : matchedOrder.estimated_cost != null
          ? `Estimasi Rp ${Number(matchedOrder.estimated_cost).toLocaleString("id-ID")}`
          : "-";

      return new Response(
        JSON.stringify({
          reply: `Halo! Berikut data resmi untuk tiket **#${matchedOrder.ticket_number}** atas nama **${matchedOrder.customer_name}**:\n\n• **Perangkat:** ${matchedOrder.device_brand || ""} ${matchedOrder.device_model || ""}\n• **Status Terkini:** ${matchedOrder.status}\n• **Keluhan:** ${matchedOrder.damage_description || matchedOrder.unit_condition || "-"}\n• **Total Biaya:** ${cost}\n\n[Buka Pelacakan Tiket #${matchedOrder.ticket_number}](/track/${matchedOrder.ticket_number})`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (extractedPhone && matchedPhoneOrders.length === 0) {
      return new Response(
        JSON.stringify({
          reply: `Maaf, nomor telepon **${extractedPhone}** tidak ditemukan pada database servis aktif maupun riwayat toko kami. Mohon pastikan nomor yang Anda berikan sesuai dengan yang didaftarkan saat servis, atau berikan nomor tiket (contoh: *F26001*), atau hubungi WhatsApp CS kami di [0811-540-4999](https://wa.me/628115404999).`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (extractedTicket && !matchedOrder) {
      return new Response(
        JSON.stringify({
          reply: `Maaf, nomor tiket **#${extractedTicket}** tidak ditemukan di sistem database Super Komputer. Mohon periksa kembali nomor tiket pada nota fisik Anda atau hubungi Customer Service kami di WhatsApp: [0811-540-4999](https://wa.me/628115404999).`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default reply jika pertanyaan umum
    const fallbackReply =
      "Halo! Selamat datang di Super Komputer Balikpapan (Authorized Service Center Resmi ASUS). Silakan sebutkan nomor tiket servis Anda (contoh: *F26001*) atau nomor HP yang terdaftar untuk memeriksa status pengerjaan unit Anda, atau tanyakan perihal troubleshooting & perbaikan perangkat.";

    return new Response(
      JSON.stringify({
        reply: data?.candidates?.[0]?.content?.parts?.[0]?.text || fallbackReply,
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