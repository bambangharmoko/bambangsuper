import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-auth-token",
};

export const DEFAULT_KNOWLEDGE_BASE = `# PROFIL SUPER KOMPUTER BALIKPAPAN
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

export const DEFAULT_SYSTEM_PROMPT = `Kamu adalah "SuperBot", asisten AI resmi dari Super Komputer Balikpapan (SUMTRA).

ATURAN FORMAT LINK & TOMBOL AKSI:
1. **PENULISAN TOMBOL & LINK**:
   - Tombol Pelacakan Tiket: \`[Buka Pelacakan Tiket #{nomor_tiket}](/track/{nomor_tiket})\`
   - Tombol Reminder Teknisi: \`[🔔 Reminder Tiket ke Teknisi](/remind-tech/{nomor_tiket})\`
   - Tombol WhatsApp Admin: \`[Chat WhatsApp Admin Super Komputer]({link_wa})\`
   - JANGAN PERNAH membungkus link dengan kurung siku/bintang ganda seperti \`**[Link](url)**\` agar tombol dapat diklik langsung.

2. **PENANGANAN TIKET STATUS 'BELUM DIKERJAKAN' YANG LEBIH DARI 24 JAM**:
   - Jika tiket berstatus "Belum Dikerjakan" (status Diterima) dan sudah masuk lebih dari 24 jam:
     * Tampilkan detail tiket secara lengkap dan sertakan info durasi tunggu: "Unit servis ini tercatat belum ditangani teknisi selama [X hari Y jam]".
     * Tanyakan opsi: "**Apakah Anda mau saya buatkan chat langsung ke WhatsApp Admin Super Komputer untuk menindaklanjuti tiket ini?**"
   - JIKA pengguna menjawab setuju / iya / mau / buatkan: Berikan link: \`[Chat WhatsApp Admin Super Komputer]({link_wa})\`.

3. **PENANGANAN TIKET STATUS 'SEDANG DIKERJAKAN' YANG LEBIH DARI 2 HARI (48 JAM) TANPA PERUBAHAN**:
   - Jika tiket berstatus "Sedang Dikerjakan" (Diagnosa / Menunggu Persetujuan / Menunggu Sparepart / Perbaikan) dan sudah lebih dari 2 hari tanpa perubahan:
     * Sampaikan dengan empatik: Unit sedang dalam status [Status Resmi] dan belum ada pembaruan status selama [X hari Y jam].
     * Sertakan tombol aksi: \`[🔔 Reminder Tiket ke Teknisi](/remind-tech/{nomor_tiket})\`
     * Jelaskan bahwa dengan menekan tombol tersebut, sistem akan langsung mengirimkan notifikasi sistem dan push notification (FCM) ke akun/HP teknisi yang menangani unit tersebut agar segera diprioritaskan.
     * Berikan juga opsi: \`[Chat WhatsApp Admin Super Komputer]({link_wa})\` jika pelanggan ingin langsung koordinasi dengan Admin Toko.

4. **KONFIRMASI PENGINGAT TEKNISI TELAH DIKIRIM**:
   - Jika pengguna menekan tombol reminder atau meminta mengirimkan pengingat ke teknisi:
     * Sampaikan dengan jelas dan ramah: "✅ **Pengingat berhasil dikirim ke teknisi penanggung jawab unit Anda!** Notifikasi prioritas dan push notification FCM telah masuk ke akun & HP teknisi kami agar segera menindaklanjuti unit Anda."

5. **PENYAJIAN TIKET NOMOR HP DENGAN FORMAT LENGKAP**:
   - Jika nomor HP memiliki lebih dari 1 tiket, kelompokkan ke dalam 4 kategori (Belum Dikerjakan, Sedang Dikerjakan, Selesai Pengerjaan, Unit Close).
   - Setiap tiket WAJIB disertai nama perangkatnya: \`- #<NomorTiket> (<Nama Perangkat>)\`.
   - Di akhir pesan, tanyakan: "**Mau di tampilkan nomor tiket yang mana nih?**"`;

