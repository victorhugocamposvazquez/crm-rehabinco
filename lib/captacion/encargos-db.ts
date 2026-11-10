import { esEstadoCaptacion, type EstadoCaptacion } from "@/lib/captacion/estados";
import { esTipoActividad } from "@/lib/captacion/actividad";
import {
  type EncargoImportado,
  type OperacionEncargo,
  type PrioridadEncargo,
  FUENTE_EXCEL_CAPTACION,
} from "@/lib/captacion/importar-excel";
import { avisarEncargosNuevos } from "@/lib/captacion/avisar-encargo";
import { identidadFinca } from "@/lib/catastro/explorer";

type Fila = Record<string, any>;

function comoFilas(data: unknown): Fila[] {
  return Array.isArray(data) ? data : [];
}

type Db = {
  from: (table: string) => any;
};

export type ActividadEncargo = {
  id: string;
  tipo: string;
  detalle: string | null;
  createdAt: string;
};

export type EncargoApi = {
  id: string;
  asignadoA: string;
  asignadoNombre: string;
  asignadoPor: string | null;
  origen: string;
  fincaReference: string | null;
  calle: string;
  numero: string;
  municipio: string;
  tipoUso: string | null;
  operacion: OperacionEncargo;
  contactoNombre: string | null;
  telefono: string | null;
  email: string | null;
  estado: EstadoCaptacion;
  proximaAccion: string | null;
  proximaAccionEn: string | null;
  resultado: string | null;
  notasRevision: string | null;
  requiereConfirmacion: boolean;
  prioridad: PrioridadEncargo | null;
  posibleDuplicado: boolean;
  updatedAt: string;
};

const OPERACIONES = new Set<OperacionEncargo>(["alquiler", "venta", "por_confirmar", "no_aplica"]);
const PRIORIDADES = new Set<PrioridadEncargo>(["alta", "media", "baja"]);

function texto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio || null;
}

function operacionDe(valor: unknown): OperacionEncargo {
  return typeof valor === "string" && OPERACIONES.has(valor as OperacionEncargo)
    ? (valor as OperacionEncargo)
    : "por_confirmar";
}

function prioridadDe(valor: unknown): PrioridadEncargo | null {
  return typeof valor === "string" && PRIORIDADES.has(valor as PrioridadEncargo)
    ? (valor as PrioridadEncargo)
    : null;
}

export function encargoDesdeFila(row: Record<string, unknown>, nombres: Map<string, string>): EncargoApi {
  return {
    id: String(row.id),
    asignadoA: String(row.asignado_a),
    asignadoNombre: nombres.get(String(row.asignado_a)) ?? "Sin nombre",
    asignadoPor: texto(row.asignado_por),
    origen: String(row.origen ?? "manual"),
    fincaReference: texto(row.finca_reference),
    calle: typeof row.calle === "string" ? row.calle : "",
    numero: typeof row.numero === "string" ? row.numero : "",
    municipio: typeof row.municipio === "string" ? row.municipio : "",
    tipoUso: texto(row.tipo_uso),
    operacion: operacionDe(row.operacion),
    contactoNombre: texto(row.contacto_nombre),
    telefono: texto(row.telefono),
    email: texto(row.email),
    estado: esEstadoCaptacion(row.estado) ? row.estado : "nueva",
    proximaAccion: texto(row.proxima_accion),
    proximaAccionEn: texto(row.proxima_accion_en),
    resultado: texto(row.resultado),
    notasRevision: texto(row.notas_revision),
    requiereConfirmacion: row.requiere_confirmacion === true,
    prioridad: prioridadDe(row.prioridad),
    posibleDuplicado: row.posible_duplicado === true,
    updatedAt: String(row.updated_at ?? row.created_at ?? ""),
  };
}

