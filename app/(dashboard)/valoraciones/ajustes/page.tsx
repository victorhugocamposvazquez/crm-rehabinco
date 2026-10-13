"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MarcaAgenciaForm } from "@/components/avm/MarcaAgenciaForm";
import { ValoracionesNav } from "@/components/avm/ValoracionesNav";
import type { MarcaGuardada } from "@/lib/actions/agency-branding";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import type { AvmDataLayer } from "@/lib/avm/data-health";
import {
  GRUPOS_SERVICIO,
  SERVICIOS_VALORADOR,
  estadoDeCapa,
  estadoDeMercado,
  etiquetaEstado,
  fmtCuando,
  fmtProxima,
  plazoCapa,
  proximaCarga,
  type EstadoServicio,
  type ServicioValorador,
} from "@/lib/avm/servicios-valorador";

type HealthRow = { layer: AvmDataLayer; loaded_at: string | null };
type Stats = {
  listings: { portal: string; operation: string; active: number }[];
  municipalities: { portal: string; municipalities: number; lastRun: string | null }[];
  catastroCache: number;
  censusSections: number;
  valuations: number;
  environmentLayers: { layer: string; source: string; category: string | null; n: number; loaded_at: string }[];
};

const TONO: Record<EstadoServicio, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  stale: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  missing: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-2)]",
  live: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300",
};

