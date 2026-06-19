import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusTimeline } from "@/components/StatusTimeline";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  ArrowLeft,
  MessageCircle,
  Edit,
  Plus,
  StickyNote,
  Users,
  CheckCircle,
  Camera,
  Upload,
  RefreshCw,
  AlertTriangle,
  Printer,
  Trash2,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const STATUS_FLOW = [
  "Diterima",
  "Diagnosa",
  "Menunggu Konfirmasi",
  "Pending",
  "Perbaikan",
  "Selesai",
  "Siap diAmbil",
  // Catatan: "Cancelled" disisipkan sebelum "Close" dalam alur konseptual.
  // Close = unit sudah tidak ada di toko (sudah diambil pelanggan).
  // Cancelled = tiket batal, tapi unit mungkin masih perlu diambil → posisi sebelum Close.
  "Cancelled",
  "Close",
];

// Alur status khusus untuk tiket "Install Software/Hardware"
// Skip: Diagnosa, Menunggu Konfirmasi, Pending
const INSTALL_STATUS_FLOW = [
  "Diterima",
  "Perbaikan",
  "Selesai",
  "Siap diAmbil",
  // Cancelled disisipkan sebelum Close (sama dengan alur normal)
  "Cancelled",
  "Close",
];

const isInstallServiceType = (serviceType?: string) => {
  if (!serviceType) return false;
  return serviceType.includes("Install Software") || serviceType.includes("Install Hardware");
};

// Status yang tidak bisa di-cancel oleh teknisi biasa.
// Owner memiliki override tersendiri untuk Selesai & Siap diAmbil.
const NON_CANCELABLE = ["Selesai", "Siap diAmbil", "Close", "Cancelled"];

interface InvoiceItem {
  description: string;
  amount: number | null;
}

