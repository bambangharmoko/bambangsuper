import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useReconnectableChannel } from "@/hooks/useReconnectableChannel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { useNavigate } from "react-router-dom";
import { User, Wrench, ChevronRight, ArrowLeft, ClipboardList, Clock, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const navigate = useNavigate();

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

    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedTech(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
            </Button>
            <h1 className="text-2xl font-bold">{selectedTech.full_name}</h1>
            {selectedTech.username && (
              <span className="text-sm text-muted-foreground">@{selectedTech.username}</span>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted text-primary">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{selectedTech.tickets.length}</p>
                  <p className="text-xs text-muted-foreground">Total Aktif</p>
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
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {selectedTech.tickets.filter((t) => ["Menunggu Sparepart", "Menunggu Persetujuan Pelanggan"].includes(t.status)).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Tertunda</p>
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
                {tickets.map((o: any) => (
                  <div
                    key={o.id}
                    className="p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/dashboard/orders/${o.ticket_number}`)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-sm">{o.ticket_number}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {o.customer_name} • {o.customer_phone}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                      <p>🔧 {o.device_type} {o.device_brand} {o.device_model} • {o.service_type}</p>
                      {(o.damage_description || o.unit_condition) && (
                        <p className="line-clamp-1">⚠️ {o.unit_condition}{o.damage_description ? ` — ${o.damage_description}` : ""}</p>
                      )}
                      <p className="text-muted-foreground/70">
                        Update terakhir: {new Date(o.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
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
        <h1 className="text-2xl font-bold">Status Pekerjaan & Tiket Teknisi</h1>

        {/* Technician list - clickable */}
        <div className="space-y-2">
          {techData.map((tech) => (
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
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{tech.full_name}</p>
                    {tech.username && <span className="text-xs text-muted-foreground">@{tech.username}</span>}
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
          ))}
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
