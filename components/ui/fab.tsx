"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FabProps {
  href: string;
  label: string;
  className?: string;
}

export function Fab({ href, label, className }: FabProps) {
  return (
    <Link
      href={href}
      className={cn(
        "fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:opacity-90 active:scale-95 md:bottom-8 md:right-8 md:h-14 md:w-14 [&_svg]:h-6 [&_svg]:w-6",
        "animate-[fadeIn_0.2s_ease-out]",
        className
      )}
      aria-label={label}
    >
      <Plus aria-hidden />
    </Link>
  );
}
