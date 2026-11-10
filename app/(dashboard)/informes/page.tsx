"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Medal,
  Award,
  Flame,
  Building2,
  ClipboardCheck,
  Handshake,
  Compass,
  PhoneCall,
  Sparkles,
  ArrowUpDown,
  ChevronRight,
  CheckCircle2,
  Info,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import {
  PUNTOS_XP,
  formatoEurosCorto,
  type CategoriaRanking,
  type EstadisticaUsuario,
  type ItemPodio,
  type MedallaPodio,
  type PeriodoEstadisticas,
  type ResultadoEstadisticas,
} from "@/lib/estadisticas/calcular";

type RespuestaApi = ResultadoEstadisticas & {
  ok: boolean;
  miUserId?: string;
  error?: string;
};

const PERIODOS: Array<{ id: PeriodoEstadisticas; label: string }> = [
  { id: "semana", label: "Esta semana" },
  { id: "mes", label: "Este mes" },
  { id: "trimestre", label: "Trimestre" },
  { id: "anio", label: "Este año" },
  { id: "todo", label: "Histórico" },
];

const CATEGORIAS_PODIO: Array<{
  id: CategoriaRanking;
  label: string;
  descripcion: string;
}> = [
  {
    id: "xp",
    label: "Ranking Global XP",
    descripcion: "Puntuación global combinando ventas, captaciones, visitas y seguimiento.",
  },
  {
    id: "captaciones",
    label: "Top Captaciones",
    descripcion: "Inmuebles dados de alta en cartera y hojas de encargo en exclusiva firmadas.",
  },
  {
    id: "visitas",
    label: "Top Visitas",
    descripcion: "Partes de visita firmados digitalmente con clientes y citas completadas.",
  },
  {
    id: "cierres",
    label: "Top Ventas y Cierres",
    descripcion: "Ventas, alquileres, contratos de arras y acuerdos cerrados.",
  },
  {
    id: "prospeccion",
    label: "Top Prospección",
    descripcion: "Fincas de Catastro trabajadas, encargos de calle, valoraciones AVM y llamadas.",
  },
];

type ColumnaOrden =
  | "xp"
  | "captaciones"
  | "exclusivas"
  | "visitas"
  | "cierres"
  | "prospeccion"
  | "seguimiento"
  | "volumen";

const ESTILO_MEDALLA: Record<
  MedallaPodio,
  {
    titulo: string;
    badgeBg: string;
    badgeText: string;
    cardBorder: string;
    cardBg: string;
    ringColor: string;
    acento: string;
  }
> = {
  oro: {
    titulo: "ORO · #1",
    badgeBg: "bg-amber-400/20 border-amber-400/50",
    badgeText: "text-amber-900",
    cardBorder: "border-amber-400/80",
    cardBg: "bg-gradient-to-b from-amber-50/90 via-[var(--surface)] to-[var(--surface)]",
    ringColor: "ring-amber-400",
    acento: "#D97706",
  },
  plata: {
    titulo: "PLATA · #2",
    badgeBg: "bg-slate-300/35 border-slate-400/50",
    badgeText: "text-slate-800",
    cardBorder: "border-slate-300",
    cardBg: "bg-gradient-to-b from-slate-100/80 via-[var(--surface)] to-[var(--surface)]",
    ringColor: "ring-slate-300",
    acento: "#64748B",
  },
  bronce: {
    titulo: "BRONCE · #3",
    badgeBg: "bg-orange-300/25 border-orange-400/50",
    badgeText: "text-orange-950",
    cardBorder: "border-orange-300/80",
    cardBg: "bg-gradient-to-b from-orange-50/75 via-[var(--surface)] to-[var(--surface)]",
    ringColor: "ring-orange-300",
    acento: "#C2410C",
  },
};

function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "U";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return `${partes[0]![0] ?? ""}${partes[1]![0] ?? ""}`.toUpperCase();
}

