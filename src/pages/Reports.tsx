import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useReconnectableChannel } from "@/hooks/useReconnectableChannel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CalendarIcon, Download, FileSpreadsheet, Filter, RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Constants } from "@/integrations/supabase/types";

const ALL_STATUSES = Constants.public.Enums.service_status;

interface ReportOrder {
  id: string;
  ticket_number: string;
  customer_name: string;
  customer_phone: string;
  device_type: string;
  device_brand: string;
  device_model: string;
  service_type: string;
  status: string;
  assigned_technician: string | null;
  estimated_cost: number | null;
  final_cost: number | null;
  created_at: string;
  updated_at: string;
  unit_condition: string;
  damage_description: string | null;
  warranty_duration: number | null;
  warranty_unit: string | null;
  warranty_notes: string | null;
  warranty_expiry: string | null;
}

export default function Reports() {
  const { hasRole } = useAuth();
  const [orders, setOrders] = useState<ReportOrder[]>([]);
  const [filtered, setFiltered] = useState<ReportOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const [techProfiles, setTechProfiles] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [closeTimestamps, setCloseTimestamps] = useState<Record<string, string>>({});

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("service_orders")
        .select("id, ticket_number, customer_name, customer_phone, device_type, device_brand, device_model, service_type, status, assigned_technician, estimated_cost, final_cost, created_at, updated_at, unit_condition, damage_description, warranty_duration, warranty_unit, warranty_notes, warranty_expiry")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (dateFrom) {
        query = query.gte("created_at", format(dateFrom, "yyyy-MM-dd"));
      }
      if (dateTo) {
        const nextDay = new Date(dateTo);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt("created_at", format(nextDay, "yyyy-MM-dd"));
      }
      if (statusFilter && statusFilter !== "all") {
        if (statusFilter === "under_warranty") {
          query = query.eq("status", "Close" as any).gte("warranty_expiry", new Date().toISOString());
        } else {
          query = query.eq("status", statusFilter as any);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setOrders(data || []);
      setFiltered(data || []);

      const techIds = [...new Set((data || []).map(o => o.assigned_technician).filter(Boolean))] as string[];
      if (techIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", techIds);
        if (profileError) throw profileError;
        const map: Record<string, string> = {};
        (profiles || []).forEach(p => { map[p.id] = p.full_name; });
        setTechProfiles(map);
      }

      const closedOrderIds = (data || []).filter(o => o.status === "Close").map(o => o.id);
      if (closedOrderIds.length > 0) {
        const { data: closeUpdates, error: closeError } = await supabase
          .from("service_updates")
          .select("order_id, created_at")
          .in("order_id", closedOrderIds)
          .eq("status", "Close" as any)
          .order("created_at", { ascending: false });
        if (closeError) throw closeError;
        const tsMap: Record<string, string> = {};
        (closeUpdates || []).forEach(u => {
          if (!tsMap[u.order_id]) tsMap[u.order_id] = u.created_at;
        });
        setCloseTimestamps(tsMap);
      }
      setFetchError(null);
    } catch (error) {
      console.error("Failed to fetch reports", error);
      setFetchError(error instanceof Error ? error.message : "Koneksi terputus atau sesi habis");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ─── Realtime: auto-refresh when orders change ────────────────────────────
  const buildReportsChannel = useCallback(
    () => supabase
      .channel("reports-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_orders" }, () => fetchOrders()),
    [fetchOrders],
  );

  useReconnectableChannel(true, buildReportsChannel, fetchOrders);

  const applyFilters = () => {
    fetchOrders();
  };

  const resetFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setStatusFilter("all");
    setTimeout(fetchOrders, 0);
  };

  const statusGroups = {
    "Dalam Pengerjaan": ["Diterima", "Diagnosa", "Menunggu Konfirmasi", "Pending", "Perbaikan"],
    "Selesai": ["Selesai", "Siap diAmbil", "Close"],
    "Cancel": ["Cancelled"],
  };

  const summaryStats = {
    total: filtered.length,
    active: filtered.filter(o => statusGroups["Dalam Pengerjaan"].includes(o.status)).length,
    completed: filtered.filter(o => statusGroups["Selesai"].includes(o.status)).length,
    cancelled: filtered.filter(o => o.status === "Cancelled").length,
    underWarranty: filtered.filter(
      (o) => o.status === "Close" && o.warranty_expiry && new Date(o.warranty_expiry) >= new Date()
    ).length,
    totalRevenue: filtered.filter(o => o.status !== "Cancelled").reduce((sum, o) => sum + (o.final_cost || 0), 0),
  };

  useEffect(() => {
    setPage(1);
  }, [filtered]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const exportCSV = () => {
    const headers = ["Tiket", "Pelanggan", "Telepon", "Perangkat", "Merek", "Model", "Layanan", "Status", "Estimasi", "Biaya Akhir", "Tanggal Masuk", "Update Terakhir"];
    const rows = filtered.map(o => [
      o.ticket_number, o.customer_name, o.customer_phone,
      o.device_type, o.device_brand, o.device_model,
      o.service_type, o.status,
      o.estimated_cost?.toString() || "", o.final_cost?.toString() || "",
      format(new Date(o.created_at), "dd/MM/yyyy"),
      format(new Date(o.updated_at), "dd/MM/yyyy"),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-servis-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
  };



  const exportExcel = () => {
    const rows = filtered.map(o => ({
      "ID Servis": o.ticket_number,
      "Tipe Servis": o.service_type,
      "Nama Teknisi": o.assigned_technician ? (techProfiles[o.assigned_technician] || "-") : "-",
      "Nama Pelanggan": o.customer_name,
      "No. Telepon": o.customer_phone,
      "Jenis Perangkat": o.device_type,
      "Merek": o.device_brand,
      "Model": o.device_model,
      "Problem": [o.unit_condition, o.damage_description].filter(Boolean).join(" — "),
      "Tanggal Dibuat": format(new Date(o.created_at), "dd/MM/yyyy"),
      "Status": o.status,
      "Tanggal Ditutup": o.status === "Close" && closeTimestamps[o.id]
        ? format(new Date(closeTimestamps[o.id]), "dd/MM/yyyy")
        : "",
      "Catatan Garansi": [
        o.warranty_duration ? `Durasi: ${o.warranty_duration} ${o.warranty_unit || 'hari'}` : "",
        o.warranty_notes ? `(${o.warranty_notes})` : ""
      ].filter(Boolean).join(" "),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String((r as any)[key] || "").length)) + 2
    }));
    ws["!cols"] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Servis");
    XLSX.writeFile(wb, `laporan-servis-${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Laporan Servis</h1>
          <div className="flex gap-2">
            <Button onClick={exportExcel} variant="default" size="sm" disabled={filtered.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button onClick={exportCSV} variant="outline" size="sm" disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

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
              <Button size="sm" variant="outline" onClick={fetchOrders}>
                <RefreshCw className="h-3 w-3 mr-1" /> Muat Ulang Data
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filter Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              {/* Date From */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Dari Tanggal</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-[160px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {dateFrom ? format(dateFrom, "dd MMM yyyy", { locale: idLocale }) : "Pilih tanggal"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Sampai Tanggal</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-[160px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {dateTo ? format(dateTo, "dd MMM yyyy", { locale: idLocale }) : "Pilih tanggal"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] h-9 text-sm">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    {(hasRole("owner") || hasRole("admin")) && (
                      <SelectItem value="under_warranty">Dalam Garansi</SelectItem>
                    )}
                    {ALL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button size="sm" onClick={applyFilters}>
                <Search className="h-3 w-3 mr-1" /> Cari
              </Button>
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className={`grid grid-cols-2 ${hasRole("owner") ? "lg:grid-cols-6" : hasRole("admin") ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-3`}>
          {[
            { label: "Total", value: summaryStats.total, color: "text-primary" },
            { label: "Dalam Proses", value: summaryStats.active, color: "text-warning" },
            { label: "Selesai", value: summaryStats.completed, color: "text-success" },
            { label: "Cancel", value: summaryStats.cancelled, color: "text-destructive" },
            ...((hasRole("owner") || hasRole("admin")) ? [{ label: "Dalam Garansi", value: summaryStats.underWarranty, color: "text-success" }] : []),
            ...(hasRole("owner") ? [{ label: "Total Pendapatan", value: `Rp ${summaryStats.totalRevenue.toLocaleString("id-ID")}`, color: "text-primary" }] : []),
          ].map((s, i) => (
            <Card key={i}>
              <CardContent className="p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-center text-muted-foreground text-sm">Memuat data...</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground text-sm">Tidak ada data ditemukan.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="p-4 flex justify-between items-center border-b border-border">
                  <p className="text-sm text-muted-foreground">
                    Menampilkan {paginatedData.length} dari total {filtered.length} tiket
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 font-medium">Tiket</th>
                      <th className="text-left p-3 font-medium">Pelanggan</th>
                      <th className="text-left p-3 font-medium hidden md:table-cell">Perangkat</th>
                      <th className="text-left p-3 font-medium hidden lg:table-cell">Layanan</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium hidden md:table-cell">Biaya</th>
                      <th className="text-right p-3 font-medium hidden lg:table-cell">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((o) => (
                      <tr key={o.id} className="border-b border-border hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{o.ticket_number}</td>
                        <td className="p-3">
                          <p className="font-medium">{o.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{o.customer_phone}</p>
                        </td>
                        <td className="p-3 hidden md:table-cell text-xs">{o.device_brand} {o.device_model}</td>
                        <td className="p-3 hidden lg:table-cell text-xs">{o.service_type}</td>
                        <td className="p-3"><StatusBadge status={o.status} /></td>
                        <td className="p-3 text-right hidden md:table-cell text-xs">
                          {o.final_cost ? `Rp ${o.final_cost.toLocaleString("id-ID")}` : "-"}
                        </td>
                        <td className="p-3 text-right hidden lg:table-cell text-xs">
                          {format(new Date(o.created_at), "dd/MM/yy")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Sebelumnya
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Hal {page} dari {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Selanjutnya
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