export const DEFAULT_QA_EXAMPLES = [
  {
    id: "qa-1",
    question: "Apakah Super Komputer adalah service center resmi ASUS di Balikpapan?",
    answer: "Ya, benar sekali! Super Komputer adalah Authorized Service Center Resmi ASUS di Balikpapan. Kami melayani perbaikan resmi dan klaim garansi produk ASUS (ROG, TUF Gaming, ZenBook, VivoBook, ExpertBook, All-in-One PC) dengan jaminan 100% sparepart original ASUS.",
  },
  {
    id: "qa-2",
    question: "Apakah bisa servis laptop selain merek ASUS?",
    answer: "Tentu saja bisa! Kami melayani perbaikan multi-brand profesional non-garansi untuk semua merek laptop seperti Lenovo, Acer, HP, Dell, MSI, Axioo, hingga Apple MacBook dengan garansi servis toko resmi 1 hingga 3 bulan.",
  },
  {
    id: "qa-3",
    question: "Apakah bisa mengecek status tiket servis menggunakan nomor WhatsApp?",
    answer: "Tentu saja bisa! Anda cukup mengetikkan nomor HP/WhatsApp yang didaftarkan saat menyerahkan unit servis, maka SuperBot akan menampilkan seluruh daftar tiket servis Anda yang terbagi dalam 4 kategori status.",
  },
  {
    id: "qa-4",
    question: "Dimana lokasi toko dan jam operasionalnya?",
    answer: "Toko kami beralamat di Jl. Ahmad Yani No.118, Gunung Sari Ilir, Balikpapan Tengah (Google Maps: https://maps.app.goo.gl/37n98csWeGpB4siH8). Kami buka setiap hari Senin - Sabtu pukul 09.00 s/d 20.00 WITA (Minggu & Hari Libur Nasional Tutup).",
  },
];