async function nombresDe(db: Db, ids: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter(Boolean))];
  const mapa = new Map<string, string>();
  if (unicos.length === 0) return mapa;
  const { data } = await db.from("profiles").select("id, nombre_completo, email").in("id", unicos);
  for (const fila of comoFilas(data)) {
    const nombre = texto(fila.nombre_completo);
    const email = texto(fila.email);
    mapa.set(String(fila.id), nombre || email?.split("@")[0] || "Sin nombre");
  }
  return mapa;
}

export async function listarEncargos(
  db: Db,
  filtro: { asignadoA?: string; sinFinca?: boolean }
): Promise<EncargoApi[]> {
  let consulta = db.from("captacion_encargos").select("*").order("updated_at", { ascending: false });
  if (filtro.asignadoA) consulta = consulta.eq("asignado_a", filtro.asignadoA);
  if (filtro.sinFinca) consulta = consulta.is("finca_reference", null);
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  const filas = comoFilas(data);
  const nombres = await nombresDe(db, filas.map((fila) => String(fila.asignado_a)));
  return filas.map((fila) => encargoDesdeFila(fila, nombres));
}

export async function obtenerEncargo(
  db: Db,
  id: string
): Promise<{ encargo: EncargoApi; actividad: ActividadEncargo[] } | null> {
  const { data, error } = await db.from("captacion_encargos").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const nombres = await nombresDe(db, [String(data.asignado_a)]);
  const { data: actividad, error: errorActividad } = await db
    .from("captacion_encargo_actividad")
    .select("id, tipo, detalle, created_at")
    .eq("encargo_id", id)
    .order("created_at", { ascending: false })
    .limit(40);
  if (errorActividad) throw new Error(errorActividad.message);
  return {
    encargo: encargoDesdeFila(data, nombres),
    actividad: comoFilas(actividad).map((fila) => ({
      id: String(fila.id),
      tipo: String(fila.tipo),
      detalle: texto(fila.detalle),
      createdAt: String(fila.created_at),
    })),
  };
}

function filaInsert(
  encargo: EncargoImportado,
  asignadoA: string,
  asignadoPor: string,
  origen: "manual" | "import" | "catastro"
) {
  return {
    asignado_a: asignadoA,
    asignado_por: asignadoPor,
    origen,
    calle: encargo.calle,
    numero: encargo.numero,
    municipio: encargo.municipio,
    tipo_uso: encargo.tipoUso,
    operacion: encargo.operacion,
    contacto_nombre: encargo.contactoNombre,
    telefono: encargo.telefono,
    email: encargo.email,
    estado: encargo.estado,
    proxima_accion: encargo.proximaAccion,
    resultado: encargo.resultado,
    notas_revision: encargo.notasRevision,
    requiere_confirmacion: encargo.requiereConfirmacion,
    prioridad: encargo.prioridad,
    posible_duplicado: encargo.posibleDuplicado,
    fila_origen: encargo.filaOrigen,
    updated_at: new Date().toISOString(),
  };
}

async function anotar(
  db: Db,
  encargoId: string,
  actorId: string,
  tipo: string,
  detalle: string
): Promise<void> {
  const { error } = await db.from("captacion_encargo_actividad").insert({
    encargo_id: encargoId,
    actor_id: actorId,
    tipo,
    detalle,
  });
  if (error) throw new Error(error.message);
}

