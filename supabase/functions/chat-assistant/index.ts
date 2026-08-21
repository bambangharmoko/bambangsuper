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
1. AUTHORIZED SERVICE CENTER RESMI ASUS:
   - Super Komputer adalah **Authorized Service Center Resmi ASUS di Balikpapan**.
   - Melayani klaim garansi resmi dan perbaikan produk ASUS (Laptop ASUS ROG, TUF Gaming, ZenBook, VivoBook, ExpertBook, PC Desktop & All-in-One).
   - GRATIS 100% biaya jasa dan penggantian sparepart original jika unit masih dalam masa garansi resmi ASUS dan memenuhi syarat garansi.
   - Pengecekan Garansi Resmi ASUS Mandiri: https://www.asus.com/id/support/warranty-status-inquiry/
   - Bantuan Pengecekan Garansi ASUS: Pelanggan dapat mengirimkan foto Serial Number (SN) ke WhatsApp CS 0811-540-4999 untuk dicekkan langsung oleh staff via sistem internal ASUS Service Partner.

2. MULTI-BRAND REPAIR (SEMUA MEREK LAPTOP & PC):
   - Acer, HP, Dell, MSI, Lenovo, Toshiba, Axioo, Apple MacBook, dll.
   - Melayani perbaikan profesional non-garansi (out-of-warranty) dan upgrade hardware:
     * Mati total (matot), short circuit motherboard, reballing/ganti IC power, BIOS corrupt.
     * Penggantian LCD/LED panel, keyboard, engsel/casing pecah, baterai original.
     * Cleaning fan & repaste thermal paste premium (Arctic / Noctua).
     * Upgrade SSD NVMe/SATA & RAM DDR4/DDR5.

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

    // 1. CEK APAKAH ADA NOMOR TIKET SUMTRA PADA PESAN PENGGUNA
    const ticketMatch = userText.match(/\b([FG]\d{5}|SK-\d{4}|\d{5})\b/i);

    if (ticketMatch) {
      const extractedTicket = ticketMatch[1].toUpperCase();

      const { data: orderData, error: orderErr } = await supabase
        .from("service_orders")
        .select(`
          id,
          ticket_number,
          customer_name,
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
        const { data: updatesData } = await supabase
          .from("service_updates")
          .select("status, notes, created_at")
          .eq("order_id", orderData.id)
          .order("created_at", { ascending: false })
          .limit(4);

        const timelineStr = (updatesData || [])
          .map(
            (u) =>
              `- [${new Date(u.created_at).toLocaleDateString("id-ID")}] ${u.status}: ${u.notes || "-"}`
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
- Status: Nomor tiket '${extractedTicket}' TIDAK DITEMUKAN di database Super Komputer. Beritahukan pelanggan secara sopan dan sarankan cek kembali nomor tiket di nota/tanda terima servis.
`;
      }
    }

    const dynamicSystemInstruction = `
Kamu adalah "SuperBot", AI Customer Care & Technical Assistant resmi dari "Super Komputer Balikpapan" (aplikasi SUMTRA).

PEDOMAN UTAMA:
1. **LAYANAN SERVICE CENTER RESMI ASUS**:
   - Super Komputer adalah **Authorized Service Center Resmi ASUS di Balikpapan**.
   - Melayani klaim garansi resmi dan perbaikan untuk seluruh lini produk ASUS (ROG, TUF Gaming, ZenBook, VivoBook, ExpertBook, PC Desktop, All-in-One).
   - Jika pelanggan menanyakan cara cek garansi ASUS atau memberikan Serial Number (SN) ASUS:
     * Jelaskan bahwa karena portal publik ASUS menerapkan proteksi captcha, sediakan 3 opsi resmi:
       1) **Cek Mandiri Cepat**: Arahkan ke [Portal Cek Status Garansi ASUS Indonesia](https://www.asus.com/id/support/warranty-status-inquiry/)
       2) **Kirim Foto SN ke CS WhatsApp**: Pelanggan cukup mengirimkan foto Serial Number (SN) di bawah laptop ke WhatsApp CS **[0811-540-4999](https://wa.me/628115404999)** untuk dicekkan langsung oleh staff di portal internal ASUS Service Partner.
       3) **Bawa ke Toko Fisik**: Jl. Ahmad Yani No. 118, Balikpapan (Senin - Sabtu: 09.00 - 20.00 WITA) untuk klaim garansi langsung secara GRATIS (Part Original & Jasa Rp 0).

2. **PERBAIKAN MULTI-BRAND (NON-GARANSI / OUT OF WARRANTY)**:
   - Untuk merek lain (Acer, HP, Dell, MSI, Lenovo, MacBook, dll.), Super Komputer melayani perbaikan profesional non-garansi dengan suku cadang berkualitas dan garansi toko.
   - Jika ada yang menanyakan garansi resmi merek selain ASUS (misal Lenovo/Acer), jelaskan bahwa Super Komputer adalah Authorized Service Center resmi khusus untuk **ASUS**, sedangkan untuk merek lain dilayani sebagai servis multi-brand non-garansi.

3. **PENGECEKAN TIKET SERVIS SUMTRA**:
   - Jika terdapat data [HASIL QUERY DATABASE RESMI SUMTRA UNTUK TIKET ...], gunakan data tersebut secara akurat dan sertakan tombol [Buka Pelacakan Tiket #{nomor_tiket}](/track/{nomor_tiket}).

${liveDynamicContext}

Knowledge Base Toko:
${KNOWLEDGE_BASE}
`;

    // Filter messages: pastikan pesan pertama adalah 'user'
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

    // Model yang didukung
    const MODEL_CANDIDATES = [
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
    ];

    let data: any = null;
    let lastError: any = null;

    for (const modelName of MODEL_CANDIDATES) {
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
              temperature: 0.2,
              thinkingConfig: {
                thinkingBudget: 0,
              },
            },
          }),
        });

        const resJson = await res.json();
        if (!resJson.error) {
          data = resJson;
          break;
        }
        lastError = resJson.error;
        console.warn(`Model ${modelName} error:`, resJson.error.message);
      } catch (e: any) {
        lastError = e;
      }
    }

    if (!data) {
      throw new Error(`Gemini API Error: ${lastError?.message || JSON.stringify(lastError)}`);
    }

    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Maaf, saya tidak dapat merespons saat ini. Silakan hubungi WhatsApp CS Super Komputer di 08115404999.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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