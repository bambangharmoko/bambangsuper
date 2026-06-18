import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute, OwnerRoute, AdminRoute, NonTechnicianRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Track from "./pages/Track";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import CreateOrder from "./pages/CreateOrder";
import Reports from "./pages/Reports";
import OrderDetail from "./pages/OrderDetail";
import UserManagement from "./pages/UserManagement";
import TechnicianWorkload from "./pages/TechnicianWorkload";
import CustomerManagement from "./pages/CustomerManagement";
import ClosedTicketsManager from "./pages/ClosedTicketsManager";
import NotFound from "./pages/NotFound";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/track" element={<Navigate to="/" replace />} />
            <Route path="/track/:ticketId" element={<Track />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><NonTechnicianRoute><Dashboard /></NonTechnicianRoute></ProtectedRoute>} />
            <Route path="/dashboard/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/dashboard/orders/create" element={<ProtectedRoute><CreateOrder /></ProtectedRoute>} />
            <Route path="/dashboard/orders/:ticketId" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
            <Route path="/dashboard/reports" element={<ProtectedRoute><AdminRoute><Reports /></AdminRoute></ProtectedRoute>} />
            <Route path="/dashboard/workload" element={<ProtectedRoute><AdminRoute><TechnicianWorkload /></AdminRoute></ProtectedRoute>} />
            <Route path="/dashboard/customers" element={<ProtectedRoute><NonTechnicianRoute><CustomerManagement /></NonTechnicianRoute></ProtectedRoute>} />
            <Route path="/dashboard/users" element={<ProtectedRoute><OwnerRoute><UserManagement /></OwnerRoute></ProtectedRoute>} />
            <Route path="/dashboard/closed-tickets" element={<ProtectedRoute><OwnerRoute><ClosedTicketsManager /></OwnerRoute></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      {/* PWA install prompt — muncul di semua halaman */}
      <PWAInstallPrompt />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
