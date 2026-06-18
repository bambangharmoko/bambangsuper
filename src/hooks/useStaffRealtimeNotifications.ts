import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { onForegroundMessage, registerSwAndGetToken, showForegroundNotification } from "@/lib/firebase";

type OrderRow = {
  id: string;
  ticket_number: string;
  device_brand: string;
  device_model: string;
  status: string;
  assigned_technician: string | null;
};

type ProfileMap = Record<string, { full_name: string | null; role: string | null }>;
type RealtimePayload<T> = { eventType: "INSERT" | "UPDATE" | "DELETE"; new: T };
type ServiceUpdateRow = { id: string; order_id: string; status: string; updated_by: string };
type InternalNoteRow = { id: string; order_id: string; user_id: string; created_at: string; updated_at?: string | null };

const STAFF_NOTIFICATION_PROMPT_KEY = "staff-notifications-permission-prompted";

const isInIframe = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const canUseNotifications = () =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator &&
  !isInIframe();

const actorLabel = (actorId: string | null | undefined, profiles: ProfileMap, currentUserId?: string) => {
  if (!actorId) return "Sistem";
  if (actorId === currentUserId) return "Anda";
  const profile = profiles[actorId];
  if (!profile) return "Staff";
  if (profile.role === "admin") return "Admin";
  if (profile.role === "owner") return "Owner";
  return profile.full_name || "Teknisi";
};

const notify = async (title: string, body: string, orderId: string, ticketNumber: string) => {
  toast(title, { description: body });

  if (!canUseNotifications() || Notification.permission !== "granted") return;
  await showForegroundNotification(title, body, { order_id: orderId, url: `/dashboard/orders/${ticketNumber}` });
};

