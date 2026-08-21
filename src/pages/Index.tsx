import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  LogIn,
  Phone,
  Mail,
  MapPin,
  Clock,
  ExternalLink,
  Monitor,
  Wrench,
  ShieldCheck,
  Cpu,
  HardDrive,
  Printer,
  Camera,
  DoorOpen,
  Store,
  Building2,
  Award,
  ChevronRight,
  Loader2,
  Bot,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReconnectableChannel } from "@/hooks/useReconnectableChannel";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ChatAssistant } from "@/components/ChatAssistant";

interface OrderResult {
  id: string;
  ticket_number: string;
  customer_name: string;
  status: string;
  device_type: string;
  device_brand: string;
  service_type: string;
  created_at: string;
}

const services = [
  {
    title: "Products",
    icon: Monitor,
    color: "from-blue-500 to-blue-600",
    items: ["Laptop & PC Built-up", "PC Rakitan & All-in-One", "Processor, Motherboard, RAM", "HDD, SSD & Peripheral"],
  },
  {
    title: "IT Solutions",
    icon: Camera,
    color: "from-emerald-500 to-emerald-600",
    items: ["CCTV Online & Offline", "Absensi Biometrik", "Networking"],
  },
  {
    title: "Service Centre Solution",
    icon: Wrench,
    color: "from-amber-500 to-amber-600",
    items: ["Authorized Service Center ASUS", "Perbaikan All Brand PC & Laptop", "Servis Printer & Proyektor"],
  },
];

