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

# 4 KATEGORI STATUS SERVIS UTAMA DI SUMTRA
1. **Belum Dikerjakan**: Status 'Diterima' (Unit baru masuk dan mengantre untuk diperiksa/dihandle teknisi).
2. **Sedang Dikerjakan**: Status 'Diagnosa', 'Menunggu Persetujuan Pelanggan', 'Menunggu Sparepart', 'Perbaikan'.
3. **Selesai Pengerjaan**: Status 'Selesai' (QC lolos) atau 'Siap diAmbil' (Unit siap diambil di toko).
4. **Unit Close**: Status 'Close' (Sudah diambil & transaksi lunas) atau 'Cancelled' (Batal servis).

# SISTEM PENGECEKAN TIKET SERVIS
- SuperBot BISA mengecek tiket langsung melalui **Nomor Tiket** (contoh: A26001, G26052, K26001) ATAU **Nomor HP / WhatsApp terdaftar**.
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
`;

function getCategoryForStatus(status: string): string {
  switch (status) {
    case "Diterima":
      return "Belum Dikerjakan";
    case "Diagnosa":
    case "Menunggu Persetujuan Pelanggan":
    case "Menunggu Sparepart":
    case "Perbaikan":
      return "Sedang Dikerjakan";
    case "Selesai":
    case "Siap diAmbil":
      return "Selesai Pengerjaan";
    case "Close":
    case "Cancelled":
      return "Unit Close";
    default:
      return "Lainnya";
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
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\!/g, "%21")
    .replace(/\'/g, "%27")
    .replace(/\*/g, "%2A")
    .replace(/\~/g, "%7E");
}

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
    let isStaleTicket = false;
    let staleDurationStr = "";
    let staleWaDirectLink = "";

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

        // Hitung durasi waktu tunggu tiket
        const createdAtDate = new Date(orderData.created_at || Date.now());
        const diffMs = Math.max(0, Date.now() - createdAtDate.getTime());
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        const remHours = diffHours % 24;
        staleDurationStr = diffDays > 0 ? `${diffDays} hari ${remHours} jam` : `${diffHours} jam`;

        const category = getCategoryForStatus(orderData.status);
        isStaleTicket = category === "Belum Dikerjakan" && diffHours >= 24;

        const waAdminPhone = "628115404999";
        const waMessageText = `Halo Admin Super Komputer, saya ingin menanyakan progres tiket servis saya yang belum ditangani teknisi:\n\n* Nomor Tiket: #${orderData.ticket_number}\n* Nama: ${orderData.customer_name}\n* Unit: ${getDeviceName(orderData)}\n* Status: Belum Dikerjakan (${orderData.status})\n* Waktu Tunggu: ${staleDurationStr}\n* Keluhan: ${orderData.damage_description || orderData.unit_condition || "-"}\n\nMohon bantuannya untuk menindaklanjuti unit saya. Terima kasih!`;

        staleWaDirectLink = `https://wa.me/${waAdminPhone}?text=${safeEncodeURIComponent(waMessageText)}`;

        let staleWarningText = "";
        if (isStaleTicket) {
          staleWarningText = `
- STATUS PENANGANAN KHUSUS (> 24 JAM BELUM DIKERJAKAN):
  * Tiket ini berstatus "Belum Dikerjakan" dan sudah masuk selama ${staleDurationStr}.
  * Tautan Direct Chat WhatsApp Admin: [Chat WhatsApp Admin Super Komputer](${staleWaDirectLink})
  * PETUNJUK RESPON:
    1. Jika pengguna baru menanyakan tiket ini: Tampilkan detail tiket, sertakan info bahwa unit belum di-handle teknisi selama ${staleDurationStr}, lalu tanyakan opsi: "Apakah Anda mau saya buatkan tautan chat langsung ke WhatsApp Admin Super Komputer untuk menindaklanjuti tiket ini?"
    2. JIKA pengguna menjawab setuju/iya/mau/buatkan/hubungi: Berikan LANGSUNG link markdown [Chat WhatsApp Admin Super Komputer](${staleWaDirectLink}) (JANGAN menambahkan tanda bintang ganda ** di luar link markdown).
`;
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
          .limit(200);

        if (!phoneErr && phoneOrders && phoneOrders.length > 0) {
          phoneOrdersFound = phoneOrders;

          const belumDikerjakan = phoneOrders.filter((o) => getCategoryForStatus(o.status) === "Belum Dikerjakan");
          const sedangDikerjakan = phoneOrders.filter((o) => getCategoryForStatus(o.status) === "Sedang Dikerjakan");
          const selesaiPengerjaan = phoneOrders.filter((o) => getCategoryForStatus(o.status) === "Selesai Pengerjaan");
          const unitClose = phoneOrders.filter((o) => getCategoryForStatus(o.status) === "Unit Close");

          const formatGroup = (title: string, list: any[]) => {
            if (list.length === 0) return `* **${title}**: 0 unit (Tidak ada)`;
            const items = list
              .map((o) => `  - #${o.ticket_number} (${getDeviceName(o)})`)
              .join("\n");
            return `* **${title}** (${list.length} unit):\n${items}`;
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
        }
      }
    }

    const systemInstruction = `
Kamu adalah "SuperBot", asisten AI resmi dari Super Komputer Balikpapan (SUMTRA).

ATURAN FORMAT LINK & KOMUNIKASI:
1. **PENULISAN LINK WHATSAPP & PELACAKAN**:
   - Tulis link markdown dengan format bersih: \`[Chat WhatsApp Admin Super Komputer]({link_wa})\` atau \`[Buka Pelacakan Tiket #{nomor_tiket}](/track/{nomor_tiket})\`.
   - JANGAN PERNAH membungkus link dengan kurung siku/bintang ganda seperti \`**[Link](url)**\` atau mengekstrak query URL ke teks obrolan, agar link dapat diklik langsung sebagai tombol interaktif!

2. **PENANGANAN TIKET STATUS 'BELUM DIKERJAKAN' YANG LEBIH DARI 24 JAM**:
   - Jika tiket berstatus "Belum Dikerjakan" (status Diterima) dan sudah masuk lebih dari 24 jam:
     * Tampilkan detail tiket secara lengkap dan sertakan info durasi tunggu: "Unit servis ini tercatat belum ditangani teknisi selama [X hari Y jam]".
     * Tanyakan opsi: "**Apakah Anda mau saya buatkan chat langsung ke WhatsApp Admin Super Komputer untuk menindaklanjuti tiket ini?**"
   - JIKA pengguna menjawab setuju / iya / mau / buatkan / hubungi admin:
     * Berikan link WhatsApp: [Chat WhatsApp Admin Super Komputer](${staleWaDirectLink})
     * Sertakan kalimat penutup ramah: "Silakan klik tombol di atas untuk langsung membuka chat WhatsApp dengan Admin Super Komputer."

3. **PENYAJIAN TIKET NOMOR HP DENGAN FORMAT LENGKAP**:
   - Jika nomor HP memiliki lebih dari 1 tiket, kelompokkan ke dalam 4 kategori (Belum Dikerjakan, Sedang Dikerjakan, Selesai Pengerjaan, Unit Close).
   - Setiap tiket WAJIB disertai nama perangkatnya: \`- #<NomorTiket> (<Nama Perangkat>)\`.
   - Di akhir pesan, tanyakan: "**Mau di tampilkan nomor tiket yang mana nih?**"

4. **TAMPILAN RINCIAN TIKET**:
   - Saat menampilkan 1 tiket tertentu, sertakan:
     • Nomor Tiket
     • Nama Pelanggan
     • Perangkat (Merk/Model)
     • Kategori Status & Status Resmi
     • Keluhan
     • Total / Estimasi Biaya
     • Tombol Pelacakan: [Buka Pelacakan Tiket #{nomor_tiket}](/track/{nomor_tiket})
   - JANGAN menampilkan "Riwayat Progres" atau catatan teknisi internal.

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
              maxOutputTokens: 3000,
              temperature: 0.1,
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
    const isUserConfirmingWa =
      /(ya|iya|setuju|mau|boleh|tolong|buatkan|hubungi|chat|wa|admin|gas|oke|ok|yes|lanjut)/i.test(lastUserText);

    if (isStaleTicket && isUserConfirmingWa && staleWaDirectLink) {
      return new Response(
        JSON.stringify({
          reply: `Baik, saya telah menyiapkan pesan konfirmasi tiket **#${ticketOrderFound?.ticket_number}**. Silakan klik tombol di bawah ini untuk langsung membuka chat WhatsApp dengan Admin Toko Super Komputer:\n\n[Chat WhatsApp Admin Super Komputer](${staleWaDirectLink})\n\nAda hal lain yang dapat kami bantu?`,
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

      let staleSuffix = "";
      if (isStaleTicket) {
        staleSuffix = `\n\n⚠️ *Catatan:* Tiket ini tercatat belum ditangani oleh teknisi selama **${staleDurationStr}**.\n\nApakah Anda mau saya buatkan chat langsung ke WhatsApp Admin di toko Super Komputer untuk menindaklanjuti unit ini?`;
      }

      return new Response(
        JSON.stringify({
          reply: `Halo! Berikut data resmi untuk tiket **#${ticketOrderFound.ticket_number}** atas nama **${ticketOrderFound.customer_name}**:\n\n• **Perangkat:** ${getDeviceName(ticketOrderFound)}\n• **Kategori:** ${getCategoryForStatus(ticketOrderFound.status)} (${ticketOrderFound.status})\n• **Keluhan:** ${ticketOrderFound.damage_description || ticketOrderFound.unit_condition || "-"}\n• **Total Biaya:** ${cost}\n\n[Buka Pelacakan Tiket #${ticketOrderFound.ticket_number}](/track/${ticketOrderFound.ticket_number})${staleSuffix}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (phoneOrdersFound.length > 0) {
      if (phoneOrdersFound.length === 1) {
        const o = phoneOrdersFound[0];
        const cost = o.final_cost != null ? `Rp ${Number(o.final_cost).toLocaleString("id-ID")}` : (o.estimated_cost != null ? `Estimasi Rp ${Number(o.estimated_cost).toLocaleString("id-ID")}` : "-");
        return new Response(
          JSON.stringify({
            reply: `Halo! Berdasarkan nomor telepon **${extractedPhone}**, ditemukan 1 tiket servis atas nama **${o.customer_name}**:\n\n• **Nomor Tiket:** #${o.ticket_number}\n• **Perangkat:** ${getDeviceName(o)}\n• **Kategori:** ${getCategoryForStatus(o.status)} (${o.status})\n• **Keluhan:** ${o.damage_description || o.unit_condition || "-"}\n• **Total Biaya:** ${cost}\n\n[Buka Pelacakan Tiket #${o.ticket_number}](/track/${o.ticket_number})`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const belumDikerjakan = phoneOrdersFound.filter((o) => getCategoryForStatus(o.status) === "Belum Dikerjakan");
      const sedangDikerjakan = phoneOrdersFound.filter((o) => getCategoryForStatus(o.status) === "Sedang Dikerjakan");
      const selesaiPengerjaan = phoneOrdersFound.filter((o) => getCategoryForStatus(o.status) === "Selesai Pengerjaan");
      const unitClose = phoneOrdersFound.filter((o) => getCategoryForStatus(o.status) === "Unit Close");

      const formatGroupFB = (title: string, list: any[]) => {
        if (list.length === 0) return `* **${title}**: 0 unit (Tidak ada)`;
        const items = list
          .map((o) => `  - #${o.ticket_number} (${getDeviceName(o)})`)
          .join("\n");
        return `* **${title}** (${list.length} unit):\n${items}`;
      };

      return new Response(
        JSON.stringify({
          reply: `Halo! Berdasarkan nomor telepon **${extractedPhone}** atas nama **${phoneOrdersFound[0]?.customer_name || "Bapak/Ibu"}**, ditemukan total **${phoneOrdersFound.length} tiket servis** yang terbagi dalam 4 kategori:\n\n${formatGroupFB("1. Belum Dikerjakan", belumDikerjakan)}\n\n${formatGroupFB("2. Sedang Dikerjakan", sedangDikerjakan)}\n\n${formatGroupFB("3. Selesai Pengerjaan", selesaiPengerjaan)}\n\n${formatGroupFB("4. Unit Close", unitClose)}\n\n**Mau di tampilkan nomor tiket yang mana nih?**`,
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