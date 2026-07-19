import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  ClipboardList,
  FileBarChart,
  Users,
  LogOut,
  Menu,
  Briefcase,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ProfileDialog } from "@/components/ProfileDialog";
import { NotificationBell } from "@/components/NotificationBell";
import { useStaffRealtimeNotifications } from "@/hooks/useStaffRealtimeNotifications";
const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: ["owner", "admin"] as const },
  { label: "Pesanan", path: "/dashboard/orders", icon: ClipboardList, roles: ["owner", "admin", "technician"] as const },
  { label: "Tiket Teknisi", path: "/dashboard/workload", icon: Briefcase, roles: ["owner", "admin"] as const },
  { label: "Laporan", path: "/dashboard/reports", icon: FileBarChart, roles: ["owner", "admin"] as const },
  { label: "Kelola Tiket Service", path: "/dashboard/closed-tickets", icon: Archive, roles: ["owner"] as const },
  { label: "Kelola Pelanggan", path: "/dashboard/customers", icon: Users, roles: ["owner", "admin"] as const },
  { label: "Kelola User", path: "/dashboard/users", icon: Users, roles: ["owner"] as const },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  useStaffRealtimeNotifications();
  const { profile, hasRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024;
    }
    return false;
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const filteredNav = navItems.filter((item) =>
    item.roles.some((role) => hasRole(role))
  );

  return (
    <div className="min-h-screen flex bg-background print:min-h-0 print:bg-transparent print:block">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden print:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 print:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-br from-primary to-blue-600 bg-clip-text text-transparent">
              SUMTRA
            </h1>
          </div>
          <p className="text-[10px] leading-tight text-sidebar-foreground/60 mt-0.5">Super Ultima Management, Tracking & Real-Time Application</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {filteredNav.map((item) => {
            const isActive = item.path === "/dashboard"
              ? location.pathname === "/dashboard"
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(window.innerWidth >= 1024 ? sidebarOpen : false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-sidebar-foreground">{profile?.full_name}</p>
            <p className="text-xs text-sidebar-foreground/60">{profile?.email}</p>
          </div>
          <ProfileDialog />
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-destructive w-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </aside>

      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 print:min-h-0 print:block",
          sidebarOpen ? "lg:pl-64" : "lg:pl-0"
        )}
      >
        <header className="sticky top-0 z-30 flex items-center gap-3 p-3 sm:p-4 border-b border-border bg-card/95 backdrop-blur print:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
          {!sidebarOpen && (
            <div className="flex items-center gap-2 transition-all duration-300">
              <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-br from-primary to-blue-600 bg-clip-text text-transparent hidden sm:block">SUMTRA</h1>
            </div>
          )}
          <div className="flex-1" />
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-auto px-3 py-4 sm:px-4 lg:p-6 print:overflow-visible print:p-0">{children}</main>
      </div>
    </div>
  );
}
