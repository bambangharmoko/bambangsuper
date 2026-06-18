# 🖥️ Super Komputer App - Sistem Informasi Manajemen Servis & Pelacakan Tiket

Selamat datang di repositori proyek skripsi **Super Komputer App**, sebuah aplikasi berbasis web modern yang dirancang untuk mengelola operasional servis komputer/perangkat elektronik secara efisien dan transparan. Aplikasi ini dilengkapi dengan sistem pelacakan tiket realtime untuk pelanggan dan dashboard manajemen multi-role bagi internal toko.

---

## 🌟 Fitur Utama

### 1. 👥 Multi-Role Dashboard
Sistem dashboard terintegrasi dengan hak akses yang disesuaikan berdasarkan peran pengguna:
*   **Owner (Pemilik):** Memantau laporan pendapatan, performa toko, beban kerja teknisi, serta seluruh aktivitas servis.
*   **Admin:** Mengelola pendaftaran tiket baru, pembayaran, pembaruan status utama, dan notifikasi ke pelanggan/teknisi.
*   **Teknisi:** Mengelola progres diagnosa/perbaikan unit yang ditugaskan, mencatat catatan internal, dan estimasi biaya perbaikan.

### 2. 🎫 Sistem Pelacakan Tiket (Ticket Tracking)
*   **Short Ticket Number:** Menggunakan format nomor tiket pendek yang mudah diingat (contoh: `F26001`) sebagai bagian dari URL pelacakan.
*   **Halaman Pelacakan Publik:** Pelanggan dapat memantau status perbaikan unit mereka secara langsung dan realtime tanpa perlu melakukan login.

### 3. ⚠️ Peringatan Tiket Tertunda (Stale Tickets Alert)
*   Pop-up otomatis untuk Admin dan Owner untuk memperingatkan jika ada tiket aktif yang tidak diperbarui (stagnan) selama lebih dari 24 jam.
*   Waktu tunggu ditampilkan secara presisi dalam format hari dan jam (contoh: `2 hari 2 jam lalu`).
*   Dilengkapi tombol pengingat instan untuk mengirimkan notifikasi ke teknisi yang ditugaskan.

### 4. 📲 PWA (Progressive Web App)
*   Aplikasi dapat diinstal langsung di perangkat **PC, Laptop, Android, maupun iOS** layaknya aplikasi native.
*   Mendukung caching aset utama agar aplikasi dapat dimuat dengan sangat cepat.

### 5. 🔔 Notifikasi Realtime & Push Notification
*   Notifikasi instan ketika terjadi perubahan status servis, penugasan teknisi baru, atau pesan internal baru.
*   Menggunakan **Firebase Cloud Messaging (FCM)** untuk mengirimkan push notification ke perangkat staff (bahkan ketika browser sedang ditutup).

---

## 🛠️ Teknologi yang Digunakan

*   **Frontend (Antarmuka):** React.js, Vite, TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons.
*   **Backend & Database:** Supabase (Database PostgreSQL, Supabase Auth untuk keamanan login, Supabase Storage untuk foto unit, Supabase Realtime untuk sinkronisasi data instan).
*   **Layanan Notifikasi:** Firebase Cloud Messaging (FCM) & Supabase Edge Functions.