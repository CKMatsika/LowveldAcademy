import { useEffect, useState } from "react";

export type Role = "Admin" | "Teacher" | "Parent" | "Student";

const STORAGE_KEY = "schoolapp.role";

export function useRole() {
  const [role, setRoleState] = useState<Role>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return (saved as Role) || "Admin";
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, role);
    } catch {}
  }, [role]);

  const setRole = (next: Role) => setRoleState(next);

  return { role, setRole } as const;
}
