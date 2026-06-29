import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  shouldShowOpenInAppBanner,
  dismissRedirectBanner,
  openInPWA,
} from "@/utils/pwa-redirect";

/**
 * Banner "Buka di Aplikasi"
 * ─────────────────────────
 * Muncul di bagian atas halaman ketika:
 * 1. User membuka situs di browser biasa (bukan PWA)
 * 2. PWA sudah terinstall di perangkat
 *
 * Mirip dengan OLX yang menampilkan smart banner di atas halaman.
 */
export function OpenInAppBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    shouldShowOpenInAppBanner().then((shouldShow) => {
      if (!cancelled) setShow(shouldShow);
    });
    return () => { cancelled = true; };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] animate-in slide-in-from-top duration-300">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          {/* App Icon */}
          <img
            src="/superkomputer.png"
            alt="Super Komputer"
            className="w-8 h-8 rounded-lg object-cover bg-white shrink-0"
          />

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Super Komputer</p>
            <p className="text-[11px] text-white/70 leading-tight">
              Buka di aplikasi untuk pengalaman lebih baik
            </p>
          </div>

          {/* Open Button */}
          <Button
            size="sm"
            onClick={openInPWA}
            className="shrink-0 h-8 px-4 rounded-full bg-white text-blue-600 hover:bg-white/90 font-semibold text-xs shadow-md"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Buka
          </Button>

          {/* Close Button */}
          <button
            onClick={() => {
              dismissRedirectBanner();
              setShow(false);
            }}
            className="shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
