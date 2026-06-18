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
      if (!data?.apiKey || !data?.projectId || !data?.vapidKey) return null;
      cachedConfig = data as FirebaseConfig;
      return cachedConfig;
    } catch (e) {
      console.error("Failed to load Firebase config:", e);
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

const buildSwUrl = (config: FirebaseConfig) => {
  const swParams = new URLSearchParams({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });
  return `/firebase-messaging-sw.js?${swParams.toString()}`;
};

export const getMessagingRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isMessagingSupported()) return null;

  const init = await initFirebase();
  if (!init) return null;
  const { config } = init;

  if (!registrationPromise) {
    registrationPromise = withTimeout(
      navigator.serviceWorker.register(buildSwUrl(config), {
        scope: "/firebase-cloud-messaging",
        updateViaCache: "none",
      }),
      12000,
      "Registrasi service worker notifikasi terlalu lama. Coba refresh halaman."
    ).then(async (registration) => {
      await registration.update().catch(() => undefined);
      return registration;
    });
  }

  const registration = await registrationPromise;

  await withTimeout(
    navigator.serviceWorker.ready,
    12000,
    "Service worker notifikasi belum siap. Coba refresh halaman."
  );

  return registration;
};

export const registerSwAndGetToken = async (): Promise<string | null> => {
  const init = await initFirebase();
  if (!init) return null;
  const { app: firebaseApp, config } = init;
  const registration = await getMessagingRegistration();
  if (!registration) return null;

  if (!messaging) messaging = getMessaging(firebaseApp);

  const token = await withTimeout(
    getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    }),
    15000,
    "Gagal mendapatkan token notifikasi. Pastikan izin notifikasi aktif lalu coba lagi."
  );
  return token || null;
};

export const showForegroundNotification = async (title: string, body: string, data: Record<string, string> = {}) => {
  if (!isMessagingSupported() || Notification.permission !== "granted") return;
  const registration = await getMessagingRegistration();
  if (!registration) return;

  await registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.order_id ? `staff-ticket-${data.order_id}` : data.ticket_number || "service-update",
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
    })
    .catch((error) => console.warn("Foreground FCM listener failed:", error));

  return () => {
    active = false;
    unsubscribe?.();
  };
};
