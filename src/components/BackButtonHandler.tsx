import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export function BackButtonHandler() {
  const { user } = useAuth();
  const location = useLocation();
  const lastBackPressRef = useRef<number | null>(null);
  const isNavigatingBackRef = useRef(false);

  // We only want to push a dummy state when we are on the dashboard 
  // so we can intercept the BACK action to prevent exiting the app immediately.
  useEffect(() => {
    if (!user) return;
    
    if (location.pathname === "/dashboard") {
      // Push dummy state for the first back press
      if (!window.history.state || window.history.state.preventExit !== true) {
        const currentState = window.history.state || {};
        window.history.pushState({ ...currentState, preventExit: true }, "", window.location.href);
      }
    }
  }, [location.pathname, user]);

  const handlePopState = useCallback((event: PopStateEvent) => {
    if (!user) return;

    if (isNavigatingBackRef.current) {
      isNavigatingBackRef.current = false;
      return;
    }

    const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    if (dialogs.length > 0) {
      // A modal is open, we want to close it, BUT the browser already navigated natively!
      // Since PWAs usually expect back to just close the modal, if we didn't push a dummy state, 
      // the URL HAS changed. We will dispatch Escape just in case, but native navigation continues.
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      // We don't return here so native navigation proceeds if there was no dummy state
    }

    if ((window as any).sidebarOpen && window.innerWidth < 768) {
      window.dispatchEvent(new Event("close-sidebar"));
      // We don't return here so native navigation proceeds if there was no dummy state
    }

    const path = location.pathname;
    
    if (path === "/dashboard") {
      const now = Date.now();
      if (lastBackPressRef.current !== null && now - lastBackPressRef.current < 2000) {
        lastBackPressRef.current = null;
        window.history.go(-(window.history.length)); // Exit app
      } else {
        lastBackPressRef.current = now;
        toast.info("Tekan lagi untuk keluar", { duration: 2000 });
        // Push state again so the next back press triggers popstate again
        const currentState = window.history.state || {};
        window.history.pushState({ ...currentState, preventExit: true }, "", window.location.href);
      }
      return;
    }
    
  }, [location.pathname, user]);

  useEffect(() => {
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [handlePopState]);

  return null;
}

