import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

# LAYANAN SERVICE CENTER & KUALIFIKASI
1. AUTHORIZED SERVICE CENTER:
   - Resmi melayani perbaikan dan klaim garansi produk **Lenovo** & **ASUS** (Laptop IdeaPad, Legion, ThinkPad, ASUS ROG, TUF Gaming, ZenBook, VivoBook, PC Desktop & All-in-One).
2. MULTI-BRAND REPAIR (SEMUA MEREK):
   - Acer, HP, Dell, MSI, Toshiba, Axioo, Apple MacBook, dll.
   - Penanganan hardware level komponen: Mati total (matot), korsleting (short circuit), reballing/ganti IC power, charging controller, BIOS corrupt, ganti keyboard, engsel/casing pecah, ganti layar LCD/LED, penggantian baterai original, penggantian kipas pendingin & thermal paste premium (Arctic / Noctua).
3. SERVIS PRINTER & SCANNER:
   - Epson, Canon, HP, Brother.
   - Kerusakan: Head buntu (clogged), blinking / waste ink pad full (reset counter), paper jam terus-menerus, mekanik patah, pasang/servis sistem infus CISS.
4. UPGRADE & RAKIT PC:
   - Upgrade SSD NVMe / SATA (kecepatan booting & aplikasi 5x - 10x lebih cepat).
   - Upgrade RAM DDR4 / DDR5 (multitasking lancar, editing video, gaming).
   - Rakit PC Custom Gaming, Content Creation, Office/Admin, Server lokal.
5. IT SOLUTIONS & KORPORAT:
   - Pengadaan & Instalasi CCTV Online / Offline (Hikvision, Dahua, dll).
   - Mesin Absensi Biometrik (Fingerprint & Face Recognition).
   - Infrastruktur Jaringan (LAN Cabling, Mikrotik, Cisco, WiFi Ubiquiti UniFi).
   - Maintenance contract untuk kantor, perhotelan, sekolah, dan perusahaan tambang/migas.

# PROSEDUR SERVIS, SLA & BIAYA
- Alur Pengerjaan: Unit Diterima -> Diagnosa Teknisi -> Konfirmasi Biaya & Kerusakan ke Pelanggan -> Pengerjaan / Penggantian Part -> Quality Control (QC) -> Selesai / Siap Diambil.
- Estimasi Waktu Diagnosa: 1 - 2 hari kerja.
- Estimasi Waktu Pengerjaan: 2 - 4 hari kerja (tergantung ketersediaan sparepart).
- Garansi Servis: Setiap perbaikan mendapatkan garansi (umumnya 1 bulan hingga 3 bulan tergantung jenis part dan pengerjaan).
- Estimasi Biaya Umum:
  * Pengecekan / Diagnosa Awal: Gratis jika dilanjutkan perbaikan.
  * Install Ulang OS + Basic App: Mulai Rp 100.000 - Rp 150.000.
  * Cleaning Fan & Repaste Thermal Premium: Mulai Rp 100.000 - Rp 150.000.
  * Servis Motherboard / IC Power: Mulai Rp 350.000 (disesuaikan dengan hasil diagnosa).
  * Upgrade SSD / RAM: Biaya part + jasa pasang/kloning transparan.
  * Servis Printer Ringan (Blinking/Reset/Paper Jam): Mulai Rp 75.000 - Rp 150.000.

# PANDUAN TROUBLESHOOTING CEPAT
- Laptop Lemot / Lelet: Sarankan upgrade ke SSD dan tambah kapasitas RAM, serta pembersihan sistem pendingin (thermal paste).
- Laptop Mati Total / Tidak Mau Hidup: Lakukan 'Hard Reset' (Cabut charger & baterai jika removable, tekan tahan tombol power 30 detik, pasang kembali charger lalu nyalakan). Jika tetap mati, bawa ke Super Komputer untuk cek adaptor/IC power.
- Layar Blank / Bergaris: Sambungkan laptop ke monitor eksternal via kabel HDMI. Jika monitor eksternal menampilkan gambar normal, kendala ada pada kabel fleksibel atau panel LCD laptop.
- Printer Hasil Putus-Putus: Lakukan Head Cleaning 1-2 kali melalui driver maintenance di komputer. Jangan head cleaning berlebihan karena bisa membuat waste pad cepat penuh.
`;

// ============================================================================
// SYSTEM INSTRUCTION PROMPT
// ============================================================================
const SYSTEM_INSTRUCTION = `
Kamu adalah "SuperBot", AI Customer Care & Technical Assistant resmi dari "Super Komputer Balikpapan" (aplikasi SUMTRA).

Karakter & Gaya Komunikasi:
1. Bahasa Indonesia yang ramah, sopan, profesional, membantu, dan solutif.
2. Gunakan format Markdown yang rapi (bold, bullet points, emoji yang sesuai) agar pesan mudah dibaca di smartphone maupun desktop.
3. Selalu prioritaskan kepuasan dan kejelasan informasi bagi pelanggan.

