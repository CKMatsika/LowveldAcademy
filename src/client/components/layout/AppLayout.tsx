import { ReactNode } from "react";
import { Header } from "./Header";
import { TabNav } from "./TabNav";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/10 flex flex-col">
      <Header />
      <main className="flex-1 container px-4 pb-24 pt-4">{children}</main>
      <TabNav />
    </div>
  );
}
