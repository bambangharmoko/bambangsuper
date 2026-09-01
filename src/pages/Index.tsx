import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  Camera,
  Store,
  Building2,
  ChevronRight,
  Loader2,
  Bot,
  Sparkles,
  ArrowRight,
  Wifi,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReconnectableChannel } from "@/hooks/useReconnectableChannel";
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

const SERVICE_STEPS = [
  { label: "Konsultasi" },
  { label: "Diagnosa" },
  { label: "Perbaikan" },
  { label: "Selesai" },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const openBot = (prompt: string) =>
  window.dispatchEvent(new CustomEvent("open-superbot-chat", { detail: { prompt } }));

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
    <motion.div
      key={order.id}
      variants={fadeUp}
      onClick={() => navigate(`/track/${order.ticket_number}`)}
      className="cursor-pointer group"
    >
      <div className="relative p-4 rounded-xl border border-white/8 bg-slate-900/60 hover:border-blue-500/40 hover:bg-slate-800/70 transition-all duration-200 backdrop-blur-sm">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm tracking-wide">{order.ticket_number}</p>
            <p className="text-slate-400 text-xs mt-0.5 truncate">{order.customer_name}</p>
            <p className="text-slate-500 text-xs mt-1 truncate">{order.device_brand} — {order.service_type}</p>
          </div>
          <div className="shrink-0">
            <StatusBadge status={order.status} />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#090d16] text-white font-sans antialiased">

      {/* ═══ NAVBAR ═══ */}
      <nav className="sticky top-0 z-50 border-b border-white/8 bg-[#090d16]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex flex-col items-start">
            <AppLogo className="h-7" />
            <span className="text-[9px] text-slate-500 hidden sm:block leading-none mt-0.5 tracking-widest uppercase">
              Super Ultima Management Tracking & Real-Time
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://www.tokopedia.com/superkomputer"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition-colors"
            >
              <Store className="h-3.5 w-3.5" />
              Tokopedia
            </a>
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-all"
            >
              <LogIn className="h-3.5 w-3.5" />
              Login Staff
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden">
        {/* Background grid + glow */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-20">
          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
            className="text-center max-w-2xl mx-auto"
          >
            {/* Badge */}
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 border border-blue-500/30 bg-blue-500/10 rounded-full px-3.5 py-1 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs font-medium text-blue-300 tracking-wide">Real-Time Service Tracker</span>
            </motion.div>

            {/* Headline */}
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.1] mb-4 tracking-tight">
              Lacak Status Servis
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-300">
                Unit Anda
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-slate-400 text-base md:text-lg mb-8 leading-relaxed">
              Masukkan nomor tiket atau nomor HP untuk memantau progress perbaikan secara{" "}
              <em className="text-slate-300 not-italic">real-time</em>
            </motion.p>

            {/* Search Bar */}
            <motion.div variants={fadeUp} className="relative max-w-lg mx-auto">
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Nomor tiket (contoh: G26028) atau Nomor HP"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/60 transition-all"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20 shrink-0 flex items-center gap-2"
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      <span className="hidden sm:inline">Lacak</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>

            {/* Live Stepper Widget */}
            <motion.div variants={fadeUp} className="mt-10 max-w-md mx-auto">
              <div className="p-4 rounded-xl border border-white/8 bg-white/3 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-400 font-medium">Tahapan Servis</span>
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <Wifi className="h-3 w-3" /> Live
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  {SERVICE_STEPS.map((step, i) => (
                    <div key={step.label} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${i === 1 ? "border-blue-500 bg-blue-600/30" : i < 1 ? "border-emerald-500/60 bg-emerald-500/15" : "border-white/10 bg-transparent"}`}>
                          {i < 1 ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          ) : i === 1 ? (
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 text-slate-600" />
                          )}
                        </div>
                        <span className={`text-[10px] font-medium ${i === 1 ? "text-blue-300" : i < 1 ? "text-emerald-400" : "text-slate-600"}`}>
                          {step.label}
                        </span>
                      </div>
                      {i < SERVICE_STEPS.length - 1 && (
                        <div className={`flex-1 h-px mx-1 mb-4 ${i < 1 ? "bg-emerald-500/40" : "bg-white/8"}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══ SEARCH RESULTS ═══ */}
      <AnimatePresence>
        {searched && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-5xl mx-auto px-4 sm:px-6 py-10"
          >
            <div className="border border-white/8 rounded-2xl bg-slate-900/40 backdrop-blur-sm overflow-hidden">
              <div className="p-5 border-b border-white/8">
                <h2 className="text-sm font-semibold text-slate-300">Hasil Pencarian</h2>
              </div>
              <div className="p-5">
                {searching ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mencari...
                  </div>
                ) : results.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-8">Nomor HP tidak ditemukan atau tidak sesuai</p>
                ) : (
                  <Tabs defaultValue="belum_dikerjakan" className="space-y-5">
                    <div className="overflow-x-auto">
                      <TabsList className="bg-white/5 border border-white/8 p-0.5 rounded-lg w-max min-w-[560px] sm:w-full grid grid-cols-4">
                        {[
                          { value: "belum_dikerjakan", label: "Belum Dikerjakan", count: belumDikerjakan.length },
                          { value: "sedang_dikerjakan", label: "Sedang Dikerjakan", count: sedangDikerjakan.length },
                          { value: "selesai_pengerjaan", label: "Selesai", count: selesaiPengerjaan.length },
                          { value: "unit_close", label: "Closed", count: unitClose.length },
                        ].map((tab) => (
                          <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="text-xs rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 py-1.5"
                          >
                            {tab.label} ({tab.count})
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                    {[
                      { value: "belum_dikerjakan", data: belumDikerjakan },
                      { value: "sedang_dikerjakan", data: sedangDikerjakan },
                      { value: "selesai_pengerjaan", data: selesaiPengerjaan },
                      { value: "unit_close", data: unitClose },
                    ].map((tab) => (
                      <TabsContent key={tab.value} value={tab.value} className="mt-0">
                        {tab.data.length === 0 ? (
                          <p className="text-center text-sm text-slate-600 py-8">Tidak ada tiket pada kategori ini</p>
                        ) : (
                          <motion.div
                            initial="initial"
                            animate="animate"
                            variants={stagger}
                            className="grid grid-cols-1 md:grid-cols-2 gap-3"
                          >
                            {tab.data.map(renderCard)}
                          </motion.div>
                        )}
                      </TabsContent>
                    ))}
                  </Tabs>
                )}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ═══ TENTANG KAMI ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <motion.div
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="max-w-3xl mx-auto text-center"
        >
          <motion.p variants={fadeUp} className="text-xs font-semibold text-blue-400 tracking-widest uppercase mb-3">Tentang Kami</motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold mb-5 tracking-tight">
            Super Komputer Balikpapan
          </motion.h2>
          <motion.p variants={fadeUp} className="text-slate-400 leading-relaxed text-base">
            Dengan pengalaman <strong className="text-slate-200">lebih dari 15 tahun</strong> melayani kebutuhan
            Teknologi Informasi di Kalimantan Timur. Kami menyediakan solusi IT menyeluruh — penjualan perangkat,
            infrastruktur jaringan, CCTV, hingga layanan perbaikan profesional sebagai{" "}
            <strong className="text-slate-200">Authorized Service Center ASUS</strong>.
          </motion.p>
        </motion.div>
      </section>

      {/* ═══ BENTO GRID FITUR UTAMA ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <motion.div
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          <motion.p variants={fadeUp} className="text-xs font-semibold text-blue-400 tracking-widest uppercase mb-2 text-center">Layanan Kami</motion.p>
          <motion.h2 variants={fadeUp} className="text-2xl md:text-3xl font-bold text-center mb-10 tracking-tight">
            Solusi IT Lengkap
          </motion.h2>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Big Card — Products */}
            <motion.div
              variants={fadeUp}
              className="md:col-span-2 relative overflow-hidden rounded-xl border border-white/8 bg-slate-900/50 p-6 group hover:border-blue-500/30 transition-all"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-4">
                  <Monitor className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Products</h3>
                <p className="text-slate-400 text-sm mb-5 leading-relaxed">Perangkat komputer & laptop, komponen rakitan, dan aksesoris IT pilihan terbaik.</p>
                <ul className="space-y-2">
                  {["Laptop & PC Built-up", "PC Rakitan & All-in-One", "Processor, Motherboard, RAM", "HDD, SSD & Peripheral"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                      <ChevronRight className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <a
                    href="https://www.tokopedia.com/superkomputer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Lihat di Tokopedia <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </motion.div>

            {/* Card — IT Solutions */}
            <motion.div
              variants={fadeUp}
              className="relative overflow-hidden rounded-xl border border-white/8 bg-slate-900/50 p-5 group hover:border-emerald-500/30 transition-all"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/8 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center mb-3">
                  <Camera className="h-4 w-4 text-emerald-400" />
                </div>
                <h3 className="text-base font-bold text-white mb-3">IT Solutions</h3>
                <ul className="space-y-2">
                  {["CCTV Online & Offline", "Absensi Biometrik", "Networking"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            {/* Card — Service Centre */}
            <motion.div
              variants={fadeUp}
              className="relative overflow-hidden rounded-xl border border-white/8 bg-slate-900/50 p-5 group hover:border-amber-500/30 transition-all"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-600/8 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <div className="w-9 h-9 rounded-lg bg-amber-600/20 border border-amber-500/30 flex items-center justify-center mb-3">
                  <Wrench className="h-4 w-4 text-amber-400" />
                </div>
                <h3 className="text-base font-bold text-white mb-3">Service Centre</h3>
                <ul className="space-y-2">
                  {["Authorized Service Center ASUS", "Perbaikan All Brand PC & Laptop", "Servis Printer & Proyektor"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            {/* Stats strip */}
            <motion.div
              variants={fadeUp}
              className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4"
            >
              {[
                { value: "15+", label: "Tahun Pengalaman", color: "text-blue-400" },
                { value: "ASUS", label: "Authorized Service", color: "text-emerald-400" },
                { value: "500+", label: "Tiket/Bulan", color: "text-amber-400" },
                { value: "8+", label: "Rekanan Korporat", color: "text-sky-400" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/8 bg-white/3 p-4 text-center hover:border-white/15 transition-all">
                  <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ═══ SUPERBOT AI SECTION ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <motion.div
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-[#0a1628] via-slate-900 to-[#0d1b38] p-6 md:p-10"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

          <div className="relative z-10 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            {/* Left */}
            <div>
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-blue-600/15 border border-blue-500/30 rounded-full px-3.5 py-1 mb-5">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs font-semibold text-blue-300 tracking-wide">AI Technical & Customer Assistant</span>
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight mb-4 tracking-tight">
                Konsultasi Instan dengan{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
                  SuperBot AI
                </span>
              </motion.h2>
              <motion.p variants={fadeUp} className="text-slate-400 text-sm md:text-base mb-7 leading-relaxed">
                Didukung <strong className="text-slate-300">Hybrid RAG + Real-time Query</strong> dan Google Gemini AI. Jawaban cepat seputar kendala laptop/PC, estimasi biaya, garansi ASUS, dan pengecekan tiket.
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
                <button
                  onClick={() => openBot("Halo SuperBot, tolong jelaskan layanan apa saja yang ada di Super Komputer.")}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all"
                >
                  <Bot className="h-4 w-4" />
                  Tanya SuperBot
                </button>
                <button
                  onClick={() => openBot("Saya ingin mengecek status pengerjaan tiket servis saya.")}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-slate-300 text-sm font-medium transition-all"
                >
                  <Search className="h-4 w-4" />
                  Cek Tiket via AI
                </button>
              </motion.div>
            </div>

            {/* Right — Feature Cards Grid */}
            <motion.div variants={stagger} className="grid grid-cols-2 gap-3">
              {[
                {
                  icon: Cpu,
                  iconColor: "text-blue-400",
                  title: "Troubleshooting HW",
                  desc: "Laptop matot, blue screen, atau lemot",
                  prompt: "Laptop saya mati total dan tidak mau hidup, apa yang harus dicek?",
                },
                {
                  icon: ShieldCheck,
                  iconColor: "text-emerald-400",
                  title: "Authorized Center",
                  desc: "Garansi & perbaikan resmi ASUS",
                  prompt: "Apakah Super Komputer melayani klaim garansi resmi ASUS?",
                },
                {
                  icon: Wrench,
                  iconColor: "text-amber-400",
                  title: "Estimasi Biaya",
                  desc: "Transparansi harga sparepart & jasa",
                  prompt: "Berapa estimasi biaya ganti SSD, RAM, dan pasang thermal paste?",
                },
                {
                  icon: Clock,
                  iconColor: "text-sky-400",
                  title: "Jam & Lokasi",
                  desc: "Info operasional Jl. Ahmad Yani",
                  prompt: "Toko Super Komputer buka jam berapa dan dimana alamat lengkapnya?",
                },
              ].map((card) => (
                <motion.div
                  key={card.title}
                  variants={fadeUp}
                  onClick={() => openBot(card.prompt)}
                  className="p-4 rounded-xl bg-white/4 border border-white/8 hover:border-blue-500/40 hover:bg-white/7 transition-all cursor-pointer group"
                >
                  <card.icon className={`h-4 w-4 ${card.iconColor} mb-2.5 group-hover:scale-110 transition-transform`} />
                  <h4 className="font-semibold text-xs text-white mb-1">{card.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-snug">{card.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ═══ REKANAN STRATEGIS ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <motion.div
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
        >
          <motion.p variants={fadeUp} className="text-xs font-semibold text-blue-400 tracking-widest uppercase mb-2 text-center">Rekanan</motion.p>
          <motion.h2 variants={fadeUp} className="text-2xl md:text-3xl font-bold text-center mb-2 tracking-tight">Dipercaya Oleh</motion.h2>
          <motion.p variants={fadeUp} className="text-center text-slate-500 text-sm mb-10 max-w-sm mx-auto">Institusi dan perusahaan yang mempercayakan kebutuhan IT mereka kepada kami</motion.p>

          <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {partners.map((name) => (
              <motion.div
                key={name}
                variants={fadeUp}
                className="flex items-center gap-2 p-3.5 rounded-xl border border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5 transition-all"
              >
                <Building2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span className="text-xs font-medium text-slate-400 leading-tight">{name}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ═══ TOKOPEDIA CTA ═══ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <motion.div
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          variants={fadeUp}
          className="rounded-2xl border border-white/8 bg-white/3 p-8 md:p-10 flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div>
            <p className="text-xs font-semibold text-blue-400 tracking-widest uppercase mb-1">Belanja Online</p>
            <h3 className="text-xl font-bold text-white mb-1.5">Tokopedia Super Komputer</h3>
            <p className="text-slate-400 text-sm">Kunjungi toko online resmi kami untuk pembelian perangkat & komponen IT</p>
          </div>
          <a
            href="https://www.tokopedia.com/superkomputer"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all shrink-0"
          >
            <ExternalLink className="h-4 w-4" />
            Buka Tokopedia
          </a>
        </motion.div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/8 bg-[#060910]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            {/* Brand */}
            <div>
              <AppLogo className="h-7 mb-3" />
              <p className="text-xs text-slate-500 leading-relaxed mb-4 max-w-xs">
                Authorized Service Center ASUS. Solusi lengkap IT untuk kebutuhan personal dan korporat di Kalimantan Timur.
              </p>
              <a
                href="https://www.tokopedia.com/superkomputer"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-400 transition-colors"
              >
                <Store className="h-3.5 w-3.5" /> Tokopedia
              </a>
            </div>

            {/* Kontak */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-4">Kontak</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-400" />
                  <a
                    href="https://maps.app.goo.gl/37n98csWeGpB4siH8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-500 hover:text-blue-400 transition-colors leading-relaxed"
                  >
                    Jl. Ahmad Yani No.118, Balikpapan, Kalimantan Timur
                  </a>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                  <a href="tel:+628115404999" className="text-xs text-slate-500 hover:text-blue-400 transition-colors">
                    08115404999
                  </a>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                  <a href="mailto:marketing@superkomputer.net" className="text-xs text-slate-500 hover:text-blue-400 transition-colors">
                    marketing@superkomputer.net
                  </a>
                </div>
              </div>
            </div>

            {/* Jam Operasional */}
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-4">Jam Operasional</h4>
              <div className="space-y-2 text-xs text-slate-500">
                <div className="flex items-center gap-2.5">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                  <span>Senin - Sabtu: 09.00 - 20.00 WITA</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                  <span>Minggu & Hari Libur: Tutup</span>
                </div>
              </div>
              <a
                href="https://maps.app.goo.gl/37n98csWeGpB4siH8"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <MapPin className="h-3.5 w-3.5" /> Buka di Google Maps
              </a>
            </div>
          </div>

          <div className="pt-6 border-t border-white/6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
            <span>© 2026 Super Komputer Balikpapan. All rights reserved.</span>
            <span>SUMTRA by Bambang Harmoko</span>
          </div>
        </div>
      </footer>

      {/* Floating Chat Assistant */}
      <ChatAssistant />
    </div>
  );
}
