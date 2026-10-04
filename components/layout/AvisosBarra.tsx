"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";

type Aviso = { id: string; titulo: string; cuerpo: string | null; url: string | null };

export function AvisosBarra() {
  const { user } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [visto, setVisto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    void supabase
      .from("crm_avisos")
      .select("id, titulo, cuerpo, url")
      .eq("user_id", user.id)
      .eq("leida", false)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setAvisos(data ?? []));
  }, [user]);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (evento: MouseEvent) => {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  const abrir = () => {
    setAbierto((v) => !v);
    if (abierto || avisos.length === 0 || !user || visto) return;
    setVisto(true);
    const ids = avisos.map((aviso) => aviso.id);
    const supabase = createClient();
    void supabase.from("crm_avisos").update({ leida: true }).in("id", ids);
  };

  if (!user) return null;

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-label={avisos.length ? `${avisos.length} avisos` : "Avisos"}
        aria-expanded={abierto}
        onClick={abrir}
        className="relative grid h-9 w-9 place-items-center rounded-[9px] text-[var(--text-2)] hover:bg-[var(--surface-soft)] hover:text-foreground"
      >
        <Lightbulb className="h-4 w-4" strokeWidth={1.75} />
        {avisos.length > 0 && !visto ? <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--green)]" /> : null}
      </button>
      {abierto ? (
        <div className="fixed left-3 right-3 top-[3.75rem] z-50 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_12px_40px_rgba(0,0,0,0.18)] min-[820px]:absolute min-[820px]:left-auto min-[820px]:right-0 min-[820px]:top-11 min-[820px]:w-[min(22rem,calc(100vw-2rem))]">
          <p className="border-b border-[var(--border-soft)] px-3.5 py-2.5 text-[12px] text-[var(--text-3)]">Avisos</p>
          {avisos.length === 0 ? (
            <p className="px-3.5 py-4 text-[13px] text-[var(--text-2)]">Nada pendiente.</p>
          ) : (
            <ul>
              {avisos.map((aviso) => {
                const cuerpo = (
                  <>
                    <span className="block text-[13.5px] font-medium text-foreground">{aviso.titulo}</span>
                    {aviso.cuerpo ? <span className="mt-0.5 block truncate text-[12px] text-[var(--text-2)]">{aviso.cuerpo}</span> : null}
                  </>
                );
                return (
                  <li key={aviso.id} className="border-b border-[var(--border-row)] last:border-0">
                    {aviso.url ? (
                      <Link href={aviso.url} onClick={() => setAbierto(false)} className="block px-3.5 py-2.5 hover:bg-[var(--surface-soft)]">
                        {cuerpo}
                      </Link>
                    ) : (
                      <div className="px-3.5 py-2.5">{cuerpo}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