export default function InformesPage() {
  const [periodo, setPeriodo] = useState<PeriodoEstadisticas>("mes");
  const [categoriaPodio, setCategoriaPodio] = useState<CategoriaRanking>("xp");
  const [ordenTabla, setOrdenTabla] = useState<ColumnaOrden>("xp");
  const [datos, setDatos] = useState<RespuestaApi | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usuarioDetalleId, setUsuarioDetalleId] = useState<string | null>(null);
  const [verReglasXp, setVerReglasXp] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    void fetch(`/api/estadisticas?periodo=${periodo}`)
      .then(async (res) => {
        const json = (await res.json()) as RespuestaApi;
        if (cancelado) return;
        if (!res.ok || !json.ok) {
          setError(json.error ?? "No se han podido cargar las estadísticas.");
          setCargando(false);
          return;
        }
        setDatos(json);
        setCargando(false);
      })
      .catch(() => {
        if (cancelado) return;
        setError("No se han podido cargar las estadísticas.");
        setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [periodo]);

  const podioActual: ItemPodio[] = useMemo(() => {
    if (!datos) return [];
    return datos.podios[categoriaPodio] ?? [];
  }, [datos, categoriaPodio]);

  const usuariosOrdenados: EstadisticaUsuario[] = useMemo(() => {
    if (!datos) return [];
    const copia = [...datos.usuarios];
    copia.sort((a, b) => {
      switch (ordenTabla) {
        case "captaciones":
          if (b.captaciones.total !== a.captaciones.total) {
            return b.captaciones.total - a.captaciones.total;
          }
          return b.puntosXp - a.puntosXp;
        case "exclusivas":
          if (b.captaciones.exclusivasCerradas !== a.captaciones.exclusivasCerradas) {
            return b.captaciones.exclusivasCerradas - a.captaciones.exclusivasCerradas;
          }
          return b.puntosXp - a.puntosXp;
        case "visitas":
          if (b.visitas.partesFirmados !== a.visitas.partesFirmados) {
            return b.visitas.partesFirmados - a.visitas.partesFirmados;
          }
          return b.visitas.partesTotales - a.visitas.partesTotales;
        case "cierres":
          if (b.cierres.totalOperacionesCerradas !== a.cierres.totalOperacionesCerradas) {
            return b.cierres.totalOperacionesCerradas - a.cierres.totalOperacionesCerradas;
          }
          return b.cierres.propiedadesReservadas - a.cierres.propiedadesReservadas;
        case "prospeccion": {
          const pa =
            a.prospeccion.fincasTrabajadas +
            a.prospeccion.encargosTrabajados +
            a.prospeccion.valoracionesAvm;
          const pb =
            b.prospeccion.fincasTrabajadas +
            b.prospeccion.encargosTrabajados +
            b.prospeccion.valoracionesAvm;
          if (pb !== pa) return pb - pa;
          return b.puntosXp - a.puntosXp;
        }
        case "seguimiento": {
          const sa =
            a.actividad.llamadasRegistradas +
            a.actividad.notasRegistradas +
            a.actividad.tareasCompletadas;
          const sb =
            b.actividad.llamadasRegistradas +
            b.actividad.notasRegistradas +
            b.actividad.tareasCompletadas;
          if (sb !== sa) return sb - sa;
          return b.puntosXp - a.puntosXp;
        }
        case "volumen":
          if (b.cierres.volumenCerradoEur !== a.cierres.volumenCerradoEur) {
            return b.cierres.volumenCerradoEur - a.cierres.volumenCerradoEur;
          }
          return b.puntosXp - a.puntosXp;
        case "xp":
        default:
          return b.puntosXp - a.puntosXp;
      }
    });
    return copia;
  }, [datos, ordenTabla]);

  const miProgreso = useMemo(() => {
    if (!datos?.miUserId) return null;
    const idx = datos.usuarios.findIndex((u) => u.userId === datos.miUserId);
    if (idx === -1) return null;
    const actual = datos.usuarios[idx]!;
    const puesto = idx + 1;
    const siguiente = idx > 0 ? datos.usuarios[idx - 1]! : null;
    const puntosParaSubir = siguiente ? Math.max(1, siguiente.puntosXp - actual.puntosXp) : 0;
    return {
      usuario: actual,
      puesto,
      siguiente,
      puntosParaSubir,
    };
  }, [datos]);

  const usuarioSeleccionado = useMemo(() => {
    if (!datos) return null;
    const id = usuarioDetalleId ?? datos.miUserId ?? datos.usuarios[0]?.userId ?? null;
    if (!id) return null;
    return datos.usuarios.find((u) => u.userId === id) ?? datos.usuarios[0] ?? null;
  }, [datos, usuarioDetalleId]);

  const infoCategoria = CATEGORIAS_PODIO.find((c) => c.id === categoriaPodio) ?? CATEGORIAS_PODIO[0]!;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        breadcrumb={[{ label: "Estadísticas y Ranking" }]}
        title="Estadísticas y Ranking"
        description="Rendimiento por usuario, captaciones, visitas, ventas y podio gamificado del equipo."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {PERIODOS.map((item) => (
              <Chip
                key={item.id}
                active={periodo === item.id}
                onClick={() => setPeriodo(item.id)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {/* Barra de progreso personal gamificada */}
      {miProgreso ? (
        <div className="rounded-[16px] border border-border bg-[var(--surface)] p-4 shadow-xs">
          <div className="flex flex-col gap-3 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-xs"
                style={{ backgroundColor: miProgreso.usuario.color }}
              >
                {inicialesDe(miProgreso.usuario.nombre)}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-semibold text-foreground">
                    Tu posición actual: #{miProgreso.puesto}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[12px] font-semibold text-amber-800">
                    <Flame className="h-3.5 w-3.5" />
                    {miProgreso.usuario.puntosXp.toLocaleString("es-ES")} XP
                  </span>
                  {miProgreso.usuario.insignias.map((ins) => (
                    <span
                      key={ins.id}
                      title={ins.descripcion}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-[var(--field)] px-2.5 py-0.5 text-[11.5px] font-medium text-foreground"
                    >
                      <Sparkles className="h-3 w-3 text-amber-600" />
                      {ins.titulo}
                    </span>
                  ))}
                </div>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-2)]">
                  {miProgreso.siguiente ? (
                    <>
                      Estás a{" "}
                      <strong className="font-semibold text-foreground">
                        {miProgreso.puntosParaSubir} XP
                      </strong>{" "}
                      de alcanzar el puesto #{miProgreso.puesto - 1} ({miProgreso.siguiente.nombre}).
                    </>
                  ) : (
                    "Lideras el ranking global en este periodo. Mantén el ritmo para conservar el Oro."
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setVerReglasXp((v) => !v)}
              className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-[var(--field)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-2)] hover:text-foreground min-[760px]:self-center"
            >
              <Info className="h-3.5 w-3.5" />
              {verReglasXp ? "Ocultar baremo de puntos" : "Cómo se ganan puntos XP"}
            </button>
          </div>

          {verReglasXp ? (
            <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-[var(--border-row)] pt-3.5 text-[12px] min-[680px]:grid-cols-4 min-[1024px]:grid-cols-6">
              <ReglaXp label="Venta / Alquiler / Arras" pts={PUNTOS_XP.cierreOperacion} />
              <ReglaXp label="Reserva de inmueble" pts={PUNTOS_XP.reservaInmueble} />
              <ReglaXp label="Exclusiva firmada" pts={PUNTOS_XP.exclusivaCerrada} />
              <ReglaXp label="Captación inmueble" pts={PUNTOS_XP.inmuebleCaptado} />
              <ReglaXp label="Parte visita firmado" pts={PUNTOS_XP.parteVisitaFirmado} />
              <ReglaXp label="Valoración / Finca / Llamada" pts="10 / 5 / 2" />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ZONA 1: Podio Gamificado (Oro, Plata y Bronce) */}
      <section className="rounded-[18px] border border-border bg-[var(--surface)] p-5">
        <div className="flex flex-col gap-3 min-[860px]:flex-row min-[860px]:items-center min-[860px]:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h2 className="text-[18px] font-semibold tracking-tight">
                Podio del Equipo · Oro, Plata y Bronce
              </h2>
            </div>
            <p className="mt-0.5 text-[12.5px] text-[var(--text-2)]">{infoCategoria.descripcion}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIAS_PODIO.map((cat) => (
              <Chip
                key={cat.id}
                active={categoriaPodio === cat.id}
                onClick={() => setCategoriaPodio(cat.id)}
              >
                {cat.label}
              </Chip>
            ))}
          </div>
        </div>

        {cargando ? (
          <div className="mt-6 grid grid-cols-1 gap-4 min-[780px]:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-48 animate-pulse rounded-2xl border border-border bg-[var(--field)]"
              />
            ))}
          </div>
        ) : podioActual.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--text-2)]">
            No hay usuarios activos para mostrar en el podio.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 items-end gap-4 min-[780px]:grid-cols-3">
            {/* En escritorio mostramos Plata (#2) a la izquierda, Oro (#1) en el centro más alto, Bronce (#3) a la derecha */}
            {ordenPodioVisual(podioActual).map((item) => (
              <TarjetaPodio
                key={item.userId}
                item={item}
                esMio={item.userId === datos?.miUserId}
                seleccionado={usuarioSeleccionado?.userId === item.userId}
                onSelect={() => setUsuarioDetalleId(item.userId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ZONA 2: KPIs Globales de la Agencia en el Periodo */}
      {datos ? (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-foreground">
            Resumen Global del Equipo
          </h2>
          <div className="grid grid-cols-2 gap-2.5 min-[640px]:grid-cols-3 min-[1080px]:grid-cols-6">
            <KpiCard
              icono={<Building2 className="h-4 w-4 text-emerald-600" />}
              valor={String(datos.resumen.captacionesTotales)}
              label="Inmuebles captados"
              sub={`${datos.resumen.exclusivasTotales} exclusivas firmadas`}
            />
            <KpiCard
              icono={<ClipboardCheck className="h-4 w-4 text-blue-600" />}
              valor={String(datos.resumen.visitasFirmadas)}
              label="Visitas firmadas"
              sub={`${datos.resumen.visitasTotales} partes en total`}
            />
            <KpiCard
              icono={<Handshake className="h-4 w-4 text-amber-600" />}
              valor={String(datos.resumen.operacionesCerradas)}
              label="Ventas / Arras / Cierres"
              sub={`${datos.resumen.reservasActivas} reservas en curso`}
            />
            <KpiCard
              icono={<Target className="h-4 w-4 text-purple-600" />}
              valor={formatoEurosCorto(datos.resumen.volumenIntermediadoEur)}
              label="Volumen cerrado"
              sub={`Cartera: ${formatoEurosCorto(datos.resumen.valorCarteraActivaEur)}`}
            />
            <KpiCard
              icono={<Compass className="h-4 w-4 text-indigo-600" />}
              valor={String(datos.resumen.fincasTrabajadas)}
              label="Fincas y encargos"
              sub={`${datos.resumen.valoracionesTotales} valoraciones AVM`}
            />
            <KpiCard
              icono={<PhoneCall className="h-4 w-4 text-rose-600" />}
              valor={String(datos.resumen.llamadasYNotas)}
              label="Llamadas y notas"
              sub={`${datos.resumen.demandasActivas} demandas activas`}
            />
          </div>
        </section>
      ) : null}

      {/* ZONA 3: Tabla Comparativa por Usuario + Embudo Detallado */}
      {datos ? (
        <section className="grid grid-cols-1 gap-5 min-[1140px]:grid-cols-[1fr_360px]">
          <div className="overflow-hidden rounded-[16px] border border-border bg-[var(--surface)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-row)] px-4 py-3.5">
              <div>
                <h2 className="text-[15.5px] font-semibold text-foreground">
                  Clasificación completa por usuario
                </h2>
                <p className="text-[12px] text-[var(--text-2)]">
                  Pulsa en cualquier cabecera para ordenar o en un usuario para ver su embudo de conversión.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border-row)] bg-[var(--field)] text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-2)]">
                    <th className="px-3.5 py-2.5">#</th>
                    <th className="px-3.5 py-2.5">Usuario</th>
                    <ThOrden
                      label="Puntos XP"
                      activa={ordenTabla === "xp"}
                      onClick={() => setOrdenTabla("xp")}
                    />
                    <ThOrden
                      label="Captaciones"
                      activa={ordenTabla === "captaciones"}
                      onClick={() => setOrdenTabla("captaciones")}
                    />
                    <ThOrden
                      label="Exclusivas"
                      activa={ordenTabla === "exclusivas"}
                      onClick={() => setOrdenTabla("exclusivas")}
                    />
                    <ThOrden
                      label="Visitas"
                      activa={ordenTabla === "visitas"}
                      onClick={() => setOrdenTabla("visitas")}
                    />
                    <ThOrden
                      label="Cierres / Ventas"
                      activa={ordenTabla === "cierres"}
                      onClick={() => setOrdenTabla("cierres")}
                    />
                    <ThOrden
                      label="Prospección"
                      activa={ordenTabla === "prospeccion"}
                      onClick={() => setOrdenTabla("prospeccion")}
                    />
                    <ThOrden
                      label="Seguimiento"
                      activa={ordenTabla === "seguimiento"}
                      onClick={() => setOrdenTabla("seguimiento")}
                    />
                    <ThOrden
                      label="Volumen"
                      activa={ordenTabla === "volumen"}
                      onClick={() => setOrdenTabla("volumen")}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-row)]">
                  {usuariosOrdenados.map((u, idx) => {
                    const puesto = idx + 1;
                    const seleccionado = usuarioSeleccionado?.userId === u.userId;
                    const esMio = u.userId === datos.miUserId;
                    return (
                      <tr
                        key={u.userId}
                        onClick={() => setUsuarioDetalleId(u.userId)}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-[var(--surface-soft)]",
                          seleccionado && "bg-accent-soft/60"
                        )}
                      >
                        <td className="px-3.5 py-3 font-semibold tabular-nums">
                          <BadgePuestoTabla puesto={puesto} />
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                              style={{ backgroundColor: u.color }}
                            >
                              {inicialesDe(u.nombre)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                <span className="truncate">{u.nombre}</span>
                                {esMio ? (
                                  <span className="rounded bg-foreground px-1.5 py-0.2 text-[10px] font-semibold text-background">
                                    Tú
                                  </span>
                                ) : null}
                              </div>
                              {u.insignias.length > 0 ? (
                                <div className="mt-0.5 flex flex-wrap gap-1">
                                  {u.insignias.map((ins) => (
                                    <span
                                      key={ins.id}
                                      title={ins.descripcion}
                                      className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.2 text-[10.5px] font-medium text-amber-900"
                                    >
                                      {ins.titulo}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[11.5px] text-[var(--text-3)]">
                                  {u.captaciones.carteraActiva} en cartera activa
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3.5 py-3 font-semibold tabular-nums text-foreground">
                          {u.puntosXp.toLocaleString("es-ES")} XP
                        </td>
                        <td className="px-3.5 py-3 tabular-nums">
                          <div className="font-semibold">{u.captaciones.total}</div>
                          <div className="text-[11.5px] text-[var(--text-2)]">
                            {u.captaciones.compartidas > 0
                              ? `${u.captaciones.individuales} ind · ${u.captaciones.compartidas} comp`
                              : `${u.captaciones.publicadasPortales} publ.`}
                          </div>
                        </td>
                        <td className="px-3.5 py-3 tabular-nums">
                          <div className="font-semibold">{u.captaciones.exclusivasCerradas}</div>
                          <div className="text-[11.5px] text-[var(--text-2)]">
                            {u.captaciones.honorariosCerrados} hon.
                          </div>
                        </td>
                        <td className="px-3.5 py-3 tabular-nums">
                          <div className="font-semibold">
                            {u.visitas.partesFirmados}{" "}
                            <span className="font-normal text-[var(--text-2)]">
                              / {u.visitas.partesTotales}
                            </span>
                          </div>
                          <div className="text-[11.5px] text-[var(--text-2)]">
                            {u.visitas.citasRealizadas} citas ({u.visitas.ratioFirmaPct}% firma)
                          </div>
                        </td>
                        <td className="px-3.5 py-3 tabular-nums">
                          <div className="font-semibold">{u.cierres.totalOperacionesCerradas}</div>
                          <div className="text-[11.5px] text-[var(--text-2)]">
                            {u.cierres.propiedadesReservadas} reservas · {u.cierres.arrasCerradas} arras
                          </div>
                        </td>
                        <td className="px-3.5 py-3 tabular-nums">
                          <div className="font-semibold">
                            {u.prospeccion.fincasTrabajadas + u.prospeccion.encargosTrabajados}
                          </div>
                          <div className="text-[11.5px] text-[var(--text-2)]">
                            {u.prospeccion.valoracionesAvm} val. AVM ({u.prospeccion.conversionFincaPct}% conv.)
                          </div>
                        </td>
                        <td className="px-3.5 py-3 tabular-nums">
                          <div className="font-semibold">
                            {u.actividad.llamadasRegistradas + u.actividad.notasRegistradas}
                          </div>
                          <div className="text-[11.5px] text-[var(--text-2)]">
                            {u.actividad.tareasCompletadas} tareas · {u.actividad.demandasActivas} dem.
                          </div>
                        </td>
                        <td className="px-3.5 py-3 font-medium tabular-nums">
                          <div>{formatoEurosCorto(u.cierres.volumenCerradoEur)}</div>
                          <div className="text-[11.5px] text-[var(--text-2)]">
                            Cartera: {formatoEurosCorto(u.captaciones.valorCarteraEur)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel lateral: Embudo Comercial Individual */}
          {usuarioSeleccionado ? (
            <PanelDetalleUsuario usuario={usuarioSeleccionado} />
          ) : null}
        </section>
      ) : null}

      {/* Atajos rápidos */}
      <div className="flex flex-wrap items-center gap-4 text-[13px] text-[var(--text-2)]">
        <Link href="/captacion" className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
          Ir a Captación <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        <Link href="/propiedades" className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
          Ir a Inmuebles <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        <Link href="/partes-visita" className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
          Ir a Partes de visita <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        <Link href="/demandas" className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
          Ir a Demandas <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function ordenPodioVisual(podio: ItemPodio[]): ItemPodio[] {
  if (podio.length < 2) return podio;
  const oro = podio.find((p) => p.puesto === 1);
  const plata = podio.find((p) => p.puesto === 2);
  const bronce = podio.find((p) => p.puesto === 3);
  return [plata, oro, bronce].filter((item): item is ItemPodio => Boolean(item));
}

function IconoMedalla({ medalla, className }: { medalla: MedallaPodio; className?: string }) {
  if (medalla === "oro") return <Trophy className={cn("text-amber-500", className)} />;
  if (medalla === "plata") return <Medal className={cn("text-slate-500", className)} />;
  return <Award className={cn("text-orange-600", className)} />;
}

function TarjetaPodio({
  item,
  esMio,
  seleccionado,
  onSelect,
}: {
  item: ItemPodio;
  esMio: boolean;
  seleccionado: boolean;
  onSelect: () => void;
}) {
  const estilo = ESTILO_MEDALLA[item.medalla];
  const esOro = item.medalla === "oro";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex w-full flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:shadow-md",
        estilo.cardBorder,
        estilo.cardBg,
        esOro && "min-[780px]:-translate-y-2 min-[780px]:p-5 shadow-sm",
        seleccionado && "ring-2 ring-foreground"
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold tracking-wide",
              estilo.badgeBg,
              estilo.badgeText
            )}
          >
            <IconoMedalla medalla={item.medalla} className="h-3.5 w-3.5" />
            {estilo.titulo}
          </span>
          <span className="text-[12px] font-semibold tabular-nums text-[var(--text-2)]">
            {item.puntosXp.toLocaleString("es-ES")} XP
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-4",
              esOro ? "h-12 w-12 text-base" : "h-10 w-10 text-sm",
              estilo.ringColor
            )}
            style={{ backgroundColor: item.color }}
          >
            {inicialesDe(item.nombre)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[16px] font-semibold text-foreground">{item.nombre}</p>
              {esMio ? (
                <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background">
                  Tú
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[20px] font-bold tabular-nums tracking-tight text-foreground">
              {item.etiquetaValor}
            </p>
          </div>
        </div>

        <p className="mt-2.5 text-[12.5px] text-[var(--text-2)]">{item.subtitulo}</p>
      </div>

      {item.insignias.length > 0 ? (
        <div className="mt-3.5 flex flex-wrap gap-1 border-t border-black/5 pt-2.5">
          {item.insignias.slice(0, 3).map((ins) => (
            <span
              key={ins.id}
              className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-neutral-800 shadow-2xs"
            >
              <Sparkles className="h-2.5 w-2.5 text-amber-500" />
              {ins.titulo}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

function KpiCard({
  icono,
  valor,
  label,
  sub,
}: {
  icono: React.ReactNode;
  valor: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-[var(--surface)] px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-[var(--text-2)]">{label}</span>
        {icono}
      </div>
      <div className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-foreground">
        {valor}
      </div>
      <div className="mt-0.5 text-[11.5px] text-[var(--text-3)]">{sub}</div>
    </div>
  );
}

function ThOrden({
  label,
  activa,
  onClick,
}: {
  label: string;
  activa: boolean;
  onClick: () => void;
}) {
  return (
    <th className="px-3.5 py-2.5">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground",
          activa ? "font-bold text-foreground" : "text-[var(--text-2)]"
        )}
      >
        {label}
        <ArrowUpDown className={cn("h-3 w-3", activa ? "opacity-100" : "opacity-45")} />
      </button>
    </th>
  );
}

function BadgePuestoTabla({ puesto }: { puesto: number }) {
  if (puesto === 1) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/25 text-[12px] font-bold text-amber-900">
        1
      </span>
    );
  }
  if (puesto === 2) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-300/50 text-[12px] font-bold text-slate-800">
        2
      </span>
    );
  }
  if (puesto === 3) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-300/35 text-[12px] font-bold text-orange-950">
        3
      </span>
    );
  }
  return <span className="pl-1.5 text-[var(--text-2)]">{puesto}</span>;
}

function ReglaXp({ label, pts }: { label: string; pts: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-[var(--field)] px-2.5 py-2">
      <div className="font-semibold text-foreground">+{pts} XP</div>
      <div className="text-[11px] text-[var(--text-2)]">{label}</div>
    </div>
  );
}

function PanelDetalleUsuario({ usuario }: { usuario: EstadisticaUsuario }) {
  const maxEmbudo = Math.max(
    1,
    usuario.prospeccion.fincasTrabajadas +
      usuario.prospeccion.encargosTrabajados +
      usuario.actividad.llamadasRegistradas,
    usuario.captaciones.total + usuario.captaciones.exclusivasCerradas,
    usuario.visitas.partesTotales + usuario.visitas.citasRealizadas,
    usuario.cierres.totalOperacionesCerradas + usuario.cierres.propiedadesReservadas
  );

  const etapas = [
    {
      titulo: "1. Prospección y Llamadas",
      valor:
        usuario.prospeccion.fincasTrabajadas +
        usuario.prospeccion.encargosTrabajados +
        usuario.actividad.llamadasRegistradas,
      detalle: `${usuario.prospeccion.fincasTrabajadas} fincas · ${usuario.prospeccion.encargosTrabajados} encargos · ${usuario.actividad.llamadasRegistradas} llamadas`,
      xp: usuario.desgloseXp.prospeccion,
      color: "bg-indigo-500",
    },
    {
      titulo: "2. Captaciones y Exclusivas",
      valor: usuario.captaciones.total + usuario.captaciones.exclusivasCerradas,
      detalle: `${usuario.captaciones.total} inmuebles (${usuario.captaciones.puntosPonderados} pond.) · ${usuario.captaciones.exclusivasCerradas} excl.`,
      xp: usuario.desgloseXp.captacion,
      color: "bg-emerald-500",
    },
    {
      titulo: "3. Visitas y Citas",
      valor: usuario.visitas.partesTotales + usuario.visitas.citasRealizadas,
      detalle: `${usuario.visitas.partesFirmados} partes firmados (${usuario.visitas.ratioFirmaPct}%) · ${usuario.visitas.citasRealizadas} citas`,
      xp: usuario.desgloseXp.visitas,
      color: "bg-blue-500",
    },
    {
      titulo: "4. Cierres y Reservas",
      valor: usuario.cierres.totalOperacionesCerradas + usuario.cierres.propiedadesReservadas,
      detalle: `${usuario.cierres.propiedadesVendidas} ventas · ${usuario.cierres.propiedadesAlquiladas} alq. · ${usuario.cierres.arrasCerradas} arras · ${usuario.cierres.propiedadesReservadas} res.`,
      xp: usuario.desgloseXp.cierres,
      color: "bg-amber-500",
    },
  ];

  return (
    <aside className="rounded-[16px] border border-border bg-[var(--surface)] p-4">
      <div className="flex items-center gap-3 border-b border-[var(--border-row)] pb-3.5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: usuario.color }}
        >
          {inicialesDe(usuario.nombre)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-foreground">{usuario.nombre}</h3>
          <p className="text-[12px] text-[var(--text-2)]">
            {usuario.puntosXp.toLocaleString("es-ES")} XP totales · Embudo comercial
          </p>
        </div>
      </div>

      {/* Embudo visual */}
      <div className="mt-4 space-y-3">
        {etapas.map((etapa) => {
          const pct = Math.max(8, Math.round((etapa.valor / maxEmbudo) * 100));
          return (
            <div key={etapa.titulo} className="space-y-1">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-medium text-foreground">{etapa.titulo}</span>
                <span className="font-semibold tabular-nums">
                  {etapa.valor}{" "}
                  <span className="text-[11px] font-normal text-[var(--text-2)]">
                    (+{etapa.xp} XP)
                  </span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--field)]">
                <div
                  className={cn("h-full rounded-full transition-all", etapa.color)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[11.5px] text-[var(--text-2)]">{etapa.detalle}</p>
            </div>
          );
        })}
      </div>

      {/* Métricas de eficiencia y calidad */}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--border-row)] pt-3.5 text-[12px]">
        <div className="rounded-lg bg-[var(--field)] p-2.5">
          <div className="text-[var(--text-2)]">Visitas por cierre</div>
          <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-foreground">
            {usuario.cierres.visitasPorCierre != null
              ? `${usuario.cierres.visitasPorCierre} vis/cierre`
              : "—"}
          </div>
        </div>
        <div className="rounded-lg bg-[var(--field)] p-2.5">
          <div className="text-[var(--text-2)]">Conversión fincas</div>
          <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-foreground">
            {usuario.prospeccion.conversionFincaPct}%
          </div>
        </div>
        <div className="rounded-lg bg-[var(--field)] p-2.5">
          <div className="text-[var(--text-2)]">Tareas al día</div>
          <div className="mt-0.5 flex items-center gap-1 text-[14px] font-semibold tabular-nums text-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            {usuario.actividad.tareasCompletadas} hechas
            {usuario.actividad.tareasVencidas > 0 ? (
              <span className="text-[11px] font-normal text-red-600">
                ({usuario.actividad.tareasVencidas} venc.)
              </span>
            ) : null}
          </div>
        </div>
        <div className="rounded-lg bg-[var(--field)] p-2.5">
          <div className="text-[var(--text-2)]">Cruces demandas</div>
          <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-foreground">
            {usuario.actividad.crucesGenerados} envíos
          </div>
        </div>
      </div>

      {/* Insignias desbloqueadas */}
      <div className="mt-4 border-t border-[var(--border-row)] pt-3.5">
        <div className="text-[12px] font-semibold text-foreground">
          Insignias desbloqueadas en el periodo
        </div>
        {usuario.insignias.length === 0 ? (
          <p className="mt-1 text-[12px] text-[var(--text-2)]">
            Aún sin insignias en este periodo. Suma captaciones, visitas firmadas o cierres para desbloquearlas.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {usuario.insignias.map((ins) => (
              <li
                key={ins.id}
                className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50/60 px-2.5 py-2 text-[12px]"
              >
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <div>
                  <div className="font-semibold text-amber-950">{ins.titulo}</div>
                  <div className="text-[11px] text-amber-900/80">{ins.descripcion}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