const partners = [
  "PT. WEIR MINERALS INDONESIA",
  "PT. SANDVIK Mining & Oil",
  "PT. Pandega Citra Niaga & Kelola",
  "GRAND TJOKRO HOTEL",
  "PT. Energy Logistic",
  "PT. ESCO Weir Indonesia",
  "SD Maria Goretti",
  "SKH F Asisi",
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

export default function IndexPage() {
  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<OrderResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const navigate = useNavigate();

  // ─── Realtime subscription refs ───────────────────────────────────────────
  const lastPhoneRef = useRef<string | null>(null);
  const orderIdsRef = useRef<string[]>([]);

  // Auto-redirect: jika pengguna sudah login, langsung ke dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/dashboard", { replace: true });
      }
    });
  }, [navigate]);

  // ─── Fetch results by phone number ──────────────────────────────────────
  const fetchByPhone = useCallback(async (phone: string): Promise<OrderResult[]> => {
    const { data, error } = await (supabase.rpc as any)(
      "get_public_orders_by_phone",
      { _phone: phone }
    );
    if (error) {
      console.error("Failed to query service orders by phone number:", error);
      toast.error("Gagal mencari tiket: " + error.message);
      return [];
    }
    return (data as OrderResult[]) || [];
  }, []);

  const fetchResults = useCallback(async () => {
    if (!lastPhoneRef.current) return;
    const fresh = await fetchByPhone(lastPhoneRef.current);
    setResults(fresh);
    orderIdsRef.current = fresh.map(r => r.id);
  }, [fetchByPhone]);

  // Handle incoming realtime events by updating local state directly
  // This avoids caching issues and is instant.
  const handleRealtimeUpdate = useCallback((payload: any) => {
    const newRecord = payload.new;
    if (!newRecord || !newRecord.order_id) return;

    setResults(prevResults => {
      // Ignore if this ticket is not currently shown
      const index = prevResults.findIndex(r => r.id === newRecord.order_id);
      if (index === -1) return prevResults;

      // Merge the updated fields into the existing record
      const newResults = [...prevResults];
      newResults[index] = { ...newResults[index], status: newRecord.status };
      return newResults;
    });
  }, []);

  // Derived stable string to prevent channel rebuild on status change
  const activeOrderIdsStr = orderIdsRef.current.sort().join(',');

  const buildChannel = useCallback(() => {
    const ids = orderIdsRef.current;
    if (ids.length === 0) return supabase.channel('empty-channel');

    const phone = lastPhoneRef.current || "";
    // The channel will be named based on the phone number
    const channel = supabase.channel(`public-search-${phone.replace(/\D/g, "")}`);

    // Subscribe to ALL changes in public_service_updates and filter locally
    // This proxy table safely bypasses the strict RLS on service_orders for anon users
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "public_service_updates" },
      handleRealtimeUpdate
    );

    return channel;
  }, [activeOrderIdsStr, handleRealtimeUpdate]);

  // Use the established internal pattern for automatic reconnects and focus/online syncing
  useReconnectableChannel(results.length > 0, buildChannel, fetchResults);

  // ─── Search handler ──────────────────────────────────────────────────────
  const handleSearch = async () => {
    const val = searchInput.trim();
    if (!val) return;

    if (/[a-zA-Z]/.test(val)) {
      navigate(`/track/${val.toUpperCase()}`);
      return;
    }

    // Store the phone number for refetching
    lastPhoneRef.current = val;

    setSearching(true);
    setSearched(true);

    const data = await fetchByPhone(val);
    setResults(data);
    orderIdsRef.current = data.map((r) => r.id);

    setSearching(false);
  };

  // ─── Categories for Tabs ─────────────────────────────────────────────────
  const belumDikerjakan = results.filter((o) => ["Diterima"].includes(o.status));
  const sedangDikerjakan = results.filter((o) => ["Diagnosa", "Menunggu Persetujuan Pelanggan", "Menunggu Sparepart", "Perbaikan"].includes(o.status));
  const selesaiPengerjaan = results.filter((o) => ["Selesai", "Siap diAmbil"].includes(o.status));
  const unitClose = results.filter((o) => ["Close", "Cancelled"].includes(o.status));

  const renderCard = (order: OrderResult) => (
    <Card
      key={order.id}
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/track/${order.ticket_number}`)}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold">{order.ticket_number}</p>
            <p className="text-sm text-muted-foreground">{order.customer_name}</p>
            <p className="text-xs text-muted-foreground">
              {order.device_brand} — {order.service_type}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ═══ Navbar ═══ */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex flex-col items-start gap-1">
            <AppLogo className="h-8" />
            <span className="text-[10px] text-muted-foreground hidden sm:block leading-tight">Super Ultima Management, Tracking & Real-Time Application</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://www.tokopedia.com/superkomputer"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Store className="h-4 w-4" /> Tokopedia
            </a>
            <Button size="sm" variant="outline" onClick={() => navigate("/login")}>
              <LogIn className="h-4 w-4 mr-1.5" /> Login Staff
            </Button>
          </div>
        </div>
      </nav>

      {/* ═══ Hero: Cek Status Tiket ═══ */}
      <section className="gradient-hero text-primary-foreground">
        <div className="container mx-auto px-4 py-20 md:py-28 text-center">
          <motion.div {...fadeUp} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 bg-primary-foreground/10 border border-primary-foreground/20 rounded-full px-4 py-1.5 mb-6">
              <Search className="h-4 w-4" />
              <span className="text-sm font-medium">Cek Status Servis</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
              Lacak Status Servis
              <br />
              Unit Anda
            </h1>
            <p className="text-primary-foreground/70 text-base md:text-lg mb-8 max-w-lg mx-auto">
              Masukkan nomor tiket atau nomor telepon untuk memantau progress perbaikan secara real-time
            </p>
            <div className="flex gap-2 max-w-md mx-auto">
              <Input
                placeholder="Nomor tiket atau Nomor HP"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 h-12 text-base"
              />
              <Button onClick={handleSearch} disabled={searching} size="lg" className="gradient-primary shrink-0 px-6">
                {searching ? (
                  "Mencari..."
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-1.5" /> Cari
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ Search Results ═══ */}
      {searched && (
        <section className="container mx-auto px-4 py-8">
          {searching ? (
            <p className="text-center text-muted-foreground">Mencari...</p>
          ) : results.length === 0 ? (
            <p className="text-center text-muted-foreground">Nomor HP tidak ditemukan atau tidak sesuai</p>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              <Tabs defaultValue="belum_dikerjakan" className="w-full space-y-6">
                <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                  <TabsList className="w-max sm:w-full grid grid-cols-4 min-w-[600px] sm:min-w-0 bg-muted/50 p-1">
                    <TabsTrigger value="belum_dikerjakan" className="text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      Belum Dikerjakan ({belumDikerjakan.length})
                    </TabsTrigger>
                    <TabsTrigger value="sedang_dikerjakan" className="text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      Sedang Dikerjakan ({sedangDikerjakan.length})
                    </TabsTrigger>
                    <TabsTrigger value="selesai_pengerjaan" className="text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      Selesai Pengerjaan ({selesaiPengerjaan.length})
                    </TabsTrigger>
                    <TabsTrigger value="unit_close" className="text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      Unit Close ({unitClose.length})
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="belum_dikerjakan" className="space-y-3 mt-0">
                  {belumDikerjakan.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Tidak ada tiket pada kategori ini</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {belumDikerjakan.map(renderCard)}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="sedang_dikerjakan" className="space-y-3 mt-0">
                  {sedangDikerjakan.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Tidak ada tiket pada kategori ini</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sedangDikerjakan.map(renderCard)}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="selesai_pengerjaan" className="space-y-3 mt-0">
                  {selesaiPengerjaan.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Tidak ada tiket pada kategori ini</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selesaiPengerjaan.map(renderCard)}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="unit_close" className="space-y-3 mt-0">
                  {unitClose.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Tidak ada tiket pada kategori ini</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {unitClose.map(renderCard)}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </section>
      )}

      {/* ═══ Tentang Kami ═══ */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Super Komputer Balikpapan</h2>
          <p className="text-muted-foreground leading-relaxed">
            Dengan pengalaman <strong className="text-foreground">lebih dari 15 tahun</strong> melayani kebutuhan
            Teknologi Informasi di Kalimantan Timur, Super Komputer telah menjadi mitra terpercaya bagi pelanggan retail
            maupun korporat. Kami menyediakan solusi IT menyeluruh — mulai dari penjualan perangkat, pemasangan
            infrastruktur jaringan & keamanan, hingga layanan perbaikan profesional sebagai{" "}
            <strong className="text-foreground">Authorized Service Center ASUS</strong>.
          </p>
        </motion.div>
      </section>

      {/* ═══ Layanan Utama ═══ */}
      <section className="bg-muted/50 py-16 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">Layanan Kami</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {services.map((s, i) => (
              <motion.div key={s.title} {...fadeUp} transition={{ delay: i * 0.12, duration: 0.5 }}>
                <Card className="h-full hover:shadow-lg transition-shadow overflow-hidden">
                  <div className={`bg-gradient-to-r ${s.color} p-4 flex items-center gap-3`}>
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <s.icon className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-white">{s.title}</h3>
                  </div>
                  <CardContent className="p-5">
                    <ul className="space-y-2.5">
                      {s.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm">
                          <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Rekanan Strategis ═══ */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">Dipercaya Oleh</h2>
        <p className="text-center text-muted-foreground mb-10 max-w-md mx-auto">
          Beberapa institusi dan perusahaan yang telah mempercayakan kebutuhan IT mereka kepada kami
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {partners.map((name, i) => (
            <motion.div key={name} {...fadeUp} transition={{ delay: i * 0.06, duration: 0.4 }}>
              <div className="flex items-center justify-center gap-2 p-4 rounded-xl border border-border bg-card hover:shadow-md transition-shadow text-center h-full">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium">{name}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ Toko Online ═══ */}
      <section className="bg-primary/5 py-12">
        <div className="container mx-auto px-4 text-center">
          <Award className="h-10 w-10 text-primary mx-auto mb-3" />
          <h3 className="text-xl font-bold mb-2">Belanja Online</h3>
          <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
            Kunjungi toko online resmi kami di Tokopedia untuk pembelian perangkat & komponen IT
          </p>
          <Button asChild className="gradient-primary">
            <a href="https://www.tokopedia.com/superkomputer" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" /> Tokopedia Super Komputer
            </a>
          </Button>
        </div>
      </section>

      {/* ═══ SuperBot AI Spotlight ═══ */}
      <section className="container mx-auto px-4 py-12">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white p-8 md:p-12 shadow-2xl"
        >
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/40 rounded-full px-3.5 py-1 mb-4 text-xs font-semibold text-blue-300">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                <span>AI Technical & Customer Assistant</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
                Konsultasi & Cek Servis Instan dengan <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">SuperBot AI</span>
              </h2>
              <p className="text-slate-300 text-sm sm:text-base mb-6 leading-relaxed">
                Didukung oleh arsitektur <strong>Hybrid RAG + Real-time Query</strong> dan Google Gemini AI. Dapatkan jawaban cepat seputar kendala teknis laptop/PC Anda, biaya perbaikan, garansi resmi ASUS, serta pengecekan status tiket secara real-time.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("open-superbot-chat", { detail: { prompt: "Halo SuperBot, tolong jelaskan layanan apa saja yang ada di Super Komputer." } }));
                  }}
                  size="lg"
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 px-6 font-semibold"
                >
                  <Bot className="h-4 w-4 mr-2" /> Tanya SuperBot Sekarang
                </Button>
                <Button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("open-superbot-chat", { detail: { prompt: "Saya ingin mengecek status pengerjaan tiket servis saya." } }));
                  }}
                  variant="outline"
                  size="lg"
                  className="border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200"
                >
                  <Search className="h-4 w-4 mr-2" /> Cek Tiket via AI
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div
                onClick={() => window.dispatchEvent(new CustomEvent("open-superbot-chat", { detail: { prompt: "Laptop saya mati total dan tidak mau hidup, apa yang harus dicek?" } }))}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all cursor-pointer group"
              >
                <Cpu className="h-5 w-5 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                <h4 className="font-semibold text-sm text-white mb-1">Troubleshooting HW</h4>
                <p className="text-xs text-slate-400">Konsultasi laptop matot, blue screen, atau lemot</p>
              </div>
              <div
                onClick={() => window.dispatchEvent(new CustomEvent("open-superbot-chat", { detail: { prompt: "Apakah Super Komputer melayani klaim garansi resmi ASUS?" } }))}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all cursor-pointer group"
              >
                <ShieldCheck className="h-5 w-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                <h4 className="font-semibold text-sm text-white mb-1">Authorized Center</h4>
                <p className="text-xs text-slate-400">Garansi & perbaikan resmi ASUS</p>
              </div>
              <div
                onClick={() => window.dispatchEvent(new CustomEvent("open-superbot-chat", { detail: { prompt: "Berapa estimasi biaya ganti SSD, RAM, dan pasang thermal paste?" } }))}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all cursor-pointer group"
              >
                <Wrench className="h-5 w-5 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                <h4 className="font-semibold text-sm text-white mb-1">Estimasi Biaya</h4>
                <p className="text-xs text-slate-400">Transparansi harga sparepart & jasa servis</p>
              </div>
              <div
                onClick={() => window.dispatchEvent(new CustomEvent("open-superbot-chat", { detail: { prompt: "Toko Super Komputer buka jam berapa dan dimana alamat lengkapnya?" } }))}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all cursor-pointer group"
              >
                <Clock className="h-5 w-5 text-sky-400 mb-2 group-hover:scale-110 transition-transform" />
                <h4 className="font-semibold text-sm text-white mb-1">Jam & Lokasi</h4>
                <p className="text-xs text-slate-400">Info operasional Jl. Ahmad Yani Balikpapan</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="bg-sidebar text-sidebar-foreground">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Info Perusahaan */}
            <div>
              <h4 className="text-lg font-bold text-sidebar-primary-foreground mb-3">Super Komputer</h4>
              <p className="text-sm text-sidebar-foreground/70 leading-relaxed mb-4">
                Authorized Service Center ASUS. Solusi lengkap IT untuk kebutuhan personal dan korporat di
                Kalimantan Timur.
              </p>
              <div className="flex gap-3">
                <a
                  href="https://www.tokopedia.com/superkomputer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sidebar-foreground/60 hover:text-sidebar-primary transition-colors"
                >
                  <Store className="h-5 w-5" />
                </a>
              </div>
            </div>

            {/* Kontak */}
            <div>
              <h4 className="font-semibold mb-3">Kontak</h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-sidebar-primary" />
                  <a
                    href="https://maps.app.goo.gl/37n98csWeGpB4siH8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sidebar-foreground/70 hover:text-sidebar-primary transition-colors"
                  >
                    Jl. Ahmad Yani No.118, Balikpapan, Kalimantan Timur
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-sidebar-primary" />
                  <a
                    href="tel:+628115404999"
                    className="text-sidebar-foreground/70 hover:text-sidebar-primary transition-colors"
                  >
                    08115404999
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-sidebar-primary" />
                  <a
                    href="mailto:marketing@superkomputer.net"
                    className="text-sidebar-foreground/70 hover:text-sidebar-primary transition-colors"
                  >
                    marketing@superkomputer.net
                  </a>
                </div>
              </div>
            </div>

            {/* Jam Operasional & Maps */}
            <div>
              <h4 className="font-semibold mb-3">Jam Operasional</h4>
              <div className="space-y-2 text-sm text-sidebar-foreground/70 mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-sidebar-primary" />
                  <span>Senin - Sabtu: 09.00 - 20.00 WITA</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-sidebar-primary" />
                  <span>Minggu: Libur</span>
                </div>
              </div>
              <a
                href="https://maps.app.goo.gl/37n98csWeGpB4siH8"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-sidebar-primary hover:underline"
              >
                <MapPin className="h-4 w-4" /> Buka di Google Maps
              </a>
            </div>
          </div>

          <Separator className="my-8 bg-sidebar-border" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-sidebar-foreground/50">
            <span>© 2026 Super Komputer Balikpapan.</span>
            <span>SUMTRA by Bambang Harmoko</span>
          </div>
        </div>
      </footer>

      {/* Floating Chat Assistant (SuperBot AI) */}
      <ChatAssistant />
    </div>
  );
}