export function useStaffRealtimeNotifications() {
  const { user, roles, loading, isApproved } = useAuth();
  const lastSeenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (loading || !user || !isApproved) return;
    if (!canUseNotifications()) return;

    const requestOnce = async () => {
      if (Notification.permission !== "default") return;
      if (localStorage.getItem(STAFF_NOTIFICATION_PROMPT_KEY) === user.id) return;
      localStorage.setItem(STAFF_NOTIFICATION_PROMPT_KEY, user.id);
      const permission = await Notification.requestPermission();
      if (permission === "granted") await registerStaffPushToken();
    };

    const registerStaffPushToken = async () => {
      if (Notification.permission !== "granted") return;
      const fcmToken = await registerSwAndGetToken();
      if (!fcmToken) return;
      const { data, error } = await supabase.functions.invoke("subscribe-staff-push-token", {
        body: { fcm_token: fcmToken, user_agent: navigator.userAgent },
      });
      if (error || data?.error) throw error || new Error(data.error);
    };

    requestOnce().catch((error) => console.warn("Notification permission request failed", error));
    registerStaffPushToken().catch((error) => console.warn("Staff push token registration failed", error));
    const unsubscribe = onForegroundMessage((payload: any) => {
      const title = payload?.notification?.title || payload?.data?.title || "Update Tiket";
      const body = payload?.notification?.body || payload?.data?.body || "";
      window.dispatchEvent(new Event("staff-data-refresh"));
      toast(title, { description: body });
      const data = {
        ...(payload?.data || {}),
        url: payload?.data?.url || (payload?.data?.order_id ? `/dashboard/orders/${payload.data.ticket_number || payload.data.order_id}` : "/dashboard"),
      };
      showForegroundNotification(title, body, data).catch((error) => console.warn("Foreground staff notification failed", error));
    });
    return () => unsubscribe?.();
  }, [isApproved, loading, user]);

  useEffect(() => {
    if (loading || !user || !isApproved || roles.length === 0) return;

    const isAdminOrOwner = roles.includes("admin") || roles.includes("owner");
    const isTechnicianOnly = roles.includes("technician") && !isAdminOrOwner;

    const getOrders = async (ids: string[]) => {
      const uniqueIds = [...new Set(ids.filter(Boolean))];
      if (uniqueIds.length === 0) return {} as Record<string, OrderRow>;
      let query = supabase
        .from("service_orders")
        .select("id, ticket_number, device_brand, device_model, status, assigned_technician")
        .in("id", uniqueIds);
      if (isTechnicianOnly) query = query.eq("assigned_technician", user.id);
      const { data, error } = await query;
      if (error) throw error;
      return Object.fromEntries((data || []).map((order) => [order.id, order as OrderRow]));
    };

    const getProfiles = async (userIds: string[]) => {
      const ids = [...new Set(userIds.filter(Boolean))];
      if (ids.length === 0) return {} as ProfileMap;
      const { data, error } = await supabase.rpc("get_staff_identities", { _user_ids: ids });
      if (error) throw error;
      return Object.fromEntries(
        (data || []).map((item) => [item.user_id, { full_name: item.full_name, role: item.role }])
      ) as ProfileMap;
    };

    const handleStatusUpdate = async (payload: RealtimePayload<ServiceUpdateRow>) => {
      if (payload.eventType !== "INSERT") return;
      const eventKey = `status:${payload.new.id}`;
      if (lastSeenRef.current.has(eventKey)) return;
      lastSeenRef.current.add(eventKey);

      const update = payload.new;
      if (update.updated_by === user.id) return;
      const orders = await getOrders([update.order_id]);
      const order = orders[update.order_id];
      if (!order) return;
      const profiles = await getProfiles([update.updated_by]);
      const actor = actorLabel(update.updated_by, profiles, user.id);
      const actorRole = profiles[update.updated_by]?.role;

      if (isAdminOrOwner) {
        if (actorRole !== "technician") return;
        const body = `Tiket ${order.ticket_number} (${order.device_brand} ${order.device_model}): ${actor} mengubah status menjadi ${update.status}.`;
        await notify("Update Status Tiket", body, order.id, order.ticket_number);
        return;
      }

      if (isTechnicianOnly) {
        if (actorRole && actorRole !== "admin" && actorRole !== "owner") return;
        const body = `${actor} mengubah status tiket ${order.ticket_number} (Tugas Anda) menjadi ${update.status}.`;
        await notify("Update Tugas Anda", body, order.id, order.ticket_number);
      }
    };

    const handleInternalNote = async (payload: RealtimePayload<InternalNoteRow>) => {
      if (!payload.new || payload.new.user_id === user.id) return;
      const eventKey = `note:${payload.eventType}:${payload.new.id}:${payload.new.updated_at || payload.new.created_at}`;
      if (lastSeenRef.current.has(eventKey)) return;
      lastSeenRef.current.add(eventKey);

      const note = payload.new;
      const orders = await getOrders([note.order_id]);
      const order = orders[note.order_id];
      if (!order) return;
      const profiles = await getProfiles([note.user_id]);
      const actor = actorLabel(note.user_id, profiles, user.id);
      const actorRole = profiles[note.user_id]?.role;
      if (isAdminOrOwner && actorRole !== "technician") return;
      if (isTechnicianOnly && actorRole !== "admin" && actorRole !== "owner") return;
      const action = payload.eventType === "UPDATE" ? "memperbarui memo" : "menambahkan memo";
      const body = isAdminOrOwner
        ? `Tiket ${order.ticket_number} (${order.device_brand} ${order.device_model}): ${actor} ${action}.`
        : `${actor} ${action} pada tiket ${order.ticket_number} (Tugas Anda).`;
      await notify("Update Memo Tiket", body, order.id, order.ticket_number);
    };

    let disposed = false;
    let retryId: number | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const connect = () => {
      if (disposed) return;
      if (retryId) window.clearTimeout(retryId);
      if (channel) supabase.removeChannel(channel);

      channel = supabase
        .channel(`staff-push-${user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "service_updates" }, (payload) => {
          window.dispatchEvent(new Event("staff-data-refresh"));
          handleStatusUpdate(payload as unknown as RealtimePayload<ServiceUpdateRow>).catch((error) => console.error("Status notification failed", error));
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "internal_notes" }, (payload) => {
          window.dispatchEvent(new Event("staff-data-refresh"));
          handleInternalNote(payload as unknown as RealtimePayload<InternalNoteRow>).catch((error) => console.error("Note notification failed", error));
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "internal_notes" }, (payload) => {
          window.dispatchEvent(new Event("staff-data-refresh"));
          handleInternalNote(payload as unknown as RealtimePayload<InternalNoteRow>).catch((error) => console.error("Note notification failed", error));
        });

      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (!disposed) retryId = window.setTimeout(connect, 3000);
        }
      });
    };

    const handleFocus = () => connect();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") connect();
    };

    connect();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      if (retryId) window.clearTimeout(retryId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channel) supabase.removeChannel(channel);
    };
  }, [isApproved, loading, roles, user]);
}