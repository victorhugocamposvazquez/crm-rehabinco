"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { anunciosDeZonas, zonaSuperaCorte, type ZonaIdealista } from "@/lib/captacion/brightdata/zonas";

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
  const [ultima, setUltima] = useState<UltimaRecogida | null>(null);
  const [fichasPendientes, setFichasPendientes] = useState(0);
  const [telefonos, setTelefonos] = useState<{
    hoy: { pedidos: number; obtenidos: number; fallidos: number; tasa: number | null };
    sieteDias: { tasa: number | null };
    pausado: boolean;
  } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

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
        ultima?: UltimaRecogida | null;
        fichasPendientes?: number;
        telefonos?: { hoy: { pedidos: number; obtenidos: number; fallidos: number; tasa: number | null }; sieteDias: { tasa: number | null }; pausado: boolean };
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
      setUltima(json.ultima ?? null);
      setFichasPendientes(json.fichasPendientes ?? 0);
      setTelefonos(json.telefonos ?? null);
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
          Fichas pendientes: {fichasPendientes}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => {
              void fetch("/api/captacion/brightdata/completar-fichas", { method: "POST" }).then(() => toast.success("Fichas encoladas. Se leen en las pasadas de cada 5 minutos."));
            }}
          >
            Completar fichas
          </button>
        </p>
        <p>
          Teléfonos hoy: {telefonos ? `${telefonos.hoy.pedidos} pedidos, ${telefonos.hoy.obtenidos} obtenidos, ${telefonos.hoy.fallidos} fallidos` : "—"}
          {telefonos?.sieteDias.tasa != null ? ` · éxito 7 días ${Math.round(telefonos.sieteDias.tasa * 100)} %` : ""}
          {telefonos?.pausado ? " · cola pausada" : ""}
        </p>
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
          Las marcadas suman {anunciosDeZonas(activas).toLocaleString("es-ES")} anuncios en el catálogo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cargando ? <p className="text-sm text-neutral-500">Cargando zonas…</p> : null}
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
        <Button type="button" disabled={guardando || cargando} onClick={() => void guardar()}>
          {guardando ? "Guardando…" : "Guardar zonas"}
        </Button>
      </CardContent>
    </Card>
    </>
  );
}
