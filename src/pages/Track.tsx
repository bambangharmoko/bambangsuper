import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { isRunningAsPWA, openInPWA } from "@/utils/pwa-redirect";
import { supabase } from "@/integrations/supabase/client";
import { useReconnectableChannel } from "@/hooks/useReconnectableChannel";
import { StatusTimeline } from "@/components/StatusTimeline";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Phone, Mail, Monitor, RefreshCw, Printer, CheckCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NotificationSubscribeButton } from "@/components/NotificationSubscribeButton";

interface Order {
  id: string;
  ticket_number: string;
  customer_name: string;
  customer_phone?: string;
  device_type: string;
  device_brand: string;
  device_model: string;
  service_type: string;
  unit_condition: string;
  status: string;
  notes: string | null;
  unit_checks: Record<string, boolean> | null;
  created_at: string;
  invoice_items: any[] | null;
  final_cost: number | null;
  warranty_duration?: number | null;
  warranty_unit?: string | null;
  warranty_expiry?: string | null;
  warranty_notes?: string | null;
  customer_email?: string;
  device_type_other?: string;
  serial_number?: string;
  unit_accessories?: string;
  problem_explanation?: string;
  damage_description?: string;
}

interface Update {
  status: string;
  description: string | null;
  created_at: string;
  cancel_type: string | null;
}

interface Photo {
  photo_url: string;
  label: string;
}


