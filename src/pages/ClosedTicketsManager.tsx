import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useReconnectableChannel } from "@/hooks/useReconnectableChannel";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Search,
  Trash2,
  Eye,
  CalendarIcon,
  RefreshCw,
  AlertTriangle,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Archive,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";
import { useUpdateEffect } from "@/hooks/useUpdateEffect";

interface ClosedOrder {
  id: string;
  ticket_number: string;
  customer_name: string;
  customer_phone: string;
  device_type: string;
  device_brand: string;
  device_model: string;
  service_type: string;
  status: string;
  final_cost: number | null;
  created_at: string;
  updated_at: string;
  warranty_expiry: string | null;
  assigned_technician: string | null;
  closed_at?: string | null;
}

const ITEMS_PER_PAGE = 10;
const FETCH_TIMEOUT_MS = 15000;

function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    )
      pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="px-2 text-muted-foreground">
            ...
          </span>
        ) : (
          <Button
            key={p}
            variant={p === currentPage ? "default" : "outline"}
            size="sm"
            className="min-w-[36px]"
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        )
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function ClosedTicketsManager() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fetchRunRef = useRef(0);

  const [orders, setOrders] = useState<ClosedOrder[]>([]);
  const [techNames, setTechNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useSessionStorageState("closed_search", "");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useSessionStorageState("closed_page", 1);

  // Dialog konfirmasi hapus
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Timestamps tiket Close dari service_updates
  const [closeTimestamps, setCloseTimestamps] = useState<Record<string, string>>({});

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const fetchRun = ++fetchRunRef.current;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      setLoading(true);
      let query = supabase
        .from("service_orders")
        .select(
          "id, ticket_number, customer_name, customer_phone, device_type, device_brand, device_model, service_type, status, final_cost, created_at, updated_at, warranty_expiry, assigned_technician"
        )
        .eq("status", "Close")
        .is("deleted_at", null)
        .abortSignal(controller.signal)
        .order("updated_at", { ascending: false });

      if (dateFrom) {
        query = query.gte("created_at", format(dateFrom, "yyyy-MM-dd"));
      }
      if (dateTo) {
        const nextDay = new Date(dateTo);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt("created_at", format(nextDay, "yyyy-MM-dd"));
      }

      const { data, error } = await query;
      if (fetchRun !== fetchRunRef.current) return;
      if (error) throw error;

      const rows = data || [];
      setOrders(rows);
      setFetchError(null);

      // Ambil nama teknisi
      const techIds = [...new Set(rows.map((o) => o.assigned_technician).filter(Boolean))] as string[];
      if (techIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", techIds);
        const map: Record<string, string> = {};
        (profiles || []).forEach((p) => { map[p.id] = p.full_name; });
        setTechNames(map);
      }

      // Ambil timestamp Close dari service_updates
      if (rows.length > 0) {
        const ids = rows.map((o) => o.id);
        const { data: closeUpdates } = await supabase
          .from("service_updates")
          .select("order_id, created_at")
          .in("order_id", ids)
          .eq("status", "Close" as any)
          .order("created_at", { ascending: false });

        const tsMap: Record<string, string> = {};
        (closeUpdates || []).forEach((u) => {
          if (!tsMap[u.order_id]) tsMap[u.order_id] = u.created_at;
        });
        setCloseTimestamps(tsMap);
      }
    } catch (err) {
      if (fetchRun !== fetchRunRef.current) return;
      const msg = err instanceof Error ? err.message : "Koneksi terputus atau sesi habis";
      setFetchError(msg);
      toast.error("Gagal memuat data tiket. Periksa koneksi, lalu coba refresh.");
    } finally {
      window.clearTimeout(timeoutId);
      if (fetchRun === fetchRunRef.current) setLoading(false);
    }
  }, [user, dateFrom, dateTo]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ─── Realtime: auto-refresh when tickets are closed/deleted ─────────────
  const buildClosedTicketsChannel = useCallback(
    () => supabase
      .channel("closed-tickets-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_orders" }, () => fetchOrders()),
    [fetchOrders],
  );

  useReconnectableChannel(!!user, buildClosedTicketsChannel, fetchOrders);

  // Reset halaman saat search/filter berubah
  useUpdateEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [search, dateFrom, dateTo]);

  // ─── Filter & Paginasi ───────────────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.ticket_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.includes(q) ||
      o.device_brand.toLowerCase().includes(q) ||
      o.device_model.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  // ─── Seleksi ────────────────────────────────────────────────────────────────
  const pageIds = pageItems.map((o) => o.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id));

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filtered.map((o) => o.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // ─── Hapus Permanen ─────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);

      // ── Langkah 1: Hapus file foto dari Supabase Storage ─────────────────────
      // Ambil semua URL foto dari tabel service_photos untuk tiket yang dipilih
      const { data: photoRows } = await supabase
        .from("service_photos")
        .select("photo_url, order_id")
        .in("order_id", ids);

      // Extract path file dari URL (format: .../public/unit-photos/<path>)
      const filePathsFromDB: string[] = (photoRows || [])
        .map((p) => {
          const parts = p.photo_url.split("public/unit-photos/");
          return parts.length > 1 ? decodeURIComponent(parts[1]) : null;
        })
        .filter(Boolean) as string[];

      // Fallback: list folder langsung dari storage per order_id
      // (menangkap file yang mungkin tidak terdaftar di tabel service_photos)
      const filePathsFromStorage: string[] = [];
      for (const orderId of ids) {
        try {
          const { data: files } = await supabase.storage
            .from("unit-photos")
            .list(orderId);
          if (files && files.length > 0) {
            files.forEach((f) => filePathsFromStorage.push(`${orderId}/${f.name}`));
          }
        } catch (e) {
          console.warn(`Tidak bisa list storage folder ${orderId}:`, e);
        }
      }

      // Gabungkan & deduplikasi semua path, lalu hapus dari storage
      const allPaths = Array.from(new Set([...filePathsFromDB, ...filePathsFromStorage]));
      if (allPaths.length > 0) {
        // Supabase storage.remove menerima max ~1000 file sekaligus — batch jika perlu
        const BATCH_SIZE = 200;
        for (let i = 0; i < allPaths.length; i += BATCH_SIZE) {
          const batch = allPaths.slice(i, i + BATCH_SIZE);
          const { error: storageError } = await supabase.storage
            .from("unit-photos")
            .remove(batch);
          if (storageError) {
            console.error("Gagal hapus file storage (batch):", storageError);
          }
        }
      }

      // ── Langkah 2: Hapus record database terkait ─────────────────────────────
      await Promise.all([
        supabase.from("service_updates").delete().in("order_id", ids),
        supabase.from("service_photos").delete().in("order_id", ids),
        supabase.from("internal_notes").delete().in("order_id", ids),
      ]);

      // ── Langkah 3: Hapus tiket utama ─────────────────────────────────────────
      const { error } = await supabase
        .from("service_orders")
        .delete()
        .in("id", ids);

      if (error) throw error;

      toast.success(
        `${ids.length} tiket berhasil dihapus secara permanen (termasuk ${allPaths.length} file foto).`
      );
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      fetchOrders();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      toast.error("Gagal menghapus tiket: " + msg);
    } finally {
      setDeleting(false);
    }
  };

  const resetDateFilter = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const totalRevenue = filtered.reduce((sum, o) => sum + (o.final_cost || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* ── Header ── */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Archive className="h-6 w-6 text-primary" />
              Kelola Tiket Service
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tiket berstatus <span className="font-medium">Close</span> — unit sudah diambil pelanggan
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setLoading(true); fetchOrders(); }}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* ── Error Banner ── */}
        {fetchError && !loading && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Koneksi terputus atau sesi habis.</p>
                  <p className="text-xs text-muted-foreground">{fetchError}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setFetchError(null); setLoading(true); fetchOrders(); }}
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Muat Ulang Data
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Filter Bar ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Filter & Pencarian</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="closed-tickets-search"
                placeholder="Cari tiket, nama, no HP, merek..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Tanggal Dari */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Dari Tanggal</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-[150px] justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {dateFrom
                      ? format(dateFrom, "dd MMM yyyy", { locale: idLocale })
                      : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Tanggal Sampai */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Sampai Tanggal</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-[150px] justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {dateTo
                      ? format(dateTo, "dd MMM yyyy", { locale: idLocale })
                      : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {(dateFrom || dateTo) && (
              <Button size="sm" variant="ghost" onClick={resetDateFilter}>
                <XCircle className="h-3 w-3 mr-1" /> Reset Tanggal
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ── Ringkasan Statistik ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Tiket Close", value: filtered.length, color: "text-primary" },
            { label: "Dipilih", value: selectedIds.size, color: "text-warning" },
            {
              label: "Total Pendapatan",
              value: `Rp ${totalRevenue.toLocaleString("id-ID")}`,
              color: "text-success",
            },
            {
              label: "Filter Aktif",
              value: dateFrom || dateTo ? "Ya" : "Semua",
              color: dateFrom || dateTo ? "text-primary" : "text-muted-foreground",
            },
          ].map((s, i) => (
            <Card key={i}>
              <CardContent className="p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Toolbar Aksi Bulk ── */}
        {filtered.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3 flex flex-wrap items-center gap-3">
              {/* Select semua halaman ini */}
              <button
                id="toggle-page-selection"
                className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                onClick={togglePage}
              >
                {allPageSelected ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground" />
                )}
                Halaman ini ({pageItems.length})
              </button>

              <span className="text-muted-foreground/50">|</span>

              {/* Select semua hasil filter */}
              {!allFilteredSelected ? (
                <button
                  id="select-all-filtered"
                  className="text-sm text-primary hover:underline font-medium"
                  onClick={selectAll}
                >
                  Pilih semua {filtered.length} tiket
                </button>
              ) : (
                <button
                  id="clear-all-selection"
                  className="text-sm text-muted-foreground hover:underline"
                  onClick={clearSelection}
                >
                  Batalkan semua pilihan
                </button>
              )}

              {selectedIds.size > 0 && (
                <>
                  <span className="text-muted-foreground/50">|</span>
                  <Badge variant="secondary" className="font-medium">
                    {selectedIds.size} dipilih
                  </Badge>
                  <Button
                    id="delete-selected-btn"
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="ml-auto"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Hapus Permanen ({selectedIds.size})
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Daftar Tiket ── */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Menampilkan {pageItems.length} dari {filtered.length} tiket
          </p>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-4 w-24" />
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
          ) : pageItems.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground font-medium">
                {search || dateFrom || dateTo
                  ? "Tidak ada tiket yang cocok dengan filter."
                  : "Belum ada tiket Close."}
              </p>
              {(search || dateFrom || dateTo) && (
                <p className="text-sm text-muted-foreground/70">
                  Coba ubah kata kunci atau rentang tanggal.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {pageItems.map((o) => {
                const isSelected = selectedIds.has(o.id);
                const closedAt = closeTimestamps[o.id];
                const techName = o.assigned_technician
                  ? techNames[o.assigned_technician] || "–"
                  : "–";

                return (
                  <Card
                    key={o.id}
                    className={cn(
                      "transition-all duration-150 hover:shadow-md",
                      isSelected && "ring-2 ring-primary/50 bg-primary/5"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div className="mt-0.5">
                          <Checkbox
                            id={`ticket-check-${o.id}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleOne(o.id)}
                          />
                        </div>

                        {/* Konten */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-bold text-sm font-mono">{o.ticket_number}</p>
                                <Badge className="bg-muted text-muted-foreground text-xs">
                                  Close
                                </Badge>
                                {o.final_cost !== null && o.final_cost > 0 && (
                                  <Badge className="bg-success/15 text-success text-xs">
                                    Rp {o.final_cost.toLocaleString("id-ID")}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {o.service_type}
                              </p>
                            </div>
                            <div className="text-xs text-muted-foreground sm:text-right shrink-0">
                              <p>Masuk: {new Date(o.created_at).toLocaleDateString("id-ID")}</p>
                              {closedAt && (
                                <p className="text-success">
                                  Selesai: {new Date(closedAt).toLocaleDateString("id-ID")}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 text-sm">
                            <p className="font-medium">{o.customer_name}</p>
                            <p className="text-muted-foreground text-xs">
                              {o.customer_phone} • {o.device_brand} {o.device_model} ({o.device_type})
                            </p>
                            <p className="text-muted-foreground text-xs mt-0.5">
                              Teknisi: {techName}
                            </p>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              id={`view-ticket-${o.id}`}
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/dashboard/orders/${o.ticket_number}`)}
                            >
                              <Eye className="h-3 w-3 mr-1" /> Detail
                            </Button>
                            <Button
                              id={`delete-ticket-${o.id}`}
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setSelectedIds(new Set([o.id]));
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3 w-3 mr-1" /> Hapus
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <PaginationControls
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={(p) => {
              setCurrentPage(p);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      </div>

      {/* ── Dialog Konfirmasi Hapus ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Hapus {selectedIds.size} Tiket Secara Permanen?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Tindakan ini akan <strong>menghapus permanen</strong> seluruh data tiket dari database,
                  termasuk:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Riwayat update dan log status</li>
                  <li>Foto & bukti diagnosa</li>
                  <li>Catatan internal (notepad)</li>
                  <li>Data invoice & biaya</li>
                </ul>
                <p className="font-medium text-destructive mt-2">
                  ⚠️ Data yang dihapus tidak dapat dikembalikan.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              id="confirm-delete-btn"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Menghapus...
                </>
              ) : (
                <>
                  <Trash2 className="h-3 w-3 mr-1" />
                  Ya, Hapus Permanen
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