Kemampuan & Tugas Utama:
1. Menjawab pertanyaan teknis (troubleshooting) seputar komputer, laptop, PC rakitan, printer, CCTV, jaringan, dan software berdasarkan Knowledge Base.
2. Memberikan informasi profil toko, jam operasional, kontak WhatsApp (08115404999), alamat di Balikpapan, dan link toko online Tokopedia.
3. Memberikan informasi estimasi biaya, garansi, alur servis, dan SLA pengerjaan.
4. **Pengecekan Status Servis (Hybrid Function Calling)**:
   - Jika pengguna menyebutkan atau menanyakan nomor tiket servis (misal: F26001, SK-1002, 26012, dll) atau menanyakan progress servisnya, **KAMU WAJIB MEMANGGIL TOOL check_ticket_status**.
   - Jangan pernah mengarang nomor tiket atau status tiket tanpa data nyata dari tool.
   - Setelah mendapatkan data dari tool, tampilkan ringkasan status tiket dengan sangat rapi:
     * Nomor Tiket & Nama Pelanggan
     * Perangkat (Brand, Model, Jenis)
     * Status Pengerjaan (misal: Diterima, Diagnosa, Perbaikan, Menunggu Sparepart, Selesai, Siap diAmbil)
     * Keluhan & Hasil Diagnosa
     * Rincian Biaya (jika ada)
     * Garansi (jika selesai)
     * Log/Timeline progres terbaru
     * Tautkan tautan ke halaman pelacakan detail: [Buka Pelacakan Tiket #{nomor_tiket}](/track/{nomor_tiket})

Knowledge Base Toko:
${KNOWLEDGE_BASE}
`;

// ============================================================================
// EDGE FUNCTION ENTRYPOINT
// ============================================================================
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

    // Inisialisasi Supabase client dengan Service Role Key untuk akses tool
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Deklarasi Tool / Function Calling untuk AI
    const tools = [
      {
        function_declarations: [
          {
            name: "check_ticket_status",
            description: "Mengecek informasi lengkap status pengerjaan unit servis pelanggan berdasarkan nomor tiket (contoh: F26001, SK-1002, 26012).",
            parameters: {
              type: "OBJECT",
              properties: {
                ticket_number: {
                  type: "STRING",
                  description: "Nomor tiket servis pelanggan (misal: F26001, SK-1002)",
                },
              },
              required: ["ticket_number"],
            },
          },
        ],
      },
    ];

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // 1. Panggilan Pertama ke Gemini
    const firstRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: messages,
        tools: tools,
      }),
    });

    let data = await firstRes.json();

    if (data.error) {
      throw new Error(`Gemini API Error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    const candidate = data.candidates?.[0]?.content;
    const functionCall = candidate?.parts?.find((p: any) => p.functionCall);

    // 2. Jika AI meminta eksekusi Function Calling (check_ticket_status)
    if (functionCall && functionCall.functionCall.name === "check_ticket_status") {
      let rawTicket = String(functionCall.functionCall.args.ticket_number || "").trim();
      // Bersihkan tanda # jika ada
      rawTicket = rawTicket.replace(/^#/, "").trim().toUpperCase();

      let toolResult: Record<string, any> = { found: false, ticket_number: rawTicket };

      // Cari tiket di tabel service_orders
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
          unit_condition,
          status,
          notes,
          unit_checks,
          created_at,
          updated_at,
          invoice_items,
          final_cost,
          warranty_duration,
          warranty_unit,
          warranty_expiry,
          warranty_notes
        `)
        .ilike("ticket_number", rawTicket)
        .is("deleted_at", null)
        .maybeSingle();

      if (orderErr) {
        toolResult = {
          found: false,
          ticket_number: rawTicket,
          message: `Gagal mencari tiket: ${orderErr.message}`,
        };
      } else if (!orderData) {
        toolResult = {
          found: false,
          ticket_number: rawTicket,
          message: `Nomor tiket '${rawTicket}' tidak ditemukan dalam sistem kami. Pastikan nomor tiket sudah sesuai (contoh: F26001).`,
        };
      } else {
        // Ambil riwayat timeline progres jika ada
        const { data: updatesData } = await supabase
          .from("service_updates")
          .select("status, notes, created_at")
          .eq("order_id", orderData.id)
          .order("created_at", { ascending: false })
          .limit(5);

        toolResult = {
          found: true,
          ticket_number: orderData.ticket_number,
          customer_name: orderData.customer_name,
          device: `${orderData.device_brand || ""} ${orderData.device_model || ""} (${orderData.device_type || "Perangkat"})`.trim(),
          service_type: orderData.service_type,
          status: orderData.status,
          unit_condition: orderData.unit_condition,
          notes: orderData.notes,
          diagnosa_unit_checks: orderData.unit_checks,
          invoice_items: orderData.invoice_items,
          final_cost: orderData.final_cost,
          warranty_info: orderData.warranty_expiry
            ? `Garansi sampai ${new Date(orderData.warranty_expiry).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} (${orderData.warranty_notes || ""})`
            : orderData.warranty_duration
            ? `${orderData.warranty_duration} ${orderData.warranty_unit || "hari"}`
            : "Tidak ada garansi khusus",
          recent_timeline: updatesData || [],
          tracking_url: `/track/${orderData.ticket_number}`,
        };
      }

      // Kirim balik hasil function call ke Gemini untuk disintesis menjadi bahasa natural
      const followUpMessages = [
        ...messages,
        candidate,
        {
          role: "function",
          parts: [
            {
              functionResponse: {
                name: "check_ticket_status",
                response: { result: toolResult },
              },
            },
          ],
        },
      ];

      const secondRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: followUpMessages,
        }),
      });

      data = await secondRes.json();
    }

    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Maaf, saat ini saya tidak dapat merespons pertanyaan Anda. Silakan hubungi Customer Service kami di 08115404999.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Chatbot Edge Function Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Terjadi kesalahan internal pada server AI." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});