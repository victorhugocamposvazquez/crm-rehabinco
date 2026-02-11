"use client";

import { MobileNav } from "./MobileNav";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <TopBar />
      <main className="mx-auto w-full max-w-[1600px] px-4 pb-24 pt-6 sm:px-6 sm:pb-10 sm:pt-8 lg:px-8 md:pb-10">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