export const DEFAULT_READY_STOCK = [
  {
    id: "sp-dell-7420-bat",
    category: "Baterai Laptop",
    name: "Baterai Dell Latitude 7420 / 7320 / 7520 Original (63Wh / 4-Cell)",
    brand: "Dell",
    compatibility: "Dell Latitude 7420, 7320, 7520, Inspiron 14 7420 (Part No: 1V1XF, 4M15E, 63Wh / 42Wh)",
    status: "ready",
    stock_qty: 4,
    price_range: "Rp 550.000 - Rp 750.000 (Termasuk Jasa Pasang & Kalibrasi)",
    warranty: "6 Bulan Garansi Resmi Toko Ganti Baru",
    notes: "Unit 100% Baru Original Grade A+. Gratis instalasi, cleaning soket, dan kalibrasi daya di toko.",
  },
  {
    id: "sp-asus-tuf-bat",
    category: "Baterai Laptop",
    name: "Baterai ASUS TUF Gaming A15 / F15 / FX506 / FA506 Original",
    brand: "ASUS",
    compatibility: "ASUS TUF Gaming FX506, FA506, FX505, FA505, TUF Dash F15 (Tipe Baterai B31N1726 / B41N1711)",
    status: "ready",
    stock_qty: 6,
    price_range: "Rp 450.000 - Rp 650.000 (Termasuk Pasang)",
    warranty: "6 Bulan Garansi Toko Ganti Baru",
    notes: "Original Resmi ASUS. Tersedia varian 48Wh dan 90Wh.",
  },
  {
    id: "sp-lenovo-ideapad-bat",
    category: "Baterai Laptop",
    name: "Baterai Lenovo IdeaPad Slim 3 / Slim 5 / V14 / V15 Original",
    brand: "Lenovo",
    compatibility: "Lenovo IdeaPad Slim 3 14/15, Slim 5, V14, V15, Flex 5 (Part No: L19M3PF5, L19C3PF5)",
    status: "ready",
    stock_qty: 5,
    price_range: "Rp 380.000 - Rp 550.000",
    warranty: "6 Bulan Garansi Toko Ganti Baru",
    notes: "Ready stok toko. Pemasangan cepat 30-45 menit bisa ditunggu.",
  },
  {
    id: "sp-lcd-14-fhd",
    category: "LCD / Screen",
    name: "LCD Panel 14.0 Inch Full HD IPS Slim 30-Pin Frameless",
    brand: "Universal",
    compatibility: "ASUS VivoBook / ZenBook, Lenovo IdeaPad, Acer Aspire, HP 14s, Dell Latitude / Inspiron 14 inch",
    status: "ready",
    stock_qty: 8,
    price_range: "Rp 750.000 - Rp 950.000 (Termasuk Pasang)",
    warranty: "3 Bulan Garansi Toko (No Dead Pixel Guarantee)",
    notes: "Panel Grade A+ No Dot / No Spot. Pengerjaan 30-60 menit.",
  },
  {
    id: "sp-lcd-156-144hz",
    category: "LCD / Screen",
    name: "LCD Panel 15.6 Inch Full HD IPS 144Hz 40-Pin / 30-Pin Gaming",
    brand: "Universal",
    compatibility: "ASUS TUF FX505/FX506, ROG Strix, Lenovo Legion 5 / Gaming 3, Acer Nitro 5, HP Pavilion Gaming",
    status: "ready",
    stock_qty: 5,
    price_range: "Rp 1.100.000 - Rp 1.350.000 (Termasuk Pasang)",
    warranty: "3 Bulan Garansi Toko",
    notes: "Refresh rate 144Hz 100% sRGB tajam dan responsif.",
  },
  {
    id: "sp-ssd-nvme-512",
    category: "SSD & Storage",
    name: "SSD M.2 NVMe PCIe Gen3/Gen4 512GB & 1TB (Kingston / Samsung / Klevv)",
    brand: "Universal",
    compatibility: "Semua laptop dan PC dengan slot M.2 NVMe (ASUS, Lenovo, Dell, HP, Acer, MacBook via adapter)",
    status: "ready",
    stock_qty: 15,
    price_range: "512GB: Rp 450.000 - Rp 550.000 | 1TB: Rp 850.000 - Rp 1.100.000",
    warranty: "3 - 5 Tahun Garansi Resmi Distributor",
    notes: "Free Jasa Pasang + Free Migrasi/Cloning Windows jika beli di toko.",
  },
  {
    id: "sp-ram-sodimm",
    category: "RAM Memory",
    name: "RAM Laptop Sodimm DDR4 (3200MHz) & DDR5 (4800/5600MHz) 8GB / 16GB",
    brand: "Universal",
    compatibility: "Kompatibel untuk semua laptop Intel Core Gen 6-14 & AMD Ryzen 3000-8000 Series",
    status: "ready",
    stock_qty: 20,
    price_range: "DDR4 8GB: Rp 280.000, 16GB: Rp 490.000 | DDR5 8GB: Rp 380.000, 16GB: Rp 680.000",
    warranty: "Lifetime / Seumur Hidup Garansi Resmi",
    notes: "Gratis pasang dan pengetesan dual-channel di toko.",
  },
  {
    id: "sp-charger-typec",
    category: "Charger / Adaptor",
    name: "Adaptor Charger Universal Type-C 65W & 100W GaN Fast Charging",
    brand: "Universal",
    compatibility: "Dell Latitude (termasuk 7420 / 7320 / 5420), ASUS ZenBook / ROG Ally, Lenovo ThinkPad / Yoga, MacBook Air / Pro M1/M2/M3, HP Envy / Spectre",
    status: "ready",
    stock_qty: 10,
    price_range: "65W: Rp 250.000 - Rp 350.000 | 100W: Rp 450.000 - Rp 550.000",
    warranty: "6 Bulan Garansi Toko Ganti Baru",
    notes: "Sudah dilengkapi smart chip proteksi arus berlebih dan kabel braided kuat.",
  },
  {
    id: "sp-license-win-office",
    category: "Aksesoris & Lisensi",
    name: "Lisensi Digital Original Windows 10/11 Pro & Microsoft Office 2021 Professional Plus",
    brand: "Universal",
    compatibility: "Semua PC Desktop & Laptop",
    status: "ready",
    stock_qty: 99,
    price_range: "Rp 150.000 / Lisensi",
    warranty: "Garansi Aktivasi Permanen Seumur Hidup",
    notes: "Aktivasi online resmi Microsoft, bukan bajakan/KMS. Bisa diupdate selamanya.",
  },
];

