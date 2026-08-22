import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useReconnectableChannel } from "@/hooks/useReconnectableChannel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { useNavigate } from "react-router-dom";
import { User, Wrench, ChevronRight, ArrowLeft, Clock, CheckCircle, AlertTriangle, RefreshCw, Bell, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface TechData {
  id: string;
  full_name: string;
  username: string | null;
  tickets: any[];
}

const ACTIVE_STATUSES = ["Diterima", "Diagnosa", "Menunggu Persetujuan Pelanggan", "Menunggu Sparepart", "Perbaikan"] as const;

export default function TechnicianWorkload() {
  const [techData, setTechData] = useState<TechData[]>([]);
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedTech, setSelectedTech] = useState<TechData | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [sendingAllReminders, setSendingAllReminders] = useState(false);
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isAdminOrOwner = hasRole("admin") || hasRole("owner");

  const fetchData = useCallback(async () => {
    try {
      const { data: techRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "technician");
      if (rolesError) throw rolesError;

      const techIds = techRoles?.map((r) => r.user_id) || [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("id", techIds.length > 0 ? techIds : ["none"]);
      if (profilesError) throw profilesError;

      const { data: orders, error: ordersError } = await supabase
        .from("service_orders")
        .select("id, ticket_number, customer_name, customer_phone, device_type, device_brand, device_model, status, assigned_technician, updated_at, damage_description, unit_condition, service_type")
        .in("status", ACTIVE_STATUSES)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (ordersError) throw ordersError;

      const techMap: Record<string, TechData> = {};
      for (const p of profiles || []) {
        techMap[p.id] = { id: p.id, full_name: p.full_name, username: p.username, tickets: [] };
      }

      const unassignedList: any[] = [];
      for (const o of orders || []) {
        if (o.assigned_technician && techMap[o.assigned_technician]) {
          techMap[o.assigned_technician].tickets.push(o);
        } else {
          unassignedList.push(o);
        }
      }

      setTechData(Object.values(techMap));
      setUnassigned(unassignedList);
      setFetchError(null);

      setSelectedTech((prev) => {
        if (!prev) return null;
        return techMap[prev.id] || null;
      });
    } catch (error) {
      console.error("Failed to fetch technician workload", error);
      setFetchError(error instanceof Error ? error.message : "Koneksi terputus atau sesi habis");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const buildWorkloadChannel = useCallback(
    () => supabase
      .channel("workload-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_orders" }, fetchData),
    [fetchData],
  );

  useReconnectableChannel(true, buildWorkloadChannel, fetchData);

  // Kirim reminder untuk 1 tiket tertentu ke teknisi
  const sendSingleTicketReminder = async (e: React.MouseEvent, orderId: string, ticketNumber: string, techName: string) => {
    e.stopPropagation();
    if (!user?.id) return;
    setSendingReminderId(orderId);
    try {
      const { data, error } = await supabase.functions.invoke("notify-staff-update", {
        body: {
          order_id: orderId,
          action: "stale_reminder",
          updated_by: user.id,
        },
      });
      if (error) throw error;
      toast.success(`Pengingat tiket #${ticketNumber} berhasil dikirim ke akun ${techName}!`);
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengirim pengingat ke teknisi.");
    } finally {
      setSendingReminderId(null);
    }
  };

  // Kirim reminder batch untuk semua tiket tertunda (>24h)
  const sendAllStaleReminders = async () => {
    setSendingAllReminders(true);
    try {
      const { data, error } = await supabase.functions.invoke("cron-stale-reminder");
      if (error) throw error;
      if (data?.stale_tickets > 0) {
        toast.success(`Pengingat berhasil dikirim ke ${data.technicians_notified} teknisi (${data.stale_tickets} tiket tertunda)!`);
      } else {
        toast.info("Tidak ada tiket tertunda yang perlu diingatkan saat ini.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal menjalankan pengingat otomatis.");
    } finally {
      setSendingAllReminders(false);
    }
  };

  // Hitung total tiket stale (>24h) di seluruh teknisi
  const totalStaleCount = techData.reduce((acc, tech) => {
    const staleCount = tech.tickets.filter(
      (t) => Date.now() - new Date(t.updated_at).getTime() > 24 * 60 * 60 * 1000
    ).length;
    return acc + staleCount;
  }, 0);

  if (loading) {
    return <DashboardLayout><div className="p-8 text-center text-muted-foreground">Loading...</div></DashboardLayout>;
  }

  if (fetchError) {
    return (
      <DashboardLayout>
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
      </DashboardLayout>
    );
  }

  // Detail view for selected technician
  if (selectedTech) {
    const statusGroups: Record<string, any[]> = {};
    for (const t of selectedTech.tickets) {
      if (!statusGroups[t.status]) statusGroups[t.status] = [];
      statusGroups[t.status].push(t);
    }

    const techStaleTickets = selectedTech.tickets.filter(
      (t) => Date.now() - new Date(t.updated_at).getTime() > 24 * 60 * 60 * 1000
    );

    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedTech(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{selectedTech.full_name}</h1>
                {selectedTech.username && (
                  <span className="text-sm text-muted-foreground">@{selectedTech.username}</span>
                )}
              </div>
            </div>

            {isAdminOrOwner && techStaleTickets.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={sendAllStaleReminders}
                disabled={sendingAllReminders}
                className="gap-1.5"
              >
                <Bell className="h-4 w-4" />
                {sendingAllReminders ? "Mengirim..." : `Ingatkan ${selectedTech.full_name} (${techStaleTickets.length} Tiket Terlambat)`}
              </Button>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted text-primary">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{selectedTech.tickets.length}</p>
                  <p className="text-xs text-muted-foreground">Total Tiket Aktif</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted text-warning">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {selectedTech.tickets.filter((t) => ["Diagnosa", "Perbaikan"].includes(t.status)).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Sedang Dikerjakan</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {techStaleTickets.length}
                  </p>
                  <p className="text-xs text-muted-foreground">&gt; 24 Jam Belum Update</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tickets grouped by status */}
          {Object.entries(statusGroups).map(([status, tickets]) => (
            <Card key={status}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StatusBadge status={status} />
                  <Badge variant="secondary">{tickets.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tickets.map((o: any) => {
                  const isLate = Date.now() - new Date(o.updated_at).getTime() > 24 * 60 * 60 * 1000;
                  const daysLate = Math.max(1, Math.floor((Date.now() - new Date(o.updated_at).getTime()) / (24 * 60 * 60 * 1000)));

                  return (
                    <div
                      key={o.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        isLate ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex justify-between items-start cursor-pointer" onClick={() => navigate(`/dashboard/orders/${o.ticket_number}`)}>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm">{o.ticket_number}</p>
                            {isLate && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                ⚠️ Terlambat {daysLate} hari
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {o.customer_name} • {o.customer_phone}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAdminOrOwner && isLate && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                              disabled={sendingReminderId === o.id}
                              onClick={(e) => sendSingleTicketReminder(e, o.id, o.ticket_number, selectedTech.full_name)}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              {sendingReminderId === o.id ? "Mengirim..." : "Ingatkan"}
                            </Button>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground space-y-0.5 cursor-pointer" onClick={() => navigate(`/dashboard/orders/${o.ticket_number}`)}>
                        <p>🔧 {o.device_type} {o.device_brand} {o.device_model} • {o.service_type}</p>
                        {(o.damage_description || o.unit_condition) && (
                          <p className="line-clamp-1">⚠️ {o.unit_condition}{o.damage_description ? ` — ${o.damage_description}` : ""}</p>
                        )}
                        <p className="text-muted-foreground/70">
                          Update terakhir: {new Date(o.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          {selectedTech.tickets.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Tidak ada tiket aktif untuk teknisi ini.</p>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // Main list view
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Status Pekerjaan & Tiket Teknisi</h1>
            <p className="text-sm text-muted-foreground">Monitor beban kerja, progres pengerjaan, dan pengingat tiket tertunda.</p>
          </div>

          {isAdminOrOwner && totalStaleCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={sendAllStaleReminders}
              disabled={sendingAllReminders}
              className="gap-2 shrink-0"
            >
              <Bell className="h-4 w-4" />
              {sendingAllReminders ? "Mengirim Notifikasi..." : `⚡ Ingatkan Semua Teknisi (${totalStaleCount} Tiket Terlambat)`}
            </Button>
          )}
        </div>

        {/* Technician list - clickable */}
        <div className="space-y-2">
          {techData.map((tech) => {
            const techStaleCount = tech.tickets.filter(
              (t) => Date.now() - new Date(t.updated_at).getTime() > 24 * 60 * 60 * 1000
            ).length;

            return (
              <Card
                key={tech.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedTech(tech)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-full bg-muted text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{tech.full_name}</p>
                      {tech.username && <span className="text-xs text-muted-foreground">@{tech.username}</span>}
                      {techStaleCount > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          ⚠️ {techStaleCount} Terlambat &gt;24j
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {tech.tickets.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Tidak ada tiket aktif</span>
                      ) : (
                        <>
                          {Object.entries(
                            tech.tickets.reduce((acc: Record<string, number>, t: any) => {
                              acc[t.status] = (acc[t.status] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([status, count]) => (
                            <Badge key={status} variant="outline" className="text-xs gap-1">
                              {status} <span className="font-bold">{count as number}</span>
                            </Badge>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={tech.tickets.length > 5 ? "destructive" : "secondary"} className="text-lg px-3">
                      {tech.tickets.length}
                    </Badge>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Unassigned */}
        {unassigned.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Tiket Belum Ditugaskan
                <Badge variant="outline" className="ml-auto">{unassigned.length} tiket</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {unassigned.map((o: any) => (
                  <div
                    key={o.id}
                    className="flex justify-between items-center p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/dashboard/orders/${o.ticket_number}`)}
                  >
                    <div>
                      <p className="font-medium text-sm">{o.ticket_number}</p>
                      <p className="text-xs text-muted-foreground">{o.customer_name} — {o.device_type} {o.device_brand} {o.device_model}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
