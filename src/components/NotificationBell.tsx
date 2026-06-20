import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useReconnectableChannel } from "@/hooks/useReconnectableChannel";
import { useNavigate } from "react-router-dom";
import { Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Notification {
  id: string;
  title: string;
  message: string;
  order_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setNotifications((data as Notification[]) || []);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const buildNotificationsChannel = useCallback(
    () => supabase
      .channel("my-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, fetchNotifications),
    [fetchNotifications],
  );

  useReconnectableChannel(!!user, buildNotificationsChannel, fetchNotifications);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
  };

  const deleteNotification = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success("Notifikasi dihapus");
    } catch (error) {
      console.error("Failed to delete notification", error);
      toast.error("Gagal menghapus notifikasi");
    }
  };

  const deleteAllNotifications = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
      setNotifications([]);
      toast.success("Semua notifikasi dihapus");
    } catch (error) {
      console.error("Failed to delete all notifications", error);
      toast.error("Gagal menghapus semua notifikasi");
    }
  };

  const handleClick = async (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.order_id) {
      setOpen(false);
      const { data } = await supabase
        .from("service_orders")
        .select("ticket_number")
        .eq("id", n.order_id)
        .single();
      if (data?.ticket_number) {
        navigate(`/dashboard/orders/${data.ticket_number}`);
      } else {
        navigate("/dashboard/orders");
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <p className="font-semibold text-sm">Notifikasi</p>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-auto py-1 px-2 text-muted-foreground hover:text-foreground" onClick={markAllRead}>
                Baca Semua
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-auto py-1 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={deleteAllNotifications}>
                Hapus Semua
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[300px]">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Tidak ada notifikasi</p>
          ) : (
            <div className="divide-y divide-border overflow-x-hidden">
              <AnimatePresence initial={false}>
                {notifications.map(n => (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <div className="relative overflow-hidden group">
                      {/* Swipe delete background indicator */}
                      <div className="absolute inset-y-0 right-0 w-24 bg-destructive flex items-center justify-center text-destructive-foreground pointer-events-none">
                        <div className="flex flex-col items-center gap-0.5">
                          <Trash2 className="h-4 w-4" />
                          <span className="text-[10px] font-medium">Hapus</span>
                        </div>
                      </div>
                      <motion.div
                        drag="x"
                        dragConstraints={{ left: -100, right: 0 }}
                        dragElastic={{ left: 0.5, right: 0.1 }}
                        onDragEnd={async (_, info) => {
                          if (info.offset.x < -60) {
                            await deleteNotification(n.id);
                          }
                        }}
                        className={`relative z-10 w-full p-3 cursor-pointer bg-background hover:bg-muted/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}
                        onClick={() => handleClick(n)}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{n.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(n.created_at).toLocaleString("id-ID")}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => deleteNotification(n.id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
