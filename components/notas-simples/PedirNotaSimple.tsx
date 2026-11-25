"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { BarraPagina, BotonBarra, BotonPrincipal } from "@/components/layout/BarraPagina";
import { MOTIVOS_NOTA, normalizarRef, type MotivoNota, type NotaResumen } from "@/lib/notas-simples/modelo";
import { PROVEEDOR_MANUAL } from "@/lib/notas-simples/proveedor";
import { cn } from "@/lib/utils";

type Identificacion = "ref" | "idufir" | "finca";

export interface DatosInicialesNota {
  refCatastral?: string;
  direccion?: string;
  municipio?: string;
  provincia?: string;
  propiedadId?: string;
}

const PASOS = ["Inmueble", "Motivo", "Confirmar"] as const;

const campo =
  "h-10 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[15px] outline-none focus:border-[var(--border-strong)]";

function Campo({ label, ayuda, children }: { label: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-[var(--text-2)]">{label}</span>
      {children}
      {ayuda ? <span className="mt-1 block text-[12px] text-[var(--text-3)]">{ayuda}</span> : null}
    </label>
  );
}

function euros(cents: number) {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

/** Pedir una nota simple en tres pasos: identificar la finca, declarar el motivo y confirmar. */
export function PedirNotaSimple({ inicial }: { inicial: DatosInicialesNota }) {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [modo, setModo] = useState<Identificacion>("ref");
  const [refCatastral, setRef] = useState(inicial.refCatastral ?? "");
  const [idufir, setIdufir] = useState("");
  const [finca, setFinca] = useState("");
  const [registro, setRegistro] = useState("");
  const [direccion, setDireccion] = useState(inicial.direccion ?? "");
  const [municipio, setMunicipio] = useState(inicial.municipio ?? "");
  const [provincia, setProvincia] = useState(inicial.provincia ?? "");
  const [titular, setTitular] = useState("");
  const [motivo, setMotivo] = useState<MotivoNota | null>(null);
  const [motivoTexto, setMotivoTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicada, setDuplicada] = useState<NotaResumen | null>(null);

  const ref = normalizarRef(refCatastral) ?? "";
  const idu = normalizarRef(idufir) ?? "";
  const errorPaso1 =
    modo === "ref" && !/^[0-9A-Z]{14}([0-9A-Z]{6})?$/.test(ref)
      ? "La referencia catastral tiene 14 caracteres (finca) o 20 (inmueble)."
      : modo === "idufir" && !/^\d{14}$/.test(idu)
        ? "El IDUFIR (CRU) tiene 14 dígitos."
        : modo === "finca" && (!finca.trim() || !registro.trim())
          ? "Indica el número de finca y su Registro."
          : !direccion.trim()
            ? "Falta la dirección."
            : null;
  const errorPaso2 = !motivo ? "Elige el motivo." : motivo === "otro" && !motivoTexto.trim() ? "Explica el motivo." : null;
  const errorActual = paso === 0 ? errorPaso1 : paso === 1 ? errorPaso2 : null;

  const enviar = async (forzar = false) => {
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch("/api/notas-simples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refCatastral: modo === "ref" ? ref : null,
          idufir: modo === "idufir" ? idu : null,
          fincaRegistral: modo === "finca" ? finca : null,
          registro: modo === "finca" ? registro : null,
          direccion,
          municipio,
          provincia,
          titular,
          motivo,
          motivoTexto: motivo === "otro" ? motivoTexto : null,
          propiedadId: inicial.propiedadId ?? null,
          forzar,
        }),
      });
      const j = (await r.json()) as { ok: boolean; nota?: { id: string }; duplicada?: NotaResumen; error?: string };
      if (r.status === 409 && j.duplicada) {
        setDuplicada(j.duplicada);
        return;
      }
      if (!r.ok || !j.ok || !j.nota) throw new Error(j.error || `Error ${r.status}`);
      router.push(`/notas-simples/${j.nota.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  const identificacion = modo === "ref" ? `Ref. catastral ${ref}` : modo === "idufir" ? `IDUFIR ${idu}` : `Finca ${finca} · Registro ${registro}`;

  return (
    <div className="-mx-3.5 -mt-5 min-[820px]:-mx-6 min-[820px]:-mt-6" data-testid="pedir-nota-simple">
      <BarraPagina
        titulo="Pedir nota simple"
        acciones={
          <Link href="/notas-simples" className="inline-flex h-10 items-center gap-1.5 rounded-[6px] px-2 text-sm text-[var(--text-2)] hover:bg-[var(--accent-soft)] hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Notas simples
          </Link>
        }
      />

      <div className="mx-auto max-w-[720px] px-3.5 py-6 min-[820px]:py-10">
        <ol className="mb-6 flex items-center gap-2" aria-label="Pasos">
          {PASOS.map((p, i) => (
            <li key={p} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-medium",
                  i < paso ? "bg-[var(--green-bg)] text-[var(--green)]" : i === paso ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-[var(--accent-soft)] text-[var(--text-3)]"
                )}
                aria-current={i === paso ? "step" : undefined}
              >
                {i < paso ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn("text-sm", i === paso ? "font-medium text-foreground" : "text-[var(--text-2)]")}>{p}</span>
              {i < PASOS.length - 1 ? <span className="h-px flex-1 bg-[var(--border)]" /> : null}
            </li>
          ))}
        </ol>

        <section className="aire-panel">
          {paso === 0 ? (
            <>
              <h2 className="aire-panel-cabecera">¿De qué finca es la nota?</h2>
              <div className="space-y-4 p-4 min-[820px]:p-6">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cómo identificarla">
                  {(
                    [
                      ["ref", "Referencia catastral"],
                      ["idufir", "IDUFIR / CRU"],
                      ["finca", "Finca y Registro"],
                    ] as const
                  ).map(([id, label]) => (
                    <BotonBarra key={id} activo={modo === id} role="radio" aria-checked={modo === id} onClick={() => setModo(id)}>
                      {label}
                    </BotonBarra>
                  ))}
                </div>
                {modo === "ref" ? (
                  <Campo label="Referencia catastral" ayuda="Con 20 caracteres la nota es de ese piso o local; con 14, de la finca entera.">
                    <input value={refCatastral} onChange={(e) => setRef(e.target.value)} className={cn(campo, "uppercase tabular-nums")} autoFocus />
                  </Campo>
                ) : modo === "idufir" ? (
                  <Campo label="IDUFIR / CRU" ayuda="14 dígitos. Aparece en notas y escrituras recientes.">
                    <input value={idufir} onChange={(e) => setIdufir(e.target.value)} className={cn(campo, "tabular-nums")} inputMode="numeric" autoFocus />
                  </Campo>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo label="Número de finca registral">
                      <input value={finca} onChange={(e) => setFinca(e.target.value)} className={campo} autoFocus />
                    </Campo>
                    <Campo label="Registro de la Propiedad" ayuda="Por ejemplo: A Coruña nº 1">
                      <input value={registro} onChange={(e) => setRegistro(e.target.value)} className={campo} />
                    </Campo>
                  </div>
                )}
                <Campo label="Dirección">
                  <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={campo} placeholder="Calle, número, piso" />
                </Campo>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo label="Municipio">
                    <input value={municipio} onChange={(e) => setMunicipio(e.target.value)} className={campo} />
                  </Campo>
                  <Campo label="Provincia">
                    <input value={provincia} onChange={(e) => setProvincia(e.target.value)} className={campo} />
                  </Campo>
                </div>
                <Campo label="Titular (si lo conoces)" ayuda="Ayuda a localizarla cuando hay varias fincas en la misma dirección.">
                  <input value={titular} onChange={(e) => setTitular(e.target.value)} className={campo} />
                </Campo>
              </div>
            </>
          ) : paso === 1 ? (
            <>
              <h2 className="aire-panel-cabecera">¿Para qué la necesitas?</h2>
              <div className="space-y-2 p-4 min-[820px]:p-6">
                <p className="mb-3 text-[14px] text-[var(--text-2)]">El Registro pide declarar un interés legítimo. Elige el que corresponda.</p>
                {MOTIVOS_NOTA.map((m) => (
                  <label
                    key={m.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-[6px] border px-3 py-3 text-[15px]",
                      motivo === m.id ? "border-[var(--border-strong)] bg-[var(--accent-soft)]" : "border-[var(--border)] hover:bg-[var(--surface-soft)]"
                    )}
                  >
                    <input type="radio" name="motivo" checked={motivo === m.id} onChange={() => setMotivo(m.id)} className="accent-[var(--accent)]" />
                    {m.label}
                  </label>
                ))}
                {motivo === "otro" ? (
                  <textarea
                    value={motivoTexto}
                    onChange={(e) => setMotivoTexto(e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 text-[15px] outline-none focus:border-[var(--border-strong)]"
                    placeholder="Explica brevemente el motivo"
                    autoFocus
                  />
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h2 className="aire-panel-cabecera">Revisa y confirma</h2>
              <dl className="divide-y divide-[var(--border)]">
                {[
                  ["Finca", identificacion],
                  ["Dirección", [direccion, municipio, provincia].filter(Boolean).join(", ")],
                  ["Titular", titular || "—"],
                  ["Motivo", motivo === "otro" ? motivoTexto : MOTIVOS_NOTA.find((m) => m.id === motivo)?.label ?? ""],
                  ["Precio orientativo", `${euros(PROVEEDOR_MANUAL.precioCents)} (IVA incluido, tasa del Registro)`],
                  ["Plazo", PROVEEDOR_MANUAL.plazo],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-4 px-4 py-3 min-[820px]:px-6">
                    <dt className="w-40 shrink-0 text-[14px] text-[var(--text-2)]">{k}</dt>
                    <dd className="min-w-0 flex-1 text-[15px]">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="border-t border-[var(--border)] px-4 py-3 text-[13px] text-[var(--text-2)] min-[820px]:px-6">
                La tramita alguien del equipo en la sede del Registro. Cuando llegue el PDF se sube a la nota y el CRM extrae titulares y cargas.
              </p>
            </>
          )}

          {duplicada ? (
            <div className="mx-4 mb-4 rounded-[6px] bg-[var(--amber-bg)] px-3 py-3 text-[14px] text-[var(--amber-ink)] min-[820px]:mx-6">
              <p className="mb-2">
                {duplicada.estado === "solicitada" || duplicada.estado === "en_tramite"
                  ? "Ya hay una nota de esta finca en curso."
                  : "Ya tenéis una nota de esta finca de los últimos 90 días."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/notas-simples/${duplicada.id}`} className="inline-flex h-9 items-center rounded-[6px] bg-[var(--accent)] px-3 text-sm text-[var(--accent-foreground)]">
                  Ver la existente
                </Link>
                <BotonBarra className="h-9" onClick={() => enviar(true)} disabled={enviando}>
                  Pedir otra igualmente
                </BotonBarra>
              </div>
            </div>
          ) : null}
          {error ? <p className="mx-4 mb-4 rounded-[6px] bg-[var(--red-bg)] px-3 py-2 text-[14px] text-[var(--red)] min-[820px]:mx-6">{error}</p> : null}

          <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-3 min-[820px]:px-6">
            {paso > 0 ? (
              <BotonBarra onClick={() => setPaso((p) => p - 1)} disabled={enviando}>
                Atrás
              </BotonBarra>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              {errorActual ? <span className="hidden text-[13px] text-[var(--text-3)] sm:inline">{errorActual}</span> : null}
              {paso < 2 ? (
                <BotonPrincipal onClick={() => setPaso((p) => p + 1)} disabled={!!errorActual}>
                  Continuar
                </BotonPrincipal>
              ) : (
                <BotonPrincipal onClick={() => enviar(false)} disabled={enviando || !!duplicada}>
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Pedir nota simple
                </BotonPrincipal>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
