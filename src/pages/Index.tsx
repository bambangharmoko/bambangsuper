import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  LogIn,
  Phone,
  Mail,
  MapPin,
  Clock,
  Monitor,
  Wrench,
  ShieldCheck,
  Cpu,
  HardDrive,
  Printer,
  Camera,
  Store,
  Building2,
  Award,
  ChevronRight,
  Loader2,
  Bot,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  Shield,
  Zap,
  Layers,
  QrCode,
  ArrowUpRight,
  Key,
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
import { Badge } from "@/components/ui/badge";
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

const SERVICE_LIFECYCLE_STEPS = [
  {
    step: 1,
    title: "Registrasi & Cek Awal",
    desc: "Pengecekan fisik, kelengkapan, & pencatatan keluhan unit",
    statusText: "Diterima",
  },
  {
    step: 2,
    title: "Diagnosa & Estimasi",
    desc: "Analisis teknis & konfirmasi persetujuan biaya ke pelanggan",
    statusText: "Diagnosa",
  },
  {
    step: 3,
    title: "Pengerjaan Hardware / OS",
    desc: "Pergantian komponen IC/part, instalasi, & running test kestabilan",
    statusText: "Perbaikan",
  },
  {
    step: 4,
    title: "Quality Control & Siap Ambil",
    desc: "Pengecekan akhir 100% tuntas, cetak nota, & garansi aktif",
    statusText: "Siap diAmbil",
  },
];

const READY_STOCK_PREVIEWS = [
  {
    name: "Baterai Laptop Original",
    brands: "Dell, Asus, Lenovo, Acer, HP",
    warranty: "1 Bulan Garansi Toko Ganti Baru",
    price: "Rp 550.000 - Rp 750.000",
    badge: "Grade A+ Original",
    icon: Zap,
    prompt: "Apakah ready stock baterai laptop Dell dan Asus di toko?",
  },
  {
    name: "LCD Panel Full HD IPS",
    brands: "14.0 & 15.6 Inch Frameless 30-Pin",
    warranty: "1 Bulan (No Dead Pixel Guarantee)",
    price: "Rp 750.000 - Rp 950.000",
    badge: "Pasang 30-60 Menit",
    icon: Monitor,
    prompt: "Berapa biaya ganti LCD laptop 14 inch Full HD IPS?",
  },
  {
    name: "SSD M.2 NVMe PCIe Gen3/4",
    brands: "512GB & 1TB (Samsung / Kingston / Klevv)",
    warranty: "1 Tahun Garansi Resmi",
    price: "Rp 450.000 - Rp 1.100.000",
    badge: "Free Cloning & Pasang",
    icon: HardDrive,
    prompt: "Berapa biaya upgrade SSD 512GB dan kloning Windows di Super Komputer?",
  },
  {
    name: "RAM Sodimm DDR4 / DDR5",
    brands: "8GB & 16GB (3200MHz / 4800MHz)",
    warranty: "Lifetime Warranty",
    price: "Rp 280.000 - Rp 680.000",
    badge: "Dual-Channel Test",
    icon: Cpu,
    prompt: "Apakah bisa upgrade RAM laptop DDR4 8GB / 16GB langsung di toko?",
  },
  {
    name: "Lisensi Windows & Office Asli",
    brands: "Windows 11 Pro & Office 2021 Plus",
    warranty: "Aktivasi Digital Permanen",
    price: "Rp 150.000",
    badge: "Resmi & Original",
    icon: Key,
    prompt: "Berapa harga lisensi resmi Windows 11 Pro dan Office original?",
  },
];

