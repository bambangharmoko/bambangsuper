import { createContext, useContext, useCallback, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "owner" | "admin" | "technician";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: {
    full_name: string;
    email: string;
    is_approved: boolean | null;
    requested_role: AppRole;
    username: string | null;
  } | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isApproved: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_CHECK_TIMEOUT_MS = 10000;
const STAFF_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const STAFF_SESSION_VALID_UNTIL_KEY = "sk-staff-session-valid-until";
const SESSION_REFRESH_WINDOW_MS = 5 * 60 * 1000;

const isProtectedPath = () => window.location.pathname.startsWith("/dashboard");

const redirectToLogin = () => {
  if (isProtectedPath()) window.location.replace("/login");
};

const extendSessionHint = () => {
  localStorage.setItem(STAFF_SESSION_VALID_UNTIL_KEY, String(Date.now() + STAFF_SESSION_TTL_MS));
};

const clearSessionHint = () => {
  localStorage.removeItem(STAFF_SESSION_VALID_UNTIL_KEY);
};

const hasRecentSessionHint = () => {
  const validUntil = Number(localStorage.getItem(STAFF_SESSION_VALID_UNTIL_KEY) || 0);
  return validUntil > Date.now();
};

const getPersistedSession = (): Session | null => {
  const key = Object.keys(localStorage).find((item) => item.startsWith("sb-") && item.endsWith("-auth-token"));
  if (!key) return null;

  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    const candidate = parsed?.currentSession || parsed?.session || parsed;
    return candidate?.access_token && candidate?.refresh_token && candidate?.user ? (candidate as Session) : null;
  } catch {
    return null;
  }
};

const shouldRefreshSession = (candidate: Session | null) => {
  if (!candidate?.refresh_token || !candidate.expires_at) return false;
  return candidate.expires_at * 1000 - Date.now() < SESSION_REFRESH_WINDOW_MS;
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("Session check timeout")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const userRef = useRef<User | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const profileRef = useRef<AuthContextType["profile"]>(null);

  useEffect(() => {
    userRef.current = user;
    sessionRef.current = session;
    profileRef.current = profile;
  }, [profile, session, user]);

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const [profileRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email, is_approved, requested_role, username")
          .eq("id", userId)
          .single(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (rolesRes.error) throw rolesRes.error;
      setProfile(profileRes.data as AuthContextType["profile"]);
      setRoles((rolesRes.data || []).map((r) => r.role));
      return true;
    } catch (error) {
      console.error("Failed to load user profile", error);
      if (!profileRef.current) {
        setProfile(null);
        setRoles([]);
      }
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        if (event === "INITIAL_SESSION") return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          extendSessionHint();
          setLoading(true);
          void fetchUserData(session.user.id).finally(() => {
            if (mounted) setLoading(false);
          });
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
          if (event === "SIGNED_OUT") clearSessionHint();
          if (initializedRef.current && (event === "SIGNED_OUT" || !hasRecentSessionHint())) redirectToLogin();
        }
      }
    );

    const checkSession = async () => {
      try {
        if (!initializedRef.current) setLoading(true);
        const persistedSession = getPersistedSession();
        if (persistedSession?.user && !sessionRef.current) {
          setSession(persistedSession);
          setUser(persistedSession.user);
        }

        if (shouldRefreshSession(sessionRef.current || persistedSession)) {
          await withTimeout(supabase.auth.refreshSession(), SESSION_CHECK_TIMEOUT_MS);
        }

        const { data: { session }, error } = await withTimeout(supabase.auth.getSession(), SESSION_CHECK_TIMEOUT_MS);
        if (error) throw error;
        if (!mounted) return;
        if (session?.user) {
          extendSessionHint();
          setSession(session);
          setUser(session.user);
          await fetchUserData(session.user.id);
        } else if (persistedSession?.user && hasRecentSessionHint()) {
          setSession(persistedSession);
          setUser(persistedSession.user);
          await fetchUserData(persistedSession.user.id);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          clearSessionHint();
          redirectToLogin();
        }
      } catch (error) {
        console.error("Session validation failed", error);
        const fallbackSession = sessionRef.current || getPersistedSession();
        if (mounted && fallbackSession?.user && hasRecentSessionHint()) {
          setSession(fallbackSession);
          setUser(fallbackSession.user);
          void fetchUserData(fallbackSession.user.id);
        } else if (mounted) {
          clearSessionHint();
          redirectToLogin();
        }
      } finally {
        if (mounted) {
          setLoading(false);
          initializedRef.current = true;
        }
      }
    };

    const handleFocus = () => {
      if (isProtectedPath()) void checkSession();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isProtectedPath()) void checkSession();
    };

    void checkSession();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearSessionHint();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  const isApproved = profile?.is_approved === true;

  return (
    <AuthContext.Provider
      value={{ user, session, profile, roles, loading, signOut, hasRole, isApproved }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
