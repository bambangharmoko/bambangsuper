/**
 * BackButtonHandler
 *
 * Intercepts the browser / Android hardware back button for the entire app.
 * Works in: Browser, Installed PWA (standalone), Android hardware back button.
 *
 * Behavior:
 * - Logged-in users get a per-account navigation stack.
 * - Back navigates to the previous page in that account's stack.
 * - At the root page, first back shows "Tekan lagi untuk keluar".
 *   Second back within 2 seconds exits the app (window.close / history manipulation).
 * - On logout the stack for that user is cleared.
 */

import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  pushPage,
  popPage,
  initStack,
  clearNavStack,
} from "@/hooks/useNavigationStack";

// Pages considered "roots" — pressing back here shows exit confirmation.
const ROOT_PATHS = [
  "/dashboard",
  "/dashboard/orders",
];

function isRootPath(path: string): boolean {
  // Strip query-string and hash for comparison
  const clean = path.split("?")[0].split("#")[0];
  return ROOT_PATHS.includes(clean);
}

export function BackButtonHandler() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const lastBackPressRef = useRef<number | null>(null);
  const userId = user?.id ?? null;

  // ─── Track navigation into the per-user stack ───────────────────────────
  useEffect(() => {
    if (!userId) return;
    const path = location.pathname + location.search;
    initStack(userId, path);   // seed stack if empty
    pushPage(userId, path);    // push every visited path
  }, [location.pathname, location.search, userId]);

  // ─── Clear stack on logout ───────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    return () => {
      // When the user changes (logout/switch), clear the old user's stack
      clearNavStack(userId);
    };
  }, [userId]);

  // ─── Intercept popstate (browser back / Android HW back) ─────────────────
  const handlePopState = useCallback(() => {
    // Always push a dummy forward entry so the browser "back" pool stays full
    // and we can keep intercepting subsequent presses.
    window.history.pushState(null, "", window.location.href);

    if (!userId) return; // not logged in — allow default

    const destination = popPage(userId);

    if (destination === null) {
      // Already at root of our stack
      const now = Date.now();
      if (
        lastBackPressRef.current !== null &&
        now - lastBackPressRef.current < 2000
      ) {
        // Second press within 2 s → exit
        lastBackPressRef.current = null;
        // Best-effort exit for PWA / Android
        window.close();
        // Fallback: navigate away from history
        window.history.go(-(window.history.length));
      } else {
        lastBackPressRef.current = now;
        toast.info("Tekan lagi untuk keluar", { duration: 2000 });
      }
    } else {
      lastBackPressRef.current = null;
      navigate(destination, { replace: true });
    }
  }, [userId, navigate]);

  useEffect(() => {
    // Push an initial state so there's always something to "go back" from
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [handlePopState]);

  return null; // renders nothing
}
