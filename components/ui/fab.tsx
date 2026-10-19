"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FabProps {
  href?: string;
  onClick?: () => void;
  label: string;
  className?: string;
}

export function Fab({ href, onClick, label, className }: FabProps) {
  const continuar = label.toLowerCase().includes("continuar");
  const cls = cn(
    "fixed right-4 z-[55] flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent text-accent-foreground shadow-[0_12px_24px_rgba(13,148,136,0.28)] transition-transform hover:opacity-95 active:scale-95 min-[820px]:hidden bottom-[var(--mobile-fab-bottom)] [&_svg]:h-6 [&_svg]:w-6",
    continuar ? "w-auto px-4" : "w-14",
    "animate-[fadeIn_0.2s_ease-out]",
    className
  );
  const contenido = (
    <>
      <Plus strokeWidth={1.5} aria-hidden />
      {continuar ? <span className="pr-1 text-[14px] font-semibold">Continuar</span> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} aria-label={label}>
        {contenido}
      </button>
    );
  }
  return (
    <Link href={href ?? "#"} className={cls} aria-label={label}>
      {contenido}
    </Link>
  );
}
