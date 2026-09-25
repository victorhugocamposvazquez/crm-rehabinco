"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  anunciosDeZonas,
  paginasListadoDiaZona,
  paginasListadoEstimadas,
  zonaSuperaCorte,
  zonasPorDefecto,
  type ZonaIdealista,
} from "@/lib/captacion/brightdata/zonas";
import {
  presupuestoUnlockerPorDefecto,
  simularListadoZonas,
  type PresupuestoUnlockerCliente,
} from "@/lib/captacion/brightdata/simulacion-zonas";

type UltimaRecogida = {
  fecha: string;
  zonas: string[];
  vistos: number;
  nuevos: number;
  retirados: number;
  estado: "abierta" | "completa" | "incompleta";
};

const MOTIVO: Record<string, string> = {
  vacia: "el listado llegó vacío",
  caida: "llegó menos del 50 % de la recogida anterior",
  pagina_invalida: "la página no trae el bloque de anuncios",
};

type DiagnosticoUnlocker = {
  unlocker_zone: string | null;
  unlocker_url: string | null;
  http_status: number | null;
  content_type: string | null;
  bytes: number | null;
  cuerpo_muestra: string | null;
};

function BloqueDiagnostico({ diag }: { diag: DiagnosticoUnlocker }) {
  return (
    <div className="mt-2 space-y-1 rounded border border-[#E8D4D4] bg-[#FBF7F7] p-2 text-[11.5px] font-mono text-neutral-800">
      <div>zone: {diag.unlocker_zone ?? "—"}</div>
      <div className="break-all">url: {diag.unlocker_url ?? "—"}</div>
      <div>
        HTTP {diag.http_status ?? "—"} · {diag.content_type ?? "—"} · {diag.bytes ?? 0} bytes
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10.5px]">{diag.cuerpo_muestra ?? ""}</pre>
    </div>
  );
}

