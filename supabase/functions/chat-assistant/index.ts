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

    // 1. HYBRID RAG PRE-RETRIEVAL: Deteksi otomatis nomor tiket dari teks percakapan
    let liveTicketContext = "";
    const ticketMatch = userText.match(/\b([A-Za-z]\d{4,5}|\d{5})\b/i);

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
[HASIL QUERY REAL-TIME DATABASE UNTUK TIKET ${orderData.ticket_number}]
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
[HASIL QUERY REAL-TIME DATABASE UNTUK TIKET ${extractedTicket}]
- Status: Nomor tiket '${extractedTicket}' TIDAK DITEMUKAN di database Super Komputer. Beritahukan pelanggan secara sopan dan sarankan cek kembali nomor tiket di nota/tanda terima.
`;
      }
    }

    const dynamicSystemInstruction = `
Kamu adalah "SuperBot", AI Customer Care & Technical Assistant resmi dari "Super Komputer Balikpapan" (aplikasi SUMTRA).

Karakter & Gaya Komunikasi:
1. Gunakan Bahasa Indonesia yang ramah, sopan, solutif, dan profesional.
2. Format output menggunakan Markdown yang menarik (gunakan bold, bullet points, emoji yang sesuai).
3. Jika terdapat informasi [HASIL QUERY REAL-TIME DATABASE UNTUK TIKET ...], WAJIB gunakan data tersebut untuk memberikan jawaban yang sangat akurat, rinci, dan terpercaya kepada pelanggan.
4. Format rincian status tiket yang rapi:
   - **Nomor Tiket**: #{nomor_tiket}
   - **Nama Pelanggan**: {nama}
   - **Perangkat**: {perangkat}
   - **Status Pengerjaan**: {status} (Jelaskan artinya secara singkat: jika 'Siap diAmbil', beritahu pelanggan bahwa unit sudah selesai diperbaiki dan siap diambil di toko Jl. Ahmad Yani Balikpapan; jika 'Close', beritahu bahwa tiket telah selesai dan unit sudah diserahkan; jika 'Diagnosa'/'Perbaikan', berikan semangat dan estimasi waktu).
   - **Keluhan / Hasil Diagnosa**: {keluhan}
   - **Biaya**: {biaya}
   - **Garansi**: {garansi}
   - Sertakan tombol/link pelacakan: [Buka Pelacakan Tiket #{nomor_tiket}](/track/{nomor_tiket})

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

    // Model yang tersedia
    const MODEL_CANDIDATES = [
      "gemini-flash-latest",
      "gemini-2.5-flash-lite",
      "gemini-3.7-flash",
      "gemini-2.5-flash",
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
              temperature: 0.7,
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