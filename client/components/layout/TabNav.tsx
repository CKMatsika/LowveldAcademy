import { NavLink } from "react-router-dom";
import {
  Home,
  MessageCircle,
  CreditCard,
  Settings2,
  Users,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";

export function TabNav() {
  const { role } = useRole();

  const items = [
    { to: "/", label: "Home", icon: Home },
    { to: "/classes", label: "Classes", icon: Users },
    { to: "/messages", label: "Messages", icon: MessageCircle },
    {
      to: "/invoices",
      label: role === "Parent" ? "Invoices" : "Finance",
      icon: CreditCard,
    },
    {
      to: "/settings",
      label: role === "Admin" ? "Settings" : "Profile",
      icon: Settings2,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto grid grid-cols-5 h-14 max-w-lg">
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
      </div>
    </nav>
  );
}
