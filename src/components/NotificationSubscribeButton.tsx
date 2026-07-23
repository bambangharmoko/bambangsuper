import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { registerSwAndGetToken, isMessagingSupported, onForegroundMessage } from "@/lib/firebase";

interface Props {
  ticketNumber: string;
}

type SubState = "idle" | "subscribing" | "subscribed" | "denied" | "unsupported";

const storageKey = (t: string) => `push-sub:${t}`;

const withTimeout = async <T,>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
};

export const NotificationSubscribeButton = ({ ticketNumber }: Props) => {
  const [state, setState] = useState<SubState>("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMessagingSupported()) {
      // Fallback: cek browser-level only
      if (!("Notification" in window)) {
        setState("unsupported");
        return;
      }
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setState("denied");
      return;
    }
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      localStorage.getItem(storageKey(ticketNumber))
    ) {
      setState("subscribed");
    }
  }, [ticketNumber]);

  // Tampilkan toast saat ada pesan masuk di foreground
  useEffect(() => {
    if (state !== "subscribed") return;
    const unsub = onForegroundMessage((payload: any) => {
      const title = payload?.notification?.title || payload?.data?.title || "Update Tiket";
      const body = payload?.notification?.body || payload?.data?.body || "";
      toast({ title, description: body });
    });
    return () => {
      try {
        unsub?.();
      } catch {
        /* ignore */
      }
    };
  }, [state]);

  const handleSubscribe = async () => {
    if (!("Notification" in window)) {
      toast({
        title: "Browser tidak mendukung",
        description: "Browser Anda tidak mendukung notifikasi push. Coba Chrome/Edge/Firefox versi terbaru.",
        variant: "destructive",
      });
      return;
    }

    try {
      setState("subscribing");
      const permission = await Notification.requestPermission();

      if (permission === "denied") {
        setState("denied");
        toast({
          title: "Izin Ditolak",
          description: "Anda menolak izin notifikasi. Aktifkan manual di pengaturan browser untuk situs ini.",
          variant: "destructive",
        });
        return;
      }

      if (permission !== "granted") {
        setState("idle");
        return;
      }

      let fcmToken: string | null = null;
      if (isMessagingSupported()) {
        fcmToken = await withTimeout(
          registerSwAndGetToken(),
          20000,
          "Permintaan token notifikasi terlalu lama. Coba refresh halaman lalu ulangi."
        );
      }

      if (!fcmToken) {
        toast({
          title: "Token FCM gagal dibuat",
          description: "Push notification belum aktif di perangkat ini. Pastikan situs sudah published dan izin notifikasi aktif.",
          variant: "destructive",
        });
        setState("idle");
        return;
      }

      const { data, error } = await withTimeout(
        supabase.functions.invoke("subscribe-push-token", {
          body: {
            ticket_number: ticketNumber,
            fcm_token: fcmToken,
            user_agent: navigator.userAgent,
          },
        }),
        15000,
        "Menyimpan token notifikasi terlalu lama. Coba lagi."
      );

      if (error || data?.error) {
        console.error("Failed to save FCM token:", error || data?.error);
        toast({
          title: "Gagal Menyimpan",
          description: data?.error || "Token notifikasi tidak dapat disimpan. Coba lagi.",
          variant: "destructive",
        });
        setState("idle");
        return;
      }

      localStorage.setItem(
        storageKey(ticketNumber),
        JSON.stringify({
          ticket: ticketNumber,
          subscribedAt: new Date().toISOString(),
          hasToken: !!fcmToken,
        })
      );
      setState("subscribed");

      toast({
        title: "Notifikasi Aktif ✅",
        description: `Anda akan menerima push notification untuk tiket ${ticketNumber}.`,
      });
    } catch (err) {
      console.error("Subscribe error:", err);
      setState("idle");
      toast({
        title: "Gagal Mengaktifkan",
        description: err instanceof Error ? err.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    }
  };

  const handleUnsubscribe = async () => {
    const stored = localStorage.getItem(storageKey(ticketNumber));
    localStorage.removeItem(storageKey(ticketNumber));
    setState("idle");

    // Soft-disable di DB
    if (stored) {
      try {
        // Kita tidak menyimpan token di localStorage (privacy), jadi disable semua untuk ticket ini dari device ini
        // Pendekatan sederhana: panggil getToken lagi untuk dapat token current device, lalu disable
        if (isMessagingSupported()) {
          const token = await registerSwAndGetToken().catch(() => null);
          if (token) {
            await supabase.functions.invoke("subscribe-push-token", {
              body: {
                ticket_number: ticketNumber,
                fcm_token: token,
                action: "unsubscribe",
              },
            });
          }
        }
      } catch (e) {
        console.warn("Unsubscribe DB cleanup failed:", e);
      }
    }

    toast({
      title: "Notifikasi Dimatikan",
      description: "Anda tidak akan menerima update untuk tiket ini.",
    });
  };

  if (state === "subscribed") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleUnsubscribe}
        className="gap-2 border-success text-success hover:bg-success/10 hover:text-success"
      >
        <BellRing className="h-4 w-4" />
        Notifikasi Aktif
      </Button>
    );
  }

  if (state === "denied") {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <BellOff className="h-4 w-4" />
        Izin Diblokir
      </Button>
    );
  }

  if (state === "unsupported") {
    return (
      <Button variant="secondary" size="sm" disabled className="gap-2 opacity-70">
        <BellOff className="h-4 w-4" />
        Tidak Didukung di Browser Ini
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleSubscribe}
      disabled={state === "subscribing"}
      className="gap-2 font-medium"
    >
      {state === "subscribing" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Mengaktifkan...
        </>
      ) : (
        <>
          <Bell className="h-4 w-4" />
          Dapatkan Notifikasi
        </>
      )}
    </Button>
  );
};
