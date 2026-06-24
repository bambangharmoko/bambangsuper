import { useState } from "react";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

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
    items: ["Authorized Service Lenovo & ASUS", "Perbaikan All Brand PC & Laptop", "Servis Printer & Proyektor"],
  },
];

const partners = [
  "PT. WEIR MINERALS INDONESIA",
  "PT. SANDVIK Mining & Oil",
  "PT. Pandega Citra Niaga & Kelola",
  "GRAND TJOKRO HOTEL",
  "PT. Energy Logistic",
  "PT. ESCO Weir Indonesia",
  "SD Maria Goreti",
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

  const handleSearch = async () => {
    const val = searchInput.trim();
    if (!val) return;

    if (/[a-zA-Z]/.test(val)) {
      navigate(`/track/${val.toUpperCase()}`);
      return;
    }

    setSearching(true);
    setSearched(true);

    const { data, error } = await (supabase.rpc as any)(
      "get_public_orders_by_phone",
      { _phone: val }
    );

    if (error) {
      console.error("Failed to query service orders by phone number:", error);
      toast.error("Gagal mencari tiket: " + error.message);
    }
    setResults((data as OrderResult[]) || []);
    setSearching(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ═══ Navbar ═══ */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-primary">Super Computer</span>
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
            <p className="text-center text-muted-foreground">Tidak ada pesanan ditemukan untuk nomor tersebut.</p>
          ) : (
            <div className="space-y-3 max-w-lg mx-auto">
              <h3 className="font-semibold text-lg">Pesanan Ditemukan ({results.length})</h3>
              {results.map((order) => (
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
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══ Tentang Kami ═══ */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Super Computer Balikpapan</h2>
          <p className="text-muted-foreground leading-relaxed">
            Dengan pengalaman <strong className="text-foreground">lebih dari 15 tahun</strong> melayani kebutuhan
            Teknologi Informasi di Kalimantan Timur, Super Computer telah menjadi mitra terpercaya bagi pelanggan retail
            maupun korporat. Kami menyediakan solusi IT menyeluruh — mulai dari penjualan perangkat, pemasangan
            infrastruktur jaringan & keamanan, hingga layanan perbaikan profesional sebagai{" "}
            <strong className="text-foreground">Authorized Service Center Lenovo & ASUS</strong>.
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

      {/* ═══ Footer ═══ */}
      <footer className="bg-sidebar text-sidebar-foreground">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Info Perusahaan */}
            <div>
              <h4 className="text-lg font-bold text-sidebar-primary-foreground mb-3">Super Computer</h4>
              <p className="text-sm text-sidebar-foreground/70 leading-relaxed mb-4">
                Authorized Service Center Lenovo & ASUS. Solusi lengkap IT untuk kebutuhan personal dan korporat di
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
            <span>© 2026 Super Computer Balikpapan.</span>
            <span>Super Computer Apps by Bambang Harmoko</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
