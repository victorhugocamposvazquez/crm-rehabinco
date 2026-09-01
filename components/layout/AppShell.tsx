"use client";

import { usePathname } from "next/navigation";
import { MobileNav } from "./MobileNav";
import { TopBar } from "./TopBar";
import { isWizardRoute } from "./wizard-chrome";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wizard = isWizardRoute(pathname);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-foreground focus:px-4 focus:py-2 focus:text-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Saltar al contenido
      </a>
      <TopBar />
      <main
        id="main-content"
        className={cn(
          "mx-auto w-full max-w-[1600px] px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8",
          wizard
            ? "pb-4 md:pb-10"
            : "pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-10"
        )}
      >
        {children}
      </main>
      {!wizard && <MobileNav />}
    </div>
  );
}
