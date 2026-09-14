"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-context";
import { isEditor } from "@/lib/auth/roles";

type Hit = { href: string; titulo: string; meta: string };

export function BusquedaGlobal() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

  useEffect(() => {
    const onKey = (evento: KeyboardEvent) => {
      if ((evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const texto = q.trim();
    if (texto.length < 2) {
      setHits([]);
      return;
    }
    const supabase = createClient();
    const like = `%${texto}%`;
    const editor = isEditor(user?.role);
    void Promise.all([
      editor
        ? Promise.resolve({ data: [] })
        : supabase.from("clientes").select("id, nombre, email").ilike("nombre", like).limit(5),
      editor
        ? Promise.resolve({ data: [] })
        : supabase.from("propiedades").select("id, titulo, referencia, direccion").or(`titulo.ilike.${like},referencia.ilike.${like},direccion.ilike.${like}`).limit(5),
      user?.role === "admin"
        ? supabase.from("facturas").select("id, numero").ilike("numero", like).limit(5)
        : Promise.resolve({ data: [] }),
    ]).then(([clientes, inmuebles, facturas]) => {
      const next: Hit[] = [];
      for (const row of clientes.data ?? []) {
        next.push({ href: `/clientes/${row.id}`, titulo: row.nombre, meta: row.email ?? "Cliente" });
      }
      for (const row of inmuebles.data ?? []) {
        next.push({
          href: `/propiedades/${row.id}`,
          titulo: row.referencia || row.titulo || "Inmueble",
          meta: row.direccion ?? "Inmueble",
        });
      }
      for (const row of facturas.data ?? []) {
        next.push({ href: `/facturas/${row.id}`, titulo: row.numero, meta: "Factura" });
      }
      setHits(next);
    });
  }, [open, q, user?.role]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 min-w-[220px] items-center gap-2 rounded-[9px] border border-[var(--input)] bg-white px-3 text-[13px] text-[var(--text-3)] hover:border-accent min-[820px]:flex"
      >
        <Search size={14} strokeWidth={2.2} />
        Buscar
        <kbd className="ml-auto rounded border border-border px-1.5 py-px font-mono text-[10.5px] text-[var(--text-3)]">⌘K</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-[9px] text-[var(--text-2)] hover:bg-[var(--surface-soft)] min-[820px]:hidden"
        aria-label="Buscar"
      >
        <Search size={16} strokeWidth={2.2} />
      </button>
      <Sheet open={open} onOpenChange={setOpen} variant="side" side="right" showCloseButton>
        <div className="px-5 pb-8 pt-[max(3.5rem,calc(env(safe-area-inset-top)+2.75rem))]">
          <h2 className="mb-4 text-lg font-semibold">Buscar</h2>
          <Input
            autoFocus
            placeholder="Cliente, inmueble, factura, referencia…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul className="mt-4 divide-y divide-[var(--border-row)]">
            {hits.map((hit) => (
              <li key={hit.href}>
                <button
                  type="button"
                  className="w-full px-1 py-3 text-left hover:bg-[var(--surface-soft)]"
                  onClick={() => {
                    setOpen(false);
                    router.push(hit.href);
                  }}
                >
                  <div className="text-[13.5px] font-semibold">{hit.titulo}</div>
                  <div className="text-[12px] text-[var(--text-2)]">{hit.meta}</div>
                </button>
              </li>
            ))}
            {q.trim().length >= 2 && hits.length === 0 && (
              <li className="py-6 text-center text-[12.5px] text-[var(--text-2)]">Sin resultados.</li>
            )}
          </ul>
        </div>
      </Sheet>
    </>
  );
}