export default function OrderDetailPage() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user, profile, hasRole } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const fetchRunRef = useRef(0);

  // Resolved UUID from ticket_number lookup
  const resolvedId = order?.id as string | undefined;

  // Names for creator & assignee
  const [creatorName, setCreatorName] = useState<string>("-");
  const [creatorRole, setCreatorRole] = useState<string>("-");
  const [assigneeName, setAssigneeName] = useState<string>("-");

  // Status update
  const [statusNote, setStatusNote] = useState("");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  // Split notes for Diagnosa → Menunggu Konfirmasi
  const [publicNote, setPublicNote] = useState("");
  const [internalDiagNote, setInternalDiagNote] = useState("");

  // Rollback dialogs
  const [rollbackToPerbaikanOpen, setRollbackToPerbaikanOpen] = useState(false);
  const [rollbackNote, setRollbackNote] = useState("");

  // Warranty (for Close - all service types, admin/owner only)
  const [warrantyDuration, setWarrantyDuration] = useState<number | null>(null);
  const [warrantyPreset, setWarrantyPreset] = useState<string>("manual");
  const [warrantyUnit, setWarrantyUnit] = useState<string>("hari");
  const [warrantyNotes, setWarrantyNotes] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");

  // Cancel
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelType, setCancelType] = useState("Cancel by Customer");
  const [cancelReason, setCancelReason] = useState("");

  // Reactivate (Owner only)
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [reactivateReason, setReactivateReason] = useState("");

  // QC Check (Perbaikan → Selesai)
  const QC_COMPONENTS = ["Speaker", "Camera", "Touchpad", "Keyboard", "Wi-Fi", "USB Port", "LCD Panel", "Lainnya"];
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [qcChecks, setQcChecks] = useState<Record<string, boolean>>({});
  const [qcNote, setQcNote] = useState("");

  // Invoice
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([{ description: "", amount: null }]);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    service_type: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    device_type: "",
    device_brand: "",
    device_model: "",
    device_password: "",
  });

  // Enriched updates with user info
  const [enrichedUpdates, setEnrichedUpdates] = useState<any[]>([]);

  // Notepad (internal notes)
  const [notepadOpen, setNotepadOpen] = useState(false);
  const [internalNotes, setInternalNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [savingDelayReason, setSavingDelayReason] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const [hasUnreadNotes, setHasUnreadNotes] = useState(false);

  // Confirmation modal (Menunggu Konfirmasi → Admin/Owner)
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmSpareParts, setConfirmSpareParts] = useState("");
  const [confirmEstCost, setConfirmEstCost] = useState<number>(0);
  const [confirmDuration, setConfirmDuration] = useState("");
  const [confirmDiagnosisData, setConfirmDiagnosisData] = useState("");

  // Owner regressive rollback / dynamic status change
  const [ownerRollbackOpen, setOwnerRollbackOpen] = useState(false);
  const [ownerRollbackTarget, setOwnerRollbackTarget] = useState("");
  const [ownerRollbackNote, setOwnerRollbackNote] = useState("");
  const [reassignTechId, setReassignTechId] = useState<string>("");
  const [technicians, setTechnicians] = useState<any[]>([]);

  // Diagnosis evidence photos
  const [diagnosisPhotos, setDiagnosisPhotos] = useState<File[]>([]);
  const [uploadingDiagPhotos, setUploadingDiagPhotos] = useState(false);

  // Reassign technician (Owner only)
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignNewTechId, setReassignNewTechId] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetchStaffIdentities = async (userIds: string[]) => {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return { profileMap: {} as Record<string, any>, roleMap: {} as Record<string, string> };
    }

    const { data, error } = await supabase.rpc("get_staff_identities", {
      _user_ids: uniqueIds,
    });

    if (error) {
      console.error("Failed to fetch staff identities", error);
      return { profileMap: {} as Record<string, any>, roleMap: {} as Record<string, string> };
    }

    const profileMap: Record<string, any> = {};
    const roleMap: Record<string, string> = {};

    for (const item of data || []) {
      profileMap[item.user_id] = {
        id: item.user_id,
        full_name: item.full_name,
        username: item.username,
      };
      roleMap[item.user_id] = item.role;
    }

    return { profileMap, roleMap };
  };

  const fetchData = async () => {
    if (!ticketId) return;
    const fetchRun = ++fetchRunRef.current;
    try {
      // First, resolve ticket_number to the order
      const orderRes = await supabase.from("service_orders").select("*").eq("ticket_number", ticketId.toUpperCase()).single();
      if (fetchRun !== fetchRunRef.current) return;
      if (orderRes.error) throw orderRes.error;
      const oid = orderRes.data?.id;
      if (!oid) throw new Error("Tiket tidak ditemukan");

      const [updatesRes, photosRes] = await Promise.all([
        supabase.from("service_updates").select("*").eq("order_id", oid).order("created_at", { ascending: true }),
        supabase.from("service_photos").select("*").eq("order_id", oid),
      ]);
      if (fetchRun !== fetchRunRef.current) return;
      if (updatesRes.error) throw updatesRes.error;
      if (photosRes.error) throw photosRes.error;
      if (orderRes.data) {
        setOrder(orderRes.data);
        setDelayReason((orderRes.data as any).update_delay_reason || "");

        const identityIds = [orderRes.data.created_by, orderRes.data.assigned_technician].filter(Boolean);
        const { profileMap: orderProfileMap, roleMap: orderRoleMap } = await fetchStaffIdentities(identityIds);

        const creatorProfile = orderProfileMap[orderRes.data.created_by];
        setCreatorName(
          creatorProfile
            ? `${creatorProfile.full_name}${creatorProfile.username ? ` (@${creatorProfile.username})` : ""}`
            : "Unknown",
        );
        setCreatorRole(orderRoleMap[orderRes.data.created_by] || "unknown");

        if (orderRes.data.assigned_technician) {
          const assigneeProfile = orderProfileMap[orderRes.data.assigned_technician];
          setAssigneeName(
            assigneeProfile
              ? `${assigneeProfile.full_name}${assigneeProfile.username ? ` (@${assigneeProfile.username})` : ""}`
              : "Unknown",
          );
        } else {
          setAssigneeName("Belum ditugaskan");
        }
      } else {
        throw new Error("Tiket tidak ditemukan");
      }

      const rawUpdates = updatesRes.data || [];
      const userIds = [...new Set(rawUpdates.map((u: any) => u.updated_by as string))];
      if (userIds.length > 0) {
        const { profileMap, roleMap } = await fetchStaffIdentities(userIds);

        setEnrichedUpdates(
          rawUpdates.map((u: any) => ({
            ...u,
            _user_name: profileMap[u.updated_by]?.full_name || "Unknown",
            _username: profileMap[u.updated_by]?.username || null,
            _role: roleMap[u.updated_by] || "unknown",
          })),
        );
      } else {
        setEnrichedUpdates(rawUpdates);
      }

      setUpdates(rawUpdates);
      setPhotos(photosRes.data || []);
      setFetchError(null);
    } catch (error) {
      if (fetchRun !== fetchRunRef.current) return;
      console.error("Failed to fetch order detail", error);
      setFetchError(error instanceof Error ? error.message : "Koneksi terputus atau sesi habis");
      toast.error("Gagal memuat detail tiket. Coba muat ulang data.");
    } finally {
      if (fetchRun === fetchRunRef.current) setLoading(false);
    }
  };

  const fetchNotes = async () => {
    if (!resolvedId || !user) return;
    const { data } = await supabase
      .from("internal_notes")
      .select("*")
      .eq("order_id", resolvedId)
      .order("created_at", { ascending: true });

    const notes = data || [];
    setInternalNotes(notes);

    const unread = notes.some((n: any) => {
      const readBy: string[] = n.is_read_by || [];
      return !readBy.includes(user.id);
    });
    setHasUnreadNotes(unread);
  };

  const fetchTechnicians = async () => {
    const { data: techRoles } = await supabase.from("user_roles").select("user_id, role").eq("role", "technician");
    if (!techRoles) return;
    const techIds = techRoles.map((r) => r.user_id);
    if (techIds.length === 0) return;
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, is_approved")
      .in("id", techIds)
      .eq("is_approved", true);

    setTechnicians((profiles || []).map((p) => ({ ...p, role: "technician" })));
  };

  const markNotesAsRead = async () => {
    if (!user || !resolvedId) return;
    const unreadNotes = internalNotes.filter((n: any) => {
      const readBy: string[] = n.is_read_by || [];
      return !readBy.includes(user.id);
    });

    for (const note of unreadNotes) {
      const currentReadBy: string[] = note.is_read_by || [];
      await supabase
        .from("internal_notes")
        .update({ is_read_by: [...currentReadBy, user.id] } as any)
        .eq("id", note.id);
    }
    setHasUnreadNotes(false);
  };

  const submitNote = async () => {
    if (!newNote.trim() || !user || !resolvedId) return;
    await supabase.from("internal_notes").insert({
      order_id: resolvedId,
      user_id: user.id,
      content: newNote.trim(),
      is_read_by: [user.id],
    } as any);
    setNewNote("");
    toast.success("Catatan ditambahkan");
    fetchNotes();
  };

  const updateNote = async (noteId: string) => {
    if (!editingNoteContent.trim()) return;
    await supabase
      .from("internal_notes")
      .update({ content: editingNoteContent.trim(), is_read_by: [user!.id] } as any)
      .eq("id", noteId);
    setEditingNoteId(null);
    setEditingNoteContent("");
    toast.success("Catatan diperbarui");
    fetchNotes();
  };

  const deleteNote = async (noteId: string) => {
    await supabase.from("internal_notes").delete().eq("id", noteId);
    toast.success("Catatan dihapus");
    fetchNotes();
  };

  useEffect(() => {
    fetchData();
    fetchTechnicians();
  }, [ticketId]);

  // Re-fetch notes when resolvedId becomes available
  useEffect(() => {
    if (resolvedId) fetchNotes();
  }, [resolvedId, user]);

  // Fetch note profiles & roles for display
  const [noteProfiles, setNoteProfiles] = useState<Record<string, any>>({});
  const [noteRoles, setNoteRoles] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = [...new Set(internalNotes.map((n: any) => n.user_id as string))];
    if (ids.length === 0) return;

    const fetchNoteIdentities = async () => {
      const pMap: Record<string, any> = {};
      const rMap: Record<string, string> = {};

      for (const u of enrichedUpdates) {
        if (u._user_name && u._user_name !== "Unknown") {
          pMap[u.updated_by] = { id: u.updated_by, full_name: u._user_name, username: u._username };
        }
        if (u._role && u._role !== "unknown") {
          rMap[u.updated_by] = u._role;
        }
      }

      const missingIds = ids.filter((id) => !pMap[id] || !rMap[id]);
      if (missingIds.length > 0) {
        const { profileMap, roleMap } = await fetchStaffIdentities(missingIds);
        Object.assign(pMap, profileMap);
        Object.assign(rMap, roleMap);
      }

      setNoteProfiles(pMap);
      setNoteRoles(rMap);
    };
    fetchNoteIdentities();
  }, [internalNotes, enrichedUpdates]);

  if (loading || !order) {
    return (
      <DashboardLayout>
        {fetchError ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Koneksi terputus atau sesi habis.</p>
                <p className="text-sm text-muted-foreground">{fetchError}</p>
              </div>
              <Button variant="outline" onClick={() => { setFetchError(null); setLoading(true); fetchData(); }}>
                <RefreshCw className="h-4 w-4 mr-2" /> Muat Ulang Data
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        )}
      </DashboardLayout>
    );
  }

  const isTechnician = hasRole("technician") && !hasRole("admin") && !hasRole("owner");
  const isMyTicket = isTechnician && order.assigned_technician === user?.id;
  const staleTechnicianStatuses = ["Diagnosa", "Menunggu Konfirmasi", "Pending", "Perbaikan"];
  const isStaleTechnicianTicket =
    isMyTicket && staleTechnicianStatuses.includes(order.status) && Date.now() - new Date(order.updated_at).getTime() > 24 * 60 * 60 * 1000;
  const hasDelayReason = Boolean(((order as any).update_delay_reason || delayReason).trim());
  const shouldLockStatusForDelayReason = isStaleTechnicianTicket && !hasDelayReason;

  const isInstallOrder = isInstallServiceType(order.service_type);
  const activeStatusFlow = isInstallOrder ? INSTALL_STATUS_FLOW : STATUS_FLOW;
  const currentIndex = activeStatusFlow.indexOf(order.status);

  // Menentukan pilihan status berikutnya.
  // Untuk tiket non-install, dari Diagnosa dan Menunggu Konfirmasi, teknisi bisa memilih beberapa jalur.
  // "Cancelled" dikecualikan dari pilihan next status karena Cancel dilakukan via tombol Cancel,
  // bukan melalui alur progres normal.
  const getNextStatusOptions = (): string[] => {
    if (isInstallOrder) {
      const idx = INSTALL_STATUS_FLOW.indexOf(order.status);
      if (idx >= 0 && idx < INSTALL_STATUS_FLOW.length - 1) {
        const next = INSTALL_STATUS_FLOW[idx + 1];
        // Skip "Cancelled" — bukan langkah maju dalam alur normal
        if (next === "Cancelled") {
          const afterCancelled = INSTALL_STATUS_FLOW[idx + 2];
          return afterCancelled ? [afterCancelled] : [];
        }
        return [next];
      }
      return [];
    }
    if (order.status === "Diagnosa") return ["Menunggu Konfirmasi", "Pending", "Perbaikan"];
    if (order.status === "Menunggu Konfirmasi") return ["Pending", "Perbaikan"];
    if (currentIndex >= 0 && currentIndex < STATUS_FLOW.length - 1) {
      const next = STATUS_FLOW[currentIndex + 1];
      // Skip "Cancelled" — bukan langkah maju dalam alur normal
      if (next === "Cancelled") {
        const afterCancelled = STATUS_FLOW[currentIndex + 2];
        return afterCancelled ? [afterCancelled] : [];
      }
      return [next];
    }
    return [];
  };
  const nextStatusOptions = getNextStatusOptions();
  // nextStatus tetap ada untuk kompatibilitas logika lama (Close, QC, Invoice, dll)
  const nextStatus = nextStatusOptions.length > 0 ? nextStatusOptions[0] : null;

  const isOwner = hasRole("owner");
  const canCancel = !NON_CANCELABLE.includes(order.status);
  // Teknisi hanya bisa cancel tiket miliknya sendiri selama belum Selesai/Siap diAmbil/Close
  const canCancelOrder = isOwner
    ? !["Close", "Cancelled"].includes(order.status)
    : isTechnician
      ? isMyTicket && canCancel
      : canCancel;
  const canEdit = !isTechnician;
  const canUpdateStatus = !isTechnician || isMyTicket;
  // Teknisi hanya bisa update sampai "Siap diAmbil" (tidak bisa Close)
  const techMaxStatus = "Siap diAmbil";
  const isTechStatusBlocked = (targetStatus: string) =>
    isTechnician && activeStatusFlow.indexOf(targetStatus) > activeStatusFlow.indexOf(techMaxStatus);
  const canManageInvoice = true;
  const canReactivate = isOwner && order.status === "Cancelled";
  const unitChecks = (order.unit_checks || {}) as Record<string, boolean>;

  const isAdminOrOwner = hasRole("admin") || hasRole("owner");

  // Owner regressive rollback: valid targets based on the active status flow for this service type.
  // "Cancelled" dikecualikan dari sini karena cancel dilakukan via tombol Cancel tersendiri,
  // bukan melalui dynamic status selector. "Diterima" juga dikecualikan karena sudah ada
  // tombol Reaktivasi khusus untuk kembali ke Diterima dari Cancelled.
  const ownerRollbackTargets =
    isOwner && currentIndex > 0 && order.status !== "Cancelled"
      ? activeStatusFlow.filter((s) => s !== "Diterima" && s !== order.status && s !== "Cancelled")
      : [];

  // Does rollback target require technician reassignment?
  const rollbackNeedsReassign = ownerRollbackTarget === "Diagnosa";

  const handleNextStatus = (targetStatus?: string) => {
    const ns = targetStatus || nextStatus;
    if (!ns) return;
    if (order.status === "Perbaikan" && ns === "Selesai") {
      const initialChecks: Record<string, boolean> = {};
      QC_COMPONENTS.forEach((c) => {
        initialChecks[c] = true;
      });
      setQcChecks(initialChecks);
      setQcNote("");
      setQcDialogOpen(true);
      return;
    }
    if (ns === "Siap diAmbil" && order.status === "Selesai" && canManageInvoice) {
      setInvoiceOpen(true);
      return;
    }
    if (order.status === "Siap diAmbil" && ns === "Close") {
      if (isAdminOrOwner) {
        setPendingStatus("Close");
        setWarrantyDuration(null);
        setWarrantyUnit("hari");
        setWarrantyNotes("");
        setStatusNote("");
        setStatusDialogOpen(true);
      } else {
        handleDirectCloseNoWarranty();
      }
      return;
    }
    if (order.status === "Diagnosa" && ns === "Menunggu Konfirmasi") {
      setPublicNote("");
      setInternalDiagNote("");
      setPendingStatus(ns);
      setStatusDialogOpen(true);
      return;
    }
    setPendingStatus(ns);
    setStatusDialogOpen(true);
  };

  // Open confirmation modal for "Menunggu Konfirmasi" status
  const openConfirmationModal = () => {
    // Get latest diagnosis data from updates
    const diagUpdate = [...updates].reverse().find((u) => u.status === "Menunggu Konfirmasi" && u.description);
    setConfirmDiagnosisData(diagUpdate?.description || "Tidak ada data diagnosa");
    setConfirmSpareParts("");
    setConfirmEstCost(0);
    setConfirmDuration("");
    setConfirmationOpen(true);
  };

  const submitConfirmation = async () => {
    if (!confirmSpareParts.trim()) {
      toast.error("Rincian spare part wajib diisi!");
      return;
    }
    if (confirmEstCost <= 0) {
      toast.error("Estimasi biaya harus lebih dari 0!");
      return;
    }
    if (!confirmDuration.trim()) {
      toast.error("Durasi pengerjaan wajib diisi!");
      return;
    }

    const confirmDesc = `[KONFIRMASI] Spare Part: ${confirmSpareParts.trim()} | Estimasi Biaya: Rp ${confirmEstCost.toLocaleString("id-ID")} | Durasi: ${confirmDuration.trim()}`;

    // Save estimated cost WITHOUT changing status
    await supabase
      .from("service_orders")
      .update({
        estimated_cost: confirmEstCost,
      })
      .eq("id", order.id);

    // Log confirmation as note on current status (no status change)
    await supabase.from("service_updates").insert({
      order_id: order.id,
      status: order.status as any,
      description: confirmDesc,
      updated_by: user!.id,
    });

    // Build WhatsApp message
    const link = `${window.location.origin}/track/${order.ticket_number}`;
    const msg = encodeURIComponent(
      `Yth. ${order.customer_name},\n\n` +
        `Berikut rincian hasil diagnosa untuk tiket *${order.ticket_number}*:\n\n` +
        `📋 *Hasil Diagnosa:*\n${confirmDiagnosisData}\n\n` +
        `🔧 *Spare Part yang Dibutuhkan:*\n${confirmSpareParts.trim()}\n\n` +
        `💰 *Estimasi Biaya:* Rp ${confirmEstCost.toLocaleString("id-ID")}\n` +
        `⏱️ *Estimasi Durasi:* ${confirmDuration.trim()}\n\n` +
        `Mohon konfirmasi persetujuan Anda untuk melanjutkan pengerjaan.\n\n` +
        `🔗 Lacak status: ${link}\n\n` +
        `Salam,\n*Super Computer Service*`,
    );
    const cleanPhone = order.customer_phone.replace(/\D/g, "");
    const waPhone = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;

    toast.success("Rincian konfirmasi disimpan & draf WhatsApp dibuka. Status tetap di Menunggu Konfirmasi.");
    setConfirmationOpen(false);
    fetchData();

    // Open WhatsApp
    window.open(`https://wa.me/${waPhone}?text=${msg}`, "_blank");
  };

  const handleDirectCloseNoWarranty = async () => {
    await supabase
      .from("service_orders")
      .update({ status: "Close" as any })
      .eq("id", order.id);
    await supabase.from("service_updates").insert({
      order_id: order.id,
      status: "Close" as any,
      description: "Unit telah diambil oleh pelanggan",
      updated_by: user!.id,
    });
    toast.success("Status diupdate ke Close");
    fetchData();
  };

  // All roles (except Owner) rollback: Siap diAmbil → Perbaikan (mandatory note)
  const rollbackSiapToPerbaikan = async () => {
    if (!rollbackNote.trim()) {
      toast.error("Catatan alasan perbaikan ulang wajib diisi!");
      return;
    }
    await supabase
      .from("service_orders")
      .update({
        status: "Perbaikan" as any,
        unit_checks: {} as any,
        invoice_items: null,
        final_cost: null,
      })
      .eq("id", order.id);
    await supabase.from("service_updates").insert({
      order_id: order.id,
      status: "Perbaikan" as any,
      description: `[ROLLBACK] Dikembalikan ke Perbaikan: ${rollbackNote.trim()}`,
      updated_by: user!.id,
    });
    toast.success("Status dikembalikan ke Perbaikan");
    setRollbackToPerbaikanOpen(false);
    setRollbackNote("");
    fetchData();
  };

  const confirmOwnerRollback = async () => {
    if (!ownerRollbackNote.trim()) {
      toast.error("Catatan wajib diisi!");
      return;
    }
    if (rollbackNeedsReassign && !reassignTechId) {
      toast.error("Pilih teknisi untuk penugasan ulang!");
      return;
    }

    const targetIndex = activeStatusFlow.indexOf(ownerRollbackTarget);
    const isForward = targetIndex > currentIndex;

    const updateData: any = { status: ownerRollbackTarget as any };

    // Only clear downstream data on backward transitions
    if (!isForward) {
      if (targetIndex < activeStatusFlow.indexOf("Selesai")) {
        updateData.unit_checks = {} as any;
      }
      if (targetIndex < activeStatusFlow.indexOf("Siap diAmbil")) {
        updateData.invoice_items = null;
        updateData.final_cost = null;
      }
    }
    if (rollbackNeedsReassign && reassignTechId) {
      updateData.assigned_technician = reassignTechId;
    }

    await supabase.from("service_orders").update(updateData).eq("id", order.id);
    await supabase.from("service_updates").insert({
      order_id: order.id,
      status: ownerRollbackTarget as any,
      description: `[${isForward ? "OVERRIDE" : "ROLLBACK"} oleh Owner] ${isForward ? "Diubah" : "Dikembalikan"} dari ${order.status} ke ${ownerRollbackTarget}: ${ownerRollbackNote.trim()}${reassignTechId ? ` | Teknisi diubah` : ""}`,
      updated_by: user!.id,
    });

    toast.success(`Status diubah ke ${ownerRollbackTarget}`);
    setOwnerRollbackOpen(false);
    setOwnerRollbackNote("");
    setOwnerRollbackTarget("");
    setReassignTechId("");
    fetchData();
  };

  const confirmQcAndComplete = async () => {
    if (!qcNote.trim()) {
      toast.error("Keterangan QC wajib diisi!");
      return;
    }
    await supabase
      .from("service_orders")
      .update({
        unit_checks: qcChecks as any,
        status: "Selesai" as any,
      })
      .eq("id", order.id);

    const failedComponents = Object.entries(qcChecks)
      .filter(([, ok]) => !ok)
      .map(([k]) => k);
    const qcSummary =
      failedComponents.length > 0
        ? `[QC] Komponen tidak berfungsi: ${failedComponents.join(", ")}. ${qcNote}`
        : `[QC] Semua komponen berfungsi baik. ${qcNote}`;

    await supabase.from("service_updates").insert({
      order_id: order.id,
      status: "Selesai" as any,
      description: qcSummary,
      updated_by: user!.id,
    });

    toast.success("QC selesai, status diupdate ke Selesai");
    setQcDialogOpen(false);
    fetchData();
  };

  const isClosingStatus = pendingStatus === "Close";
  const isDiagnosaToKonfirmasi = order.status === "Diagnosa" && pendingStatus === "Menunggu Konfirmasi";

  const confirmStatusUpdate = async () => {
    if (isDiagnosaToKonfirmasi) {
      if (!publicNote.trim()) {
        toast.error("Keterangan publik wajib diisi!");
        return;
      }
      if (!internalDiagNote.trim()) {
        toast.error("Keterangan internal wajib diisi!");
        return;
      }

      // Upload diagnosis photos if any
      if (diagnosisPhotos.length > 0) {
        setUploadingDiagPhotos(true);
        try {
          for (const file of diagnosisPhotos) {
            const ext = file.name.split(".").pop() || "jpg";
            const filePath = `${resolvedId}/diagnosa-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const { error: uploadError } = await supabase.storage.from("unit-photos").upload(filePath, file);
            if (uploadError) {
              toast.error(`Gagal upload foto: ${uploadError.message}`);
              continue;
            }
            const { data: urlData } = supabase.storage.from("unit-photos").getPublicUrl(filePath);
            await supabase.from("service_photos").insert({
              order_id: resolvedId!,
              photo_url: urlData.publicUrl,
              label: "Bukti Diagnosa",
            });
          }
        } finally {
          setUploadingDiagPhotos(false);
        }
      }

      await supabase
        .from("service_orders")
        .update({ status: pendingStatus as any })
        .eq("id", order.id);
      await supabase.from("service_updates").insert({
        order_id: order.id,
        status: pendingStatus as any,
        description: publicNote.trim(),
        updated_by: user!.id,
      });
      await supabase.from("internal_notes").insert({
        order_id: order.id,
        user_id: user!.id,
        content: `[Diagnosa Internal] ${internalDiagNote.trim()}`,
        is_read_by: [user!.id],
      } as any);
      toast.success(`Status diupdate ke ${pendingStatus}`);
      setStatusDialogOpen(false);
      setPublicNote("");
      setInternalDiagNote("");
      setDiagnosisPhotos([]);
      fetchData();
      fetchNotes();
      return;
    }

    if (isClosingStatus) {
      if (warrantyDuration === null) {
        toast.error("Durasi garansi wajib diisi (isi 0 jika tidak ada garansi)");
        return;
      }
      const updateData: any = { status: pendingStatus as any };
      const expiryDate = new Date();
      if (warrantyDuration > 0) {
        if (warrantyUnit === "bulan") expiryDate.setMonth(expiryDate.getMonth() + warrantyDuration);
        else expiryDate.setDate(expiryDate.getDate() + warrantyDuration);
      }
      updateData.warranty_duration = warrantyDuration;
      updateData.warranty_unit = warrantyUnit;
      updateData.warranty_notes = warrantyNotes || null;
      updateData.warranty_expiry = expiryDate.toISOString();
      await supabase.from("service_orders").update(updateData).eq("id", order.id);
      await supabase.from("service_updates").insert({
        order_id: order.id,
        status: pendingStatus as any,
        description: statusNote.trim() || "Unit telah diambil oleh pelanggan",
        updated_by: user!.id,
      });
      toast.success(`Status diupdate ke ${pendingStatus}`);
      setStatusDialogOpen(false);
      setStatusNote("");
      setWarrantyDuration(null);
      setWarrantyPreset("manual");
      setWarrantyUnit("hari");
      setWarrantyNotes("");
      fetchData();
      return;
    }

    // Normal status update
    if (!statusNote.trim()) {
      toast.error("Keterangan wajib diisi!");
      return;
    }

    await supabase
      .from("service_orders")
      .update({ status: pendingStatus as any })
      .eq("id", order.id);
    await supabase.from("service_updates").insert({
      order_id: order.id,
      status: pendingStatus as any,
      description: statusNote.trim(),
      updated_by: user!.id,
    });

    toast.success(`Status diupdate ke ${pendingStatus}`);
    setStatusDialogOpen(false);
    setStatusNote("");
    fetchData();
  };

  const confirmCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Alasan pembatalan wajib diisi!");
      return;
    }
    await supabase.from("service_updates").insert({
      order_id: order.id,
      status: "Cancelled" as any,
      description: cancelReason,
      cancel_type: cancelType,
      updated_by: user!.id,
    });
    await supabase.from("service_orders").update({ status: "Cancelled" }).eq("id", order.id);
    toast.success("Pesanan dibatalkan");
    setCancelDialogOpen(false);
    setCancelReason("");
    fetchData();
  };

  const confirmReactivate = async () => {
    if (!reactivateReason.trim()) {
      toast.error("Alasan reaktivasi wajib diisi!");
      return;
    }
    await supabase.from("service_updates").insert({
      order_id: order.id,
      status: "Diterima" as any,
      description: `[REAKTIVASI oleh Owner] ${reactivateReason}`,
      updated_by: user!.id,
    });
    await supabase
      .from("service_orders")
      .update({ status: "Diterima" as any, assigned_technician: null })
      .eq("id", order.id);
    toast.success("Tiket berhasil diaktifkan kembali ke status Diterima");
    setReactivateOpen(false);
    setReactivateReason("");
    fetchData();
  };

  // Close setelah Cancel: Owner menandai bahwa unit dari tiket yang dibatalkan
  // sudah diambil kembali oleh pelanggan → status Close (unit tidak ada lagi di toko)
  const handleCancelledToClose = async () => {
    await supabase
      .from("service_orders")
      .update({ status: "Close" as any })
      .eq("id", order.id);
    await supabase.from("service_updates").insert({
      order_id: order.id,
      status: "Close" as any,
      description: "Unit dari tiket yang dibatalkan telah diambil kembali oleh pelanggan",
      updated_by: user!.id,
    });
    toast.success("Status diupdate ke Close — unit sudah tidak ada di toko");
    fetchData();
  };

  const saveInvoice = async () => {
    const validItems = invoiceItems
      .filter((i) => i.description.trim() && i.amount !== null && Number.isFinite(i.amount) && i.amount >= 0)
      .map((i) => ({ description: i.description.trim(), amount: i.amount as number }));
    if (validItems.length === 0) {
      toast.error("Tambahkan minimal satu item biaya (isi 0 jika gratis)!");
      return;
    }
    const total = validItems.reduce((sum, i) => sum + i.amount, 0);

    await supabase
      .from("service_orders")
      .update({
        invoice_items: validItems as any,
        final_cost: total,
        status: "Siap diAmbil",
      })
      .eq("id", order.id);

    await supabase.from("service_updates").insert({
      order_id: order.id,
      status: "Siap diAmbil" as any,
      description: `Invoice dibuat. Total: Rp ${total.toLocaleString("id-ID")}`,
      updated_by: user!.id,
    });

    toast.success("Invoice disimpan, status diupdate ke Siap diAmbil");
    setInvoiceOpen(false);
    fetchData();
  };

  const handleEdit = () => {
    setEditForm({
      service_type: order.service_type,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email || "",
      device_type: order.device_type,
      device_brand: order.device_brand,
      device_model: order.device_model,
      device_password: order.device_password || "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const editedInfo = `Di edit oleh ${profile?.full_name}, waktu ${new Date().toLocaleString("id-ID")}`;
    await supabase
      .from("service_orders")
      .update({
        service_type: editForm.service_type,
        customer_name: editForm.customer_name,
        customer_phone: editForm.customer_phone,
        customer_email: editForm.customer_email || null,
        device_type: editForm.device_type,
        device_brand: editForm.device_brand,
        device_model: editForm.device_model,
        device_password: editForm.device_password || null,
        edited_by: editedInfo,
        edited_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    toast.success("Data pesanan berhasil diperbarui");
    setEditOpen(false);
    fetchData();
  };


  const REASSIGN_STATUSES = isInstallOrder
    ? ["Perbaikan", "Selesai", "Siap diAmbil"]
    : ["Diagnosa", "Menunggu Konfirmasi", "Pending", "Perbaikan", "Selesai", "Siap diAmbil"];
  const canReassign = isOwner && REASSIGN_STATUSES.includes(order.status);

  const confirmReassign = async () => {
    if (!reassignNewTechId) {
      toast.error("Pilih teknisi baru!");
      return;
    }
    await supabase.from("service_orders").update({ assigned_technician: reassignNewTechId }).eq("id", order.id);
    await supabase.from("service_updates").insert({
      order_id: order.id,
      status: order.status as any,
      description: `[REASSIGN oleh Owner] Teknisi diubah`,
      updated_by: user!.id,
    });
    toast.success("Teknisi berhasil diubah");
    setReassignDialogOpen(false);
    setReassignNewTechId("");
    fetchData();
  };

  const sendWhatsApp = () => {
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

  const openNotepad = () => {
    setNotepadOpen(true);
    markNotesAsRead();
  };

  const saveDelayReason = async () => {
    const reason = delayReason.trim();
    if (!reason) {
      toast.error("Alasan terlambat wajib diisi");
      return;
    }
    setSavingDelayReason(true);
    const { error } = await supabase
      .from("service_orders")
      .update({ update_delay_reason: reason } as any)
      .eq("id", order.id);
    if (!error) {
      await supabase.from("internal_notes").insert({
        order_id: order.id,
        user_id: user!.id,
        content: `[Alasan Terlambat Update] ${reason}`,
        is_read_by: [user!.id],
      } as any);
    }
    setSavingDelayReason(false);
    if (error) {
      toast.error("Gagal menyimpan alasan");
      return;
    }
    toast.success("Alasan keterlambatan disimpan");
    fetchData();
    fetchNotes();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-primary text-primary-foreground";
      case "admin":
        return "bg-accent text-accent-foreground";
      case "technician":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-4 print:max-w-none print:mx-0">
        {/* Print Header - Only visible when printing */}
        <div className="hidden print:block text-center border-b-2 border-black pb-4 mb-4">
          <h1 className="text-2xl font-bold text-black">Toko Super Komputer</h1>
          <p className="text-sm text-black">Jl Ahmad Yani No 118</p>
          <p className="text-sm text-black">Telp: 0811-5404-999</p>
          <div className="mt-4 flex justify-between items-end">
            <div className="text-left">
              <p className="text-sm font-bold text-black">No. Tiket: {order.ticket_number}</p>
              <p className="text-xs text-black">
                {new Date(order.created_at).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="text-right">
              <StatusBadge status={order.status} />
            </div>
          </div>

          {/* QR Codes — hanya muncul saat print */}
          <div className="mt-5 flex justify-between">
            {/* QR 1: WhatsApp toko */}
            <div className="flex flex-col items-center gap-1">
              <QRCodeSVG
                value={`https://wa.me/628115404999`}
                size={90}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
              />
              <p className="text-[10px] text-black font-medium mt-1">WhatsApp Kami</p>
              <p className="text-[9px] text-black">0811-5404-999</p>
            </div>

            {/* QR 2: Link lacak tiket pelanggan */}
            <div className="flex flex-col items-center gap-1">
              <QRCodeSVG
                value={`${window.location.origin}/track/${order.ticket_number}`}
                size={90}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
              />
              <p className="text-[10px] text-black font-medium mt-1">Lacak Status Servis</p>
              <p className="text-[9px] text-black">Scan untuk cek progress</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/orders")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{order.ticket_number}</h1>
              <p className="text-sm text-muted-foreground">{order.customer_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit className="h-3 w-3 mr-1" /> Edit
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={sendWhatsApp}>
            <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={openNotepad} className="relative">
            <StickyNote className="h-3 w-3 mr-1" /> Notepad
            {hasUnreadNotes && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3 w-3 mr-1" /> Cetak
          </Button>
        </div>

        {isTechnician && !isMyTicket && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg text-center print:hidden">
            🔒 Mode View Only — Ambil tiket ini terlebih dahulu untuk mengupdate status.
          </div>
        )}

        {order.edited_by && <div className="text-xs text-warning bg-warning/10 p-2 rounded-lg print:hidden">{order.edited_by}</div>}

        {isStaleTechnicianTicket && (
          <Card className="border-destructive/40 bg-destructive/5 print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <AlertTriangle className="h-4 w-4" /> Tiket Terlambat Di-update
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-destructive">
                Tiket ini belum diperbarui lebih dari 24 jam. Isi alasan keterlambatan sebelum update status.
              </p>
              <Textarea
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                placeholder="Tulis alasan keterlambatan update..."
                className="min-h-[80px]"
              />
              <Button size="sm" onClick={saveDelayReason} disabled={savingDelayReason || !delayReason.trim()}>
                {savingDelayReason ? "Menyimpan..." : "Simpan Alasan"}
              </Button>
            </CardContent>
          </Card>
        )}

        {(order as any).update_delay_reason && (isOwner || isAdminOrOwner) && (
          <Card className="border-warning/30 bg-warning/10 print:hidden">
            <CardContent className="p-4 text-sm">
              <p className="font-medium text-warning">Alasan keterlambatan teknisi</p>
              <p className="mt-1 text-foreground">{(order as any).update_delay_reason}</p>
            </CardContent>
          </Card>
        )}

        {/* Creator & Assignee Attribution with Role */}
        <Card className="print:hidden">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">📝 Dibuat oleh (Creator)</p>
                <p className="font-medium">{creatorName}</p>
                <Badge className={`text-[10px] px-1.5 py-0 mt-1 ${getRoleBadgeColor(creatorRole)}`}>
                  {creatorRole}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">🔧 Teknisi (Assignee)</p>
                <p className="font-medium">{assigneeName}</p>
                {canReassign && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 h-6 text-[10px]"
                    onClick={() => {
                      setReassignNewTechId(order.assigned_technician || "");
                      setReassignDialogOpen(true);
                    }}
                  >
                    <RefreshCw className="h-2.5 w-2.5 mr-1" /> Reassign
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer & Device Info */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Info Pelanggan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Nama:</span> {order.customer_name}
              </p>
              <p>
                <span className="text-muted-foreground">Telepon:</span>{" "}
                {order.customer_phone.replace(/(\d{4})(\d{4})(\d+)/, "$1-$2-$3")}
              </p>
              <p>
                <span className="text-muted-foreground">Email:</span> {order.customer_email || "-"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Info Unit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Perangkat:</span> {order.device_type} - {order.device_brand}{" "}
                {order.device_model}
              </p>
              <p>
                <span className="text-muted-foreground">Tipe Servis:</span> {order.service_type}
              </p>
              <p>
                <span className="text-muted-foreground">Kondisi:</span> {order.unit_condition}
              </p>
              <p>
                <span className="text-muted-foreground">Kelengkapan:</span> {order.unit_accessories || "-"}
              </p>
              {order.serial_number && (
                <p>
                  <span className="text-muted-foreground">Serial Number:</span>{" "}
                  <span className="font-mono bg-muted px-2 py-0.5 rounded">{order.serial_number}</span>
                </p>
              )}
              {order.device_password && (
                <p>
                  <span className="text-muted-foreground">Password:</span>{" "}
                  <span className="font-mono bg-muted px-2 py-0.5 rounded">{order.device_password}</span>
                </p>
              )}
              {order.damage_description && (
                <p>
                  <span className="text-muted-foreground">Deskripsi:</span> {order.damage_description}
                </p>
              )}
              {order.notes && (
                <p>
                  <span className="text-muted-foreground">Catatan:</span> {order.notes}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Unit Checks */}
        {Object.keys(unitChecks).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cek Unit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(unitChecks).map(([key, ok]) => (
                  <Badge
                    key={key}
                    className={ok ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}
                  >
                    {key}: {ok ? "Kondisi Baik" : "Tidak Berfungsi"}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <Card className="print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Foto Unit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p: any) => (
                  <div key={p.id} className="cursor-pointer" onClick={() => setLightboxUrl(p.photo_url)}>
                    <img
                      src={p.photo_url}
                      alt={p.label}
                      className="rounded-lg w-full aspect-square object-cover hover:opacity-80 transition-opacity"
                    />
                    <p className="text-xs text-center text-muted-foreground mt-1">{p.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice Info */}
        {order.invoice_items && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Invoice</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                {(order.invoice_items as InvoiceItem[]).map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.description}</span>
                    <span className="font-medium">Rp {item.amount.toLocaleString("id-ID")}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-border font-bold">
                  <span>Total</span>
                  <span>Rp {order.final_cost?.toLocaleString("id-ID")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warranty Info */}
        {(order as any).warranty_duration && order.status === "Close" && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">🛡️ Garansi Toko</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Durasi:</span> {(order as any).warranty_duration}{" "}
                {(order as any).warranty_unit}
              </p>
              <p>
                <span className="text-muted-foreground">Berlaku sampai:</span>{" "}
                <span className="font-medium">
                  {(order as any).warranty_expiry
                    ? new Date((order as any).warranty_expiry).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "-"}
                </span>
                {(order as any).warranty_expiry && new Date((order as any).warranty_expiry) < new Date() && (
                  <Badge variant="destructive" className="ml-2 text-[10px]">
                    Expired
                  </Badge>
                )}
                {(order as any).warranty_expiry && new Date((order as any).warranty_expiry) >= new Date() && (
                  <Badge className="ml-2 text-[10px] bg-success text-success-foreground">Aktif</Badge>
                )}
              </p>
              {(order as any).warranty_notes && (
                <p>
                  <span className="text-muted-foreground">Catatan:</span> {(order as any).warranty_notes}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Status Actions */}
        {order.status !== "Close" && order.status !== "Cancelled" && canUpdateStatus && (
          <Card className="print:hidden">
            <CardContent className="p-4 flex flex-wrap gap-2">
              {/* Confirmation button for Admin/Owner on Menunggu Konfirmasi */}
              {order.status === "Menunggu Konfirmasi" && isAdminOrOwner && (
                <Button
                  onClick={openConfirmationModal}
                  disabled={shouldLockStatusForDelayReason}
                  className="bg-success text-success-foreground hover:bg-success/90"
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Konfirmasi & Kirim ke Pelanggan
                </Button>
              )}
              {/* Next status buttons — supports multiple options for branching flows */}
              {nextStatusOptions
                .filter((ns) => !isTechStatusBlocked(ns))
                .map((ns) => {
                  // Buat label yang lebih deskriptif untuk pilihan percabangan
                  let label = `→ ${ns}`;
                  if (order.status === "Diagnosa") {
                    if (ns === "Menunggu Konfirmasi") label = "→ Menunggu Konfirmasi";
                    if (ns === "Pending") label = "→ Pending (Skip Konfirmasi)";
                    if (ns === "Perbaikan") label = "→ Langsung Perbaikan";
                  } else if (order.status === "Menunggu Konfirmasi") {
                    if (ns === "Perbaikan") label = "→ Langsung Perbaikan";
                  }
                  return (
                    <Button
                      key={ns}
                      onClick={() => handleNextStatus(ns)}
                      disabled={shouldLockStatusForDelayReason}
                      className="gradient-primary"
                    >
                      {label}
                    </Button>
                  );
                })}
              {shouldLockStatusForDelayReason && (
                <p className="w-full text-xs text-destructive">Update status terkunci sampai alasan terlambat disimpan.</p>
              )}
              {canCancelOrder && (
                <Button variant="destructive" onClick={() => setCancelDialogOpen(true)}>
                  Cancel
                </Button>
              )}
            </CardContent>
          </Card>
        )}


        {/* Rollback: Admin & Technician can rollback Siap diAmbil → Perbaikan (hidden for Owner) */}
        {order.status === "Siap diAmbil" && canUpdateStatus && !isOwner && (
          <Card className="border-warning/30 print:hidden">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">
                Kembalikan ke Perbaikan jika pelanggan menemukan masalah saat pengecekan unit.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRollbackNote("");
                  setRollbackToPerbaikanOpen(true);
                }}
              >
                ↩ Rollback ke Perbaikan
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Owner: Dynamic Status Change Selector (Diagnosa through Close) */}
        {isOwner && !["Cancelled", "Diterima"].includes(order.status) && (
          <Card className="border-primary/30 print:hidden">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                <Users className="h-3 w-3 inline mr-1" />
                Sebagai Owner, Anda dapat mengubah status tiket ke tahap manapun secara dinamis.
              </p>
              <Select
                value=""
                onValueChange={(target) => {
                  setOwnerRollbackTarget(target);
                  setOwnerRollbackNote("");
                  setReassignTechId(order.assigned_technician || "");
                  setOwnerRollbackOpen(true);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih status tujuan..." />
                </SelectTrigger>
                <SelectContent>
                  {activeStatusFlow.filter((s) => s !== "Diterima" && s !== order.status && s !== "Cancelled").map((s) => (
                    <SelectItem key={s} value={s}>
                      {activeStatusFlow.indexOf(s) < currentIndex ? "↩ " : "→ "}
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {/* Owner: Cancel from Selesai/Siap diAmbil */}
        {canCancelOrder && ["Selesai", "Siap diAmbil"].includes(order.status) && isOwner && (
          <Card className="border-destructive/30 print:hidden">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">
                Sebagai Owner, Anda dapat membatalkan tiket meskipun sudah selesai.
              </p>
              <Button variant="destructive" size="sm" onClick={() => setCancelDialogOpen(true)}>
                Cancel Tiket (Owner Override)
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Owner/Admin: Reactivate/Close Cancelled ticket */}
        {order.status === "Cancelled" && isAdminOrOwner && (
          <Card className="border-primary/30 print:hidden">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Tiket ini telah dibatalkan. Sebagai {isOwner ? "Owner" : "Admin"}, Anda dapat {isOwner ? "mengaktifkannya kembali, atau " : ""}menandai unit sebagai sudah diambil oleh pelanggan (Close).
              </p>
              <div className="flex flex-wrap gap-2">
                {canReactivate && (
                  <Button size="sm" className="gradient-primary" onClick={() => setReactivateOpen(true)}>
                    🔄 Reaktivasi Tiket
                  </Button>
                )}
                {/* Close setelah Cancel: unit sudah tidak ada di toko (sudah diambil pelanggan) */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelledToClose}
                >
                  ✅ Unit Sudah Diambil (Close)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Timeline */}
        <Card className="print:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Riwayat Update</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTimeline updates={updates} currentStatus={order.status} serviceType={order.service_type} />
          </CardContent>
        </Card>

        {/* Log Riwayat Perubahan - Owner only */}
        {isOwner && enrichedUpdates.length > 0 && (
          <Card className="print:hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">📋 Log Riwayat Perubahan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {enrichedUpdates.map((u: any, i: number) => (
                  <div key={u.id || i} className="border-l-2 border-primary/30 pl-3 py-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{u._user_name}</span>
                      {u._username && <span className="text-xs text-muted-foreground">@{u._username}</span>}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {u._role}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Status → <span className="font-medium">{u.status}</span>
                      {u.cancel_type && ` (${u.cancel_type})`}
                    </p>
                    {u.description && <p className="text-xs mt-0.5">{u.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(u.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Status ke "{pendingStatus}"</DialogTitle>
            <DialogDescription>Masukkan keterangan untuk perubahan status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isDiagnosaToKonfirmasi ? (
              <>
                <div className="space-y-2">
                  <Label>Keterangan Publik (ditampilkan ke pelanggan) *</Label>
                  <Textarea
                    value={publicNote}
                    onChange={(e) => setPublicNote(e.target.value)}
                    placeholder="Informasi untuk pelanggan..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Keterangan Internal (hanya staf) *</Label>
                  <Textarea
                    value={internalDiagNote}
                    onChange={(e) => setInternalDiagNote(e.target.value)}
                    placeholder="Diagnosa teknis internal..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Camera className="h-3 w-3" /> Lampiran Bukti Diagnosa (opsional)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Unggah foto bukti kerusakan dari kamera atau galeri perangkat.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="relative"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.capture = "environment";
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) setDiagnosisPhotos((prev) => [...prev, file]);
                        };
                        input.click();
                      }}
                    >
                      <Camera className="h-3 w-3 mr-1" /> Kamera
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.multiple = true;
                        input.onchange = (e) => {
                          const files = Array.from((e.target as HTMLInputElement).files || []);
                          if (files.length > 0) setDiagnosisPhotos((prev) => [...prev, ...files]);
                        };
                        input.click();
                      }}
                    >
                      <Upload className="h-3 w-3 mr-1" /> Galeri
                    </Button>
                  </div>
                  {diagnosisPhotos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {diagnosisPhotos.map((file, i) => (
                        <div key={i} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Diagnosa ${i + 1}`}
                            className="h-16 w-16 object-cover rounded-lg border border-border"
                          />
                          <button
                            type="button"
                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setDiagnosisPhotos((prev) => prev.filter((_, j) => j !== i))}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>{isClosingStatus ? "Keterangan (opsional)" : "Keterangan *"}</Label>
                <Textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Masukkan keterangan..."
                />
              </div>
            )}

            {pendingStatus === "Close" && (
              <div className="space-y-3 border-t pt-3">
                <p className="text-sm font-medium">🛡️ Garansi Pascaservis</p>
                <div className="space-y-1">
                  <Label className="text-xs">Masa Garansi</Label>
                  <Select
                    value={warrantyPreset}
                    onValueChange={(value) => {
                      setWarrantyPreset(value);
                      setWarrantyUnit("hari");
                      if (value !== "manual") setWarrantyDuration(Number(value));
                      else setWarrantyDuration(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih masa garansi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 Hari</SelectItem>
                      <SelectItem value="14">14 Hari</SelectItem>
                      <SelectItem value="30">30 Hari</SelectItem>
                      <SelectItem value="manual">Input Manual Hari</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Durasi Garansi (Hari)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={warrantyDuration ?? ""}
                    onChange={(e) => {
                      setWarrantyPreset("manual");
                      setWarrantyUnit("hari");
                      setWarrantyDuration(e.target.value === "" ? null : Math.max(0, Number(e.target.value)));
                    }}
                    placeholder="Contoh: 30"
                  />
                  {warrantyDuration === null && (
                    <p className="text-xs text-destructive">Durasi garansi wajib diisi (isi 0 jika tidak ada garansi)</p>
                  )}
                  {warrantyDuration === 0 && (
                    <p className="text-xs text-muted-foreground">Unit ini tidak akan memiliki masa garansi</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Catatan Teknis Garansi</Label>
                  <Textarea
                    value={warrantyNotes}
                    onChange={(e) => setWarrantyNotes(e.target.value)}
                    placeholder="Detail purnajual, kondisi garansi, dll."
                    className="min-h-[60px]"
                  />
                </div>
                {warrantyDuration > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Garansi berlaku hingga:{" "}
                    <span className="font-medium text-foreground">
                      {(() => {
                        const d = new Date();
                        d.setDate(d.getDate() + warrantyDuration);
                        return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
                      })()}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={confirmStatusUpdate}
              disabled={uploadingDiagPhotos || (pendingStatus === "Close" && warrantyDuration === null)}
              className="gradient-primary"
            >
              {uploadingDiagPhotos ? "Mengupload..." : "Konfirmasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal (Menunggu Konfirmasi → Pending with WhatsApp) */}
      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>✅ Konfirmasi & Kirim Rincian ke Pelanggan</DialogTitle>
            <DialogDescription>Isi rincian spare part, biaya, dan durasi pengerjaan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Hasil Diagnosa Teknisi</Label>
              <div className="bg-muted/50 p-3 rounded-lg text-sm">{confirmDiagnosisData}</div>
            </div>
            <div className="space-y-2">
              <Label>Rincian Spare Part *</Label>
              <Textarea
                value={confirmSpareParts}
                onChange={(e) => setConfirmSpareParts(e.target.value)}
                placeholder="Contoh: LCD 14 inch, Baterai Original, Keyboard US Layout..."
              />
            </div>
            <div className="space-y-2">
              <Label>Estimasi Biaya (Rp) *</Label>
              <Input
                type="number"
                min={0}
                value={confirmEstCost || ""}
                onChange={(e) => setConfirmEstCost(Number(e.target.value))}
                placeholder="Contoh: 500000"
              />
              {confirmEstCost > 0 && (
                <p className="text-xs text-muted-foreground">= Rp {confirmEstCost.toLocaleString("id-ID")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Estimasi Durasi Pengerjaan *</Label>
              <Input
                value={confirmDuration}
                onChange={(e) => setConfirmDuration(e.target.value)}
                placeholder="Contoh: 3-5 hari kerja"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmationOpen(false)}>
              Batal
            </Button>
            <Button onClick={submitConfirmation} className="bg-success text-success-foreground hover:bg-success/90">
              <MessageCircle className="h-4 w-4 mr-1" /> Simpan & Kirim WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Owner Dynamic Status Change Dialog */}
      <Dialog open={ownerRollbackOpen} onOpenChange={setOwnerRollbackOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {activeStatusFlow.indexOf(ownerRollbackTarget) < activeStatusFlow.indexOf(order.status)
                ? `↩ Rollback ke ${ownerRollbackTarget}`
                : `→ Override ke ${ownerRollbackTarget}`}
            </DialogTitle>
            <DialogDescription>Masukkan catatan dan konfirmasi perubahan status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Status tiket akan diubah dari <strong>{order.status}</strong> ke <strong>{ownerRollbackTarget}</strong>.
              {activeStatusFlow.indexOf(ownerRollbackTarget) < currentIndex && (
                <>
                  {activeStatusFlow.indexOf(ownerRollbackTarget) < activeStatusFlow.indexOf("Selesai") &&
                    " Data QC unit akan dihapus."}
                  {activeStatusFlow.indexOf(ownerRollbackTarget) < activeStatusFlow.indexOf("Siap diAmbil") &&
                    " Data invoice akan dihapus."}
                </>
              )}
            </p>
            <div className="space-y-2">
              <Label>Catatan *</Label>
              <Textarea
                value={ownerRollbackNote}
                onChange={(e) => setOwnerRollbackNote(e.target.value)}
                placeholder="Jelaskan alasan perubahan status..."
              />
            </div>
            {rollbackNeedsReassign && (
              <div className="space-y-2">
                <Label>
                  <Users className="h-3 w-3 inline mr-1" />
                  Pilih Teknisi Baru *
                </Label>
                <Select value={reassignTechId} onValueChange={setReassignTechId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih teknisi..." />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians
                      .filter((t) => t.role === "technician")
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.full_name} {t.username ? `(@${t.username})` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOwnerRollbackOpen(false)}>
              Batal
            </Button>
            <Button onClick={confirmOwnerRollback} className="gradient-primary">
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Siap diAmbil → Perbaikan (All roles, mandatory note) */}
      <Dialog open={rollbackToPerbaikanOpen} onOpenChange={setRollbackToPerbaikanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>↩ Rollback ke Perbaikan</DialogTitle>
            <DialogDescription>Kembalikan status jika ada masalah saat pengecekan unit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Kembalikan status ke Perbaikan jika pelanggan menemukan masalah saat pengecekan unit di tempat.
            </p>
            <div className="space-y-2">
              <Label>Alasan Perbaikan Ulang *</Label>
              <Textarea
                value={rollbackNote}
                onChange={(e) => setRollbackNote(e.target.value)}
                placeholder="Jelaskan alasan perbaikan ulang..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackToPerbaikanOpen(false)}>
              Batal
            </Button>
            <Button onClick={rollbackSiapToPerbaikan} className="gradient-primary">
              Konfirmasi Rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan Pesanan</DialogTitle>
            <DialogDescription>Pilih jenis dan alasan pembatalan pesanan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={cancelType} onValueChange={setCancelType}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Cancel by Customer" id="cc" />
                <Label htmlFor="cc">Cancel by Customer</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Cancel by Super Komputer" id="cs" />
                <Label htmlFor="cs">Cancel by Super Komputer</Label>
              </div>
            </RadioGroup>
            <div className="space-y-2">
              <Label>Alasan Pembatalan *</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Masukkan alasan..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmCancel}>
              Konfirmasi Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QC Check Dialog */}
      <Dialog open={qcDialogOpen} onOpenChange={setQcDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🔍 Cek Unit - Quality Control</DialogTitle>
            <DialogDescription>Verifikasi kondisi komponen sebelum menyelesaikan perbaikan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Verifikasi kondisi komponen perangkat sebelum menyelesaikan perbaikan.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {QC_COMPONENTS.map((comp) => (
                <div key={comp} className="flex items-center gap-2">
                  <Checkbox
                    id={`qc-${comp}`}
                    checked={qcChecks[comp] || false}
                    onCheckedChange={(checked) => setQcChecks((prev) => ({ ...prev, [comp]: !!checked }))}
                  />
                  <Label htmlFor={`qc-${comp}`} className="text-sm cursor-pointer">
                    {comp}
                  </Label>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Keterangan QC *</Label>
              <Textarea
                value={qcNote}
                onChange={(e) => setQcNote(e.target.value)}
                placeholder="Catatan hasil pengecekan akhir..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQcDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={confirmQcAndComplete} className="gradient-primary">
              Selesaikan Perbaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Invoice</DialogTitle>
            <DialogDescription>Tambahkan item biaya servis.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {invoiceItems.map((item, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Deskripsi</Label>
                  <Input
                    value={item.description}
                    onChange={(e) => {
                      const items = [...invoiceItems];
                      items[i].description = e.target.value;
                      setInvoiceItems(items);
                    }}
                    placeholder="Item biaya"
                  />
                </div>
                <div className="w-32 space-y-1">
                  <Label className="text-xs">Nominal</Label>
                  <Input
                    type="number"
                    min={0}
                    value={item.amount ?? ""}
                    onChange={(e) => {
                      const items = [...invoiceItems];
                      const value = e.target.value;
                      items[i].amount = value === "" ? null : Math.max(0, Number(value));
                      setInvoiceItems(items);
                    }}
                  />
                </div>
                {invoiceItems.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setInvoiceItems(invoiceItems.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInvoiceItems([...invoiceItems, { description: "", amount: null }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Tambah Item
            </Button>
            <div className="text-right font-bold text-lg">
              Total: Rp {invoiceItems.reduce((s, i) => s + (i.amount ?? 0), 0).toLocaleString("id-ID")}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceOpen(false)}>
              Batal
            </Button>
            <Button onClick={saveInvoice} className="gradient-primary">
              Simpan Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pesanan (Step 1-3)</DialogTitle>
            <DialogDescription>Perbarui informasi pelanggan dan perangkat.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Tipe Servis</Label>
              <Select
                value={editForm.service_type}
                onValueChange={(v) => setEditForm({ ...editForm, service_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Non Garansi", "Garansi Toko", "Garansi Partner", "Install Software/Hardware"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nama Pelanggan</Label>
              <Input value={editForm.customer_name} disabled className="bg-muted" />
              <p className="text-[10px] text-muted-foreground">
                Nama pelanggan tidak dapat diubah. Gunakan menu Kelola Pelanggan.
              </p>
            </div>
            <div className="space-y-2">
              <Label>No HP</Label>
              <Input value={editForm.customer_phone} disabled className="bg-muted" />
              <p className="text-[10px] text-muted-foreground">
                No HP tidak dapat diubah. Gunakan menu Kelola Pelanggan.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={editForm.customer_email}
                onChange={(e) => setEditForm({ ...editForm, customer_email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Jenis Perangkat</Label>
              <Input
                value={editForm.device_type}
                onChange={(e) => setEditForm({ ...editForm, device_type: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Merk</Label>
              <Input
                value={editForm.device_brand}
                onChange={(e) => setEditForm({ ...editForm, device_brand: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                value={editForm.device_model}
                onChange={(e) => setEditForm({ ...editForm, device_model: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password/PIN</Label>
              <Input
                value={editForm.device_password}
                onChange={(e) => setEditForm({ ...editForm, device_password: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button onClick={saveEdit} className="gradient-primary">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate Dialog (Owner only) */}
      <Dialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reaktivasi Tiket</DialogTitle>
            <DialogDescription>Aktifkan kembali tiket yang telah dibatalkan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tiket ini akan dikembalikan ke status <strong>Diterima</strong> dan masuk kembali ke antrean pengerjaan.
            </p>
            <div className="space-y-2">
              <Label>Alasan Reaktivasi *</Label>
              <Textarea
                value={reactivateReason}
                onChange={(e) => setReactivateReason(e.target.value)}
                placeholder="Contoh: Pelanggan setuju melanjutkan setelah negosiasi ulang biaya..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReactivateOpen(false)}>
              Batal
            </Button>
            <Button onClick={confirmReactivate} className="gradient-primary">
              Konfirmasi Reaktivasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notepad / Catatan Internal Dialog */}
      <Dialog open={notepadOpen} onOpenChange={setNotepadOpen}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>📝 Catatan Internal</DialogTitle>
            <DialogDescription>Catatan hanya dapat dilihat oleh staf internal.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {internalNotes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada catatan internal.</p>
            )}
            {internalNotes.map((note: any) => {
              const noteProfile = noteProfiles[note.user_id];
              const noteRole = noteRoles[note.user_id] || "unknown";
              const isMyNote = note.user_id === user?.id;
              return (
                <div
                  key={note.id}
                  className={`border rounded-lg p-3 space-y-1 ${isMyNote ? "border-primary/30 bg-primary/5" : "border-border"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{noteProfile?.full_name || "Unknown"}</span>
                      {noteProfile?.username && (
                        <span className="text-[10px] text-muted-foreground">@{noteProfile.username}</span>
                      )}
                      <Badge className={`text-[9px] px-1 py-0 ${getRoleBadgeColor(noteRole)}`}>{noteRole}</Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(note.created_at).toLocaleString("id-ID")}
                      {note.updated_at !== note.created_at && " (diedit)"}
                    </span>
                  </div>
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingNoteContent}
                        onChange={(e) => setEditingNoteContent(e.target.value)}
                        className="min-h-[60px]"
                      />
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => updateNote(note.id)}>
                          Simpan
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(null)}>
                          Batal
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      {isMyNote && (
                        <div className="flex gap-1 pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => {
                              setEditingNoteId(note.id);
                              setEditingNoteContent(note.content);
                            }}
                          >
                            <Edit className="h-3 w-3 mr-1" /> Edit
                          </Button>
                          {isOwner && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] px-2 text-destructive"
                              onClick={() => deleteNote(note.id)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" /> Hapus
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Tulis catatan internal..."
              className="min-h-[60px] flex-1"
            />
            <Button onClick={submitNote} disabled={!newNote.trim()} className="self-end gradient-primary">
              Kirim
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reassign Technician Dialog (Owner only) */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔄 Reassign Teknisi</DialogTitle>
            <DialogDescription>Pilih teknisi baru untuk menangani tiket ini.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pilih teknisi baru untuk menangani tiket <strong>{order.ticket_number}</strong>.
            </p>
            <div className="space-y-2">
              <Label>Teknisi Baru *</Label>
              <Select value={reassignNewTechId} onValueChange={setReassignNewTechId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih teknisi..." />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name} {t.username ? `(@${t.username})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={confirmReassign} className="gradient-primary">
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    </DashboardLayout>
  );
}