export function ZonasIdealistaCard() {
  const [zonas, setZonas] = useState<ZonaIdealista[]>([]);
  const [activas, setActivas] = useState<string[]>([]);
  const [estimados, setEstimados] = useState<Record<string, number | null>>({});
  const [sospechosas, setSospechosas] = useState<Record<string, string>>({});
  const [diagnosticos, setDiagnosticos] = useState<Record<string, DiagnosticoUnlocker>>({});
  const [diagnosticosTelefono, setDiagnosticosTelefono] = useState<
    Array<DiagnosticoUnlocker & { id: string; url: string | null; intentos: number | null; estado: string | null }>
  >([]);
  const [ultima, setUltima] = useState<UltimaRecogida | null>(null);
  const [fichasPendientes, setFichasPendientes] = useState(0);
  const [fichasEnCola, setFichasEnCola] = useState(0);
  const [encolandoFichas, setEncolandoFichas] = useState(false);
  const [telefonos, setTelefonos] = useState<{
    hoy: { pedidos: number; obtenidos: number; fallidos: number; tasa: number | null };
    sieteDias: { tasa: number | null };
    pausado: boolean;
  } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [presupuestoUnlocker, setPresupuestoUnlocker] = useState<PresupuestoUnlockerCliente | null>(null);

  const sim = useMemo(
    () => simularListadoZonas(activas, estimados, presupuestoUnlocker ?? presupuestoUnlockerPorDefecto()),
    [activas, estimados, presupuestoUnlocker]
  );

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/captacion/brightdata/zonas");
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        zonas?: ZonaIdealista[];
        activas?: string[];
        estimados?: Record<string, number | null>;
        sospechosas?: Record<string, string>;
        diagnosticos?: Record<string, DiagnosticoUnlocker>;
        diagnosticosTelefono?: Array<
          DiagnosticoUnlocker & { id: string; url: string | null; intentos: number | null; estado: string | null }
        >;
        ultima?: UltimaRecogida | null;
        fichasPendientes?: number;
        fichasEnCola?: number;
        telefonos?: { hoy: { pedidos: number; obtenidos: number; fallidos: number; tasa: number | null }; sieteDias: { tasa: number | null }; pausado: boolean };
        presupuestoUnlocker?: PresupuestoUnlockerCliente;
      };
      if (!res.ok || !json.ok || !json.zonas) {
        toast.error(json.error || "No se han podido leer las zonas.");
        setCargando(false);
        return;
      }
      setZonas(json.zonas);
      setActivas(json.activas ?? json.zonas.filter((zona) => zona.porDefecto).map((zona) => zona.id));
      setEstimados(json.estimados ?? {});
      setSospechosas(json.sospechosas ?? {});
      setDiagnosticos(json.diagnosticos ?? {});
      setDiagnosticosTelefono(json.diagnosticosTelefono ?? []);
      setUltima(json.ultima ?? null);
      setFichasPendientes(json.fichasPendientes ?? 0);
      setFichasEnCola(json.fichasEnCola ?? 0);
      setTelefonos(json.telefonos ?? null);
      if (json.presupuestoUnlocker) setPresupuestoUnlocker(json.presupuestoUnlocker);
      setCargando(false);
    })();
  }, []);

  const grupos = zonas.reduce<Array<{ nombre: string; zonas: ZonaIdealista[] }>>((lista, zona) => {
    const grupo = lista.find((item) => item.nombre === zona.grupo);
    if (grupo) grupo.zonas.push(zona);
    else lista.push({ nombre: zona.grupo, zonas: [zona] });
    return lista;
  }, []);

  const alternar = (id: string) => {
    setActivas((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const guardar = async () => {
    setGuardando(true);
    const res = await fetch("/api/captacion/brightdata/zonas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activas, estimados }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string; activas?: string[] };
    setGuardando(false);
    if (!res.ok || !json.ok) {
      toast.error(json.error || "No se han podido guardar las zonas.");
      return;
    }
    if (json.activas) setActivas(json.activas);
    toast.success("Zonas guardadas. El listado usará solo estas.");
  };

  const nombres = new Map(zonas.map((zona) => [zona.id, zona.nombre]));
  const problemas = Object.entries(sospechosas);
  const fecha = ultima
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(ultima.fecha))
    : null;

  return (
    <>
    <Card className="md:col-span-2">
      <CardContent className="space-y-1 py-4 text-[13.5px] text-neutral-800">
        <p>
          Última recogida:{" "}
          {ultima && fecha
            ? `${fecha}, ${ultima.zonas.length} zonas, ${ultima.vistos} vistos / ${ultima.nuevos} nuevos / ${ultima.retirados} retirados, ${ultima.estado}`
            : "ninguna"}
        </p>
        <p>
          Sin ficha enriquecida: {fichasPendientes}
          {fichasEnCola > 0 ? ` · ${fichasEnCola} en cola Unlocker` : ""}
          <button
            type="button"
            className="ml-2 underline disabled:opacity-50"
            disabled={encolandoFichas}
            onClick={() => {
              void (async () => {
                setEncolandoFichas(true);
                try {
                  const res = await fetch("/api/captacion/brightdata/completar-fichas", { method: "POST" });
                  const json = (await res.json()) as {
                    ok?: boolean;
                    error?: string;
                    intentadas?: number;
                    nuevas?: number;
                    yaEnCola?: number;
                    reactivadas?: number;
                    elegibles?: number;
                    fichasEnCola?: number;
                  };
                  if (!res.ok || !json.ok) {
                    toast.error(json.error ?? "No se pudieron encolar fichas.");
                    return;
                  }
                  setFichasEnCola(json.fichasEnCola ?? fichasEnCola);
                  const movidas = (json.nuevas ?? 0) + (json.reactivadas ?? 0);
                  if ((json.intentadas ?? 0) === 0) {
                    toast.message(
                      json.elegibles === 0
                        ? "Ningún anuncio activo (novedad/contacto/visita/negociando) necesita ficha."
                        : `Hay ${json.elegibles ?? 0} elegibles, pero ninguno en este lote de 300.`
                    );
                  } else if (movidas === 0) {
                    toast.message(
                      `${json.yaEnCola ?? 0} ya estaban en cola. Usa «Procesar ráfaga ahora» en Captación (cada 5 min el cron).`
                    );
                  } else {
                    toast.success(
                      `${movidas} fichas listas para ráfaga (${json.nuevas ?? 0} nuevas, ${json.reactivadas ?? 0} reactivadas). Cola total: ${json.fichasEnCola ?? "—"}.`
                    );
                  }
                } finally {
                  setEncolandoFichas(false);
                }
              })();
            }}
          >
            {encolandoFichas ? "Encolando…" : "Completar fichas"}
          </button>
        </p>
        <p>
          Teléfonos hoy: {telefonos ? `${telefonos.hoy.pedidos} pedidos, ${telefonos.hoy.obtenidos} obtenidos, ${telefonos.hoy.fallidos} fallidos` : "—"}
          {telefonos?.sieteDias.tasa != null ? ` · éxito 7 días ${Math.round(telefonos.sieteDias.tasa * 100)} %` : ""}
          {telefonos?.pausado ? " · cola pausada" : ""}
        </p>
        {diagnosticosTelefono.length > 0 ? (
          <details className="text-[12.5px] text-[#8A3030]">
            <summary className="cursor-pointer">Últimos fallos de teléfono (Unlocker)</summary>
            <ul className="mt-2 space-y-2">
              {diagnosticosTelefono.map((diag) => (
                <li key={diag.id}>
                  <p className="font-medium text-neutral-800">
                    {diag.url ?? diag.id} · {diag.estado ?? "—"} · intentos {diag.intentos ?? 0}
                  </p>
                  <BloqueDiagnostico diag={diag} />
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <p>
          Zonas con problema:{" "}
          {problemas.length === 0
            ? "ninguna"
            : problemas.map(([id, motivo]) => `${nombres.get(id) ?? id} (${MOTIVO[motivo] ?? motivo})`).join(". ")}
        </p>
      </CardContent>
    </Card>
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Zonas de Idealista</CardTitle>
        <CardDescription>
          Solo se leen las marcadas. El número es el estimado: por encima de 1.500 hay que partir la zona.
          Las marcadas suman {anunciosDeZonas(activas).toLocaleString("es-ES")} anuncios (~
          {paginasListadoEstimadas(activas)} pág. listado/día si la recogida termina entera) + provincia 48 h.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cargando ? <p className="text-sm text-neutral-500">Cargando zonas…</p> : null}
        <div
          className={`rounded-md border px-3 py-3 text-[13px] ${
            sim.dentroTope ? "border-[var(--border)] bg-[var(--surface-2)]" : "border-[#E8A4A4] bg-[#FBF3F3]"
          }`}
        >
          <p className="font-medium text-[var(--text-1)]">Simulación Unlocker (listado diario)</p>
          <p className="mt-1 text-[var(--text-2)]">
            {sim.zonasActivas === 0
              ? "Marca al menos un municipio para estimar peticiones."
              : `${sim.paginasDia.toLocaleString("es-ES")} pet./día (${sim.paginasMunicipiosDia} municipios + ${sim.paginasProvinciaDia} provincia 48 h) → ~${sim.paginasMes.toLocaleString("es-ES")} pet./mes (${sim.diasMes} días).`}
          </p>
          {sim.zonasActivas > 0 ? (
            <>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className={`h-full transition-all ${sim.dentroTope ? "bg-emerald-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, Math.round(sim.pctDelTope * 100))}%` }}
                />
              </div>
              <p className="mt-1.5 text-[12.5px] text-[var(--text-2)]">
                {Math.round(sim.pctDelTope * 100)} % del tope mensual ({sim.topeMes.toLocaleString("es-ES")} pet. ={" "}
                {sim.creditosGratis.toLocaleString("es-ES")} créditos + {sim.usdMes.toFixed(0)} USD).
                {sim.usdEstimadoListado > 0
                  ? ` Solo listado: ~${sim.usdEstimadoListado.toFixed(2)} USD de bolsillo (tras créditos).`
                  : " Solo listado: cubierto por créditos gratis."}
                {sim.margenPeticiones > 0
                  ? ` Margen ~${sim.margenPeticiones.toLocaleString("es-ES")} pet./mes para fichas y teléfonos.`
                  : sim.dentroTope
                    ? ""
                    : ` Te pasas ~${Math.abs(sim.margenPeticiones).toLocaleString("es-ES")} pet./mes solo con listado.`}
              </p>
            </>
          ) : null}
          {presupuestoUnlocker ? (
            <p className="mt-2 border-t border-[var(--border)] pt-2 text-[12px] text-[var(--text-3)]">
              Gasto real este mes (todas las ráfagas): {presupuestoUnlocker.usadasMes.toLocaleString("es-ES")} /{" "}
              {presupuestoUnlocker.topeMes.toLocaleString("es-ES")} pet. · quedan{" "}
              {presupuestoUnlocker.restantesMes.toLocaleString("es-ES")}. Fichas/teléfonos no entran en la barra verde.
            </p>
          ) : null}
        </div>
        {grupos.map((grupo) => (
          <fieldset key={grupo.nombre} className="space-y-2">
            <legend className="text-[13px] font-semibold text-neutral-800">{grupo.nombre}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {grupo.zonas.map((zona) => (
                <label key={zona.id} className="flex items-center gap-2 text-[13.5px]">
                  <input
                    type="checkbox"
                    checked={activas.includes(zona.id)}
                    onChange={() => alternar(zona.id)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 flex-1">
                    {zona.nombre}
                    {activas.includes(zona.id) ? (
                      <span className="ml-1 text-[12px] text-[var(--text-3)]">
                        ~{paginasListadoDiaZona(zona.id, estimados)} pet./día
                      </span>
                    ) : null}
                    {zonaSuperaCorte(estimados[zona.id] ?? null) ? (
                      <span className="mt-0.5 block text-[12px] text-[#8A3030]">Supera 1.500 anuncios. Hay que partir esta zona.</span>
                    ) : null}
                    {sospechosas[zona.id] ? (
                      <details className="mt-0.5 text-[12px] text-[#8A3030]">
                        <summary className="cursor-pointer">
                          Sospechosa: {MOTIVO[sospechosas[zona.id]] ?? sospechosas[zona.id]}. Ver respuesta Unlocker
                        </summary>
                        {diagnosticos[zona.id] ? <BloqueDiagnostico diag={diagnosticos[zona.id]} /> : <p className="mt-1 text-[11px]">Sin muestra guardada en esta recogida.</p>}
                      </details>
                    ) : null}
                  </span>
                  <input
                    type="number"
                    min={0}
                    aria-label={`Estimado de ${zona.nombre}`}
                    value={estimados[zona.id] ?? ""}
                    onChange={(e) => {
                      const valor = e.target.value === "" ? null : Number(e.target.value);
                      setEstimados((prev) => ({ ...prev, [zona.id]: valor != null && Number.isFinite(valor) ? valor : null }));
                    }}
                    className="w-20 rounded border border-[var(--input)] px-1.5 py-1 text-right text-[12.5px]"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={guardando || cargando}
            onClick={() => setActivas(zonasPorDefecto())}
          >
            14 grandes (diario)
          </Button>
          <Button type="button" disabled={guardando || cargando} onClick={() => void guardar()}>
            {guardando ? "Guardando…" : "Guardar zonas"}
          </Button>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
