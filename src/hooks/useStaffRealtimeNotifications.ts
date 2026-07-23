import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { onForegroundMessage, registerSwAndGetToken, showForegroundNotification } from "@/lib/firebase";

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

export function useStaffRealtimeNotifications() {
  const { user, roles, loading, isApproved } = useAuth();
  // Simpan timestamp terakhir registrasi token untuk rate-limit re-registration
  const lastTokenRegRef = useRef<number>(0);

  useEffect(() => {
    if (loading || !user || !isApproved) return;
    if (!canUseNotifications()) return;

    const registerStaffPushToken = async () => {
      if (Notification.permission !== "granted") return;
      // Rate limit: jangan re-register lebih dari sekali per 30 menit
      const now = Date.now();
      if (now - lastTokenRegRef.current < 30 * 60 * 1000) return;
      lastTokenRegRef.current = now;

      try {
        const fcmToken = await registerSwAndGetToken();
        if (!fcmToken) {
          console.warn("[Staff-SW] FCM token kosong - push notification tidak akan berfungsi");
          return;
        }
        const { data, error } = await supabase.functions.invoke("subscribe-staff-push-token", {
          body: { fcm_token: fcmToken, user_agent: navigator.userAgent },
        });
        if (error || data?.error) {
          throw error || new Error(data.error);
        }
        console.info("[Staff-SW] Push token berhasil didaftarkan.");
      } catch (err) {
        console.error("[Staff-SW] Gagal mendaftarkan push token:", err);
        // Reset rate limit agar bisa retry lebih cepat jika gagal
        lastTokenRegRef.current = 0;
        throw err;
      }
    };

    const requestOnce = async () => {
      if (Notification.permission !== "default") return;
      if (localStorage.getItem(STAFF_NOTIFICATION_PROMPT_KEY) === user.id) return;
      localStorage.setItem(STAFF_NOTIFICATION_PROMPT_KEY, user.id);
      const permission = await Notification.requestPermission();
      if (permission === "granted") await registerStaffPushToken();
    };

    requestOnce().catch((error) => console.warn("[Staff-SW] Permission request gagal:", error));

    registerStaffPushToken().catch((error) => console.warn("[Staff-SW] Push token registration gagal:", error));

    // Re-register token saat app kembali aktif (untuk handle token refresh FCM)
    const handleFocusRegister = () => {
      registerStaffPushToken().catch(() => {/* silent */});
    };
    const handleVisibilityRegister = () => {
      if (document.visibilityState === "visible") {
        registerStaffPushToken().catch(() => {/* silent */});
      }
    };

    const unsubscribeFCM = onForegroundMessage((payload: any) => {
      const title = payload?.notification?.title || payload?.data?.title || "Update Tiket";
      const body = payload?.notification?.body || payload?.data?.body || "";
      window.dispatchEvent(new Event("staff-data-refresh"));
      toast(title, { description: body });
      const data = {
        ...(payload?.data || {}),
        url: payload?.data?.url || (payload?.data?.order_id
          ? `/dashboard/orders/${payload.data.ticket_number || payload.data.order_id}`
          : "/dashboard"),
      };
      showForegroundNotification(title, body, data).catch((error) =>
        console.warn("[Staff-SW] Foreground notification gagal:", error)
      );
    });

    window.addEventListener("focus", handleFocusRegister);
    document.addEventListener("visibilitychange", handleVisibilityRegister);

    return () => {
      unsubscribeFCM?.();
      window.removeEventListener("focus", handleFocusRegister);
      document.removeEventListener("visibilitychange", handleVisibilityRegister);
    };
  }, [isApproved, loading, user]);

  useEffect(() => {
    if (loading || !user || !isApproved || roles.length === 0) return;

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
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "internal_notes" }, (payload) => {
          window.dispatchEvent(new Event("staff-data-refresh"));
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "internal_notes" }, (payload) => {
          window.dispatchEvent(new Event("staff-data-refresh"));
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