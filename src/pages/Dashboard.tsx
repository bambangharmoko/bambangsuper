import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useReconnectableChannel } from "@/hooks/useReconnectableChannel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ClipboardList, Wrench, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StaleTicketsAlert } from "@/components/StaleTicketsAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const RECENT_PER_PAGE = 10;
const FETCH_TIMEOUT_MS = 15000;

interface Stats {
  total: number;
  inProgress: number;
  runningTest: number;
  stale: number;
  awaitingPickupStale: number;
  underWarranty: number;
  cancelledNotPickedUp: number;
}

interface RecentOrder {
  id: string;
  ticket_number: string;
  customer_name: string;
  status: string;
  updated_at: string;
  warranty_expiry: string | null;
  is_picked_up: boolean;
  assigned_technician: string | null;
  update_delay_reason?: string | null;
}

export default function DashboardHome() {
  const [stats, setStats] = useState<Stats>({ total: 0, inProgress: 0, runningTest: 0, stale: 0, awaitingPickupStale: 0, underWarranty: 0, cancelledNotPickedUp: 0 });
  const [allOrders, setAllOrders] = useState<RecentOrder[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [delayReasons, setDelayReasons] = useState<Record<string, string>>({});
  const [savingReasonId, setSavingReasonId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const fetchRunRef = useRef(0);
  const isTechnician = hasRole("technician") && !hasRole("admin") && !hasRole("owner");

  const fetchData = useCallback(async () => {
    if (!user) return;
    const fetchRun = ++fetchRunRef.current;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const { data: orders, error } = await supabase
        .from("service_orders")
        .select("id, ticket_number, customer_name, status, updated_at, warranty_expiry, is_picked_up, assigned_technician, update_delay_reason")
        .is("deleted_at", null)
        .abortSignal(controller.signal)
        .order("updated_at", { ascending: false });

      if (fetchRun !== fetchRunRef.current) return;
      if (error) throw error;

      const safeOrders = orders || [];
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const staleStatuses = ["Diagnosa", "Menunggu Persetujuan Pelanggan", "Menunggu Sparepart", "Perbaikan"];
      const inProgressStatuses = ["Diagnosa", "Menunggu Persetujuan Pelanggan", "Menunggu Sparepart", "Perbaikan"];

      setStats({
        total: safeOrders.length,
        inProgress: safeOrders.filter((o) => inProgressStatuses.includes(o.status)).length,
        runningTest: safeOrders.filter((o) => o.status === "Selesai").length,
        stale: safeOrders.filter(
          (o) => staleStatuses.includes(o.status) && new Date(o.updated_at) < oneDayAgo
        ).length,
        awaitingPickupStale: safeOrders.filter(
          (o) => o.status === "Siap diAmbil" && new Date(o.updated_at) < oneDayAgo
        ).length,
        underWarranty: safeOrders.filter(
          (o) => o.status === "Close" && o.warranty_expiry && new Date(o.warranty_expiry) >= now
        ).length,
        cancelledNotPickedUp: safeOrders.filter((o) => o.status === "Cancelled" && !o.is_picked_up).length,
      });
      setAllOrders(safeOrders);
      setFetchError(null);
    } catch (error) {
      if (fetchRun !== fetchRunRef.current) return;
      console.error("Failed to fetch dashboard data", error);
      setFetchError(error instanceof Error ? error.message : "Koneksi terputus atau sesi habis");
      toast.error("Gagal memuat data dashboard. Coba muat ulang data.");
    } finally {
      window.clearTimeout(timeoutId);
      if (fetchRun === fetchRunRef.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchData();
  }, [user, fetchData]);

  const buildDashboardChannel = useCallback(
    () => supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_orders" }, () => fetchData()),
    [fetchData],
  );

  useReconnectableChannel(!!user, buildDashboardChannel, fetchData);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLoading(true);
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

  const handleStatClick = (filter: string) => {
    navigate(`/dashboard/orders?filter=${filter}`);
  };

  const totalPages = Math.max(1, Math.ceil(allOrders.length / RECENT_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOrders = allOrders.slice((safePage - 1) * RECENT_PER_PAGE, safePage * RECENT_PER_PAGE);
  const staleTechOrders = allOrders
    .filter((o) => {
      const staleStatuses = ["Diagnosa", "Menunggu Persetujuan Pelanggan", "Menunggu Sparepart", "Perbaikan"];
      return isTechnician && o.assigned_technician === user?.id && staleStatuses.includes(o.status) && Date.now() - new Date(o.updated_at).getTime() > 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());

  const saveDelayReason = async (orderId: string) => {
    const reason = delayReasons[orderId]?.trim();
    if (!reason) {
      toast.error("Alasan terlambat wajib diisi");
      return;
    }
    setSavingReasonId(orderId);
    const { error } = await supabase
      .from("service_orders")
      .update({ update_delay_reason: reason } as any)
      .eq("id", orderId);
    const order = allOrders.find((item) => item.id === orderId);
    if (!error && order && user) {
      await supabase.from("internal_notes").insert({
        order_id: orderId,
        user_id: user.id,
        content: `[Alasan Terlambat Update] ${reason}`,
        is_read_by: [user.id],
      } as any);

      await supabase.from("service_updates").insert({
        order_id: orderId,
        status: order.status as any,
        description: `[ALASAN TERLAMBAT] ${reason}`,
        updated_by: user.id,
      });
    }
    setSavingReasonId(null);
    if (error) {
      toast.error("Gagal menyimpan alasan");
      return;
    }
    toast.success("Alasan keterlambatan disimpan");
    fetchData();
  };

  const statCards = [
    { label: "Total Pesanan", value: stats.total, icon: ClipboardList, color: "text-primary", filter: "all" },
    { label: "Dalam Proses", value: stats.inProgress, icon: Wrench, color: "text-warning", filter: "in_progress" },
    { label: "Running Test", value: stats.runningTest, icon: CheckCircle, color: "text-success", filter: "running_test" },
    { label: "Belum Diupdate 24j", value: stats.stale, icon: AlertTriangle, color: "text-destructive", filter: "stale" },
    { label: "Belum Diambil 24j", value: stats.awaitingPickupStale, icon: AlertTriangle, color: "text-destructive", filter: "awaiting_pickup_stale" },
    { label: "Dalam Garansi", value: stats.underWarranty, icon: CheckCircle, color: "text-success", filter: "under_warranty" },
    { label: "Cancel", value: stats.cancelledNotPickedUp, icon: XCircle, color: "text-destructive", filter: "cancel" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <StaleTicketsAlert />
        {!isOnline && <div className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">Mode offline. Data akan disinkronkan saat koneksi kembali.</div>}
        {fetchError && !loading && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="font-medium">Koneksi terputus atau sesi habis.</p>
                  <p className="text-xs text-muted-foreground">{fetchError}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setFetchError(null); setLoading(true); fetchData(); }}>
                <RefreshCw className="h-3 w-3 mr-1" /> Muat Ulang Data
              </Button>
            </CardContent>
          </Card>
        )}
        <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between bg-background/95 px-4 py-2 backdrop-blur lg:-mx-6 lg:px-6">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            {staleTechOrders.length > 0 && (
              <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">
                {staleTechOrders.length}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={fetchData} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {staleTechOrders.length > 0 && (
          <Card className="border-destructive/40 bg-destructive/5 shadow-sm transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <AlertTriangle className="h-4 w-4" /> Peringatan Tiket Terlambat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {staleTechOrders.slice(0, 4).map((o) => {
                const daysLate = Math.max(1, Math.floor((Date.now() - new Date(o.updated_at).getTime()) / (24 * 60 * 60 * 1000)));
                return (
                  <div key={o.id} className="rounded-lg border border-destructive/20 bg-background p-3 space-y-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">{o.ticket_number} · {o.customer_name}</p>
                        <p className="text-xs text-destructive">Belum di-update selama {daysLate} hari</p>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>
                    <Textarea
                      value={delayReasons[o.id] ?? o.update_delay_reason ?? ""}
                      onChange={(e) => setDelayReasons((prev) => ({ ...prev, [o.id]: e.target.value }))}
                      placeholder="Isi alasan keterlambatan update..."
                      className="min-h-[72px]"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => saveDelayReason(o.id)} disabled={savingReasonId === o.id || !(delayReasons[o.id] ?? o.update_delay_reason ?? "").trim()}>
                        {savingReasonId === o.id ? "Menyimpan..." : "Simpan Alasan"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/orders/${o.ticket_number}`)}>
                        Buka Tiket
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          {statCards.map((s, i) => (
            <Card
              key={i}
              className="cursor-pointer hover:shadow-md transition-all duration-200"
              onClick={() => handleStatClick(s.filter)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  {loading ? <Skeleton className="h-7 w-10" /> : <p className="text-2xl font-bold">{s.value}</p>}
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pesanan Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : allOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  Menampilkan {paginatedOrders.length} dari {allOrders.length} pesanan
                </p>
                <div className="space-y-2">
                  {paginatedOrders.map((o) => (
                    <div
                      key={o.id}
                      className="flex justify-between items-center p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/dashboard/orders/${o.ticket_number}`)}
                    >
                      <div>
                        <p className="font-medium text-sm">{o.ticket_number}</p>
                        <p className="text-xs text-muted-foreground">{o.customer_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={o.status} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(o.updated_at).toLocaleDateString("id-ID")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 pt-4">
                    <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => { setCurrentPage(safePage - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                      <Button key={p} variant={p === safePage ? "default" : "outline"} size="sm" className="min-w-[36px]" onClick={() => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                        {p}
                      </Button>
                    ))}
                    {totalPages > 7 && <span className="px-2 text-muted-foreground">...</span>}
                    <Button variant="outline" size="sm" disabled={safePage === totalPages} onClick={() => { setCurrentPage(safePage + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
