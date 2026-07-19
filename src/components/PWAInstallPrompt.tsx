import { useCallback, useEffect, useRef, useState } from "react";
import { Download, X, Share, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLogo } from "./AppLogo";

// ── Helpers ──────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function wasDismissedRecently(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  return Date.now() - Number(raw) < DISMISS_DURATION_MS;
}

function markDismissed() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

// ── Komponen Utama ──────────────────────────────────────────────────────────

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);
  const listenerRef = useRef(false);

  // ── Android / Desktop: tangkap beforeinstallprompt ─────────────────────
  useEffect(() => {
    if (isInStandaloneMode() || wasDismissedRecently()) return;
    if (listenerRef.current) return;
    listenerRef.current = true;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Sembunyikan jika user sudah install
    window.addEventListener("appinstalled", () => {
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  // ── iOS: tampilkan guide setelah delay ─────────────────────────────────
  useEffect(() => {
    if (isInStandaloneMode() || wasDismissedRecently()) return;
    if (!isIOS()) return;

    const t = setTimeout(() => setShowIOSGuide(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // ── Install handler ────────────────────────────────────────────────────
  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstalling(true);

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowBanner(false);
      }
    } catch {
      // Prompt already used or cancelled
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  // ── Dismiss handler ────────────────────────────────────────────────────
  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    setShowIOSGuide(false);
    markDismissed();
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  //  RENDER: Android / Desktop Install Bar
  // ═══════════════════════════════════════════════════════════════════════
  if (showBanner && deferredPrompt) {
    return (
      <div
        role="alert"
        className="fixed bottom-0 left-0 right-0 z-[9998] animate-in slide-in-from-bottom duration-400"
      >
        {/* Backdrop gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

        <div className="relative mx-auto max-w-lg px-4 pb-4 pt-2">
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Decorative top accent bar */}
            <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600" />

            <div className="p-4">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Content */}
              <div className="flex items-center gap-3.5">
                {/* App Icon */}
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-0.5 shadow-lg shadow-blue-500/25">
                    <AppLogo className="w-full h-full rounded-[14px] object-cover bg-white" />
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0 pr-6">
                  <p className="font-bold text-sm text-foreground leading-tight">
                    SUMTRA
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 max-w-[200px] sm:max-w-xs leading-tight">
                    Install aplikasi untuk pengalaman lebih cepat
                  </p>
                </div>
              </div>

              {/* Install Button */}
              <Button
                onClick={handleInstall}
                disabled={installing}
                className="w-full mt-3.5 h-11 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all duration-200 active:scale-[0.98]"
              >
                {installing ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Menginstall...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Install Aplikasi
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  RENDER: iOS Safari Guide
  // ═══════════════════════════════════════════════════════════════════════
  if (showIOSGuide) {
    return (
      <div
        role="alert"
        className="fixed bottom-0 left-0 right-0 z-[9998] animate-in slide-in-from-bottom duration-400"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

        <div className="relative mx-auto max-w-lg px-4 pb-4 pt-2">
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600" />

            <div className="p-4">
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3.5 mb-3">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-0.5 shadow-lg shadow-blue-500/25">
                    <AppLogo className="w-full h-full rounded-[14px] object-cover bg-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <p className="font-bold text-sm text-foreground leading-tight">
                    Install SUMTRA
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tambahkan ke Home Screen:
                  </p>
                </div>
              </div>

              <ol className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>
                    Tap ikon{" "}
                    <Share className="inline h-3.5 w-3.5 text-blue-500 -mt-0.5" />{" "}
                    <strong className="text-foreground">Bagikan</strong> di toolbar Safari
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>
                    Pilih{" "}
                    <strong className="text-foreground">"Tambahkan ke Layar Utama"</strong>
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>
                    Tap <strong className="text-foreground">"Tambahkan"</strong> di pojok kanan atas
                  </span>
                </li>
              </ol>

              {/* Arrow pointing down to Safari toolbar */}
              <div className="flex justify-center mt-3 animate-bounce">
                <ChevronUp className="h-5 w-5 text-blue-500 rotate-180" />
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="mt-2 w-full text-muted-foreground"
              >
                Nanti Saja
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
