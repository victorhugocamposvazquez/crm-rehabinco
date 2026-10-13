"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function PapeleraValoracionesFab() {
  const pathname = usePathname() ?? "";
  const [n, setN] = useState(0);
  const oculta = pathname.startsWith("/valoraciones/papelera") || pathname.startsWith("/valoraciones/nueva");

  useEffect(() => {
    if (oculta) return;
    const cargar = () => {
      const supabase = createClient();
      void supabase
        .from("avm_valuations")
        .select("id", { count: "exact", head: true })
        .not("deleted_at", "is", null)
        .then(({ count }) => setN(count ?? 0));
    };
    cargar();
    window.addEventListener("avm-papelera", cargar);
    return () => window.removeEventListener("avm-papelera", cargar);
  }, [oculta, pathname]);

  if (oculta) return null;

  return (
    <Link
      href="/valoraciones/papelera"
      aria-label={n > 0 ? `Papelera, ${n} valoraciones` : "Papelera"}
      className="fixed right-4 z-40 grid h-12 w-12 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:text-foreground bottom-[calc(var(--mobile-nav-h,0px)+16px)] min-[820px]:bottom-6"
    >
      <Trash2 className="h-5 w-5" strokeWidth={1.7} aria-hidden />
      {n > 0 ? (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
          {n > 99 ? "99+" : n}
        </span>
      ) : null}
    </Link>
  );
}
