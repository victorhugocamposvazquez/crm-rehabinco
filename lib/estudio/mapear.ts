import type { InmuebleEstudio } from "./data";

export type FilaEstudio = {
  id: string;
  referencia: string | null;
  titulo: string | null;
  direccion: string | null;
  localidad: string | null;
  tipo_operacion: string;
  precio_venta: number | null;
  precio_alquiler: number | null;
  superficie_m2: number | null;
  superficie_construida: number | null;
  habitaciones: number | null;
  banos: number | null;
  certificado_energetico: string | null;
  comercial_id: string | null;
  user_id: string;
};

export type FotoFila = { id: string; propiedad_id: string; url: string | null; orden: number | null };
export type AgenteFila = { id: string; nombre_completo: string | null; color: string | null };

const LETRAS = new Set(["A", "B", "C", "D", "E", "F", "G"]);

export function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letras.join("") || "RH";
}

export function etiquetaVisita(empieza: string, termina: string): { evento: string; hora: string } {
  const zona = "Europe/Madrid";
  const a = new Date(empieza);
  const b = new Date(termina);
  const partes = (fecha: Date) => {
    const map = new Map(
      new Intl.DateTimeFormat("es-ES", {
        timeZone: zona,
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(fecha)
        .map((p) => [p.type, p.value])
    );
    return map;
  };
  const pa = partes(a);
  const pb = partes(b);
  const wd = (pa.get("weekday") ?? "").replace(".", "");
  const evento = `${wd} ${pa.get("day") ?? ""} ${(pa.get("month") ?? "").replace(".", "")}`.replace(/\s+/g, " ").trim();
  const hora = `${pa.get("hour")}:${pa.get("minute")} a ${pb.get("hour")}:${pb.get("minute")}`;
  return { evento, hora };
}

export function mapearInmuebleEstudio(
  fila: FilaEstudio,
  fotos: FotoFila[],
  agente: AgenteFila | null,
  visita?: { evento: string; hora: string } | null
): InmuebleEstudio {
  const alquiler = fila.tipo_operacion === "alquiler";
  const precio = (alquiler ? fila.precio_alquiler : fila.precio_venta) ?? fila.precio_venta ?? fila.precio_alquiler ?? 0;
  const localidad = fila.localidad?.trim() || "A Coruña";
  const letra = (fila.certificado_energetico ?? "").trim().toUpperCase().slice(0, 1);
  const nombre = agente?.nombre_completo?.trim() || "Rehabinco";
  return {
    id: fila.id,
    ref: fila.referencia?.trim() || fila.id.slice(0, 8).toUpperCase(),
    titulo: fila.titulo?.trim() || fila.direccion?.trim() || "Inmueble",
    direccion: fila.direccion?.trim() || localidad,
    zona: localidad,
    barrio: localidad,
    precio,
    precioAnterior: null,
    m2: fila.superficie_m2 ?? fila.superficie_construida ?? 0,
    habitaciones: fila.habitaciones ?? 0,
    banos: fila.banos ?? 0,
    energia: LETRAS.has(letra) ? letra : null,
    agente: { nombre, iniciales: inicialesDe(nombre), color: agente?.color || "#4C8DFF" },
    fotos: fotos
      .filter((f) => f.propiedad_id === fila.id && f.url)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      .map((f, i) => ({
        id: f.id,
        url: f.url as string,
        nombre: `Foto ${i + 1}`,
        tipo: i === 0 ? "ext" : "int",
      })),
    visita: visita ?? null,
  };
}
