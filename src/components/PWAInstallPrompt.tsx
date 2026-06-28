import { useEffect, useState } from "react";
import { X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Jangan tampilkan panduan iOS jika sudah diinstall
    if (isInStandaloneMode()) return;

    // iOS: tampilkan guide manual karena Safari tidak punya prompt install otomatis
    if (isIOS() && !isInStandaloneMode()) {
      // Tunda 3 detik agar tidak langsung muncul saat halaman load
      const t = setTimeout(() => setShowIOSGuide(true), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  const handleDismiss = () => {
    setShowIOSGuide(false);
  };

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
