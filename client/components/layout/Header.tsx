import { School, Bell, ChevronDown } from "lucide-react";
import { useRole, Role } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

const roles: Role[] = ["Admin", "Teacher", "Parent", "Student"];

export function Header() {
  const { role, setRole } = useRole();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-primary to-indigo-500 text-primary-foreground shadow-sm">
      <div className="container px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-white/20 flex items-center justify-center">
            <School className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm opacity-90">Aurora High School</div>
            <div className="text-xs opacity-80">Smart School Management</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="Notifications" className="h-9 w-9 rounded-md bg-white/15 flex items-center justify-center">
            <Bell className="h-5 w-5" />
          </button>
          <div className="relative">
            <Button size="sm" variant="secondary" className="bg-white text-primary hover:bg-white/90" onClick={() => setOpen((v) => !v)}>
              {role}
              <ChevronDown className="h-4 w-4" />
            </Button>
            {open && (
              <div className="absolute right-0 mt-2 w-40 rounded-md bg-white shadow-md ring-1 ring-black/5 overflow-hidden">
                {roles.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRole(r);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-accent",
                      r === role && "bg-accent/60",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
