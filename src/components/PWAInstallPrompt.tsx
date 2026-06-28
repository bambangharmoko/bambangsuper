import { useEffect, useState } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Jangan tampilkan jika sudah diinstall
    if (isInStandaloneMode()) return;

    // Android / Chrome Desktop: tangkap event beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault(); // Mencegah popup mini-infobar bawaan Chrome agar custom popup kita yang muncul
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS: tampilkan guide manual karena Safari tidak punya prompt install otomatis
    if (isIOS() && !isInStandaloneMode()) {
      // Tunda 3 detik agar tidak langsung muncul saat halaman load
      const t = setTimeout(() => setShowIOSGuide(true), 3000);
      return () => clearTimeout(t);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    // Hanya menyembunyikan untuk sesi ini saja, tidak disimpan ke localStorage
    // sehingga saat direfresh akan muncul lagi jika belum diinstall
    setShowPrompt(false);
    setShowIOSGuide(false);
  };

  // ── Android / Chrome / Desktop ─────────────────────────────────────────
  if (showPrompt && deferredPrompt) {
    return (
      <div
        role="alert"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm
                   bg-card border border-border shadow-2xl rounded-2xl p-4
                   animate-in slide-in-from-bottom-4 duration-300"
      >
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <img src="/superkomputer.png" alt="App icon" className="w-12 h-12 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">Install Super Komputer</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pasang di layar utama untuk akses cepat tanpa browser.
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <Button size="sm" className="flex-1 gradient-primary text-white" onClick={handleInstall}>
            <Download className="h-3 w-3 mr-1" /> Install Sekarang
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-muted-foreground">
            Nanti
          </Button>
        </div>
      </div>
    );
  }

  // ── iOS Safari Guide ───────────────────────────────────────────────────
  if (showIOSGuide) {
    return (
      <div
        role="alert"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm
                   bg-card border border-border shadow-2xl rounded-2xl p-4
                   animate-in slide-in-from-bottom-4 duration-300"
      >
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 mb-3">
          <img src="/superkomputer.png" alt="App icon" className="w-12 h-12 rounded-xl shrink-0" />
          <div>
            <p className="font-semibold text-sm text-foreground">Install di iPhone / iPad</p>
            <p className="text-xs text-muted-foreground mt-0.5">Tambahkan ke Home Screen:</p>
          </div>
        </div>

        <ol className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
            <span>Tap ikon <Share className="inline h-3 w-3 text-blue-500" /> <strong>Bagikan</strong> di toolbar Safari</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
            <span>Pilih <strong>"Tambahkan ke Layar Utama"</strong></span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
            <span>Tap <strong>"Tambahkan"</strong> di pojok kanan atas</span>
          </li>
        </ol>

        <Button size="sm" variant="ghost" onClick={handleDismiss} className="mt-3 w-full text-muted-foreground">
          Mengerti
        </Button>
      </div>
    );
  }

  return null;
}
