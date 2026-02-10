"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function Protected({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login?redirect=" + encodeURIComponent(pathname ?? "/"));
    }
  }, [user, isLoading, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
