"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileSearch, Loader2, Search } from "lucide-react";
import { BarraPagina, BotonPrincipal } from "@/components/layout/BarraPagina";
import { ESTADOS_NOTA, ETIQUETA_ESTADO_NOTA, type EstadoNota } from "@/lib/notas-simples/modelo";
import { cargasVigentes } from "@/lib/notas-simples/resumen";
import type { NotaSimple } from "@/lib/notas-simples/tipos";
import { EstadoNotaBadge } from "./EstadoNotaBadge";

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export function ListaNotasSimples() {
  const router = useRouter();
  const [notas, setNotas] = useState<NotaSimple[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consulta, setConsulta] = useState("");
  const [estado, setEstado] = useState<EstadoNota | "todas">("todas");

  useEffect(() => {
    fetch("/api/notas-simples")
      .then(async (r) => {
        const j = (await r.json()) as { ok: boolean; notas?: NotaSimple[]; error?: string };
        if (!r.ok || !j.ok) throw new Error(j.error || `Error ${r.status}`);
        setNotas(j.notas ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const visibles = useMemo(() => {
    const q = consulta.trim().toLowerCase();
    return (notas ?? []).filter(
      (n) =>
        (estado === "todas" || n.estado === estado) &&
        (!q || [n.direccion, n.ref_catastral, n.idufir, n.titular, n.municipio].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [notas, consulta, estado]);

  const pedir = () => router.push("/notas-simples/nueva");

  return (
    <div className="-mx-3.5 -mt-5 min-[820px]:-mx-6 min-[820px]:-mt-6" data-testid="lista-notas-simples">
      <BarraPagina
        titulo="Notas simples"
        acciones={<BotonPrincipal onClick={pedir}>Pedir nota simple</BotonPrincipal>}
      >
        <label className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 min-[820px]:max-w-[380px]">
          <Search className="h-4 w-4 shrink-0 text-[var(--text-3)]" aria-hidden />
          <input
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Dirección, referencia o titular"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-3)]"
            aria-label="Buscar notas simples"
          />
        </label>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoNota | "todas")}
          className="h-10 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
          aria-label="Estado"
        >
          <option value="todas">Todos los estados</option>
          {ESTADOS_NOTA.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO_NOTA[e]}
            </option>
          ))}
        </select>
      </BarraPagina>

      <div className="px-3.5 py-5 min-[820px]:px-8 min-[820px]:py-8">
        {error ? (
          <p className="rounded-[6px] bg-[var(--red-bg)] px-3 py-2 text-[14px] text-[var(--red)]">{error}</p>
        ) : notas === null ? (
          <p className="flex items-center gap-2 text-[var(--text-2)]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cargando…
          </p>
        ) : notas.length === 0 ? (
          <div className="aire-panel flex min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)]">
              <FileSearch className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="text-2xl font-normal text-[var(--titulo,var(--foreground))]">
              Pide tu <strong className="font-semibold">primera nota simple</strong>
            </h2>
            <p className="max-w-md text-[15px] text-[var(--text-2)]">
              Titulares, cargas y superficie registral de cualquier finca de España, leídos y resumidos en el CRM.
            </p>
            <BotonPrincipal onClick={pedir} className="mt-2">
              Pedir nota simple
            </BotonPrincipal>
          </div>
        ) : (
          <div className="aire-panel overflow-hidden">
            <ul className="divide-y divide-[var(--border)]">
              {visibles.map((n) => {
                const cargas = n.resumen ? cargasVigentes(n.resumen) : null;
                return (
                  <li key={n.id}>
                    <Link href={`/notas-simples/${n.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-[var(--surface-soft)] min-[820px]:px-6">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base text-[var(--titulo,var(--foreground))]">{n.direccion}</div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-[var(--text-2)]">
                          <span className="tabular-nums">{n.ref_catastral ?? n.idufir ?? `Finca ${n.finca_registral}`}</span>
                          <span>Pedida el {fecha(n.created_at)}</span>
                          {cargas ? <span>{cargas.numero ? `${cargas.numero} carga${cargas.numero > 1 ? "s" : ""} vigente${cargas.numero > 1 ? "s" : ""}` : "Libre de cargas"}</span> : null}
                        </div>
                      </div>
                      <EstadoNotaBadge estado={n.estado} />
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-3)]" aria-hidden />
                    </Link>
                  </li>
                );
              })}
              {!visibles.length ? <li className="px-6 py-6 text-[14px] text-[var(--text-2)]">Ninguna nota coincide con la búsqueda.</li> : null}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
