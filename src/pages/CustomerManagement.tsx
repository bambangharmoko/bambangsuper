import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useReconnectableChannel } from "@/hooks/useReconnectableChannel";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Edit, Trash2, ArrowLeft, Filter, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";
import { useUpdateEffect } from "@/hooks/useUpdateEffect";

interface SavedCustomer {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  created_at: string;
  created_by: string;
}

export default function CustomerManagementPage() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<SavedCustomer[]>([]);
  const [search, setSearch] = useSessionStorageState("customers_search", "");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useSessionStorageState("customers_page", 1);
  const itemsPerPage = 10;

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<SavedCustomer | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedCustomer | null>(null);
  const [warrantyBlock, setWarrantyBlock] = useState(false);

  // Batch delete / retention filter
  const [retentionFilterOpen, setRetentionFilterOpen] = useState(false);
  const [retentionValue, setRetentionValue] = useState<number>(6);
  const [retentionUnit, setRetentionUnit] = useState<string>("bulan");
  const [filteredInactive, setFilteredInactive] = useState<SavedCustomer[]>([]);
  const [retentionFilterActive, setRetentionFilterActive] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [warrantyBlockedIds, setWarrantyBlockedIds] = useState<Set<string>>(new Set());

  const isOwner = hasRole("owner");

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from("saved_customers")
      .select("*")
      .order("created_at", { ascending: false });
    setCustomers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // ─── Realtime: auto-refresh when customers are added/edited/deleted ───────
  const buildCustomersChannel = useCallback(
    () => supabase
      .channel("customers-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "saved_customers" }, () => fetchCustomers()),
    [],
  );

  useReconnectableChannel(!!user, buildCustomersChannel, fetchCustomers);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.customer_name.toLowerCase().includes(q) ||
      c.customer_phone.includes(q) ||
      (c.customer_email || "").toLowerCase().includes(q)
    );
  });

  useUpdateEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const openEdit = (c: SavedCustomer) => {
    setEditCustomer(c);
    setEditName(c.customer_name);
    setEditPhone(c.customer_phone);
    setEditEmail(c.customer_email || "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editCustomer || !editName.trim() || !editPhone.trim()) {
      toast.error("Nama dan No HP wajib diisi!");
      return;
    }
    const { error } = await supabase
      .from("saved_customers")
      .update({
        customer_name: editName.trim(),
        customer_phone: editPhone.trim(),
        customer_email: editEmail.trim() || null,
      })
      .eq("id", editCustomer.id);
    if (error) {
      toast.error("Gagal menyimpan: " + error.message);
      return;
    }

    // Sync to service_orders (only if _is_linked_customer = true and phone matches)
    const { data: tickets } = await supabase
      .from("service_orders")
      .select("id")
      .eq("customer_phone", editCustomer.customer_phone)
      .contains("unit_checks", { _is_linked_customer: true });
      
    if (tickets && tickets.length > 0) {
      await supabase.from("service_orders").update({
        customer_name: editName.trim(),
        customer_phone: editPhone.trim(),
      }).in("id", tickets.map(t => t.id));
      toast.success(
        tickets.length > 0
          ? `Data pelanggan diperbarui & tersinkronisasi ke ${tickets.length} tiket`
          : "Data pelanggan diperbarui"
      );
    } else {
      toast.success("Data pelanggan diperbarui");
    }

    setEditOpen(false);
    fetchCustomers();
  };

  const checkWarrantyAndDelete = async (c: SavedCustomer) => {
    // Check if any service order for this customer has active warranty
    const { data: orders } = await supabase
      .from("service_orders")
      .select("id, warranty_expiry, ticket_number")
      .eq("customer_phone", c.customer_phone)
      .not("warranty_expiry", "is", null);

    const hasActiveWarranty = (orders || []).some(
      (o) => o.warranty_expiry && new Date(o.warranty_expiry) >= new Date()
    );

    if (hasActiveWarranty) {
      setWarrantyBlock(true);
      setDeleteTarget(c);
      return;
    }

    setWarrantyBlock(false);
    setDeleteTarget(c);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("saved_customers")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast.error("Gagal menghapus: " + error.message);
      return;
    }
    toast.success("Data pelanggan dihapus");
    setDeleteOpen(false);
    setDeleteTarget(null);
    fetchCustomers();
  };

  const applyRetentionFilter = async () => {
    const cutoff = new Date();
    if (retentionUnit === "bulan") {
      cutoff.setMonth(cutoff.getMonth() - retentionValue);
    } else {
      cutoff.setFullYear(cutoff.getFullYear() - retentionValue);
    }

    // Find customers with no orders after cutoff
    const inactive: SavedCustomer[] = [];
    const blockedIds = new Set<string>();

    for (const c of customers) {
      const { data: orders } = await supabase
        .from("service_orders")
        .select("id, created_at, warranty_expiry")
        .eq("customer_phone", c.customer_phone)
        .order("created_at", { ascending: false })
        .limit(1);

      const lastOrder = orders?.[0];
      const isInactive = !lastOrder || new Date(lastOrder.created_at) < cutoff;

      if (isInactive) {
        inactive.push(c);
        // Check warranty
        const { data: warrantyOrders } = await supabase
          .from("service_orders")
          .select("warranty_expiry")
          .eq("customer_phone", c.customer_phone)
          .not("warranty_expiry", "is", null);

        const hasActive = (warrantyOrders || []).some(
          (o) => o.warranty_expiry && new Date(o.warranty_expiry) >= new Date()
        );
        if (hasActive) blockedIds.add(c.id);
      }
    }

    setFilteredInactive(inactive);
    setWarrantyBlockedIds(blockedIds);
    setSelectedForDelete(new Set());
    setRetentionFilterActive(true);
    setRetentionFilterOpen(false);
  };

  const toggleSelectInactive = (id: string) => {
    if (warrantyBlockedIds.has(id)) return;
    setSelectedForDelete((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmBatchDelete = async () => {
    const ids = Array.from(selectedForDelete);
    if (ids.length === 0) return;

    const { error } = await supabase
      .from("saved_customers")
      .delete()
      .in("id", ids);
    if (error) {
      toast.error("Gagal menghapus: " + error.message);
      return;
    }
    toast.success(`${ids.length} data pelanggan dihapus`);
    setBatchDeleteOpen(false);
    setSelectedForDelete(new Set());
    setFilteredInactive([]);
    fetchCustomers();
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">Kelola Data Pelanggan</h1>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, no HP, atau email..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isOwner && (
            <Button variant="outline" onClick={() => setRetentionFilterOpen(true)}>
              <Filter className="h-4 w-4 mr-1" /> Filter Retensi
            </Button>
          )}
        </div>

        {/* Inactive customers from retention filter */}
        {retentionFilterActive && (
          <Card className="border-warning/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>📋 Pelanggan Pasif ({filteredInactive.length})</span>
                {selectedForDelete.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBatchDeleteOpen(true)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Hapus {selectedForDelete.size} Terpilih
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredInactive.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Tidak ada pelanggan pasif ditemukan untuk kriteria filter tersebut.</p>
              ) : (
                filteredInactive.map((c) => {
                  const isBlocked = warrantyBlockedIds.has(c.id);
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${isBlocked ? "border-primary/30 bg-primary/5" : "border-border"}`}
                    >
                      <Checkbox
                        checked={selectedForDelete.has(c.id)}
                        onCheckedChange={() => toggleSelectInactive(c.id)}
                        disabled={isBlocked}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{c.customer_name}</p>
                          {isBlocked && (
                            <Badge className="text-[9px] px-1 py-0 bg-success text-success-foreground">
                              <ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> Garansi Aktif
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{c.customer_phone}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => {
                  setFilteredInactive([]);
                  setSelectedForDelete(new Set());
                  setRetentionFilterActive(false);
                }}
              >
                Tutup & Bersihkan Filter
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Customer list */}
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Memuat...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Tidak ada data pelanggan.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Menampilkan {paginatedData.length} dari total {filtered.length} pelanggan</p>
            {paginatedData.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{c.customer_phone}</p>
                    {c.customer_email && (
                      <p className="text-xs text-muted-foreground">{c.customer_email}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Ditambahkan: {new Date(c.created_at).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => checkWarrantyAndDelete(c)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 pb-2">
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
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Data Pelanggan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nama *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>No HP *</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button onClick={saveEdit} className="gradient-primary">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Pelanggan</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus data pelanggan <strong>{deleteTarget?.customer_name}</strong>. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Warranty Block Alert */}
      <AlertDialog open={warrantyBlock} onOpenChange={setWarrantyBlock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🛡️ Tidak Dapat Dihapus</AlertDialogTitle>
            <AlertDialogDescription>
              Pelanggan <strong>{deleteTarget?.customer_name}</strong> masih memiliki tiket servis dengan garansi aktif. 
              Data tidak dapat dihapus hingga masa garansi berakhir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setWarrantyBlock(false)}>Mengerti</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retention Filter Dialog */}
      <Dialog open={retentionFilterOpen} onOpenChange={setRetentionFilterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔍 Filter Retensi Pelanggan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Identifikasi pelanggan yang tidak memiliki transaksi dalam periode tertentu.
            </p>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Durasi Tidak Aktif</Label>
                <Input
                  type="number"
                  min={1}
                  value={retentionValue}
                  onChange={(e) => setRetentionValue(Number(e.target.value))}
                />
              </div>
              <div className="w-28 space-y-1">
                <Label className="text-xs">Satuan</Label>
                <Select value={retentionUnit} onValueChange={setRetentionUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bulan">Bulan</SelectItem>
                    <SelectItem value="tahun">Tahun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetentionFilterOpen(false)}>Batal</Button>
            <Button onClick={applyRetentionFilter} className="gradient-primary">Terapkan Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Confirmation */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Hapus Massal</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus <strong>{selectedForDelete.size}</strong> data pelanggan pasif secara permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBatchDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus {selectedForDelete.size} Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