const PARTNERS = [
  "PT. WEIR MINERALS INDONESIA",
  "PT. SANDVIK Mining & Oil",
  "PT. Pandega Citra Niaga & Kelola",
  "GRAND TJOKRO HOTEL",
  "PT. Energy Logistic",
  "PT. ESCO Weir Indonesia",
  "SD Maria Goretti Balikpapan",
  "SKH F Asisi Balikpapan",
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

export default function IndexPage() {
  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<OrderResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeLifecycleStep, setActiveLifecycleStep] = useState(2); // Step 3 as default
  const navigate = useNavigate();

  // ─── Realtime subscription refs ───────────────────────────────────────────
  const lastPhoneRef = useRef<string | null>(null);
  const orderIdsRef = useRef<string[]>([]);

  // Auto-redirect jika sudah login
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/dashboard", { replace: true });
      }
    });
  }, [navigate]);

  // Real-time store status calculation (WITA)
  const storeStatus = useMemo(() => {
    const nowWita = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
    const isSunday = nowWita.getDay() === 0;
    const hour = nowWita.getHours();
    const isOpen = !isSunday && hour >= 9 && hour < 20;

    return {
      isOpen,
      text: isSunday
        ? "Tutup (Hari Minggu - Libur Mingguan)"
        : isOpen
        ? "Buka Sekarang s/d 20.00 WITA"
        : hour < 9
        ? "Buka Hari Ini Pukul 09.00 WITA"
        : "Tutup (Buka Besok 09.00 WITA)",
    };
  }, []);

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
  const handleSearch = async (overrideValue?: string) => {
    const val = (overrideValue || searchInput).trim();
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

    setTimeout(() => {
      const el = document.getElementById("search-results-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  const openAiChatWithPrompt = (promptText: string) => {
    window.dispatchEvent(
      new CustomEvent("open-superbot-chat", {
        detail: { prompt: promptText },
      })
    );
  };

  // ─── Grouped Search Results ──────────────────────────────────────────────
  const belumDikerjakan = results.filter((o) => ["Diterima"].includes(o.status));
  const sedangDikerjakan = results.filter((o) =>
    ["Diagnosa", "Menunggu Persetujuan Pelanggan", "Menunggu Sparepart", "Perbaikan"].includes(o.status)
  );
  const selesaiPengerjaan = results.filter((o) => ["Selesai", "Siap diAmbil"].includes(o.status));
  const unitClose = results.filter((o) => ["Close", "Cancelled"].includes(o.status));

  const renderResultCard = (order: OrderResult) => (
    <Card
      key={order.id}
      className="group relative overflow-hidden bg-slate-900/70 border-slate-800 hover:border-blue-500/50 hover:bg-slate-900 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-blue-500/10"
      onClick={() => navigate(`/track/${order.ticket_number}`)}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex justify-between items-start gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-blue-400">
                #{order.ticket_number}
              </span>
              <span className="text-xs text-slate-400">• {order.customer_name}</span>
            </div>
            <p className="text-sm font-medium text-slate-200">
              {order.device_brand} ({order.device_type})
            </p>
            <p className="text-xs text-slate-400">
              Layanan: <span className="text-slate-300">{order.service_type || "Perbaikan Hardware"}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={order.status} />
            <span className="text-[11px] text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Lacak Detail <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* ═══ Top Notification Bar / Real-Time Store Status ═══ */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 text-xs text-slate-300 py-1.5 px-4 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                storeStatus.isOpen ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span className="font-medium text-slate-200">Toko Balikpapan:</span>
            <span className="text-slate-400 hidden sm:inline">{storeStatus.text}</span>
            <span className="text-slate-400 sm:hidden">
              {storeStatus.isOpen ? "Buka Sekarang" : "Tutup"}
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <a
              href="https://wa.me/628115404999"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400 transition-colors flex items-center gap-1"
            >
              <Phone className="h-3 w-3 text-emerald-400" />
              <span className="hidden md:inline">WhatsApp:</span> 08115404999
            </a>
            <span className="hidden sm:inline text-slate-700">|</span>
            <span className="hidden sm:inline">Jl. Ahmad Yani No.118</span>
          </div>
        </div>
      </div>

      {/* ═══ Main Navbar ═══ */}
      <nav className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl sticky top-[33px] z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo className="h-9" />
            <div className="hidden lg:flex flex-col border-l border-slate-800 pl-3">
              <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
                Authorized Service Center
              </span>
              <span className="text-[10px] text-slate-400">
                Super Ultima Management, Tracking & Application
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://www.tokopedia.com/superkomputer"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 hover:text-emerald-400 transition-all shadow-sm"
            >
              <Store className="h-3.5 w-3.5 text-emerald-400" />
              <span>Official Tokopedia</span>
            </a>

            <Button
              onClick={() => openAiChatWithPrompt("Halo SuperBot, tolong bantu informasi servis perangkat saya.")}
              variant="outline"
              size="sm"
              className="h-9 border-blue-500/30 bg-blue-950/40 text-blue-300 hover:bg-blue-900/50 hover:text-white hover:border-blue-400 text-xs gap-1.5 shadow-sm shadow-blue-950"
            >
              <Bot className="h-3.5 w-3.5 text-blue-400" />
              <span>Tanya AI</span>
            </Button>

            <Button
              size="sm"
              onClick={() => navigate("/login")}
              className="h-9 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-blue-600/20 px-3.5"
            >
              <LogIn className="h-3.5 w-3.5 mr-1.5" />
              <span>Portal Staff</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO SECTION + LIVE TRACKER CARD ═══ */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-24 border-b border-slate-900">
        {/* Subtle royal blue ambient glow background */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-center max-w-7xl mx-auto">
            {/* Left Column: Heading & Quick Tracking Bar */}
            <motion.div
              {...fadeUp}
              className="lg:col-span-7 text-center lg:text-left space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-800/50 text-blue-300 text-xs font-semibold shadow-inner">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                <span>Authorized ASUS Service & Multi-Brand Specialist Balikpapan</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
                Pusat Servis Laptop & PC{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400">
                  Transparan & Terlacak Real-Time
                </span>
              </h1>

              <p className="text-slate-300 text-sm sm:text-base md:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
                Pengalaman 15+ tahun melayani perbaikan hardware, penggantian sparepart resmi bergaransi, dan transparansi status pengerjaan langsung ke smartphone Anda.
              </p>

              {/* ─── QUICK SERVICE TRACKING BAR ─── */}
              <div className="pt-2 max-w-xl mx-auto lg:mx-0">
                <div className="p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl shadow-blue-950/50 backdrop-blur-xl focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1 flex items-center">
                      <Search className="absolute left-3.5 h-4 w-4 text-blue-400 pointer-events-none" />
                      <Input
                        placeholder="Ketik Nomor Tiket (#G26028) atau No. HP..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="pl-10 h-12 bg-transparent border-0 text-white placeholder:text-slate-500 text-sm sm:text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                    <Button
                      onClick={() => handleSearch()}
                      disabled={searching}
                      className="h-12 px-6 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-md shadow-blue-600/30 rounded-xl shrink-0"
                    >
                      {searching ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mencari...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" /> Lacak Servis
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Quick chip examples */}
                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-400 justify-center lg:justify-start">
                  <span className="text-slate-500">Coba cepat:</span>
                  <button
                    onClick={() => {
                      setSearchInput("G26028");
                      handleSearch("G26028");
                    }}
                    className="font-mono px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 hover:border-blue-500/50 hover:text-blue-300 transition-colors"
                  >
                    #G26028
                  </button>
                  <button
                    onClick={() => {
                      setSearchInput("08115404999");
                      handleSearch("08115404999");
                    }}
                    className="px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 hover:border-blue-500/50 hover:text-blue-300 transition-colors"
                  >
                    No. HP WhatsApp
                  </button>
                  <button
                    onClick={() =>
                      openAiChatWithPrompt("Saya ingin mengecek apakah tiket servis saya masih dalam masa garansi toko atau sudah berakhir.")
                    }
                    className="px-2.5 py-0.5 rounded-md bg-blue-950/60 border border-blue-800/40 text-blue-300 hover:bg-blue-900/50 transition-colors flex items-center gap-1"
                  >
                    <Clock className="h-3 w-3 text-blue-400" /> Cek Masa Garansi
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Right Column: INTERACTIVE LIVE SERVICE STATUS CARD (UI Widget Mockup) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="lg:col-span-5"
            >
              <div className="relative rounded-3xl p-1 bg-gradient-to-b from-blue-500/30 via-slate-800/40 to-slate-900/80 shadow-2xl shadow-blue-950/80 backdrop-blur-xl">
                <div className="rounded-[22px] bg-slate-900/95 border border-slate-800/80 p-5 sm:p-6 space-y-5">
                  {/* Card Top Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-mono font-bold text-xs">
                        SK
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm font-bold text-white">#G26028</span>
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold py-0">
                            Live Simulation
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-400">Unit: Dell Latitude 7420 (Core i7 / 16GB)</p>
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3 text-blue-400" /> Real-Time
                    </span>
                  </div>

                  {/* Dynamic Stepper Bar */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-200">
                        Tahapan Servis: <span className="text-blue-400">{SERVICE_LIFECYCLE_STEPS[activeLifecycleStep].title}</span>
                      </span>
                      <span className="font-mono text-slate-400 text-[11px]">
                        Langkah {activeLifecycleStep + 1} dari 4
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 shadow-sm shadow-blue-500/50"
                        style={{ width: `${((activeLifecycleStep + 1) / 4) * 100}%` }}
                      />
                    </div>

                    {/* Step Selector Buttons */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {SERVICE_LIFECYCLE_STEPS.map((step, idx) => (
                        <button
                          key={step.step}
                          onClick={() => setActiveLifecycleStep(idx)}
                          className={`p-2 rounded-xl text-center border transition-all ${
                            activeLifecycleStep === idx
                              ? "bg-blue-600/20 border-blue-500 text-blue-300 font-semibold shadow-inner"
                              : idx < activeLifecycleStep
                              ? "bg-slate-800/60 border-slate-700/60 text-slate-300"
                              : "bg-slate-900/40 border-slate-800 text-slate-500 hover:border-slate-700"
                          }`}
                        >
                          <div className="text-[10px] font-mono mb-0.5">0{step.step}</div>
                          <div className="text-[10px] truncate leading-tight">{step.statusText}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Step Details Box */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Deskripsi Pengerjaan:</span>
                      <span className="text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="h-3 w-3" /> Teknisi Bertugas: Fajar H.
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium">
                      {SERVICE_LIFECYCLE_STEPS[activeLifecycleStep].desc}
                    </p>
                    <div className="flex flex-wrap items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-800/60">
                      <span>Estimasi Garansi: <strong className="text-blue-300">1 Bulan Hardware</strong></span>
                      <span className="font-mono text-slate-400">Status: {SERVICE_LIFECYCLE_STEPS[activeLifecycleStep].statusText}</span>
                    </div>
                  </div>

                  {/* Interactive Action footer inside mockup */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => navigate("/track/G26028")}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
                    >
                      Buka Contoh Pelacakan Asli <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <Badge variant="outline" className="bg-slate-800/50 border-slate-700 text-slate-300 text-[10px]">
                      Notifikasi WhatsApp Aktif
                    </Badge>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SEARCH RESULTS SECTION (EXPANDABLE) ═══ */}
      {searched && (
        <section id="search-results-section" className="container mx-auto px-4 py-10 border-b border-slate-800/80">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Search className="h-5 w-5 text-blue-400" /> Hasil Pencarian Tiket
                </h3>
                <p className="text-xs text-slate-400">
                  Ditemukan {results.length} riwayat servis untuk nomor HP yang dicari
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearched(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Tutup Hasil
              </Button>
            </div>

            {searching ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                <p className="text-sm">Menghubungkan ke database SUMTRA...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-300">Nomor HP tidak ditemukan atau belum terdaftar tiket.</p>
                <p className="text-xs text-slate-500">
                  Pastikan nomor telepon yang dimasukkan sama persis dengan yang didaftarkan pada nota servis fisik Anda.
                </p>
              </div>
            ) : (
              <Tabs defaultValue="sedang_dikerjakan" className="w-full space-y-6">
                <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                  <TabsTrigger
                    value="belum_dikerjakan"
                    className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Belum Dikerjakan ({belumDikerjakan.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="sedang_dikerjakan"
                    className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Sedang Dikerjakan ({sedangDikerjakan.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="selesai_pengerjaan"
                    className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Selesai ({selesaiPengerjaan.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="unit_close"
                    className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    Unit Close ({unitClose.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="belum_dikerjakan" className="space-y-3 mt-0">
                  {belumDikerjakan.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-8">Tidak ada tiket di kategori ini.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3.5">{belumDikerjakan.map(renderResultCard)}</div>
                  )}
                </TabsContent>

                <TabsContent value="sedang_dikerjakan" className="space-y-3 mt-0">
                  {sedangDikerjakan.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-8">Tidak ada tiket di kategori ini.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3.5">{sedangDikerjakan.map(renderResultCard)}</div>
                  )}
                </TabsContent>

                <TabsContent value="selesai_pengerjaan" className="space-y-3 mt-0">
                  {selesaiPengerjaan.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-8">Tidak ada tiket di kategori ini.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3.5">{selesaiPengerjaan.map(renderResultCard)}</div>
                  )}
                </TabsContent>

                <TabsContent value="unit_close" className="space-y-3 mt-0">
                  {unitClose.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-8">Tidak ada tiket di kategori ini.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3.5">{unitClose.map(renderResultCard)}</div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </section>
      )}

      {/* ═══ BENTO GRID FITUR UTAMA (Asimetris & Berkarakter) ═══ */}
      <section className="py-16 md:py-24 relative">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Layanan Komprehensif & Standar Servis Resmi
            </h2>
            <p className="text-slate-400 text-sm">
              Dirancang untuk menghadirkan kepastian estimasi biaya, ketersediaan komponen fisik di toko, dan garansi resmi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-12 gap-5">
            {/* ── CARD A (Card Besar - Col Span 7 / Row Span 2): Katalog Sparepart & Estimasi ── */}
            <motion.div
              {...fadeUp}
              className="lg:col-span-7 md:col-span-2 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 flex flex-col justify-between hover:border-blue-500/40 transition-all duration-300 shadow-xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950 border border-blue-800/40 text-blue-300 text-xs font-semibold">
                    <Monitor className="h-3.5 w-3.5 text-blue-400" />
                    <span>Etalase Ready Stock & Estimasi</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Real-Time Inventory</span>
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">
                    Katalog Sparepart & Biaya Perbaikan Jelas
                  </h3>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1">
                    Komponen laptop dan PC siap pasang dengan jaminan garansi toko resmi ganti baru tanpa biaya tambahan.
                  </p>
                </div>

                {/* Component Preview List */}
                <div className="space-y-2.5 pt-2">
                  {READY_STOCK_PREVIEWS.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => openAiChatWithPrompt(item.prompt)}
                      className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-blue-500/50 hover:bg-slate-950 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 group/item"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-blue-400 shrink-0 group-hover/item:scale-105 transition-transform">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white group-hover/item:text-blue-300 transition-colors">
                              {item.name}
                            </span>
                            <Badge variant="outline" className="text-[10px] bg-slate-900 border-slate-700 text-slate-300 py-0">
                              {item.badge}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400">{item.brands} • {item.warranty}</p>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-1.5 sm:pt-0 border-slate-800/60">
                        <span className="text-xs font-bold text-emerald-400">{item.price}</span>
                        <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
                          Tanya Stok <ArrowRight className="h-2.5 w-2.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-5 flex items-center justify-between border-t border-slate-800/80 mt-4 text-xs text-slate-400">
                <span>📍 Pemasangan & pengujian langsung di workshop toko</span>
                <button
                  onClick={() => openAiChatWithPrompt("Saya ingin menanyakan ketersediaan sparepart dan estimasi harga.")}
                  className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                >
                  Konsultasi Sparepart Lengkap <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>

            {/* ── CARD B (Card Sedang - Col Span 5): Konsultasi Teknisi & SuperBot AI ── */}
            <motion.div
              {...fadeUp}
              transition={{ delay: 0.1 }}
              className="lg:col-span-5 md:col-span-1 rounded-3xl bg-gradient-to-b from-blue-950/40 via-slate-900 to-slate-900 border border-blue-800/30 p-6 sm:p-7 flex flex-col justify-between hover:border-blue-500/50 transition-all duration-300 shadow-xl relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-800/50 text-emerald-300 text-xs font-semibold">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Teknisi & AI Online</span>
                  </div>
                  <Badge variant="outline" className="text-[11px] bg-blue-950/60 border-blue-800/50 text-blue-300">
                    Respon Instan
                  </Badge>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Bot className="h-5 w-5 text-blue-400" /> Live AI & Technical Support
                  </h3>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
                    Sampaikan keluhan laptop mati total, layar bergaris, bluescreen, atau kendala jaringan untuk diagnosa awal cepat.
                  </p>
                </div>

                {/* Quick Consultation Chips */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Topik Konsultasi Populer:
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      {
                        title: "Laptop Mati Total / No Display",
                        desc: "Pengecekan IC Power, Short Mainboard, & Charging",
                        prompt: "Laptop saya mati total dan tidak ada indikator lampu sama sekali, apa yang harus dicek?",
                      },
                      {
                        title: "Klaim Garansi Resmi ASUS",
                        desc: "Authorized Service Center ROG, TUF, ZenBook",
                        prompt: "Bagaimana cara klaim garansi resmi laptop ASUS di Super Komputer Balikpapan?",
                      },
                      {
                        title: "Pembersihan Thermal Paste & Fan",
                        desc: "Atasi laptop cepat panas, throttling, & bersuara bising",
                        prompt: "Berapa biaya jasa cleaning fan dan ganti thermal paste laptop?",
                      },
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => openAiChatWithPrompt(item.prompt)}
                        className="w-full text-left p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-950 transition-all text-xs group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200 group-hover:text-blue-300 transition-colors">
                            {item.title}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800">
                <Button
                  onClick={() => openAiChatWithPrompt("Halo SuperBot, tolong jelaskan layanan perbaikan apa saja di Super Komputer.")}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/25"
                >
                  <MessageSquare className="h-4 w-4 mr-2" /> Buka Percakapan AI Sekarang
                </Button>
              </div>
            </motion.div>

            {/* ── CARD C (Card Sedang - Col Span 5): Sistem Garansi & Transparansi Nota ── */}
            <motion.div
              {...fadeUp}
              transition={{ delay: 0.2 }}
              className="lg:col-span-5 md:col-span-1 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col justify-between hover:border-blue-500/40 transition-all duration-300 shadow-xl"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-emerald-950 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Garansi & Nota Transparan</h3>
                    <p className="text-[11px] text-slate-400">Standar operasional toko resmi SUMTRA</p>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Garansi Hardware 1 Bulan Penuh</strong>
                      <p className="text-[11px] text-slate-400">Klaim ganti baru atau perbaikan ulang tanpa biaya jika kendala yang sama berulang.</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Persetujuan Biaya di Awal</strong>
                      <p className="text-[11px] text-slate-400">Tidak ada biaya tersembunyi. Teknisi baru bekerja setelah Anda menyetujui estimasi harga.</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5">
                    <QrCode className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Pelacakan QRIS & Nota Digital</strong>
                      <p className="text-[11px] text-slate-400">Scan QR nota untuk melihat foto pengerjaan komponen dan status tiket langsung.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Pelacakan real-time 24/7</span>
                <span className="text-emerald-400 font-medium">100% Data Aman</span>
              </div>
            </motion.div>

            {/* ── CARD D (Card Horizontal - Col Span 7): Solusi Korporat & Partner ── */}
            <motion.div
              {...fadeUp}
              transition={{ delay: 0.25 }}
              className="lg:col-span-7 md:col-span-2 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col justify-between hover:border-blue-500/40 transition-all duration-300 shadow-xl"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold">
                    <Building2 className="h-3.5 w-3.5 text-blue-400" />
                    <span>Solusi Enterprise & Institusi</span>
                  </div>
                  <span className="text-xs text-slate-400">Kalimantan Timur</span>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center sm:text-left space-y-1">
                    <Camera className="h-5 w-5 text-blue-400" />
                    <h4 className="font-semibold text-xs text-white">CCTV & Keamanan</h4>
                    <p className="text-[11px] text-slate-400 leading-tight">Instalasi & monitoring online IP Camera</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center sm:text-left space-y-1">
                    <Layers className="h-5 w-5 text-emerald-400" />
                    <h4 className="font-semibold text-xs text-white">Jaringan Kantor</h4>
                    <p className="text-[11px] text-slate-400 leading-tight">Mikrotik, Fiber Optik, & LAN Setup</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center sm:text-left space-y-1">
                    <Printer className="h-5 w-5 text-amber-400" />
                    <h4 className="font-semibold text-xs text-white">Maintenance Kontrak</h4>
                    <p className="text-[11px] text-slate-400 leading-tight">Perawatan berkala PC & Printer kantor</p>
                  </div>
                </div>

                {/* Corporate Partners Pill List */}
                <div className="pt-2">
                  <span className="text-[11px] text-slate-400 block mb-2 font-medium">Dipercaya oleh institusi terkemuka:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PARTNERS.slice(0, 6).map((p, idx) => (
                      <span key={idx} className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-medium">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 mt-2">
                <span>Pengadaan & Penawaran Resmi (SPK / Faktur Pajak)</span>
                <a href="mailto:marketing@superkomputer.net" className="text-blue-400 hover:underline font-medium">
                  Hubungi B2B Support
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ TOKOPEDIA & ONLINE STORE HIGHLIGHT ═══ */}
      <section className="container mx-auto px-4 py-8">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-0.5 rounded-full">
              <Award className="h-3.5 w-3.5" /> Official Store Tokopedia (Rating 4.9/5)
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Belanja Perangkat Komputer & Aksesoris IT Online
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Pengiriman instan untuk wilayah Balikpapan (GoSend/GrabExpress) atau reguler seluruh Indonesia dengan jaminan originalitas produk.
            </p>
          </div>

          <Button
            asChild
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-11 px-6 shadow-lg shadow-emerald-600/20 shrink-0 rounded-xl"
          >
            <a href="https://www.tokopedia.com/superkomputer" target="_blank" rel="noopener noreferrer">
              <Store className="h-4 w-4 mr-2" /> Kunjungi Tokopedia Super Komputer
            </a>
          </Button>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-400 mt-12">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Brand Information */}
            <div className="space-y-3">
              <AppLogo className="h-8" />
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                Authorized Service Center Resmi ASUS & Multi-Brand IT Specialist. Solusi menyeluruh untuk kebutuhan personal, kantor, dan korporat di Kalimantan Timur.
              </p>
              <div className="pt-2">
                <span className="text-[11px] text-slate-500 font-mono">SUMTRA System Engine v2.0</span>
              </div>
            </div>

            {/* Kontak & Lokasi */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white">Workshop & Service Center</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <a
                    href="https://maps.app.goo.gl/37n98csWeGpB4siH8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-300 transition-colors"
                  >
                    Jl. Ahmad Yani No.118, Gunung Sari Ilir, Balikpapan Tengah, Kalimantan Timur 76113
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-400 shrink-0" />
                  <a href="tel:+628115404999" className="hover:text-emerald-300 transition-colors">
                    08115404999 (Customer Service / WhatsApp)
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-400 shrink-0" />
                  <a href="mailto:marketing@superkomputer.net" className="hover:text-blue-300 transition-colors">
                    marketing@superkomputer.net
                  </a>
                </div>
              </div>
            </div>

            {/* Jam Operasional */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white">Jam Operasional Toko</h4>
              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <Clock className="h-3.5 w-3.5 text-blue-400" /> Senin - Sabtu
                  </span>
                  <span className="font-mono text-emerald-400 font-medium">09.00 - 20.00 WITA</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400">Minggu & Hari Libur Nasional</span>
                  <span className="font-mono text-amber-400 font-medium">Tutup / Libur</span>
                </div>
              </div>
              <a
                href="https://maps.app.goo.gl/37n98csWeGpB4siH8"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 pt-1"
              >
                <MapPin className="h-3.5 w-3.5" /> Buka Penunjuk Arah Google Maps
              </a>
            </div>
          </div>

          <Separator className="my-8 bg-slate-800/80" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>© 2026 Super Komputer Balikpapan. Seluruh Hak Cipta Dilindungi.</span>
            <span>Aplikasi PWA Super Komputer v2</span>
          </div>
        </div>
      </footer>

      {/* Floating Chat Assistant (SuperBot AI) */}
      <ChatAssistant />
    </div>
  );
}
