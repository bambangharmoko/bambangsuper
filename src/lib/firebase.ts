import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
}

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let cachedConfig: FirebaseConfig | null = null;
let configPromise: Promise<FirebaseConfig | null> | null = null;
// registrationPromise sekarang selalu menggunakan Workbox SW (sw.js) yang sudah aktif.
// Tidak perlu mendaftarkan firebase-messaging-sw.js terpisah.
let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

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

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

export const isMessagingSupported = () =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator &&
  !isInIframe;

const fetchConfig = async (): Promise<FirebaseConfig | null> => {
  if (cachedConfig) return cachedConfig;
  if (configPromise) return configPromise;

  configPromise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-firebase-config");
      if (error) throw error;
      if (!data?.apiKey || !data?.projectId || !data?.vapidKey) {
        console.error("[Firebase] Config tidak lengkap dari server:", data);
        return null;
      }
      cachedConfig = data as FirebaseConfig;
      return cachedConfig;
    } catch (e) {
      console.error("[Firebase] Gagal load config:", e);
      configPromise = null; // Reset agar bisa retry
      return null;
    }
  })();

  return configPromise;
};

const initFirebase = async (): Promise<{ app: FirebaseApp; config: FirebaseConfig } | null> => {
  const config = await fetchConfig();
  if (!config) return null;
  if (!app) {
    app = getApps().length
      ? getApps()[0]
      : initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      });
  }
  return { app, config };
};

/**
 * Dapatkan Service Worker Registration yang aktif pada scope "/".
 * 
 * Strategi: Gunakan Workbox SW (sw.js) yang sudah terdaftar sebagai SW utama.
 * Firebase SDK akan menggunakan SW ini untuk FCM token binding.
 * Ini memastikan hanya 1 SW aktif dan push notification berfungsi di semua kondisi.
 */
export const getMessagingRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isMessagingSupported()) return null;

  const init = await initFirebase();
  if (!init) return null;

  if (!registrationPromise) {
    registrationPromise = (async () => {
      try {
        // Tunggu navigator.serviceWorker.ready — ini mengembalikan SW aktif pada scope "/"
        // yang merupakan Workbox SW (sw.js) yang sudah didaftarkan di main.tsx.
        const registration = await withTimeout(
          navigator.serviceWorker.ready,
          15000,
          "Service Worker tidak siap dalam 15 detik. Coba refresh halaman."
        );

        // Pastikan SW adalah yang kita harapkan (scope "/")
        if (registration.scope !== `${self.location.origin}/`) {
          console.warn(
            "[Firebase] SW scope tidak sesuai:",
            registration.scope,
            "— diharapkan:",
            `${self.location.origin}/`
          );
        }

        console.info("[Firebase] Menggunakan SW registration:", registration.scope);

        // Update SW jika ada versi baru
        await registration.update().catch((err) =>
          console.warn("[Firebase] SW update check failed:", err)
        );

        return registration;
      } catch (err) {
        console.error("[Firebase] Gagal mendapatkan SW registration:", err);
        registrationPromise = null; // Reset agar bisa retry
        throw err;
      }
    })();
  }

  try {
    return await registrationPromise;
  } catch {
    registrationPromise = null;
    return null;
  }
};

export const registerSwAndGetToken = async (): Promise<string | null> => {
  const init = await initFirebase();
  if (!init) {
    console.error("[Firebase] Firebase tidak terinisialisasi — tidak bisa mendapatkan token");
    return null;
  }
  const { app: firebaseApp, config } = init;

  if (!messaging) messaging = getMessaging(firebaseApp);

  const registration = await getMessagingRegistration();
  if (!registration) {
    console.error("[Firebase] Tidak ada SW registration — push notification tidak akan berfungsi");
    return null;
  }

  try {
    const token = await withTimeout(
      getToken(messaging, {
        vapidKey: config.vapidKey,
        serviceWorkerRegistration: registration,
      }),
      15000,
      "Gagal mendapatkan token notifikasi. Pastikan izin notifikasi aktif lalu coba lagi."
    );

    if (!token) {
      console.warn("[Firebase] getToken() mengembalikan token kosong. Permission:", Notification.permission);
      return null;
    }

    console.info("[Firebase] FCM token berhasil didapat:", token.substring(0, 20) + "...");
    return token;
  } catch (err) {
    console.error("[Firebase] getToken() gagal:", err);
    return null;
  }
};

export const showForegroundNotification = async (title: string, body: string, data: Record<string, string> = {}) => {
  if (!isMessagingSupported() || Notification.permission !== "granted") return;
  const registration = await getMessagingRegistration();
  if (!registration) return;

  const tag = data.order_id
    ? `staff-ticket-${data.order_id}`
    : data.ticket_number || "service-update";

  await registration.showNotification(title, {
    body,
    icon: "/superkomputer.png",
    badge: "/superkomputer.png",
    tag,
    data,
    requireInteraction: true,
  });
};

export const onForegroundMessage = (cb: (payload: unknown) => void) => {
  let active = true;
  let unsubscribe: (() => void) | undefined;

  initFirebase()
    .then((init) => {
      if (!active || !init) return;
      if (!messaging) messaging = getMessaging(init.app);
      unsubscribe = onMessage(messaging, cb);
      console.info("[Firebase] Foreground message listener aktif.");
    })
    .catch((error) => console.warn("[Firebase] Foreground FCM listener gagal:", error));

  return () => {
    active = false;
    unsubscribe?.();
  };
};
