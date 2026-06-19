import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Bell, Eye } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StaleOrder {
  id: string;
  ticket_number: string;
  customer_name: string;
  status: string;
  updated_at: string;
  assigned_technician: string | null;
  technician_name?: string;
}

export function StaleTicketsAlert() {
  const [open, setOpen] = useState(false);
  const [staleOrders, setStaleOrders] = useState<StaleOrder[]>([]);
  const [sending, setSending] = useState<Set<string>>(new Set());
  const { hasRole, user } = useAuth();
  const navigate = useNavigate();

  const isAdminOrOwner = hasRole("admin") || hasRole("owner");

  useEffect(() => {
    if (!isAdminOrOwner) return;

    const checkStaleTickets = async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const activeStatuses = ["Diterima", "Diagnosa", "Menunggu Konfirmasi", "Pending", "Perbaikan"] as const;

      const { data: orders } = await supabase
        .from("service_orders")
        .select("id, ticket_number, customer_name, status, updated_at, assigned_technician")
        .is("deleted_at", null)
        .in("status", activeStatuses)
        .lt("updated_at", oneDayAgo);

      if (!orders || orders.length === 0) return;

      // Get technician names
      const techIds = [...new Set(orders.filter(o => o.assigned_technician).map(o => o.assigned_technician!))];
      let techMap: Record<string, string> = {};
      if (techIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", techIds);
        if (profiles) {
          techMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name]));
        }
      }

      const enriched = orders.map(o => ({
        ...o,
        technician_name: o.assigned_technician ? techMap[o.assigned_technician] || "Tidak diketahui" : undefined,
      }));

      setStaleOrders(enriched);
      setOpen(true);
    };

    // Small delay to let dashboard render first
    const timer = setTimeout(checkStaleTickets, 1500);
    return () => clearTimeout(timer);
  }, [isAdminOrOwner]);

  const sendNotification = async (order: StaleOrder) => {
    if (!order.assigned_technician || !user) {
      toast.error("Tiket ini belum memiliki teknisi yang ditugaskan");
      return;
    }

    setSending(prev => new Set(prev).add(order.id));

    const { error } = await supabase.from("notifications").insert({
      user_id: order.assigned_technician,
      title: "⚠️ Pengingat Tiket",
      message: `Tiket ${order.ticket_number} (${order.customer_name}) belum diupdate lebih dari 24 jam. Mohon segera ditindaklanjuti.`,
      order_id: order.id,
    });

    setSending(prev => {
      const next = new Set(prev);
      next.delete(order.id);
      return next;
    });

    if (error) {
      toast.error("Gagal mengirim notifikasi");
    } else {
      toast.success(`Notifikasi terkirim ke ${order.technician_name}`);
      supabase.functions.invoke("notify-staff-update", {
        body: {
          order_id: order.id,
          updated_by: user.id,
          action: "stale_reminder",
        },
      }).catch((err) => console.error("Failed to send push notification reminder", err));
    }
  };

  if (!isAdminOrOwner || staleOrders.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Peringatan Tiket Tertunda
          </DialogTitle>
          <DialogDescription>
            {staleOrders.length} tiket belum diupdate lebih dari 24 jam.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3">
            {staleOrders.map((order) => {
              const diffMs = Date.now() - new Date(order.updated_at).getTime();
              const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
              const days = Math.floor(totalHours / 24);
              const remainingHours = totalHours % 24;

              let durationText = "";
              if (days > 0) {
                durationText += `${days} hari`;
                if (remainingHours > 0) {
                  durationText += ` ${remainingHours} jam`;
                }
              } else {
                durationText += `${remainingHours} jam`;
              }
              durationText += " lalu";

              return (
                <div key={order.id} className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm">{order.ticket_number}</p>
                      <p className="text-xs text-muted-foreground">{order.customer_name}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {order.technician_name
                        ? `Teknisi: ${order.technician_name}`
                        : "Belum ditugaskan"}
                    </span>
                    <span className="text-destructive font-medium">{durationText}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setOpen(false);
                        navigate(`/dashboard/orders/${order.ticket_number}`);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" /> Detail
                    </Button>
                    {order.assigned_technician && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        disabled={sending.has(order.id)}
                        onClick={() => sendNotification(order)}
                      >
                        <Bell className="h-3 w-3 mr-1" />
                        {sending.has(order.id) ? "Mengirim..." : "Kirim Notifikasi"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