export default function TrackPage() {
  const { ticketId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && ticketId) {
        if (!isRunningAsPWA()) {
          const hasFired = sessionStorage.getItem(`pwa_intent_fired_${ticketId}`);
          
          if (!hasFired) {
            sessionStorage.setItem(`pwa_intent_fired_${ticketId}`, "true");
            // Jika belum di dalam aplikasi PWA (masih di browser), paksa buka PWA
            openInPWA();
            // Fallback navigasi internal jika popup diblokir atau gagal
            setTimeout(() => {
              navigate(`/dashboard/orders/${ticketId.toUpperCase()}`, { replace: true });
            }, 500);
          } else {
            // Jika sudah pernah dipanggil (berarti fallback), langsung navigasi
            navigate(`/dashboard/orders/${ticketId.toUpperCase()}`, { replace: true });
          }
        } else {
          // Jika sudah di dalam PWA, langsung pindah ke dashboard internal
          navigate(`/dashboard/orders/${ticketId.toUpperCase()}`, { replace: true });
        }
      }
    });
  }, [ticketId, navigate]);

  const [order, setOrder] = useState<Order | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!ticketId) return;
    try {
      const ticket = ticketId.toUpperCase();
      const { data: orderRows, error } = await supabase.rpc(
        "get_public_order_by_ticket",
        { _ticket: ticket },
      );

      const orderData = Array.isArray(orderRows) ? orderRows[0] : orderRows;
      if (error || !orderData) {
        setNotFound(true);
        setFetchError(null);
        return;
      }
      setOrder(orderData as Order);
      setNotFound(false);

      const [updatesRes, photosRes] = await Promise.all([
        supabase.rpc("get_public_updates_by_ticket", { _ticket: ticket }),
        supabase.rpc("get_public_photos_by_ticket", { _ticket: ticket }),
      ]);
      if (updatesRes.error) throw updatesRes.error;
      if (photosRes.error) throw photosRes.error;

      setUpdates(((updatesRes.data as Update[]) || []) as Update[]);
      const allPhotos = (photosRes.data as Photo[]) || [];
      const publicPhotos = allPhotos.filter((p) => p.label !== "Bukti Diagnosa");
      setPhotos(publicPhotos);
      setFetchError(null);
    } catch (error) {
      console.error("Failed to fetch tracking data", error);
      setFetchError(error instanceof Error ? error.message : "Koneksi terputus");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [ticketId, fetchData]);

  // ─── Realtime: auto-refresh when order status changes ─────────────────────
  const buildTrackChannel = useCallback(
    () => {
      const channel = supabase.channel(`track-${ticketId}`);
      channel.on("postgres_changes", { event: "*", schema: "public", table: "service_orders" }, () => {
        fetchData();
      });
      channel.on("postgres_changes", { event: "*", schema: "public", table: "service_updates" }, () => {
        fetchData();
      });
      channel.on("postgres_changes", { event: "*", schema: "public", table: "service_photos" }, () => {
        fetchData();
      });
      return channel;
    },
    [ticketId, fetchData],
  );

  useReconnectableChannel(!!ticketId, buildTrackChannel, fetchData);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      fetchData();
    };
    const handleFocus = () => fetchData();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchData]);

  if (fetchError && !loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center border-destructive/30 bg-destructive/5">
          <CardContent className="p-8 space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <div>
              <h2 className="text-lg font-bold text-destructive">Koneksi terputus</h2>
              <p className="text-sm text-muted-foreground">{fetchError}</p>
            </div>
            <Button variant="outline" onClick={() => { setFetchError(null); setLoading(true); fetchData(); }}>
              <RefreshCw className="h-4 w-4 mr-2" /> Muat Ulang Data
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="p-8">
            <Monitor className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold mb-2">Tiket Tidak Ditemukan</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Nomor tiket "{ticketId}" tidak ditemukan dalam sistem.
            </p>
            <Link to="/" className="text-primary hover:underline text-sm">
              ← Kembali ke Beranda
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) return null;

  const unitChecks = (order.unit_checks || {}) as Record<string, boolean>;
  const displayStatus = order.status;
  const invoiceItems = (order.invoice_items || []) as { description: string; amount: number }[];

  return (
    <div className="min-h-screen bg-background print:bg-transparent print:min-h-0">
      {/* Print Layout - Only visible when printing */}
      <div className="hidden print:block text-black text-sm font-sans max-w-3xl mx-auto p-4">
        {/* Header & QR Codes */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex flex-col items-center gap-1 w-24">
            <QRCodeSVG value="https://wa.me/628115404999" size={54} bgColor="#ffffff" fgColor="#000000" level="M" />
            <p className="text-[9px] font-medium mt-1 text-center leading-tight">WhatsApp Kami</p>
          </div>

          <div className="text-center flex-1 px-2">
            <h1 className="text-base font-bold uppercase mb-0.5">Formulir Tanda Terima Servis / Perbaikan</h1>
            <h2 className="text-sm font-bold">SUPER KOMPUTER</h2>
            <p className="text-[9px]">Jl Ahmad Yani No 118 | Telp/WA: 0811-5404-999 | IG: @superkomputer | Tokopedia: superkomputer </p>
          </div>

          <div className="flex flex-col items-center gap-1 w-24">
            <QRCodeSVG value={`${window.location.origin}/track/${order.ticket_number}`} size={54} bgColor="#ffffff" fgColor="#000000" level="M" />
            <p className="text-[9px] font-medium mt-1 text-center leading-tight">Lacak Tiket</p>
          </div>
        </div>

        {/* Informasi Pengguna */}
        <div className="mb-2">
          <h3 className="font-bold text-sm mb-1 border-b border-black pb-1">👤 INFORMASI PENGGUNA</h3>
          <table className="w-full text-[11px] border-collapse border border-black">
            <tbody>
              <tr>
                <td className="border border-black p-1 font-bold w-1/3 bg-gray-100">ID Service</td>
                <td className="border border-black p-1">{order.ticket_number}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold bg-gray-100">Nama Pelanggan</td>
                <td className="border border-black p-1">{order.customer_name}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold bg-gray-100">Nomor Telepon/Ponsel</td>
                <td className="border border-black p-1">{order.customer_phone || "-"}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold bg-gray-100">Email</td>
                <td className="border border-black p-1">{order.customer_email || "-"}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold bg-gray-100">Tanggal Masuk / Waktu</td>
                <td className="border border-black p-1">{new Date(order.created_at).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Informasi Produk */}
        <div className="mb-2">
          <h3 className="font-bold text-sm mb-1 border-b border-black pb-1">💻 INFORMASI PRODUK</h3>
          <table className="w-full text-[11px] border-collapse border border-black">
            <tbody>
              <tr>
                <td className="border border-black p-1 font-bold w-1/3 bg-gray-100">Jenis Perangkat</td>
                <td className="border border-black p-1">{order.device_type} {order.device_type_other ? `(${order.device_type_other})` : ""}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold bg-gray-100">Merek & Model</td>
                <td className="border border-black p-1">{order.device_brand} {order.device_model}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold bg-gray-100">Nomor Seri (SN) / IMEI</td>
                <td className="border border-black p-1">{order.serial_number || "-"}</td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold bg-gray-100">Kelengkapan (Aksesori)</td>
                <td className="border border-black p-1">{order.unit_accessories || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Keluhan & Diagnosa Awal */}
        <div className="mb-2">
          <h3 className="font-bold text-sm mb-1 border-b border-black pb-1">🛠️ KELUHAN & DIAGNOSA AWAL</h3>
          <table className="w-full text-[11px] border-collapse border border-black">
            <tbody>
              <tr>
                <td className="border border-black p-1 font-bold w-1/3 bg-gray-100 align-top">Permasalahan Unit</td>
                <td className="border border-black p-1">{order.problem_explanation || order.damage_description || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Syarat dan Ketentuan Layanan */}
        <div className="mb-2 text-[9px] leading-tight">
          <h3 className="font-bold text-sm mb-1 border-b border-black pb-1">📜 SYARAT DAN KETENTUAN LAYANAN</h3>
          <p className="italic mb-0.5">*(Silakan pelanggan membaca S&K di bawah ini sebelum menandatangani)*</p>
          <ol className="list-decimal pl-4 space-y-0.5 mb-1.5">
            <li><strong>Risiko Kehilangan Data:</strong> Kami tidak bertanggung jawab atas kehilangan, kerusakan, atau kebocoran data selama proses pengecekan maupun perbaikan. Pelanggan sangat disarankan untuk melakukan <em>backup</em> data pribadi secara mandiri sebelum menyerahkan unit.</li>
            <li><strong>Batas Waktu Pengambilan Unit:</strong> Unit yang telah selesai diperbaiki atau dibatalkan, namun tidak diambil dalam kurun waktu <strong>3 (tiga) bulan</strong> sejak pelanggan dihubungi, maka segala bentuk kerusakan, kehilangan, atau penyusutan nilai barang sudah berada di luar tanggung jawab kami. Pihak toko berhak mengelola unit tersebut untuk menutupi biaya administrasi dan penyimpanan.</li>
            <li><strong>Risiko Unit Mati Total:</strong> Untuk unit yang diserahkan dalam <strong>Kondisi apa pun</strong>, apabila sebelumnya pelanggan telah diinformasikan oleh teknisi bahwa terdapat risiko unit menjadi Mati Total selama proses pembongkaran, pengecekan, atau perbaikan, maka kami tidak bertanggung jawab jika hal tersebut benar-benar terjadi. Tindakan perbaikan komponen elektronik memiliki risiko teknis bawaan yang terkadang di luar kendali.</li>
            <li><strong>Pengecekan Gratis (<em>Free Diagnostic</em>):</strong> Kami tidak memungut biaya pengecekan atau diagnosa. Apabila setelah dilakukan pengecekan pelanggan memutuskan untuk membatalkan perbaikan (misalnya karena estimasi biaya tidak disetujui), unit akan dirakit kembali dan dikembalikan <strong>tanpa dikenakan biaya apa pun</strong>.</li>
            <li><strong>Garansi Perbaikan:</strong> Garansi servis berlaku selama <strong>30 Hari</strong> terhitung sejak unit selesai diperbaiki atau diambil. Garansi ini <strong>hanya berlaku</strong> untuk jenis keluhan dan pergantian suku cadang yang sama.</li>
            <li><strong>Klaim & Batalnya Garansi (Void):</strong> Garansi otomatis hangus atau tidak berlaku apabila unit kembali dengan keluhan/kerusakan pada komponen yang <strong>berbeda</strong> dari riwayat perbaikan sebelumnya. Garansi juga batal jika ditemukan indikasi kelalaian pemakaian (<em>human error</em>), seperti cacat fisik (jatuh, terbentur, pecah), atau indikasi unit terkena cairan setelah perbaikan selesai.</li>
            <li><strong>Keamanan Unit & Kejadian Tak Terduga:</strong> Kami berkomitmen penuh untuk menjaga keamanan unit Anda selama berada di bengkel kami. Namun, apabila terjadi kejadian luar biasa di luar kendali kami (<em>force majeure</em>) seperti bencana alam, kebakaran, atau musibah tak terduga lainnya, maka segala bentuk penyelesaian akan dibicarakan secara musyawarah dan kekeluargaan demi menemukan solusi terbaik bagi kedua belah pihak.</li>
          </ol>
          <div className="border border-black p-1 bg-gray-50">
            <p className="font-bold mb-0.5 text-[9px]">PERNYATAAN PELANGGAN</p>
            <p>Saya telah membaca, memahami, dan menyetujui seluruh Syarat dan Ketentuan di atas. Saya juga mengonfirmasi bahwa data informasi produk yang diserahkan adalah benar.</p>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-4">
          <table className="w-full text-center text-[11px]">
            <tbody>
              <tr>
                <td className="w-1/2 pb-8"><strong>Tanda Tangan Pelanggan</strong></td>
                <td className="w-1/2 pb-8"><strong>Tanda Tangan Penerima</strong></td>
              </tr>
              <tr>
                <td>( ................................................. )</td>
                <td>( ................................................. )</td>
              </tr>
              <tr>
                <td><strong>Nama: {order.customer_name || "................................................."}</strong></td>
                <td><strong>Nama: SUPER KOMPUTER</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <header className="sticky top-0 z-20 gradient-hero text-primary-foreground p-4 print:hidden">
        <div className="max-w-lg mx-auto">
          <Link to="/" className="flex items-center gap-2 text-sm text-primary-foreground/70 mb-3 hover:text-primary-foreground">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">{order.ticket_number}</h1>
              <p className="text-primary-foreground/70 text-sm truncate">{order.customer_name}</p>
            </div>
            <StatusBadge status={displayStatus} />
          </div>
          <div className="mt-3 flex justify-between items-center">
            <NotificationSubscribeButton ticketNumber={order.ticket_number} />
            <Button variant="outline" size="sm" onClick={() => window.print()} className="bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              <Printer className="h-4 w-4 mr-2" /> Cetak Tanda Terima
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4 print:hidden">
        {!isOnline && <div className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">Mode offline. Status akan diperbarui saat koneksi kembali.</div>}
        {/* Detail Unit */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detail Unit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Perangkat</span>
                <p className="font-medium">{order.device_type}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Merk</span>
                <p className="font-medium">{order.device_brand}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Model</span>
                <p className="font-medium">{order.device_model}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tipe Servis</span>
                <p className="font-medium">{order.service_type}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Kondisi</span>
                <p className="font-medium">{order.unit_condition}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tanggal Masuk</span>
                <p className="font-medium">{new Date(order.created_at).toLocaleDateString("id-ID")}</p>
              </div>
              {(order.warranty_duration || order.warranty_notes || order.warranty_expiry) ? (
                <div>
                  <span className="text-muted-foreground">Masa Garansi</span>
                  <p className="font-medium">
                    {(() => {
                      if (order.warranty_expiry) {
                        const now = new Date();
                        const expiryDate = new Date(order.warranty_expiry);
                        const diffTime = expiryDate.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays > 0) {
                          return `Aktif - Sisa ${diffDays} Hari${order.warranty_notes ? ` (${order.warranty_notes})` : ""}`;
                        } else {
                          return <span className="text-destructive">Tidak Aktif{order.warranty_notes ? ` (${order.warranty_notes})` : ""}</span>;
                        }
                      }

                      return [
                        order.warranty_duration ? `${order.warranty_duration} ${order.warranty_unit || 'hari'}` : "",
                        order.warranty_notes ? `(${order.warranty_notes})` : ""
                      ].filter(Boolean).join(" ") || "Aktif";
                    })()}
                  </p>
                </div>
              ) : null}
            </div>
            {order.notes && (
              <div>
                <span className="text-muted-foreground">Catatan</span>
                <p className="font-medium">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unit Checks */}
        {/* Unit Checks */}
        {order.unit_checks && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hasil Cek Unit</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const STANDARD_CHECK_ITEMS = ["Speaker", "Camera", "Touchpad", "Keyboard", "Wifi", "LCD Panel"];
                
                // 1. Filter out internal keys like _is_linked_customer
                const validChecks: Record<string, boolean> = {};
                for (const [k, v] of Object.entries(unitChecks)) {
                  if (!k.startsWith("_")) {
                    validChecks[k] = Boolean(v);
                  }
                }
                
                // 2. Identify checked vs unchecked items
                const uncheckedItems: string[] = [];
                const checkedItems: string[] = [];
                
                for (const item of STANDARD_CHECK_ITEMS) {
                  const label = item === "Wifi" ? "Wi-Fi" : item;
                  if (!validChecks[item]) {
                    uncheckedItems.push(label);
                  } else {
                    checkedItems.push(label);
                  }
                }
                
                // Add any non-standard items
                for (const [k, v] of Object.entries(validChecks)) {
                  if (!STANDARD_CHECK_ITEMS.includes(k)) {
                    if (!v) uncheckedItems.push(k);
                    else checkedItems.push(k);
                  }
                }
                
                // 3. Logic to display
                const totalItems = STANDARD_CHECK_ITEMS.length + Object.keys(validChecks).filter(k => !STANDARD_CHECK_ITEMS.includes(k)).length;
                
                if (uncheckedItems.length === totalItems) {
                  return <p className="text-sm text-muted-foreground">Kondisi unit belum dapat diverifikasi atau unit tidak dalam kondisi baik saat pemeriksaan.</p>;
                }
                
                if (uncheckedItems.length === 0) {
                  return <p className="text-sm text-success-foreground font-medium flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Seluruh kondisi unit telah diperiksa dan dalam kondisi baik.</p>;
                }
                
                // Mixed state
                return (
                  <div className="space-y-4">
                    {checkedItems.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-green-700 dark:text-green-500">Kondisi Baik</p>
                        <div className="flex flex-wrap gap-2">
                          {checkedItems.map((item) => (
                            <div key={item} className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-md px-2.5 py-1 text-xs">
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {uncheckedItems.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-amber-600 dark:text-amber-500">Tidak Dapat Diperiksa / Perlu Perhatian</p>
                        <div className="flex flex-wrap gap-2">
                          {uncheckedItems.map((item) => (
                            <div key={item} className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-md px-2.5 py-1 text-xs">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Invoice / Rincian Biaya */}
        {invoiceItems.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">💰 Rincian Biaya Servis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-[1fr_auto] gap-2 text-muted-foreground text-xs border-b border-border pb-1">
                  <span>Komponen / Jasa</span>
                  <span className="text-right">Harga</span>
                </div>
                {invoiceItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto] gap-2">
                    <span>{item.description}</span>
                    <span className="font-medium text-right">Rp {item.amount.toLocaleString("id-ID")}</span>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_auto] gap-2 pt-2 border-t border-border font-bold">
                  <span>Total Biaya</span>
                  <span className="text-right">Rp {(order.final_cost || 0).toLocaleString("id-ID")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Foto Unit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="space-y-1 cursor-pointer" onClick={() => setLightboxUrl(p.photo_url)}>
                    <img
                      src={p.photo_url}
                      alt={p.label}
                      className="rounded-lg w-full aspect-square object-cover hover:opacity-80 transition-opacity"
                    />
                    <p className="text-xs text-center text-muted-foreground">{p.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Progress Perbaikan</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTimeline updates={updates} currentStatus={displayStatus} serviceType={order.service_type} />
          </CardContent>
        </Card>

        {/* Help */}
        <Card>
          <CardContent className="p-4 text-center space-y-2">
            <p className="text-sm font-medium">Butuh Bantuan?</p>
            <div className="flex justify-center gap-4 text-sm">
              <a href="tel:+628115404999" className="flex items-center gap-1 text-primary hover:underline">
                <Phone className="h-3 w-3" /> Telepon
              </a>
              <a href="mailto:marketing@superkomputer.net" className="flex items-center gap-1 text-primary hover:underline">
                <Mail className="h-3 w-3" /> Email
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Photo Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader>
            <DialogTitle className="sr-only">Preview Foto</DialogTitle>
          </DialogHeader>
          {lightboxUrl && (
            <img src={lightboxUrl} alt="Preview" className="w-full max-h-[80vh] object-contain rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
