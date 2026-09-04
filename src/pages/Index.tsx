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
  Activity,
  Users,
  Check,
  BadgeCheck,
  HardDrive,
  Laptop,
  Shield,
  FileText,
  BadgePercent,
  X,
} from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
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
  { step: "01", label: "Konsultasi & Masuk", desc: "Penerimaan & registrasi unit" },
  { step: "02", label: "Diagnosa & Estimasi", desc: "Pemeriksaan detail teknisi" },
  { step: "03", label: "Perbaikan & Part", desc: "Pengerjaan sesuai persetujuan" },
  { step: "04", label: "Selesai & Diambil", desc: "Quality check & serah terima" },
];

// Spring-based staggered animations
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 280,
      damping: 24,
    },
  },
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
    orderIdsRef.current = fresh.map((r) => r.id);
  }, [fetchByPhone]);

  // Handle incoming realtime events by updating local state directly
  const handleRealtimeUpdate = useCallback((payload: any) => {
    const newRecord = payload.new;
    if (!newRecord || !newRecord.order_id) return;

    setResults((prevResults) => {
      const index = prevResults.findIndex((r) => r.id === newRecord.order_id);
      if (index === -1) return prevResults;

      const newResults = [...prevResults];
      newResults[index] = { ...newResults[index], status: newRecord.status };
      return newResults;
    });
  }, []);

  const activeOrderIdsStr = orderIdsRef.current.sort().join(",");

  const buildChannel = useCallback(() => {
    const ids = orderIdsRef.current;
    if (ids.length === 0) return supabase.channel("empty-channel");

    const phone = lastPhoneRef.current || "";
    const channel = supabase.channel(`public-search-${phone.replace(/\D/g, "")}`);

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "public_service_updates" },
      handleRealtimeUpdate
    );

    return channel;
  }, [activeOrderIdsStr, handleRealtimeUpdate]);

  useReconnectableChannel(results.length > 0, buildChannel, fetchResults);

  // ─── Search handler ──────────────────────────────────────────────────────
  const handleSearch = async (forcedVal?: string) => {
    const val = (forcedVal !== undefined ? forcedVal : searchInput).trim();
    if (!val) return;

    if (/[a-zA-Z]/.test(val)) {
      navigate(`/track/${val.toUpperCase()}`);
      return;
    }

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
  const sedangDikerjakan = results.filter((o) =>
    ["Diagnosa", "Menunggu Persetujuan Pelanggan", "Menunggu Sparepart", "Perbaikan"].includes(o.status)
  );
  const selesaiPengerjaan = results.filter((o) => ["Selesai", "Siap diAmbil"].includes(o.status));
  const unitClose = results.filter((o) => ["Close", "Cancelled"].includes(o.status));

  const renderCard = (order: OrderResult) => (
    <motion.div
      key={order.id}
      variants={itemVariants}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      onClick={() => navigate(`/track/${order.ticket_number}`)}
      className="cursor-pointer group"
    >
      <div className="relative p-4 rounded-xl border border-slate-800/80 bg-slate-900/80 hover:border-blue-500/50 hover:bg-slate-800/90 transition-all duration-200 backdrop-blur-sm shadow-sm">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm tracking-wide">{order.ticket_number}</span>
              <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded">
                {order.device_type || "Unit"}
              </span>
            </div>
            <p className="text-slate-300 text-xs mt-1 font-medium truncate">{order.customer_name}</p>
            <p className="text-slate-400 text-xs mt-0.5 truncate">
              {order.device_brand} — {order.service_type}
            </p>
          </div>
          <div className="shrink-0">
            <StatusBadge status={order.status} />
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 group-hover:text-blue-400 transition-colors">
          <span>Lihat rincian riwayat & teknisi</span>
          <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Background Ambience: Precision Engineered Dark Mode Grid */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-blue-600/[0.07] rounded-full blur-[140px]" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[350px] bg-indigo-600/[0.04] rounded-full blur-[130px]" />
      </div>

      {/* ═══ NAVBAR ═══ */}
      <nav className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070b14]/85 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo className="h-7 w-auto" />
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sistem Online
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Authorized ASUS Service Center
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://www.tokopedia.com/superkomputer"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800/60"
            >
              <Store className="h-3.5 w-3.5 text-blue-400" />
              <span>Official Store</span>
            </a>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/login")}
              className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-800 bg-slate-900/90 hover:bg-slate-800 hover:border-slate-700 text-slate-200 hover:text-white transition-all shadow-xs"
            >
              <LogIn className="h-3.5 w-3.5 text-blue-400" />
              <span>Login Staff</span>
            </motion.button>
          </div>
        </div>
      </nav>

      <div className="relative z-10">
        {/* ═══ HERO SECTION ═══ */}
        <section className="relative pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <motion.div
              initial="hidden"
              animate="show"
              variants={containerVariants}
              className="text-center max-w-3xl mx-auto"
            >
              {/* System Indicator Pulse Pill */}
              <motion.div variants={itemVariants} className="inline-flex items-center justify-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/25 bg-blue-500/10 text-xs text-blue-300 font-medium backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                  </span>
                  <span>SUMTRA Real-Time Tracker • Terhubung Database Toko</span>
                </div>
              </motion.div>

              {/* Commanding Main Headline */}
              <motion.h1
                variants={itemVariants}
                className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.12] mb-5"
              >
                Lacak Status Servis Unit{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-blue-200">
                  Secara Real-Time
                </span>
              </motion.h1>

              {/* Subheadline with Technical Authority */}
              <motion.p
                variants={itemVariants}
                className="text-slate-400 text-sm sm:text-base md:text-lg mb-8 leading-relaxed max-w-2xl mx-auto font-normal"
              >
                Pantau progres reparasi laptop, PC desktop, CCTV, dan klaim garansi resmi ASUS langsung dari meja teknisi Super Komputer Balikpapan.
              </motion.p>

              {/* Primary Focal Point: The Tracking Command Bar */}
              <motion.div
                variants={itemVariants}
                className="relative max-w-xl mx-auto mb-6"
              >
                <div className="relative p-1.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-2xl shadow-blue-950/30 backdrop-blur-xl focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 flex items-center pl-3">
                      <Search className="h-4 w-4 text-slate-400 shrink-0 mr-2.5" />
                      <input
                        type="text"
                        placeholder="Ketik nomor tiket (cth: G26028) atau No. WhatsApp..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none py-2.5"
                      />
                      {searchInput && (
                        <button
                          onClick={() => setSearchInput("")}
                          className="p-1 text-slate-500 hover:text-slate-300 mr-2"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSearch()}
                      disabled={searching}
                      className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs sm:text-sm font-semibold tracking-wide disabled:opacity-50 transition-all shadow-md shadow-blue-600/30 flex items-center gap-2 shrink-0 cursor-pointer"
                    >
                      {searching ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Mengecek...</span>
                        </>
                      ) : (
                        <>
                          <Activity className="h-4 w-4" />
                          <span>Lacak Status</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>

                {/* Quick Interactive Chips */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-xs">
                  <span className="text-slate-500 text-[11px] font-medium">Contoh cepat:</span>
                  {["F26001", "G26028", "Cek via Nomor HP", "Klaim ASUS"].map((sample) => (
                    <button
                      key={sample}
                      onClick={() => {
                        if (sample === "Cek via Nomor HP") {
                          setSearchInput("0811");
                        } else if (sample === "Klaim ASUS") {
                          openBot("Bagaimana prosedur klaim garansi resmi ASUS di Super Komputer?");
                        } else {
                          setSearchInput(sample);
                          handleSearch(sample);
                        }
                      }}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-900 border border-slate-800 text-slate-400 hover:text-blue-300 hover:border-blue-500/40 hover:bg-slate-800/80 transition-all cursor-pointer"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Functional Live Progress Tracker Widget */}
              <motion.div
                variants={itemVariants}
                className="mt-12 max-w-2xl mx-auto rounded-2xl border border-slate-800/90 bg-slate-900/60 p-5 backdrop-blur-md shadow-lg"
              >
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-slate-300">
                    <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Alur Pengerjaan Servis Real-Time</span>
                  </div>
                  <span className="text-[11px] text-slate-500">Standar ISO 9001:2015 Service Quality</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {SERVICE_STEPS.map((step, idx) => (
                    <div
                      key={step.step}
                      className="relative flex flex-col p-3 rounded-xl border border-slate-800 bg-slate-950/40 text-left hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono font-bold text-blue-400/80 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          {step.step}
                        </span>
                        {idx === 0 ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : idx === 1 ? (
                          <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                        ) : (
                          <Circle className="h-3 w-3 text-slate-600" />
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-slate-200">{step.label}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{step.desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ═══ SEARCH RESULTS SECTION ═══ */}
        <AnimatePresence>
          {searched && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.3 }}
              className="max-w-5xl mx-auto px-4 sm:px-6 pb-20"
            >
              <div className="border border-slate-800 rounded-2xl bg-slate-900/90 shadow-2xl backdrop-blur-md overflow-hidden">
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-200">Hasil Pelacakan Tiket</h2>
                    <p className="text-xs text-slate-500">Menampilkan data servis terkait nomor pencarian Anda</p>
                  </div>
                  {results.length > 0 && (
                    <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                      {results.length} Tiket Ditemukan
                    </span>
                  )}
                </div>

                <div className="p-5">
                  {searching ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                      <span className="text-xs">Menghubungkan ke database Supabase...</span>
                    </div>
                  ) : results.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400">
                        <Search className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium text-slate-300">Tidak ada data tiket ditemukan</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Pastikan nomor tiket atau nomor WhatsApp yang Anda masukkan sesuai dengan yang didaftarkan saat penyerahan unit.
                      </p>
                    </div>
                  ) : (
                    <Tabs defaultValue="sedang_dikerjakan" className="space-y-4">
                      <div className="overflow-x-auto">
                        <TabsList className="bg-slate-950/80 border border-slate-800 p-1 rounded-xl w-max min-w-[560px] sm:w-full grid grid-cols-4">
                          {[
                            { value: "belum_dikerjakan", label: "Antrean Masuk", count: belumDikerjakan.length },
                            { value: "sedang_dikerjakan", label: "Dalam Pengerjaan", count: sedangDikerjakan.length },
                            { value: "selesai_pengerjaan", label: "Siap Diambil", count: selesaiPengerjaan.length },
                            { value: "unit_close", label: "Riwayat Selesai", count: unitClose.length },
                          ].map((tab) => (
                            <TabsTrigger
                              key={tab.value}
                              value={tab.value}
                              className="text-xs font-medium rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 py-1.5 transition-all"
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
                            <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                              Tidak ada tiket dalam kategori ini.
                            </div>
                          ) : (
                            <motion.div
                              initial="hidden"
                              animate="show"
                              variants={containerVariants}
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

        {/* ═══ BENTO GRID FITUR UTAMA (ASYMMETRICAL LAYOUT) ═══ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            variants={containerVariants}
          >
            {/* Section Header */}
            <div className="text-center max-w-2xl mx-auto mb-12">
              <motion.span variants={itemVariants} className="text-[11px] font-bold text-blue-400 tracking-widest uppercase mb-2 inline-block">
                Standar Layanan Super Komputer
              </motion.span>
              <motion.h2 variants={itemVariants} className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Transparansi & Keandalan Servis
              </motion.h2>
              <motion.p variants={itemVariants} className="text-slate-400 text-sm mt-3 leading-relaxed">
                Empat fondasi utama yang menjamin perangkat Anda ditangani dengan aman, cepat, dan presisi oleh tim teknisi bersertifikat.
              </motion.p>
            </div>

            {/* Asymmetrical Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">

              {/* MODULE 1: Live Status & Telemetry Simulator (Span 2 col) */}
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="md:col-span-2 relative rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-[#0a1224] to-slate-900/90 p-6 sm:p-7 overflow-hidden group shadow-lg"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white">Pelacakan Status Real-Time</h3>
                      <p className="text-xs text-slate-400">Live Status & Event Log Teknisi</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Sync Aktif
                    </span>
                  </div>
                </div>

                {/* Simulated Telemetry Interface */}
                <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 font-sans text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-400">#F26042</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-300 font-medium">ASUS ROG Strix G15</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                      Pengerjaan (75%)
                    </span>
                  </div>

                  {/* Telemetry Timeline Events */}
                  <div className="space-y-3 pt-3">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <div className="flex-1 flex items-baseline justify-between text-slate-400">
                        <span className="text-slate-300">Unit diterima di meja counter servis & registrasi barcode</span>
                        <span className="text-[10px] text-slate-500 font-mono">09:30 WITA</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <div className="flex-1 flex items-baseline justify-between text-slate-400">
                        <span className="text-slate-300">Diagnosa: Short-circuit VRM motherboard telah teratasi</span>
                        <span className="text-[10px] text-slate-500 font-mono">11:15 WITA</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse mt-1.5 shrink-0" />
                      <div className="flex-1 flex items-baseline justify-between text-slate-300 font-medium">
                        <span>Stress testing suhu GPU 3DMark & pemantauan kestabilan</span>
                        <span className="text-[10px] text-blue-400 font-mono">Real-Time</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/60">
                  <span>Pelanggan menerima notifikasi otomatis saat unit selesai</span>
                  <span className="text-blue-400 font-medium flex items-center gap-1">
                    Transparansi 100% <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </motion.div>

              {/* MODULE 2: Technician Availability & On-Duty Status (Span 1 col) */}
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="relative rounded-2xl border border-slate-800 bg-slate-900/90 p-6 overflow-hidden group shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold text-white">Ketersediaan Teknisi</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      On-Duty
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">Tim teknisi lab bersertifikasi resmi yang siap melayani unit Anda.</p>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800 text-xs">
                      <span className="text-slate-300">Teknisi Bertugas Hari Ini</span>
                      <span className="font-bold text-white font-mono">5 Teknisi</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800 text-xs">
                      <span className="text-slate-300">Waktu Diagnosa Awal</span>
                      <span className="font-bold text-emerald-400 font-mono">&lt; 24 Jam</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>Authorized ASUS Service Engineer</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>BGA Rework & Micro-Soldering Lab</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Tingkat Kepuasan Kerja</span>
                  <span className="text-emerald-400 font-bold font-mono">98.6%</span>
                </div>
              </motion.div>

              {/* MODULE 3: Warranty Transparency & Quality Guarantee (Span 1 col) */}
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="relative rounded-2xl border border-slate-800 bg-slate-900/90 p-6 overflow-hidden group shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Transparansi Garansi</h3>
                  <p className="text-xs text-slate-400 mb-4">Ketenangan pikiran dengan jaminan garansi toko dan garansi resmi.</p>

                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-200">
                        <span>Hardware Servis</span>
                        <span className="text-amber-400 font-bold">1 Bulan</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Garansi toko untuk perbaikan komponen perangkat keras</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-200">
                        <span>Software & OS</span>
                        <span className="text-amber-400 font-bold">1 Minggu</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Jaminan kestabilan instalasi dan driver resmi</p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-200">
                        <span>Garansi Resmi ASUS</span>
                        <span className="text-blue-400 font-bold">Hingga 2 Thn</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Bebas biaya suku cadang bagi unit bergaransi ASUS</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <BadgeCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Kebijakan Tanpa Biaya jika unit tidak dapat diperbaiki</span>
                </div>
              </motion.div>

              {/* MODULE 4: Cost Estimation & Component Pricing (Span 2 col) */}
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="md:col-span-2 relative rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-[#0a1420] to-slate-900/90 p-6 sm:p-7 overflow-hidden group shadow-lg"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white">Estimasi Biaya Komponen & Sparepart</h3>
                      <p className="text-xs text-slate-400">Persetujuan Pelanggan Wajib Sebelum Tindakan</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-sky-500/10 border border-sky-500/20 text-sky-300 w-fit">
                    Tanpa Biaya Terselubung
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Teknisi kami wajib mengkonfirmasi rincian perkiraan biaya dan mendapatkan persetujuan Anda sebelum penggantian sparepart dilakukan.
                </p>

                {/* Popular Services & Pricing Indicator */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/50 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-200">Thermal Paste High-End</span>
                      <p className="text-[10px] text-slate-500">Arctic MX-4 / Kingpin Overhaul</p>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-emerald-400">Termasuk Jasa</span>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/50 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-200">Lisensi Windows & Office Asli</span>
                      <p className="text-[10px] text-slate-500">100% Original Resmi & Permanen</p>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-sky-400">Rp 150.000</span>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/50 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-200">Upgrade SSD NVMe & RAM</span>
                      <p className="text-[10px] text-slate-500">Original Bergaransi Resmi 3-5 Thn</p>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-300">Sesuai Kapasitas</span>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/50 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-200">Rekonstruksi Engsel Laptop</span>
                      <p className="text-[10px] text-slate-500">Perbaikan dudukan baut & frame</p>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-amber-400">Kokoh & Presisi</span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">Ingin tahu estimasi biaya untuk tipe laptop atau kendala Anda?</span>
                  <button
                    onClick={() => openBot("Berapa estimasi biaya servis dan sparepart di Super Komputer?")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    <span>Tanya Estimasi ke SUMTRA AI</span>
                  </button>
                </div>
              </motion.div>

            </div>
          </motion.div>
        </section>

        {/* ═══ SUMTRA AI CONSULTATION SECTION ═══ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            variants={containerVariants}
            className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-[#0a1426] via-slate-900 to-[#0c1830] p-6 sm:p-10 shadow-2xl"
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              {/* Left Column */}
              <div>
                <motion.div variants={itemVariants} className="inline-flex items-center gap-2 bg-blue-600/15 border border-blue-500/30 rounded-full px-3.5 py-1 mb-4">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-blue-300 tracking-wide">SUMTRA AI Tech & Care</span>
                </motion.div>

                <motion.h2 variants={itemVariants} className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight mb-4 tracking-tight">
                  Konsultasi Instan dengan{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
                    SUMTRA AI
                  </span>
                </motion.h2>

                <motion.p variants={itemVariants} className="text-slate-400 text-sm sm:text-base mb-7 leading-relaxed font-normal">
                  Ditenagai oleh <strong className="text-slate-200">Google Gemini & Hybrid RAG</strong>. Dapatkan diagnosa awal seputar kendala hardware/software, cek stok sparepart, dan syarat klaim garansi ASUS dalam hitungan detik.
                </motion.p>

                <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openBot("Halo SUMTRA AI, tolong jelaskan layanan apa saja yang ada di Super Komputer.")}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                  >
                    <Bot className="h-4 w-4" />
                    <span>Mulai Chatbot AI</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openBot("Saya ingin mengecek status pengerjaan tiket servis saya.")}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs sm:text-sm font-medium transition-all cursor-pointer"
                  >
                    <Search className="h-4 w-4 text-blue-400" />
                    <span>Cek Tiket via AI</span>
                  </motion.button>
                </motion.div>
              </div>

              {/* Right Column: AI Prompt Shortcut Cards */}
              <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3">
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
                    title: "Authorized ASUS",
                    desc: "Klaim garansi & perbaikan resmi",
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
                    variants={itemVariants}
                    whileHover={{ y: -3, transition: { duration: 0.15 } }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openBot(card.prompt)}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-blue-500/40 hover:bg-slate-900 transition-all cursor-pointer group shadow-sm"
                  >
                    <card.icon className={`h-4 w-4 ${card.iconColor} mb-2 group-hover:scale-110 transition-transform`} />
                    <h4 className="font-bold text-xs text-white mb-1">{card.title}</h4>
                    <p className="text-[11px] text-slate-500 leading-snug">{card.desc}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* ═══ REKANAN STRATEGIS ═══ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            variants={containerVariants}
          >
            <div className="text-center max-w-xl mx-auto mb-8">
              <motion.span variants={itemVariants} className="text-[11px] font-bold text-blue-400 tracking-widest uppercase mb-1 inline-block">
                Rekanan Korporat
              </motion.span>
              <motion.h2 variants={itemVariants} className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Dipercaya oleh Institusi Terkemuka
              </motion.h2>
              <motion.p variants={itemVariants} className="text-xs text-slate-400 mt-2">
                Dipercaya oleh berbagai perusahaan multinasional dan institusi pendidikan di Kalimantan Timur.
              </motion.p>
            </div>

            <motion.div variants={containerVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto">
              {partners.map((name) => (
                <motion.div
                  key={name}
                  variants={itemVariants}
                  whileHover={{ y: -2, transition: { duration: 0.15 } }}
                  className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/60 transition-all shadow-xs"
                >
                  <Building2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-300 leading-snug truncate">{name}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* ═══ E-COMMERCE & TOKOPEDIA BANNER ═══ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            variants={itemVariants}
            className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl"
          >
            <div>
              <span className="text-[11px] font-bold text-blue-400 tracking-widest uppercase mb-1 block">Toko Online Resmi</span>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-1">Tokopedia Super Komputer Balikpapan</h3>
              <p className="text-slate-400 text-xs sm:text-sm">Beli laptop, PC built-up, komponen rakitan, dan aksesoris original dengan pengiriman aman.</p>
            </div>
            <motion.a
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              href="https://www.tokopedia.com/superkomputer"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-600/20 transition-all shrink-0 cursor-pointer"
            >
              <Store className="h-4 w-4" />
              <span>Buka Tokopedia</span>
              <ExternalLink className="h-3 w-3 opacity-80" />
            </motion.a>
          </motion.div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="border-t border-slate-800/90 bg-[#050810] text-slate-400 text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
            <div className="grid md:grid-cols-3 gap-8 mb-10">
              {/* Brand Col */}
              <div>
                <AppLogo className="h-7 w-auto mb-3" />
                <p className="text-slate-400 leading-relaxed mb-4 max-w-xs font-normal">
                  Authorized Service Center ASUS & Pusat Servis Komputer All-Brand di Balikpapan, Kalimantan Timur.
                </p>
                <div className="flex items-center gap-2 text-slate-300 font-medium">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Suku Cadang & Lisensi Resmi</span>
                </div>
              </div>

              {/* Kontak Col */}
              <div>
                <h4 className="text-sm font-bold text-slate-200 mb-3.5">Kontak & Alamat</h4>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                    <a
                      href="https://maps.app.goo.gl/37n98csWeGpB4siH8"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-300 transition-colors leading-relaxed"
                    >
                      Jl. Ahmad Yani No.118, Balikpapan, Kalimantan Timur
                    </a>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 text-blue-400 shrink-0" />
                    <a href="tel:+628115404999" className="hover:text-blue-300 transition-colors font-mono">
                      0811-540-4999
                    </a>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 text-blue-400 shrink-0" />
                    <a href="mailto:marketing@superkomputer.net" className="hover:text-blue-300 transition-colors">
                      marketing@superkomputer.net
                    </a>
                  </div>
                </div>
              </div>

              {/* Jam Operasional Col */}
              <div>
                <h4 className="text-sm font-bold text-slate-200 mb-3.5">Jam Operasional</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <Clock className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-300 font-medium">Senin - Sabtu: 09.00 - 20.00 WITA</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-500">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>Minggu & Hari Libur Nasional: Tutup</span>
                  </div>
                </div>
                <a
                  href="https://maps.app.goo.gl/37n98csWeGpB4siH8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors font-semibold"
                >
                  <MapPin className="h-3.5 w-3.5" /> Petunjuk Arah Google Maps
                </a>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
              <span>© {new Date().getFullYear()} Super Komputer Balikpapan. Hak Cipta Dilindungi.</span>
              <span>SUMTRA Platform v2.0 • Real-Time Management & Tracking</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Floating Chatbot Assistant */}
      <ChatAssistant />
    </div>
  );
}