export default function AjustesValoradorPage() {
  const { user } = useAuth();
  const permitido = isAdmin(user?.role);
  const [health, setHealth] = useState<HealthRow[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [marca, setMarca] = useState<MarcaGuardada | null>(null);

  useEffect(() => {
    if (!permitido) return;
    const supabase = createClient();
    void supabase.rpc("avm_data_health").then(({ data }) => {
      if (Array.isArray(data)) setHealth(data as HealthRow[]);
    });
    void supabase.rpc("avm_method_stats", { p_empty: false }).then(({ data }) => {
      if (data) setStats(data as Stats);
    });
    void supabase
      .from("agency_branding")
      .select("name, color, pdf_theme, phone, email, web, logo_light_path, logo_dark_path")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setMarca({
          name: data.name,
          color: data.color,
          pdf_theme: data.pdf_theme === "dark" ? "dark" : "light",
          phone: data.phone,
          email: data.email,
          web: data.web,
          logo_light_path: data.logo_light_path,
          logo_dark_path: data.logo_dark_path,
        });
      });
  }, [permitido]);

  const porCapa = useMemo(() => {
    const map = new Map<AvmDataLayer, string | null>();
    for (const row of health ?? []) map.set(row.layer, row.loaded_at);
    return map;
  }, [health]);

  const ultimaPasada = useMemo(() => {
    const fechas = (stats?.municipalities ?? [])
      .map((m) => m.lastRun)
      .filter((v): v is string => Boolean(v));
    if (!fechas.length) return null;
    return fechas.sort().at(-1) ?? null;
  }, [stats]);

  const anuncios = (stats?.listings ?? []).reduce((n, l) => n + (l.active ?? 0), 0);

  if (!permitido) {
    return (
      <div>
        <PageHeader title="Ajustes del valorador" />
        <p className="text-[14px] text-[var(--text-2)]">Esta página es de quien ve los ajustes de la agencia.</p>
      </div>
    );
  }

  const listo = health !== null;
  const filas = SERVICIOS_VALORADOR.map((servicio) => decorar(servicio, porCapa, ultimaPasada, stats, listo));
  const cargas = filas.filter((f) => f.estado !== "live");
  const alDia = cargas.filter((f) => f.estado === "ok").length;
  const fuera = cargas.filter((f) => f.estado === "stale").length;
  const sin = cargas.filter((f) => f.estado === "missing").length;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Valoraciones", href: "/valoraciones" }, { label: "Ajustes" }]}
        title="Ajustes del valorador"
        description="Qué datos usa una valoración, cada cuánto se renuevan y si la última carga sigue dentro de plazo."
      />
      <ValoracionesNav actual="/valoraciones/ajustes" />
      {marca ? <MarcaAgenciaForm marca={marca} /> : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Resumen n={listo ? alDia : null} etiqueta="Al día" detalle="Última carga dentro del plazo" tono="ok" />
        <Resumen n={listo ? fuera : null} etiqueta="Fuera de plazo" detalle="Siguen usándose, pero toca renovar" tono="stale" />
        <Resumen n={listo ? sin : null} etiqueta="Sin carga" detalle="El informe no puede mostrarlos" tono="missing" />
      </div>

      <div className="space-y-8">
        {GRUPOS_SERVICIO.map((grupo) => (
          <section key={grupo.id}>
            <h2 className="text-[18px] font-semibold tracking-tight">{grupo.titulo}</h2>
            <p className="mb-3 mt-1 max-w-2xl text-[13px] leading-snug text-[var(--text-2)]">{grupo.texto}</p>
            <div className="grid gap-3 lg:grid-cols-2">
              {filas
                .filter((f) => f.servicio.grupo === grupo.id)
                .map((f) => (
                  <Tarjeta key={f.servicio.id} fila={f} anuncios={anuncios} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Resumen({
  n,
  etiqueta,
  detalle,
  tono,
}: {
  n: number | null;
  etiqueta: string;
  detalle: string;
  tono: "ok" | "stale" | "missing";
}) {
  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-[28px] font-semibold tabular-nums leading-none">{n == null ? "…" : n}</p>
      <p className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[12px] font-medium ${TONO[tono]}`}>{etiqueta}</p>
      <p className="mt-1.5 text-[12px] text-[var(--text-3)]">{detalle}</p>
    </div>
  );
}

type FilaVista = {
  servicio: ServicioValorador;
  estado: EstadoServicio;
  ultima: string;
  proxima: string;
  nota: string;
};

function decorar(
  servicio: ServicioValorador,
  porCapa: Map<AvmDataLayer, string | null>,
  ultimaPasada: string | null,
  stats: Stats | null,
  listo: boolean,
): FilaVista {
  if (servicio.capa) {
    const loaded = listo ? (porCapa.get(servicio.capa) ?? null) : null;
    return {
      servicio,
      estado: listo ? estadoDeCapa(servicio.capa, loaded) : "missing",
      ultima: listo ? fmtCuando(loaded) : "Cargando…",
      proxima: fmtProxima(proximaCarga(servicio.cadencia)),
      nota: `Se considera vieja a los ${plazoCapa(servicio.capa)} sin recarga.`,
    };
  }
  if (servicio.id === "mercado") {
    return {
      servicio,
      estado: stats ? estadoDeMercado(ultimaPasada) : "missing",
      ultima: stats ? fmtCuando(ultimaPasada) : "Cargando…",
      proxima: fmtProxima(proximaCarga(servicio.cadencia)),
      nota: "Si pasa más de 10 días sin pasada, el mercado se marca fuera de plazo.",
    };
  }
  const cache = stats?.catastroCache ?? 0;
  const nota =
    servicio.id === "catastro"
      ? cache > 0
        ? `${cache.toLocaleString("es-ES")} consultas guardadas en caché.`
        : "Aún no hay consultas en caché."
      : servicio.id === "google"
        ? "Solo entra si CartoCiudad no devuelve portal."
        : "Geocodificación directa, sin calendario.";
  return {
    servicio,
    estado: "live",
    ultima: servicio.id === "catastro" && cache > 0 ? "Caché en uso" : "Bajo demanda",
    proxima: "Al abrir una valoración",
    nota,
  };
}

function Tarjeta({ fila, anuncios }: { fila: FilaVista; anuncios: number }) {
  const { servicio, estado } = fila;
  return (
    <article className="flex flex-col rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold leading-tight">{servicio.titulo}</h3>
          <p className="mt-1 text-[13px] leading-snug text-[var(--text-2)]">{servicio.paraQue}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${fila.ultima === "Cargando…" ? TONO.live : TONO[estado]}`}>
          {fila.ultima === "Cargando…" ? "Cargando" : etiquetaEstado(estado)}
        </span>
      </div>
      <dl className="mt-4 grid gap-2 text-[12px]">
        <Dato k="Frecuencia" v={servicio.cadenciaTexto} />
        <Dato k="Próxima" v={fila.proxima} />
        <Dato k="Última" v={fila.ultima} />
        <Dato k="Origen" v={servicio.donde} />
        {servicio.id === "mercado" && anuncios > 0 ? (
          <Dato k="Anuncios activos" v={anuncios.toLocaleString("es-ES")} />
        ) : null}
      </dl>
      <p className="mt-3 text-[12px] text-[var(--text-3)]">{fila.nota}</p>
    </article>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2">
      <dt className="text-[var(--text-3)]">{k}</dt>
      <dd className="text-[var(--text)]">{v}</dd>
    </div>
  );
}
