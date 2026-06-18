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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const filteredNav = navItems.filter((item) =>
    item.roles.some((role) => hasRole(role))
  );

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden print:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 lg:translate-x-0 print:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 border-b border-sidebar-border">
          <h1 className="text-lg font-bold text-sidebar-primary-foreground">
            Super Computer
          </h1>
          <p className="text-xs text-sidebar-foreground/60">Service Management</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {filteredNav.map((item) => {
            const isActive = item.path === "/dashboard"
              ? location.pathname === "/dashboard"
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
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

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between p-3 sm:p-4 border-b border-border bg-card/95 backdrop-blur print:hidden">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-sm font-bold lg:hidden">Super Computer</h1>
          <div className="hidden lg:block" />
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-auto px-3 py-4 sm:px-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
