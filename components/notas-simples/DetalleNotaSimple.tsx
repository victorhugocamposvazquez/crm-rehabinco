"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, FileText, Loader2, RefreshCw, Upload } from "lucide-react";
import { BarraPagina, BotonBarra, BotonPrincipal } from "@/components/layout/BarraPagina";
import { MOTIVOS_NOTA, puedePasar, type EstadoNota } from "@/lib/notas-simples/modelo";
import { SEDE_REGISTRADORES } from "@/lib/notas-simples/proveedor";
import { cargasVigentes } from "@/lib/notas-simples/resumen";
import type { NotaSimple } from "@/lib/notas-simples/tipos";
import { EstadoNotaBadge } from "./EstadoNotaBadge";

type Datos = { nota: NotaSimple; pdfUrl: string | null; instrucciones: string[] | null };

function fecha(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "—";
}

function euros(n: number) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function Fila({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-2.5 min-[820px]:px-6">
      <dt className="w-44 shrink-0 text-[14px] text-[var(--text-2)]">{k}</dt>
      <dd className="min-w-0 flex-1 text-[15px]">{v || "—"}</dd>
    </div>
  );
}

export function DetalleNotaSimple({ id }: { id: string }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [refProveedor, setRefProveedor] = useState("");
  const archivo = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/notas-simples/${id}`);
      const j = (await r.json()) as { ok: boolean; error?: string } & Partial<Datos>;
      if (!r.ok || !j.ok || !j.nota) throw new Error(j.error || `Error ${r.status}`);
      setDatos({ nota: j.nota, pdfUrl: j.pdfUrl ?? null, instrucciones: j.instrucciones ?? null });
      setRefProveedor(j.nota.proveedor_ref ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const accion = async (clave: string, peticion: () => Promise<Response>) => {
    setOcupado(clave);
    setError(null);
    setAviso(null);
    try {
      const r = await peticion();
      const j = (await r.json()) as { ok: boolean; error?: string; aviso?: string | null };
      if (!r.ok || !j.ok) throw new Error(j.error || `Error ${r.status}`);
      if (j.aviso) setAviso(j.aviso);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  };

  const patch = (clave: string, cuerpo: Record<string, unknown>) =>
    accion(clave, () => fetch(`/api/notas-simples/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) }));

  const cambiarEstado = (estado: EstadoNota) => {
    if (estado === "error") {
      const incidencia = window.prompt("¿Qué ha pasado? (p. ej. el Registro no localiza la finca)");
      if (incidencia === null) return;
      return patch("estado", { estado, incidencia });
    }
    if (estado === "cancelada" && !window.confirm("¿Cancelar esta nota simple?")) return;
    return patch("estado", { estado });
  };

  const subir = (f: File) => {
    const form = new FormData();
    form.append("pdf", f);
    return accion("pdf", () => fetch(`/api/notas-simples/${id}/pdf`, { method: "POST", body: form }));
  };

  const volver = (
    <Link href="/notas-simples" className="inline-flex h-10 items-center gap-1.5 rounded-[6px] px-2 text-sm text-[var(--text-2)] hover:bg-[var(--accent-soft)] hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Notas simples
    </Link>
  );

  if (!datos) {
    return (
      <div className="-mx-3.5 -mt-5 min-[820px]:-mx-6 min-[820px]:-mt-6">
        <BarraPagina titulo="Nota simple" acciones={volver} />
        <div className="px-3.5 py-6 min-[820px]:px-8">
          {error ? (
            <p className="rounded-[6px] bg-[var(--red-bg)] px-3 py-2 text-[14px] text-[var(--red)]">{error}</p>
          ) : (
            <p className="flex items-center gap-2 text-[var(--text-2)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Cargando…
            </p>
          )}
        </div>
      </div>
    );
  }

  const { nota: n, pdfUrl, instrucciones } = datos;
  const r = n.resumen;
  const cargas = r ? cargasVigentes(r) : null;
  const abierta = n.estado === "solicitada" || n.estado === "en_tramite" || n.estado === "error";
  const motivo = n.motivo === "otro" ? n.motivo_texto : MOTIVOS_NOTA.find((m) => m.id === n.motivo)?.label;

  return (
    <div className="-mx-3.5 -mt-5 min-[820px]:-mx-6 min-[820px]:-mt-6" data-testid="detalle-nota-simple">
      <BarraPagina titulo="Nota simple" acciones={volver} />

      <div className="mx-auto max-w-[960px] space-y-4 px-3.5 py-6 min-[820px]:px-8">
        <section className="aire-panel p-4 min-[820px]:p-6">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-medium text-[var(--titulo,var(--foreground))]">{n.direccion}</h2>
              <p className="mt-0.5 text-[13px] tabular-nums text-[var(--text-2)]">
                {[n.ref_catastral, n.idufir && `IDUFIR ${n.idufir}`, n.finca_registral && `Finca ${n.finca_registral}`, n.registro].filter(Boolean).join(" · ")}
              </p>
            </div>
            <EstadoNotaBadge estado={n.estado} />
          </div>

          {n.estado === "error" && n.incidencia ? (
            <p className="mt-3 rounded-[6px] bg-[var(--red-bg)] px-3 py-2 text-[14px] text-[var(--red)]">{n.incidencia}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {abierta || n.estado === "recibida" || n.estado === "leida" ? (
              <BotonPrincipal onClick={() => archivo.current?.click()} disabled={!!ocupado}>
                {ocupado === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
                {n.pdf_path ? "Sustituir PDF" : "Subir PDF recibido"}
              </BotonPrincipal>
            ) : null}
            <input
              ref={archivo}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void subir(f);
              }}
            />
            {pdfUrl ? (
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm hover:bg-[var(--accent-soft)]">
                <FileText className="h-4 w-4" aria-hidden /> Ver PDF
              </a>
            ) : null}
            {n.pdf_path ? (
              <BotonBarra onClick={() => accion("releer", () => fetch(`/api/notas-simples/${id}/pdf?releer=1`, { method: "POST" }))} disabled={!!ocupado}>
                {ocupado === "releer" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
                Volver a leer
              </BotonBarra>
            ) : null}
            {puedePasar(n.estado, "en_tramite") ? (
              <BotonBarra onClick={() => cambiarEstado("en_tramite")} disabled={!!ocupado}>
                Marcar en trámite
              </BotonBarra>
            ) : null}
            {puedePasar(n.estado, "solicitada") && n.estado === "error" ? (
              <BotonBarra onClick={() => cambiarEstado("solicitada")} disabled={!!ocupado}>
                Reintentar
              </BotonBarra>
            ) : null}
            {puedePasar(n.estado, "error") ? (
              <BotonBarra onClick={() => cambiarEstado("error")} disabled={!!ocupado}>
                Anotar incidencia
              </BotonBarra>
            ) : null}
            {puedePasar(n.estado, "cancelada") ? (
              <BotonBarra onClick={() => cambiarEstado("cancelada")} disabled={!!ocupado} className="text-[var(--text-2)]">
                Cancelar
              </BotonBarra>
            ) : null}
          </div>
          {ocupado === "pdf" || ocupado === "releer" ? <p className="mt-2 text-[13px] text-[var(--text-2)]">Leyendo la nota… puede tardar unos segundos.</p> : null}
          {aviso ? <p className="mt-3 rounded-[6px] bg-[var(--amber-bg)] px-3 py-2 text-[14px] text-[var(--amber-ink)]">{aviso}</p> : null}
          {error ? <p className="mt-3 rounded-[6px] bg-[var(--red-bg)] px-3 py-2 text-[14px] text-[var(--red)]">{error}</p> : null}
        </section>

        {abierta && instrucciones?.length ? (
          <section className="aire-panel">
            <h3 className="aire-panel-cabecera">Cómo tramitarla</h3>
            <ol className="list-decimal space-y-1.5 py-4 pl-10 pr-4 text-[15px] min-[820px]:pl-12">
              {instrucciones.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-4 py-3 min-[820px]:px-6">
              <a href={SEDE_REGISTRADORES} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-[var(--border)] px-3 text-sm hover:bg-[var(--accent-soft)]">
                Abrir la sede del Registro <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
              <input
                value={refProveedor}
                onChange={(e) => setRefProveedor(e.target.value)}
                placeholder="Nº de solicitud en el Registro"
                className="h-9 min-w-[200px] flex-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none"
                aria-label="Número de solicitud en el Registro"
              />
              <BotonBarra className="h-9" onClick={() => patch("ref", { proveedorRef: refProveedor })} disabled={!!ocupado || refProveedor === (n.proveedor_ref ?? "")}>
                Guardar
              </BotonBarra>
            </div>
          </section>
        ) : null}

        {r ? (
          <>
            <section className={cargas?.numero ? "aire-panel border-[var(--amber-ink)]/30" : "aire-panel"}>
              <div className="flex items-center gap-3 p-4 min-[820px]:px-6">
                {cargas?.numero ? (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--amber-ink)]" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--green)]" aria-hidden />
                )}
                <div className="text-[16px] font-medium">
                  {cargas?.numero
                    ? `${cargas.numero} carga${cargas.numero > 1 ? "s" : ""} vigente${cargas.numero > 1 ? "s" : ""}${cargas.importe ? ` · ${euros(cargas.importe)}` : ""}`
                    : "Libre de cargas"}
                </div>
              </div>
              {r.alertas.length ? (
                <ul className="space-y-1 border-t border-[var(--border)] px-4 py-3 text-[14px] min-[820px]:px-6">
                  {r.alertas.map((a) => (
                    <li key={a} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--amber-ink)]" />
                      {a}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="aire-panel">
              <h3 className="aire-panel-cabecera">Titulares ({r.titulares.length})</h3>
              <ul className="divide-y divide-[var(--border)]">
                {r.titulares.map((t, i) => (
                  <li key={`${t.nombre}-${i}`} className="px-4 py-3 min-[820px]:px-6">
                    <div className="text-[15px] font-medium">{t.nombre}</div>
                    <div className="text-[13px] text-[var(--text-2)]">
                      {[t.porcentaje, t.derecho, t.titulo, t.fecha].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </li>
                ))}
                {!r.titulares.length ? <li className="px-6 py-3 text-[14px] text-[var(--text-2)]">No se han encontrado titulares.</li> : null}
              </ul>
            </section>

            <section className="aire-panel">
              <h3 className="aire-panel-cabecera">Cargas ({r.cargas.length})</h3>
              <ul className="divide-y divide-[var(--border)]">
                {r.cargas.map((c, i) => (
                  <li key={`${c.tipo}-${i}`} className="flex items-start gap-3 px-4 py-3 min-[820px]:px-6">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium first-letter:uppercase">{c.tipo}</div>
                      <div className="text-[13px] text-[var(--text-2)]">{[c.acreedor, c.detalle].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                    <div className="text-right">
                      {c.importe ? <div className="text-[15px] tabular-nums">{euros(c.importe)}</div> : null}
                      <div className={c.vigente === false ? "text-[12px] text-[var(--text-3)]" : "text-[12px] text-[var(--amber-ink)]"}>
                        {c.vigente === false ? "Cancelada o caducada" : "Vigente"}
                      </div>
                    </div>
                  </li>
                ))}
                {!r.cargas.length ? <li className="px-6 py-3 text-[14px] text-[var(--text-2)]">La nota no recoge cargas.</li> : null}
              </ul>
            </section>

            <section className="aire-panel">
              <h3 className="aire-panel-cabecera">Descripción registral</h3>
              <dl className="divide-y divide-[var(--border)]">
                <Fila k="Tipo" v={r.descripcion.tipo} />
                <Fila k="Dirección" v={r.descripcion.direccion} />
                <Fila k="Sup. construida" v={r.descripcion.superficieConstruida != null ? `${r.descripcion.superficieConstruida.toLocaleString("es-ES")} m²` : null} />
                <Fila k="Sup. útil" v={r.descripcion.superficieUtil != null ? `${r.descripcion.superficieUtil.toLocaleString("es-ES")} m²` : null} />
                <Fila k="Cuota de participación" v={r.descripcion.cuotaParticipacion} />
                <Fila k="Anejos" v={r.descripcion.anejos.join(", ")} />
                <Fila k="Registro" v={r.registro} />
                <Fila k="Finca registral" v={r.fincaRegistral} />
                <Fila k="IDUFIR" v={r.idufir} />
                <Fila k="Fecha de la nota" v={r.fechaNota} />
              </dl>
              <p className="border-t border-[var(--border)] px-4 py-2.5 text-[12px] text-[var(--text-3)] min-[820px]:px-6">
                Resumen automático. Ante cualquier duda, manda el PDF original.
              </p>
            </section>
          </>
        ) : null}

        <section className="aire-panel">
          <h3 className="aire-panel-cabecera">Solicitud</h3>
          <dl className="divide-y divide-[var(--border)]">
            <Fila k="Pedida el" v={fecha(n.solicitada_en)} />
            <Fila k="Recibida el" v={fecha(n.recibida_en)} />
            <Fila k="Motivo" v={motivo} />
            <Fila k="Titular indicado" v={n.titular} />
            <Fila k="Municipio" v={[n.municipio, n.provincia].filter(Boolean).join(", ")} />
            <Fila k="Nº en el Registro" v={n.proveedor_ref} />
            {n.propiedad_id ? <Fila k="Inmueble" v={<Link className="underline" href={`/propiedades/${n.propiedad_id}`}>Ver ficha del inmueble</Link>} /> : null}
          </dl>
        </section>
      </div>
    </div>
  );
}