export async function crearEncargos(
  db: Db,
  input: {
    asignadoA: string;
    asignadoPor: string;
    origen: "manual" | "import" | "catastro";
    encargos: EncargoImportado[];
    detalleActividad: string;
  }
): Promise<EncargoApi[]> {
  if (input.encargos.length === 0) return [];
  const { data, error } = await db
    .from("captacion_encargos")
    .insert(input.encargos.map((encargo) => filaInsert(encargo, input.asignadoA, input.asignadoPor, input.origen)))
    .select("id, calle, numero");
  if (error) throw new Error(error.message);
  const creados = comoFilas(data);
  if (creados.length > 0) {
    const { error: errorActividad } = await db.from("captacion_encargo_actividad").insert(
      creados.map((fila) => ({
        encargo_id: fila.id,
        actor_id: input.asignadoPor,
        tipo: "asignacion",
        detalle: input.detalleActividad,
      }))
    );
    if (errorActividad) throw new Error(errorActividad.message);
    await avisarEncargosNuevos({
      asignadoA: input.asignadoA,
      actorId: input.asignadoPor,
      encargos: creados.map((fila) => ({
        id: String(fila.id),
        calle: String(fila.calle ?? ""),
        numero: String(fila.numero ?? ""),
      })),
    });
  }
  return listarEncargos(db, { asignadoA: input.asignadoA });
}

export async function importarSiNoExiste(
  db: Db,
  input: { asignadoA: string; asignadoPor: string; fuente: string; encargos: EncargoImportado[] }
): Promise<{ creados: number; yaEstaban: boolean }> {
  const { data, error } = await db
    .from("captacion_encargos")
    .select("id, fila_origen")
    .eq("asignado_a", input.asignadoA)
    .eq("origen", "import");
  if (error) throw new Error(error.message);
  const ya = comoFilas(data).some((fila) => {
    const origen = fila.fila_origen;
    return origen && typeof origen === "object" && (origen as { fuente?: string }).fuente === input.fuente;
  });
  if (ya) return { creados: 0, yaEstaban: true };
  await crearEncargos(db, {
    asignadoA: input.asignadoA,
    asignadoPor: input.asignadoPor,
    origen: "import",
    encargos: input.encargos,
    detalleActividad: "Encargo importado desde Excel",
  });
  return { creados: input.encargos.length, yaEstaban: false };
}

export { FUENTE_EXCEL_CAPTACION };

function direccionDe(address: unknown): { calle: string; numero: string; municipio: string } {
  if (!address || typeof address !== "object") return { calle: "", numero: "", municipio: "" };
  const finca = address as Record<string, unknown>;
  const calle = [finca.sigla, finca.via]
    .filter((parte): parte is string => typeof parte === "string" && parte.trim().length > 0)
    .join(" ");
  return {
    calle,
    numero: typeof finca.numero === "string" ? finca.numero : "",
    municipio: typeof finca.municipio === "string" ? finca.municipio : "",
  };
}

