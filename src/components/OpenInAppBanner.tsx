import { useEffect, useState, useRef } from "react";
import { shouldShowOpenInAppBanner, openInPWA, dismissRedirectBanner } from "@/utils/pwa-redirect";

/**
 * PWA Auto Redirect & Banner
 * ─────────────────────────
 * Otomatis redirect ke PWA (jika sudah terinstall) saat user 
 * membuka web via browser.
 */
export function OpenInAppBanner() {
  const [show, setShow] = useState(false);
  const [autoRedirecting, setAutoRedirecting] = useState(false);
  const hasAttemptedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    shouldShowOpenInAppBanner().then((shouldShow) => {
      if (cancelled || !shouldShow) return;
      
      setShow(true);

      // Jika ini pertama kali mount, coba lakukan auto-redirect langsung (mirip OLX)
      if (!hasAttemptedRef.current) {
        hasAttemptedRef.current = true;
        setAutoRedirecting(true);
        
        const tryRedirect = () => {
          openInPWA();
          // Hapus event listener jika berhasil dipanggil via gesture
          window.removeEventListener('touchstart', tryRedirect);
          window.removeEventListener('click', tryRedirect);
        };
        
        // 1. Coba panggil otomatis (terkadang berhasil di beberapa versi OS/Browser)
        setTimeout(() => {
          tryRedirect();
          
          // 2. Jika redirect otomatis gagal (karena browser butuh User Gesture):
          // Kita pasang penjebak (interceptor). Saat user pertama kali 
          // menyentuh layar (misal niatnya scroll), kita langsung trigger PWA-nya!
          window.addEventListener('touchstart', tryRedirect, { once: true, capture: true });
          window.addEventListener('click', tryRedirect, { once: true, capture: true });
          
          // 3. Jika setelah 3.5 detik user sama sekali tidak menyentuh layar,
          // barulah kita tampilkan tombol fallback secara manual.
          setTimeout(() => {
            if (!cancelled) setAutoRedirecting(false);
          }, 3500);
        }, 300);
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (!show) return null;

  // Jika sedang proses redirect otomatis, tampilkan layar interstitial
  if (autoRedirecting) {
    return (
      <div className="fixed inset-0 z-[99999] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold text-foreground">Membuka Aplikasi...</h2>
        <p className="text-sm text-muted-foreground mt-2 text-center max-w-[250px]">
          Anda sedang dialihkan ke SUMTRA.
        </p>
      </div>
    );
  }

  // Fallback: Jika auto-redirect gagal (dilarang browser dsb), tampilkan tombol
  return (
    <div className="fixed inset-0 z-[99999] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
      <img src="/superkomputer.png" alt="SUMTRA" className="w-20 h-20 rounded-2xl mb-6 shadow-xl" />
      <div className="space-y-2 mb-8">
        <h2 className="text-xl font-bold text-foreground">Buka di Aplikasi</h2>
        <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
          Lanjutkan di aplikasi SUMTRA untuk pengalaman yang lebih cepat dan nyaman.
        </p>
      </div>
      
      <div className="flex flex-col gap-3 w-full max-w-[280px]">
        <button
          onClick={openInPWA}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg active:scale-95 transition-transform"
        >
          Buka Sekarang
        </button>
        <button
          onClick={() => {
            dismissRedirectBanner();
            setShow(false);
          }}
          className="w-full h-12 rounded-xl bg-secondary text-secondary-foreground font-semibold active:scale-95 transition-transform"
        >
          Lanjutkan di Browser
        </button>
      </div>
    </div>
  );
}
