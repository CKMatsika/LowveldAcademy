import { NavLink } from "react-router-dom";
import {
  Home,
  MessageCircle,
  CreditCard,
  Settings2,
  Users,
  Calendar,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function TabNav() {
  const { role } = useRole();

  const items =
    role === "Admin"
      ? [
          { to: "/", label: "Home", icon: Home },
          { to: "/students", label: "Students", icon: Users },
          { to: "/classes", label: "Classes", icon: Users },
          { to: "/teachers", label: "Teachers", icon: Users },
          { to: "/timetable", label: "Timetable", icon: Calendar },
          // Keep secondary items accessible from Dashboard quick links instead of bottom nav to avoid crowding
          // { to: "/attendance", label: "Attendance", icon: Calendar },
          // { to: "/staff", label: "Staff", icon: Users },
          // { to: "/invoices", label: "Finance", icon: CreditCard },
          // { to: "/settings", label: "Settings", icon: Settings2 },
        ]
      : [
          { to: "/", label: "Home", icon: Home },
          { to: "/classes", label: "Classes", icon: Users },
          { to: "/timetable", label: "Timetable", icon: Calendar },
          { to: "/messages", label: "Messages", icon: MessageCircle },
          {
            to: "/invoices",
            label: role === "Parent" ? "Invoices" : "Finance",
            icon: CreditCard,
          },
          {
            to: "/settings",
            label: "Profile",
            icon: Settings2,
          },
        ];

  const colCount = (role === "Admin" ? items.length + 1 : items.length); // +1 for More

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className={`mx-auto grid h-14 max-w-lg ${colCount === 5 ? "grid-cols-5" : colCount === 6 ? "grid-cols-6" : colCount === 7 ? "grid-cols-7" : "grid-cols-5"}`}>
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center text-xs ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span className="mt-0.5">{label}</span>
          </NavLink>
        ))}
        {role === "Admin" && <MoreTab />}
      </div>
    </nav>
  );
}

function MoreTab() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex flex-col items-center justify-center text-xs text-muted-foreground">
          <Settings2 className="h-5 w-5" />
          <span className="mt-0.5">More</span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>More</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <NavLink to="/attendance" onClick={() => setOpen(false)} className="border rounded-md p-2 text-sm text-left">
            Attendance
          </NavLink>
          <NavLink to="/staff" onClick={() => setOpen(false)} className="border rounded-md p-2 text-sm text-left">
            Staff
          </NavLink>
          <NavLink to="/invoices" onClick={() => setOpen(false)} className="border rounded-md p-2 text-sm text-left">
            Finance
          </NavLink>
          <NavLink to="/settings" onClick={() => setOpen(false)} className="border rounded-md p-2 text-sm text-left">
            Settings
          </NavLink>
        </div>
      </DialogContent>
    </Dialog>
  );
}