export async function asegurarEncargosDeFincas(
  db: Db,
  input: { refs: string[]; comercialId: string; asignadoPor: string }
): Promise<void> {
  if (input.refs.length === 0) return;
  const { data: existentes, error } = await db
    .from("captacion_encargos")
    .select("id, finca_reference, asignado_a, calle, numero")
    .in("finca_reference", input.refs);
  if (error) throw new Error(error.message);
  const porRef = new Map(comoFilas(existentes).map((fila) => [String(fila.finca_reference), fila]));
  const faltan = input.refs.filter((ref) => !porRef.has(ref));
  const reasignados = comoFilas(existentes).filter((fila) => String(fila.asignado_a) !== input.comercialId);
  const ahora = new Date().toISOString();

  if (faltan.length > 0) {
    const { data: fincas } = await db.from("catastro_fincas").select("finca_reference, address").in("finca_reference", faltan);
    const porFinca = new Map(comoFilas(fincas).map((fila) => [String(fila.finca_reference), direccionDe(fila.address)]));
    const { data: creados, error: errorInsert } = await db
      .from("captacion_encargos")
      .insert(
        faltan.map((ref) => {
          const direccion = porFinca.get(ref) ?? { calle: "", numero: "", municipio: "" };
          return {
            asignado_a: input.comercialId,
            asignado_por: input.asignadoPor,
            origen: "catastro",
            finca_reference: ref,
            calle: direccion.calle,
            numero: direccion.numero,
            municipio: direccion.municipio,
            estado: "nueva",
            fila_origen: { fuente: "catastro", fincaReference: ref },
            updated_at: ahora,
          };
        })
      )
      .select("id, calle, numero");
    if (errorInsert) throw new Error(errorInsert.message);
    const filas = comoFilas(creados);
    if (filas.length > 0) {
      await db.from("captacion_encargo_actividad").insert(
        filas.map((fila) => ({
          encargo_id: fila.id,
          actor_id: input.asignadoPor,
          tipo: "asignacion",
          detalle: "Finca encargada desde Catastro",
        }))
      );
      await avisarEncargosNuevos({
        asignadoA: input.comercialId,
        actorId: input.asignadoPor,
        encargos: filas.map((fila) => ({
          id: String(fila.id),
          calle: String(fila.calle ?? ""),
          numero: String(fila.numero ?? ""),
        })),
      });
    }
  }

  for (const fila of reasignados) {
    const { error: errorUpdate } = await db
      .from("captacion_encargos")
      .update({ asignado_a: input.comercialId, asignado_por: input.asignadoPor, updated_at: ahora })
      .eq("id", fila.id);
    if (errorUpdate) throw new Error(errorUpdate.message);
    await anotar(db, String(fila.id), input.asignadoPor, "asignacion", "Encargo reasignado");
  }
  if (reasignados.length > 0) {
    await avisarEncargosNuevos({
      asignadoA: input.comercialId,
      actorId: input.asignadoPor,
      encargos: reasignados.map((fila) => ({
        id: String(fila.id),
        calle: String(fila.calle ?? ""),
        numero: String(fila.numero ?? ""),
      })),
    });
  }
}

export async function reflejarEnPipeline(
  db: Db,
  encargo: { fincaReference: string | null; estado: string; proximaAccion: string | null; proximaAccionEn: string | null },
  actorId: string
): Promise<void> {
  if (!encargo.fincaReference) return;
  const { error } = await db.from("catastro_explorer_pipeline").upsert(
    {
      finca_reference: encargo.fincaReference,
      estado: encargo.estado,
      proxima_accion: encargo.proximaAccion,
      proxima_accion_en: encargo.proximaAccionEn,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "finca_reference" }
  );
  if (error) throw new Error(error.message);
}

const TIPOS_ANOTACION = new Set(["visita", "llamada", "nota"]);

export function tipoAnotacion(valor: unknown): "visita" | "llamada" | "nota" | null {
  if (typeof valor !== "string" || !TIPOS_ANOTACION.has(valor)) return null;
  if (!esTipoActividad(valor) && valor !== "visita") return null;
  return valor as "visita" | "llamada" | "nota";
}

export async function vincularFincaEncargo(
  db: Db,
  input: { encargoId: string; fincaReference: string; actorId: string; asignadoA: string }
): Promise<void> {
  const referencia = identidadFinca(input.fincaReference);
  if (!referencia) throw new Error("La referencia catastral no es válida.");
  const { data: ocupada } = await db
    .from("captacion_encargos")
    .select("id")
    .eq("finca_reference", referencia)
    .maybeSingle();
  if (ocupada && String(ocupada.id) !== input.encargoId) {
    throw new Error("Esa finca ya tiene un encargo.");
  }
  const { error: errorAsignacion } = await db.from("catastro_explorer_assignments").upsert(
    {
      finca_reference: referencia,
      comercial_id: input.asignadoA,
      assigned_by: input.actorId,
      assigned_at: new Date().toISOString(),
    },
    { onConflict: "finca_reference" }
  );
  if (errorAsignacion) throw new Error(errorAsignacion.message);
  const { error } = await db
    .from("captacion_encargos")
    .update({ finca_reference: referencia, updated_at: new Date().toISOString() })
    .eq("id", input.encargoId);
  if (error) throw new Error(error.message);
  await anotar(db, input.encargoId, input.actorId, "propiedad", `Vinculada a la finca ${referencia}`);
}
