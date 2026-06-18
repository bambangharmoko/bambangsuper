import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLoading } from "@/components/AppLoading";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, isApproved } = useAuth();

  if (loading) {
    return <AppLoading />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isApproved) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { hasRole, loading } = useAuth();

  if (loading) {
    return <AppLoading />;
  }

  if (!hasRole("owner") && !hasRole("admin")) return <Navigate to="/dashboard/orders" replace />;

  return <>{children}</>;
}

export function NonTechnicianRoute({ children }: { children: ReactNode }) {
  const { hasRole, loading } = useAuth();

  if (loading) {
    return <AppLoading />;
  }

  // Technicians go to orders instead of dashboard
  if (hasRole("technician") && !hasRole("owner") && !hasRole("admin")) {
    return <Navigate to="/dashboard/orders" replace />;
  }

  return <>{children}</>;
}

export function OwnerRoute({ children }: { children: ReactNode }) {
  const { hasRole, loading } = useAuth();

  if (loading) {
    return <AppLoading />;
  }

  if (!hasRole("owner")) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