const STORAGE_FILE_PATH = "config/ai_training_settings.json";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. GET: Ambil pengaturan AI terkini
    if (req.method === "GET") {
      try {
        const { data, error } = await supabase.storage
          .from("unit-photos")
          .download(STORAGE_FILE_PATH);

        if (!error && data) {
          const text = await data.text();
          const config = JSON.parse(text);
          if (!Array.isArray(config.ready_stock)) {
            config.ready_stock = DEFAULT_READY_STOCK;
          }
          return new Response(JSON.stringify({ ok: true, data: config }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (err) {
        console.warn("No custom AI settings found in storage, returning defaults:", err);
      }

      // Default jika belum ada yang disimpan
      const defaultConfig = {
        knowledge_base: DEFAULT_KNOWLEDGE_BASE,
        system_prompt: DEFAULT_SYSTEM_PROMPT,
        qa_examples: DEFAULT_QA_EXAMPLES,
        ready_stock: DEFAULT_READY_STOCK,
        temperature: 0.1,
        stale_unassigned_hours: 24,
        stale_inprogress_hours: 48,
        wa_admin_phone: "628115404999",
        updated_at: new Date().toISOString(),
      };

      return new Response(JSON.stringify({ ok: true, data: defaultConfig, is_default: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. POST: Simpan atau Uji Coba Pengaturan AI
    if (req.method === "POST") {
      const body = await req.json();
      const action = body.action || "save";

      if (action === "list_models") {
        const apiKey = Deno.env.get("GEMINI_API_KEY");
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const listJson = await listRes.json();
        return new Response(JSON.stringify(listJson), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── ACTION: BENCHMARK MODELS (find the fastest model) ──
      if (action === "benchmark_models") {
        const apiKey = Deno.env.get("GEMINI_API_KEY");
        const modelsToTest = body.models || [
          "gemini-3.5-flash-lite",
          "gemini-3.1-flash-lite",
          "gemini-flash-lite-latest",
          "gemini-flash-latest",
          "gemini-3.5-flash",
          "gemini-3.6-flash",
        ];
        const testMsg = body.test_message || "Halo";
        const results: any[] = [];

        for (const modelName of modelsToTest) {
          const t0 = Date.now();
          try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 12000);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                system_instruction: { parts: [{ text: "Kamu adalah SuperBot, asisten AI toko komputer. Jawab singkat dan cepat." }] },
                contents: [{ role: "user", parts: [{ text: testMsg }] }],
                generationConfig: { maxOutputTokens: 300, temperature: 0.1 },
              }),
            });
            clearTimeout(tid);
            const rj = await res.json();
            const reply = rj.candidates?.[0]?.content?.parts?.[0]?.text;
            results.push({
              model: modelName,
              time_ms: Date.now() - t0,
              ok: !!reply,
              reply_preview: reply ? reply.substring(0, 80) : null,
              error: rj.error?.message || null,
            });
          } catch (e: any) {
            results.push({ model: modelName, time_ms: Date.now() - t0, ok: false, error: e.message });
          }
        }
        return new Response(JSON.stringify({ results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── ACTION: TEST PROMPT / SIMULATOR PLAYGROUND ──
      if (action === "test_prompt") {
        const apiKey = Deno.env.get("GEMINI_API_KEY");
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "GEMINI_API_KEY belum disetel." }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const testMsg = body.test_message || "Halo";
        const customKB = body.knowledge_base || DEFAULT_KNOWLEDGE_BASE;
        const customPrompt = body.system_prompt || DEFAULT_SYSTEM_PROMPT;
        const customQA = body.qa_examples || [];
        const customStock = body.ready_stock || DEFAULT_READY_STOCK;
        const temp = typeof body.temperature === "number" ? body.temperature : 0.1;

        let qaContext = "";
        if (Array.isArray(customQA) && customQA.length > 0) {
          qaContext = "\n\nCONTOH TANYA JAWAB IDEAL:\n" + customQA.map((q: any) => `Tanya: ${q.question}\nJawab: ${q.answer}`).join("\n\n");
        }

        let stockContext = "";
        if (Array.isArray(customStock) && customStock.length > 0) {
          stockContext = "\n\n[KATALOG REAL-TIME READY STOCK SPAREPART & PRODUK SUPER KOMPUTER]:\n" +
            customStock.map((s: any, idx: number) => 
              `${idx + 1}. ${s.name} (${s.brand || 'Universal'})
   - Kategori: ${s.category}
   - Kompatibilitas: ${s.compatibility || '-'}
   - Status Stok: ${s.status === 'ready' ? 'READY STOCK DI TOKO' : s.status === 'po' ? 'PRE-ORDER / INDENT (1-3 Hari)' : 'HABIS / KOSONG'} (Qty: ${s.stock_qty || 0})
   - Estimasi Harga: ${s.price_range || 'Konfirmasi Admin'}
   - Garansi Toko: ${s.warranty || 'Garansi Toko'}
   - Catatan: ${s.notes || '-'}`
            ).join("\n\n");
        }

        const fullPrompt = `${customPrompt}\n\nKNOWLEDGE BASE TOKO:\n${customKB}${stockContext}${qaContext}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: fullPrompt }] },
            contents: [{ role: "user", parts: [{ text: testMsg }] }],
            generationConfig: { maxOutputTokens: 2000, temperature: temp },
          }),
        });

        const geminiJson = await geminiRes.json();
        const reply = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!reply) {
          return new Response(JSON.stringify({ ok: false, error: geminiJson.error?.message || JSON.stringify(geminiJson) }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ ok: true, reply }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── ACTION: SAVE SETTINGS ──
      if (action === "save") {
        const newConfig = {
          knowledge_base: body.knowledge_base || DEFAULT_KNOWLEDGE_BASE,
          system_prompt: body.system_prompt || DEFAULT_SYSTEM_PROMPT,
          qa_examples: body.qa_examples || DEFAULT_QA_EXAMPLES,
          ready_stock: body.ready_stock || DEFAULT_READY_STOCK,
          temperature: typeof body.temperature === "number" ? body.temperature : 0.1,
          stale_unassigned_hours: body.stale_unassigned_hours || 24,
          stale_inprogress_hours: body.stale_inprogress_hours || 48,
          wa_admin_phone: body.wa_admin_phone || "628115404999",
          updated_at: new Date().toISOString(),
        };

        const jsonBlob = new Blob([JSON.stringify(newConfig, null, 2)], { type: "application/json" });

        const { error: uploadErr } = await supabase.storage
          .from("unit-photos")
          .upload(STORAGE_FILE_PATH, jsonBlob, {
            upsert: true,
            contentType: "application/json",
          });

        if (uploadErr) {
          throw uploadErr;
        }

        return new Response(
          JSON.stringify({ ok: true, message: "Pengaturan pelatihan AI & Katalog Ready Stock berhasil disimpan dan aktif seketika!" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── ACTION: RESET TO DEFAULT ──
      if (action === "reset_default") {
        const defaultConfig = {
          knowledge_base: DEFAULT_KNOWLEDGE_BASE,
          system_prompt: DEFAULT_SYSTEM_PROMPT,
          qa_examples: DEFAULT_QA_EXAMPLES,
          ready_stock: DEFAULT_READY_STOCK,
          temperature: 0.1,
          stale_unassigned_hours: 24,
          stale_inprogress_hours: 48,
          wa_admin_phone: "628115404999",
          updated_at: new Date().toISOString(),
        };

        const jsonBlob = new Blob([JSON.stringify(defaultConfig, null, 2)], { type: "application/json" });
        await supabase.storage
          .from("unit-photos")
          .upload(STORAGE_FILE_PATH, jsonBlob, {
            upsert: true,
            contentType: "application/json",
          });

        return new Response(
          JSON.stringify({ ok: true, data: defaultConfig, message: "Pengaturan AI & Katalog Ready Stock berhasil dikembalikan ke standar awal!" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Manage AI Settings Error]:", err);
    return new Response(JSON.stringify({ error: err.message || "Gagal memproses pengaturan AI" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
