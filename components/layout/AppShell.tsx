"use client";

import { MobileNav } from "./MobileNav";
import { DesktopNav } from "./DesktopNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <DesktopNav />
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 sm:pb-8 lg:px-8 md:pb-8">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
