import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Messages from "./pages/Messages";
import Invoices from "./pages/Invoices";
import Classes from "./pages/Classes";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ParentRegistration from "./pages/ParentRegistration";
import Teachers from "./pages/Teachers";
import Timetable from "./pages/Timetable";
import Students from "./pages/Students";
import Attendance from "./pages/Attendance";
import Staff from "./pages/Staff";

const queryClient = new QueryClient();

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<ParentRegistration />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/messages"
            element={
              <RequireAuth>
                <Messages />
              </RequireAuth>
            }
          />
          <Route
            path="/invoices"
            element={
              <RequireAuth>
                <Invoices />
              </RequireAuth>
            }
          />
          <Route
            path="/classes"
            element={
              <RequireAuth>
                <Classes />
              </RequireAuth>
            }
          />
          <Route
            path="/teachers"
            element={
              <RequireAuth>
                <Teachers />
              </RequireAuth>
            }
          />
          <Route
            path="/students"
            element={
              <RequireAuth>
                <Students />
              </RequireAuth>
            }
          />
          <Route
            path="/timetable"
            element={
              <RequireAuth>
                <Timetable />
              </RequireAuth>
            }
          />
          <Route
            path="/attendance"
            element={
              <RequireAuth>
                <Attendance />
              </RequireAuth>
            }
          />
          <Route
            path="/staff"
            element={
              <RequireAuth>
                <Staff />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

import { load } from "./lib/storage";

export default App;

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = load<string | null>("auth.token", null);
  const user = load<any>("user", null);

  // Check if we have both token and user info
  if (!token || !user) {
    console.log('No token or user info found, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user || !user.id) {
    console.log('Invalid user data, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
