/**
 * PWA Redirect Utility
 * ─────────────────────
 * Mendeteksi apakah PWA sudah terinstall dan mengarahkan user dari browser
 * ke PWA jika memungkinkan. Menggunakan kombinasi:
 *
 * 1. `getInstalledRelatedApps()` API (Chrome 80+)
 * 2. `display-mode: standalone` detection
 * 3. `launch_handler` di manifest.json (Chrome 102+)
 *
 * Untuk browser yang tidak mendukung API di atas, tampilkan banner
 * "Buka di Aplikasi" agar user switch secara manual.
 */

const REDIRECT_DISMISSED_KEY = "pwa-redirect-dismissed-at";
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 hari

/** Cek apakah halaman sudah berjalan di dalam PWA (standalone) */
export function isRunningAsPWA(): boolean {
  // Check display-mode standalone
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari standalone
  if ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true) return true;
  return false;
}

/** Cek apakah user sudah dismiss banner redirect baru-baru ini */
function wasRedirectDismissed(): boolean {
  const raw = localStorage.getItem(REDIRECT_DISMISSED_KEY);
  if (!raw) return false;
  return Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
}

/** Tandai banner redirect sebagai dismissed */
export function dismissRedirectBanner(): void {
  localStorage.setItem(REDIRECT_DISMISSED_KEY, String(Date.now()));
}

/**
 * Cek apakah PWA terinstall menggunakan getInstalledRelatedApps API.
 * Returns true jika PWA sudah terinstall, false jika belum atau API tidak tersedia.
 */
export async function isPWAInstalled(): Promise<boolean> {
  try {
    // getInstalledRelatedApps() hanya tersedia di konteks aman (HTTPS)
    // dan pada browser yang mendukung (Chrome 80+, Edge 79+)
    if ("getInstalledRelatedApps" in navigator) {
      const relatedApps = await (navigator as any).getInstalledRelatedApps();
      return relatedApps.length > 0;
    }
  } catch {
    // API tidak tersedia atau gagal
  }
  return false;
}

/**
 * Evaluasi apakah perlu menampilkan banner "Buka di Aplikasi".
 * Returns true jika:
 * - User TIDAK sedang di PWA (standalone)
 * - PWA sudah terinstall
 * - Banner belum di-dismiss baru-baru ini
 */
export async function shouldShowOpenInAppBanner(): Promise<boolean> {
  // Jika sudah di dalam PWA, tidak perlu redirect
  if (isRunningAsPWA()) return false;

  // Jika user baru saja dismiss, jangan tampilkan
  if (wasRedirectDismissed()) return false;

  // Cek apakah PWA sudah terinstall
  const installed = await isPWAInstalled();
  return installed;
}

/**
 * Buka URL saat ini di PWA. Menggunakan teknik yang berbeda per platform.
 * Catatan: Ini bergantung pada `launch_handler: { client_mode: "navigate-existing" }`
 * di manifest.json agar browser mengarahkan ke jendela PWA yang sudah ada.
 */
export function openInPWA(): void {
  // Cara paling sederhana: navigasi ke URL sendiri.
  // Dengan launch_handler di manifest.json, browser Chrome/Edge akan
  // secara otomatis membuka URL ini di window PWA yang sudah terinstall.
  const currentUrl = window.location.href;
  window.location.href = currentUrl;
}
