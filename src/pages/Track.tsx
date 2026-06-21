import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusTimeline } from "@/components/StatusTimeline";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Phone, Mail, Monitor, RefreshCw } from "lucide-react";
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 gradient-hero text-primary-foreground p-4">
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
          <div className="mt-3">
            <NotificationSubscribeButton ticketNumber={order.ticket_number} />
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
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
              {order.warranty_duration && (
                <div>
                  <span className="text-muted-foreground">Masa Garansi</span>
                  <p className="font-medium">
                    {order.warranty_duration} {order.warranty_unit || 'hari'}
                    {order.warranty_notes ? ` (${order.warranty_notes})` : ""}
                  </p>
                </div>
              )}
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
        {Object.keys(unitChecks).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hasil Cek Unit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(unitChecks).map(([key, ok]) => (
                  <Badge
                    key={key}
                    className={ok ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}
                  >
                    {key}: {ok ? "OK" : "NO"}
                  </Badge>
                ))}
              </div>
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
              <a href="tel:+6281234567890" className="flex items-center gap-1 text-primary hover:underline">
                <Phone className="h-3 w-3" /> Telepon
              </a>
              <a href="mailto:support@supercomputer.com" className="flex items-center gap-1 text-primary hover:underline">
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
