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

# LAYANAN AUTHORIZED SERVICE & KLAIM GARANSI RESMI
1. KUALIFIKASI AUTHORIZED SERVICE CENTER RESMI:
   - Super Komputer adalah Service Center Resmi (Authorized Service Center) di Balikpapan untuk merek **Lenovo** & **ASUS** (Laptop LOQ, Legion, IdeaPad, ThinkPad, Yoga, ASUS ROG, TUF Gaming, ZenBook, VivoBook, PC Desktop & All-in-One).
   - Melayani klaim garansi resmi pabrikan (gratis penggantian sparepart original jika masih dalam masa garansi resmi dan memenuhi syarat garansi).
   - Melayani perbaikan non-garansi / out-of-warranty dengan suku cadang original.

2. ATURAN PENGECEKAN SERIAL NUMBER (SN) PABRIKAN:
   - AI SuperBot TIDAK memiliki akses langsung ke server internal portal pabrikan global Lenovo / ASUS secara real-time.
   - DILARANG KERAS MENGARANG tipe laptop, status garansi, tanggal berakhir, atau jenis garansi dari Serial Number (SN).
   - Jika pelanggan menanyakan garansi pabrikan dari Serial Number (SN / S/N):
     * Jelaskan dengan jujur bahwa Super Komputer bisa menerima klaim garansi resmi Lenovo & ASUS.
     * Minta pelanggan membawa unit ke toko Super Komputer di Jl. Ahmad Yani No. 118 Balikpapan, atau hubungi CS WhatsApp 08115404999 untuk dicekkan langsung ke portal resmi Lenovo/ASUS oleh staff.
     * Sediakan link resmi untuk pengecekan mandiri:
       - Portal Garansi Lenovo: https://pcsupport.lenovo.com/id/id/warranty-lookup
       - Portal Garansi ASUS: https://www.asus.com/id/support/warranty-status/

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

    // 1. HYBRID RAG PRE-RETRIEVAL: Deteksi otomatis nomor tiket dari database SUMTRA
    let liveTicketContext = "";
    // Format tiket SUMTRA: misal F26001, G26002, SK-1002, 26001
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

        liveTicketContext = `
[HASIL QUERY DATABASE RESMI SUMTRA UNTUK TIKET ${orderData.ticket_number}]
- Nomor Tiket: ${orderData.ticket_number}
- Nama Pelanggan: ${orderData.customer_name}
- Perangkat: ${orderData.device_brand || ""} ${orderData.device_model || ""} (${orderData.device_type || "Unit"})
- Status Terkini: ${orderData.status}
- Tipe Servis: ${orderData.service_type}
- Keluhan Awal: ${orderData.damage_description || orderData.unit_condition || "-"}
- Catatan Teknisi: ${orderData.notes || "-"}
- Total Biaya: ${costStr}
- Garansi: ${warrantyStr}
- Riwayat Progres:
${timelineStr || "- Belum ada catatan timeline tambahan"}
- Link Pelacakan Detail: [Buka Pelacakan Tiket #${orderData.ticket_number}](/track/${orderData.ticket_number})
`;
      } else if (!orderErr && !orderData) {
        liveTicketContext = `
[HASIL QUERY DATABASE RESMI SUMTRA UNTUK TIKET ${extractedTicket}]
- Status: Nomor tiket '${extractedTicket}' TIDAK DITEMUKAN di database Super Komputer. Beritahukan pelanggan secara sopan dan sarankan cek kembali nomor tiket di nota/tanda terima servis.
`;
      }
    }

    const dynamicSystemInstruction = `
Kamu adalah "SuperBot", AI Customer Care & Technical Assistant resmi dari "Super Komputer Balikpapan" (aplikasi SUMTRA).

PEDOMAN INTEGRITAS & KETEPATAN DATA (SANGAT PENTING):
1. **DILARANG KERAS MENGARANG (HALUSINASI) DATA**:
   - Jangan pernah mengarang tipe laptop, tanggal garansi, atau status garansi pabrikan dari Serial Number (SN / S/N).
   - Jika pelanggan memberikan Serial Number (SN) laptop pabrikan (contoh: SN Lenovo 'MP2YMGW0', SN ASUS, dsb):
     * Jelaskan bahwa Super Komputer adalah **Authorized Service Center resmi Lenovo & ASUS di Balikpapan** dan melayani klaim garansi resmi.
     * Jelaskan dengan jujur bahwa untuk memvalidasi tanggal garansi resmi dan spesifikasi tipe unit secara akurat dari Serial Number, pelanggan dapat:
       1) Membawa unit laptop ke toko Super Komputer di Jl. Ahmad Yani No. 118 Balikpapan untuk dicek langsung oleh tim kami di portal resmi Lenovo/ASUS Service.
       2) Menghubungi Admin CS WhatsApp kami di **0811-540-4999** dengan mengirimkan foto Serial Number/nota.
       3) Mengecek mandiri di portal resmi garansi: [Portal Cek Garansi Lenovo](https://pcsupport.lenovo.com/id/id/warranty-lookup) atau [Portal Garansi ASUS](https://www.asus.com/id/support/warranty-status/).
2. **PENGECEKAN NOMOR TIKET SUMTRA**:
   - Jika terdapat data di [HASIL QUERY DATABASE RESMI SUMTRA UNTUK TIKET ...], WAJIB gunakan data nyata tersebut.
   - Format rincian status tiket:
     * **Nomor Tiket**: #{nomor_tiket}
     * **Nama Pelanggan**: {nama}
     * **Perangkat**: {perangkat}
     * **Status Pengerjaan**: {status} (Jelaskan arti status: 'Siap diAmbil' = sudah selesai dan bisa diambil; 'Close' = tiket selesai dan unit sudah diserahkan; 'Diagnosa' = sedang diperiksa; 'Perbaikan' = sedang dikerjakan).
     * **Keluhan / Diagnosa**: {keluhan}
     * **Biaya**: {biaya}
     * **Garansi**: {garansi}
     * Tombol link: [Buka Pelacakan Tiket #{nomor_tiket}](/track/{nomor_tiket})

${liveTicketContext}

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