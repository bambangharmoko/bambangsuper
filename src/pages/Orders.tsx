import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useReconnectableChannel } from "@/hooks/useReconnectableChannel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogFooter, AlertDialogAction, AlertDialogCancel, AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Search, Plus, MessageCircle, Eye, Hand, X, ChevronLeft, ChevronRight, RefreshCw, ClipboardList, PackageCheck, AlertTriangle, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Order {
  id: string;
  ticket_number: string;
  customer_name: string;
  customer_phone: string;
  device_type: string;
  device_brand: string;
  device_model: string;
  service_type: string;
  unit_condition: string;
  unit_accessories: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  warranty_expiry: string | null;
  assigned_technician: string | null;
  is_picked_up: boolean;
  update_delay_reason?: string | null;
}

type ServiceStatus = Enums<"service_status">;

const FILTER_LABELS: Record<string, string> = {
  all: "Semua Pesanan",
  in_progress: "Dalam Proses",
  completed: "Running Test",
  running_test: "Running Test",
  stale: "Belum Diupdate 24j",
  awaiting_pickup_stale: "Belum Diambil 24j",
  under_warranty: "Dalam Garansi",
  cancel: "Cancel",
};

const ITEMS_PER_PAGE = 6;
const FETCH_TIMEOUT_MS = 15000;

const isInstallServiceType = (serviceType?: string) => {
  if (!serviceType) return false;
  return serviceType.includes("Install Software") || serviceType.includes("Install Hardware");
};

