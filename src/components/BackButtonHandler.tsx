import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  pushPage,
  initStack,
  clearNavStack,
  readStack,
  writeStack
} from "@/hooks/useNavigationStack";

const MAIN_PAGES = [
  "/dashboard/orders",
  "/dashboard/workload",
  "/dashboard/reports",
  "/dashboard/closed-tickets",
  "/dashboard/customers",
  "/dashboard/users",
  "/dashboard/profile"
];

export function BackButtonHandler() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const lastBackPressRef = useRef<number | null>(null);
  const userId = user?.id ?? null;

  // Track navigation into the per-user stack
  useEffect(() => {
    if (!userId) return;
    const path = location.pathname + location.search;
    initStack(userId, path);
    
    if (MAIN_PAGES.some(p => location.pathname === p)) {
      writeStack(userId, ["/dashboard", path]);
    } else if (location.pathname === "/dashboard") {
      writeStack(userId, ["/dashboard"]);
    } else {
      pushPage(userId, path);
    }
  }, [location.pathname, location.search, userId]);

  useEffect(() => {
    if (!userId) return;
    return () => clearNavStack(userId);
  }, [userId]);

  const handlePopState = useCallback(() => {
    window.history.pushState(null, "", window.location.href);

    const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    if (dialogs.length > 0) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }

    if ((window as any).sidebarOpen) {
      window.dispatchEvent(new Event("close-sidebar"));
      return;
    }

    if (!userId) return;

    const path = location.pathname;

    if (path === "/dashboard") {
      const now = Date.now();
      if (lastBackPressRef.current !== null && now - lastBackPressRef.current < 2000) {
        lastBackPressRef.current = null;
        window.close();
        window.history.go(-(window.history.length));
      } else {
        lastBackPressRef.current = now;
        toast.info("Tekan lagi untuk keluar", { duration: 2000 });
      }
    } else if (MAIN_PAGES.some(p => path === p)) {
      navigate("/dashboard", { replace: true });
    } else {
      lastBackPressRef.current = null;
      const stack = readStack(userId);
      
      if (stack.length > 1) {
        stack.pop(); // remove current
        
        while (stack.length > 1) {
          const topPath = stack[stack.length - 1];
          if (topPath.includes("/orders/create")) {
            stack.pop();
          } else {
            break;
          }
        }
        
        writeStack(userId, stack);
        const destination = stack[stack.length - 1];
        navigate(destination, { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [userId, navigate, location.pathname]);

  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [handlePopState]);

  return null;
}

