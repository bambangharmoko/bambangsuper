import { useEffect, useState } from "react";
import { shouldShowOpenInAppBanner, openInPWA, dismissRedirectBanner } from "@/utils/pwa-redirect";
import { AppLogo } from "./AppLogo";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * PWA Banner (Non-intrusive)
 * ─────────────────────────
 * Menampilkan banner kecil yang tidak mengganggu jika user membuka web di browser 
 * padahal PWA sudah terinstall di perangkatnya.
 * TIDAK melakukan auto-redirect atau reload paksa.
 */
export function OpenInAppBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    shouldShowOpenInAppBanner().then((shouldShow) => {
      if (cancelled || !shouldShow) return;
      setShow(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <aside
      aria-label="Buka di Aplikasi"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-bottom duration-300 pointer-events-auto"
    >
      <div className="bg-card/95 backdrop-blur-md border border-primary/20 shadow-2xl rounded-2xl p-3.5 flex items-center justify-between gap-3 text-card-foreground">
        <div className="flex items-center gap-3 min-w-0">
          <AppLogo className="w-10 h-10 rounded-xl shadow-md shrink-0 bg-primary/10 p-1" />
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-foreground truncate">
              Buka di Aplikasi SUMTRA
            </h4>
            <p className="text-[11px] text-muted-foreground truncate">
              Akses lebih cepat, stabil, dan notifikasi real-time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={() => {
              openInPWA();
            }}
            className="h-8 px-3 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shadow-sm"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Buka</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              dismissRedirectBanner();
              setShow(false);
            }}
            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
            title="Tutup banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