function PaginationControls({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="px-2 text-muted-foreground">...</span>
        ) : (
          <Button key={p} variant={p === currentPage ? "default" : "outline"} size="sm" className="min-w-[36px]" onClick={() => onPageChange(p)}>
            {p}
          </Button>
        )
      )}
      <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [claimConfirmOpen, setClaimConfirmOpen] = useState(false);
  const fetchRunRef = useRef(0);
  const { user, hasRole, loading: authLoading, isApproved } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeFilter = searchParams.get("filter") || "";

  const isTechnician = hasRole("technician") && !hasRole("admin") && !hasRole("owner");
  const fetchOrders = useCallback(async () => {
    if (authLoading || !user || !isApproved) return;

    const fetchRun = ++fetchRunRef.current;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      let query = supabase
        .from("service_orders")
        .select("id, ticket_number, customer_name, customer_phone, device_type, device_brand, device_model, service_type, unit_condition, unit_accessories, status, created_at, updated_at, warranty_expiry, assigned_technician, is_picked_up, update_delay_reason")
        .is("deleted_at", null)
        .abortSignal(controller.signal);

      if (activeFilter === "cancel") {
        query = query.eq("status", "Cancelled").eq("is_picked_up", false);
      }

      const { data, error } = await query.order(activeFilter === "in_progress" ? "updated_at" : "created_at", { ascending: activeFilter === "in_progress" });
      if (fetchRun !== fetchRunRef.current) return;
      if (error) throw error;
      setOrders(data || []);
      setFetchError(null);
    } catch (error) {
      if (fetchRun !== fetchRunRef.current) return;
      console.error("Failed to fetch orders", error);
      setFetchError(error instanceof Error ? error.message : "Koneksi terputus atau sesi habis");
      toast.error("Gagal memuat daftar pesanan. Periksa koneksi internet, lalu coba refresh.");
    } finally {
      window.clearTimeout(timeoutId);
      if (fetchRun === fetchRunRef.current) setLoadingOrders(false);
    }
  }, [activeFilter, authLoading, isApproved, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isApproved) {
      setLoadingOrders(false);
      return;
    }

    setLoadingOrders(true);
    fetchOrders();
  }, [activeFilter, authLoading, isApproved, user, fetchOrders]);

  const buildOrdersChannel = useCallback(
    () => supabase
      .channel(`orders-realtime-${activeFilter || "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_orders" }, () => fetchOrders()),
    [activeFilter, fetchOrders],
  );

  useReconnectableChannel(!authLoading && !!user && isApproved, buildOrdersChannel, fetchOrders);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLoadingOrders(true);
      fetchOrders();
    };
    const handleFocus = () => fetchOrders();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchOrders();
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
  }, [fetchOrders]);

  // Reset page when search or filter changes
  useEffect(() => { setCurrentPage(1); }, [search, activeFilter]);

  const clearFilter = () => {
    searchParams.delete("filter");
    setSearchParams(searchParams);
  };

  const applyDashboardFilter = (list: Order[]) => {
    if (!activeFilter || activeFilter === "all") return list;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const staleStatuses = ["Diterima", "Diagnosa", "Menunggu Persetujuan Pelanggan", "Menunggu Sparepart", "Perbaikan"];
    const inProgressStatuses = ["Diagnosa", "Menunggu Persetujuan Pelanggan", "Menunggu Sparepart", "Perbaikan"];

    switch (activeFilter) {
      case "in_progress":
        return list.filter((o) => inProgressStatuses.includes(o.status));
      case "running_test":
      case "completed":
        return list.filter((o) => o.status === "Selesai");
      case "stale":
        return list.filter(
          (o) => staleStatuses.includes(o.status) && new Date(o.updated_at) < oneDayAgo
        );
      case "awaiting_pickup_stale":
        return list.filter(
          (o) => o.status === "Siap diAmbil" && new Date(o.updated_at) < oneDayAgo
        );
      case "under_warranty":
        return list.filter(
          (o) => o.status === "Close" && o.warranty_expiry && new Date(o.warranty_expiry) >= now
        );
      case "cancel":
        return list.filter((o) => o.status === "Cancelled" && !o.is_picked_up);
      default:
        return list;
    }
  };

  const getWarrantyDaysLeft = (expiry?: string | null) => {
    if (!expiry) return null;
    return Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  };

  const getUpdateAgeLabel = (updatedAt: string) => {
    const hours = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / (60 * 60 * 1000)));
    if (hours < 24) return `Belum di-update selama ${hours} jam`;
    return `Belum di-update selama ${Math.floor(hours / 24)} hari`;
  };

  const filtered = applyDashboardFilter(
    orders.filter((o) => {
      const q = search.toLowerCase();
      return (
        o.ticket_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_phone.includes(q)
      );
    })
  );

  // Technician views
  const openPool = filtered
    .filter((o) => o.status === "Diterima" && !o.assigned_technician)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const activeWorkStatuses = ["Diagnosa", "Menunggu Persetujuan Pelanggan", "Menunggu Sparepart", "Perbaikan"];
  const finishedWorkStatuses = ["Selesai", "Siap diAmbil", "Close"];
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const myTickets = filtered
    .filter((o) => o.assigned_technician === user?.id && activeWorkStatuses.includes(o.status))
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
  const completedTickets = filtered
    .filter(
      (o) =>
        o.assigned_technician === user?.id &&
        finishedWorkStatuses.includes(o.status) &&
        (o.status !== "Close" || new Date(o.updated_at) >= threeMonthsAgo)
    )
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // Paginate helper
  const paginate = (list: Order[]) => {
    const totalPages = Math.max(1, Math.ceil(list.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return { items: list.slice(start, start + ITEMS_PER_PAGE), totalPages, total: list.length };
  };

  const sendWhatsApp = (order: Order) => {
    const link = `${window.location.origin}/track/${order.ticket_number}`;
    const date = new Date(order.created_at).toLocaleDateString("id-ID");
    const unitName = [order.device_brand, order.device_model].filter(Boolean).join(" ") || order.device_type || "-";
    const msg = encodeURIComponent(
      `Halo *${order.customer_name}*, terima kasih telah mempercayakan perbaikan unit Anda di *Toko Super Komputer*. Berikut adalah rangkuman detail tiket penerimaan servis Anda:\n\n` +
      `🧾 *Nomor Tiket:* ${order.ticket_number}\n\n` +
      `📅 *Tanggal Masuk:* ${date}\n\n` +
      `🔧 *Tipe Servis:* ${order.service_type || "-"}\n\n` +
      `💻 *Unit:* ${unitName}\n\n` +
      `⚠️ *Kondisi Unit:* ${order.unit_condition || "-"}\n\n` +
      `🎒 *Kelengkapan:* ${order.unit_accessories || "-"}\n\n` +
      `📌 *Status Saat Ini:* ${order.status}\n\n` +
      `🔍 *Pantau Status Servis:*\n\n` +
      `Kakak bisa melacak proses pengerjaan secara real-time melalui link berikut:\n\n` +
      `👉 ${link}\n\n` +
      `Kami akan segera menginformasikan jika ada update atau pengecekan lebih lanjut. Terima kasih! 🙏`,
    );
    const cleanPhone = order.customer_phone.replace(/\D/g, "");
    const waPhone = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;
    window.open(`https://wa.me/${waPhone}?text=${msg}`, "_blank");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const claimTickets = async () => {
    if (!user || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const selectedOrders = orders.filter((order) => selectedIds.has(order.id));
    const installIds = selectedOrders.filter((order) => isInstallServiceType(order.service_type)).map((order) => order.id);
    const regularIds = selectedOrders.filter((order) => !isInstallServiceType(order.service_type)).map((order) => order.id);

    const updateResults = await Promise.all([
      regularIds.length
        ? supabase
          .from("service_orders")
          .update({ assigned_technician: user.id, status: "Diagnosa" as ServiceStatus })
          .in("id", regularIds)
          .is("assigned_technician", null)
        : Promise.resolve({ error: null }),
      installIds.length
        ? supabase
          .from("service_orders")
          .update({ assigned_technician: user.id, status: "Perbaikan" as ServiceStatus })
          .in("id", installIds)
          .is("assigned_technician", null)
        : Promise.resolve({ error: null }),
    ]);

    const error = updateResults.find((result) => result.error)?.error;

    if (error) {
      toast.error("Gagal mengambil tiket: " + error.message);
      return;
    }

    for (const order of selectedOrders) {
      const isInstallService = isInstallServiceType(order.service_type);
      await supabase.from("service_updates").insert({
        order_id: order.id,
        status: (isInstallService ? "Perbaikan" : "Diagnosa") as ServiceStatus,
        description: isInstallService ? "Tiket diambil oleh teknisi dan langsung dikerjakan" : "Tiket diambil oleh teknisi",
        updated_by: user.id,
      });
    }

    toast.success(`${ids.length} tiket berhasil diambil!`);
    setSelectedIds(new Set());
    setClaimConfirmOpen(false);
    fetchOrders();
  };

  const markCancelledOrderPickedUp = async (orderId: string) => {
    const { error } = await supabase
      .from("service_orders")
      .update({ is_picked_up: true })
      .eq("id", orderId)
      .eq("status", "Cancelled");

    if (error) {
      toast.error("Gagal mengonfirmasi pengambilan: " + error.message);
      return;
    }

    toast.success("Unit dibatalkan ditandai sudah diambil.");
    fetchOrders();
  };

  const renderOrderCard = (o: Order, showCheckbox = false) => {
    const warrantyDaysLeft = activeFilter === "under_warranty" ? getWarrantyDaysLeft(o.warranty_expiry) : null;
    const showCancelPickupAction = activeFilter === "cancel" && o.status === "Cancelled" && !o.is_picked_up;
    const showUpdateAge = isTechnician && o.assigned_technician === user?.id && ["Diagnosa", "Menunggu Persetujuan Pelanggan", "Menunggu Sparepart", "Perbaikan"].includes(o.status);
    const isLateUpdate = showUpdateAge && Date.now() - new Date(o.updated_at).getTime() > 24 * 60 * 60 * 1000;

    return (
      <Card key={o.id} className="hover:shadow-md transition-all duration-200">
        <CardContent className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-2">
            <div className="flex min-w-0 items-center gap-2">
              {showCheckbox && (
                <Checkbox
                  checked={selectedIds.has(o.id)}
                  onCheckedChange={() => toggleSelect(o.id)}
                />
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-sm">{o.ticket_number}</p>
                  <StatusBadge status={o.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{o.service_type}</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground sm:text-right">
              {new Date(o.created_at).toLocaleDateString("id-ID")}
            </span>
          </div>
          <div className="text-sm mb-3">
            <p className="font-medium">{o.customer_name}</p>
            <p className="text-muted-foreground text-xs">{o.customer_phone} • {o.device_brand} {o.device_type}</p>
            {warrantyDaysLeft !== null && (
              <p className={`text-xs font-medium mt-1 ${warrantyDaysLeft <= 2 ? "text-destructive" : "text-success"}`}>
                Sisa Garansi: {warrantyDaysLeft} Hari lagi
              </p>
            )}
            {showUpdateAge && (
              <p className={`text-xs font-medium mt-1 ${isLateUpdate ? "text-destructive" : "text-muted-foreground"}`}>
                {getUpdateAgeLabel(o.updated_at)}
              </p>
            )}
            {isLateUpdate && !o.update_delay_reason && (
              <Badge variant="destructive" className="mt-2">Alasan terlambat belum diisi</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/orders/${o.ticket_number}`)}>
              <Eye className="h-3 w-3 mr-1" /> Detail
            </Button>
            <Button variant="ghost" size="sm" onClick={() => sendWhatsApp(o)}>
              <MessageCircle className="h-3 w-3" />
            </Button>
            {showCancelPickupAction && (
              <Button variant="secondary" size="sm" onClick={() => markCancelledOrderPickedUp(o.id)}>
                <PackageCheck className="h-3 w-3 mr-1" /> Sudah Diambil
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const handlePageChange = (p: number) => {
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderPaginatedList = (list: Order[], showCheckbox = false) => {
    const { items, totalPages, total } = paginate(list);
    return (
      <>
        <p className="text-xs text-muted-foreground">
          Menampilkan {items.length} dari {total} tiket
        </p>
        {loadingOrders ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-3 w-48" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground font-medium">Tidak ada pesanan ditemukan</p>
            <p className="text-sm text-muted-foreground/70">
              {search ? "Coba kata kunci lain atau hapus filter pencarian." : "Belum ada pesanan yang dibuat."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((o) => renderOrderCard(o, showCheckbox))}
          </div>
        )}
        <PaginationControls currentPage={Math.min(currentPage, totalPages)} totalPages={totalPages} onPageChange={handlePageChange} />
      </>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {!isOnline && <div className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">Mode offline. Data akan dimuat ulang saat koneksi kembali.</div>}
        {fetchError && !loadingOrders && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="font-medium">Koneksi terputus atau sesi habis.</p>
                  <p className="text-xs text-muted-foreground">{fetchError}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setFetchError(null); setLoadingOrders(true); fetchOrders(); }}>
                <RefreshCw className="h-3 w-3 mr-1" /> Muat Ulang Data
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="sticky top-0 z-20 -mx-4 flex flex-col gap-3 bg-background/95 px-4 py-2 backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:-mx-6 lg:px-6">
          <h1 className="text-2xl font-bold">Daftar Pesanan</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => { setLoadingOrders(true); fetchOrders(); }} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {(hasRole("admin") || hasRole("owner")) && (
              <Button onClick={() => navigate("/dashboard/orders/create")} className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" /> Buat Pesanan
              </Button>
            )}
          </div>
        </div>

        {activeFilter && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              {FILTER_LABELS[activeFilter] || activeFilter}
              <button onClick={clearFilter}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
            <span className="text-sm text-muted-foreground">{filtered.length} pesanan</span>
          </div>
        )}

        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari tiket, nama, atau no HP..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => setScannerOpen(true)} title="Scan Barcode/QR Code">
            <QrCode className="h-4 w-4" />
          </Button>
        </div>

        <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
          <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-sm">
            <BarcodeScanner
              onDetected={(val) => {
                let finalVal = val.trim();
                try {
                  if (finalVal.startsWith("http")) {
                    const url = new URL(finalVal);
                    const segments = url.pathname.split("/").filter(Boolean);
                    if (segments.length > 0) {
                      finalVal = segments[segments.length - 1];
                    }
                  }
                } catch (e) {
                  // Keep raw value if parsing fails
                }
                setSearch(finalVal);
                setScannerOpen(false);
              }}
              onClose={() => setScannerOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {isTechnician ? (
          <Tabs defaultValue="open" className="space-y-4" onValueChange={() => setCurrentPage(1)}>
            <div className="sticky top-16 z-10 -mx-4 overflow-x-auto bg-background/95 px-4 py-2 backdrop-blur lg:-mx-6 lg:px-6">
              <TabsList className="w-max min-w-full">
                <TabsTrigger value="open" className="min-w-32 flex-1">
                  Tiket Terbuka ({openPool.length})
                </TabsTrigger>
                <TabsTrigger value="mine" className="min-w-44 flex-1">
                  Sedang Dikerjakan ({myTickets.length})
                  {myTickets.filter((o) => ["Diagnosa", "Menunggu Persetujuan Pelanggan", "Menunggu Sparepart", "Perbaikan"].includes(o.status) && Date.now() - new Date(o.updated_at).getTime() > 24 * 60 * 60 * 1000).length > 0 && (
                    <span className="ml-2 rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">
                      {myTickets.filter((o) => ["Diagnosa", "Menunggu Persetujuan Pelanggan", "Menunggu Sparepart", "Perbaikan"].includes(o.status) && Date.now() - new Date(o.updated_at).getTime() > 24 * 60 * 60 * 1000).length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="done" className="min-w-36 flex-1">
                  Sudah Selesai ({completedTickets.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="open" className="space-y-2">
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                  <span className="text-sm font-medium">{selectedIds.size} tiket dipilih</span>
                  <Button size="sm" onClick={() => setClaimConfirmOpen(true)} className="gradient-primary">
                    <Hand className="h-3 w-3 mr-1" /> Ambil Tiket
                  </Button>
                </div>
              )}
              {renderPaginatedList(openPool, true)}
            </TabsContent>

            <TabsContent value="mine" className="space-y-2">
              {renderPaginatedList(myTickets)}
            </TabsContent>

            <TabsContent value="done" className="space-y-2">
              {renderPaginatedList(completedTickets)}
            </TabsContent>
          </Tabs>
        ) : (
          renderPaginatedList(filtered)
        )}
      </div>

      {/* Claim Confirmation Dialog */}
      <AlertDialog open={claimConfirmOpen} onOpenChange={setClaimConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ambil {selectedIds.size} Tiket?</AlertDialogTitle>
            <AlertDialogDescription>
              Tiket Install Software/Hardware akan langsung masuk Sedang Dikerjakan, tiket lainnya masuk Diagnosa. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={claimTickets}>Ya, Ambil Tiket</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
