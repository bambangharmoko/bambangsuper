import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-auth-token",
};

// ============================================================================
// HELPER: QUERY REAL-TIME LENOVO OFFICIAL WARRANTY API
// ============================================================================
async function fetchLenovoOfficialWarranty(serialNumber: string) {
  try {
    const cleanSN = serialNumber.trim().toUpperCase();
    const res = await fetch("https://pcsupport.lenovo.com/us/en/api/v4/upsell/redport/getIbaseInfo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({
        serialNumber: cleanSN,
        country: "id",
        language: "id",
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();

    if (json.code === 0 && json.data?.machineInfo) {
      const info = json.data.machineInfo;
      const currentW = json.data.currentWarranty || json.data.baseWarranties?.[0];
      const hasADP = (json.data.upgradeWarranties || []).some(
        (u: any) => u.deliveryType === "ADP" || (u.name || "").includes("Accidental Damage")
      );

      return {
        found: true,
        brand: "Lenovo",
        productName: info.productName || "Lenovo Device",
        serial: info.serial || cleanSN,
        productModel: info.product || info.model || "",
        warrantyStatus: json.data.warrantyStatus === "In warranty" ? "Aktif (Masih Bergaransi Resmi)" : "Habis (Out of Warranty)",
        isInWarranty: json.data.warrantyStatus === "In warranty",
        endDate: currentW?.endDate || "Tidak diketahui",
        warrantyName: currentW?.deliveryTypeName || currentW?.name || "Garansi Standar Pabrikan",
        hasADP: hasADP,
        adpInfo: hasADP ? "Tercakup Accidental Damage Protection (ADP)" : "Tidak ada ADP",
      };
    }
    return null;
  } catch (err: any) {
    console.warn("Lenovo warranty lookup error:", err.message);
    return null;
  }
}

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

# LAYANAN AUTHORIZED SERVICE & KLAIM GARANSI RESMI
1. KUALIFIKASI AUTHORIZED SERVICE CENTER RESMI:
   - Super Komputer adalah Service Center Resmi (Authorized Service Center) di Balikpapan untuk merek **Lenovo** & **ASUS** (Laptop LOQ, Legion, IdeaPad, ThinkPad, Yoga, ASUS ROG, TUF Gaming, ZenBook, VivoBook, PC Desktop & All-in-One).
   - Melayani klaim garansi resmi pabrikan (gratis penggantian sparepart original jika masih dalam masa garansi resmi dan memenuhi syarat garansi).
   - Melayani perbaikan non-garansi / out-of-warranty dengan suku cadang original.

2. PENGECEKAN GARANSI RESMI:
   - Lenovo: Sistem SuperBot terhubung langsung ke API resmi Lenovo Global untuk mengecek status Serial Number (SN) secara akurat.
   - ASUS: Melayani klaim garansi resmi ASUS di toko (Jl. Ahmad Yani No. 118 Balikpapan) dan via CS WhatsApp 08115404999. Link portal mandiri ASUS: https://www.asus.com/id/support/warranty-status/

3. MULTI-BRAND REPAIR (SEMUA MEREK):
   - Acer, HP, Dell, MSI, Toshiba, Axioo, Apple MacBook, dll.
   - Penanganan level komponen motherboard: Mati total (matot), korsleting (short circuit), reballing/ganti IC power, BIOS corrupt, ganti keyboard, engsel/casing pecah, ganti layar LCD/LED, penggantian baterai original, cleaning fan & ganti thermal paste premium.

4. SERVIS PRINTER, SCANNER, CCTV & JARINGAN:
   - Epson, Canon, HP, Brother (head buntu, blinking/waste pad, paper jam, mekanik).
   - Pengadaan & Instalasi CCTV Online/Offline, Mesin Absensi Biometrik, Jaringan LAN/WiFi UniFi/Mikrotik.

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

    // 1. CEK APAKAH ADA SERIAL NUMBER LENOVO PADA PESAN PENGGUNA
    // Format SN Lenovo umumnya 8 karakter alfanumerik (contoh: MP2YMGW0, PF123456, YM001234, 8-10 karakter)
    const snMatch = userText.match(/\b([A-Z0-9]{8,10})\b/i);
    const hasLenovoKeyword = /lenovo/i.test(userText);

    if (snMatch) {
      const candidateSN = snMatch[1].toUpperCase();
      // Jangan salah deteksi nomor tiket SUMTRA (yang berformat F26xxx atau G26xxx atau SK-xxx)
      const isSumtraTicket = /^([FG]\d{5}|\d{5})$/i.test(candidateSN);

      if (!isSumtraTicket || hasLenovoKeyword) {
        const lenovoData = await fetchLenovoOfficialWarranty(candidateSN);
        if (lenovoData && lenovoData.found) {
          liveDynamicContext += `
[HASIL PENGECEKAN RESMI REAL-TIME PORTAL LENOVO GLOBAL]
- Merek: Lenovo
- Tipe Laptop / Produk: ${lenovoData.productName} (Model: ${lenovoData.productModel})
- Serial Number (S/N): ${lenovoData.serial}
- Status Garansi: ${lenovoData.warrantyStatus}
- Tanggal Berakhir Garansi Resmi: ${lenovoData.endDate}
- Jenis Garansi: ${lenovoData.warrantyName}
- Perlindungan Tambahan: ${lenovoData.adpInfo}
- Klaim di Toko: Super Komputer adalah Authorized Service Center Resmi Lenovo di Balikpapan. Pelanggan dapat mengklaim garansi resmi unit ini di Super Komputer secara GRATIS (Part Original & Jasa Rp 0) selama kerusakan bukan akibat kelalaian (atau jika ada ADP maka tercover).
`;
        }
      }
    }

    // 2. CEK APAKAH ADA NOMOR TIKET SUMTRA PADA PESAN PENGGUNA
    const ticketMatch = userText.match(/\b([FG]\d{5}|SK-\d{4}|\d{5})\b/i);

    if (ticketMatch && !liveDynamicContext) {
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
1. **PENGECEKAN GARANSI RESMI LENOVO (TERHUBUNG KE API LENOVO)**:
   - Jika terdapat data [HASIL PENGECEKAN RESMI REAL-TIME PORTAL LENOVO GLOBAL], WAJIB tampilkan data resmi tersebut dengan jelas dan rapi:
     * **Tipe Perangkat**: (misal: LOQ 15IRX9 - Type 83DV)
     * **Serial Number**: {SN}
     * **Status Garansi**: Aktif / Expired
     * **Tanggal Berakhir Garansi**: {tanggal}
     * **Jenis Layanan Garansi**: {jenis garansi} (misal: 2Y PremiumCare, ADP, dll.)
     * **Klaim Garansi di Super Komputer**: Jelaskan bahwa Super Komputer adalah **Authorized Service Center Resmi Lenovo di Balikpapan** dan pelanggan dapat langsung membawa unit ke toko di Jl. Ahmad Yani No. 118 Balikpapan untuk klaim garansi resmi (Gratis jasa & part original).

2. **PENGECEKAN GARANSI ASUS**:
   - Jika pelanggan menanyakan garansi ASUS via Serial Number:
     * Jelaskan bahwa Super Komputer adalah Authorized Service Center ASUS resmi di Balikpapan.
     * Portal garansi ASUS memerlukan verifikasi interaktif, sehingga pelanggan disarankan mengirimkan foto SN ke WhatsApp CS [0811-540-4999](https://wa.me/628115404999) atau membawa laptop ke toko, atau cek di [Portal Garansi ASUS](https://www.asus.com/id/support/warranty-status/).

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