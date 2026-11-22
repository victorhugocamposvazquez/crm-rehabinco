import { z } from "zod";

/** Lo que se extrae de una nota simple. Todo opcional: las notas varían mucho por Registro. */
export const resumenNotaSchema = z.object({
  registro: z.string().nullable().describe("Registro de la Propiedad, p. ej. 'A Coruña nº 1'"),
  fincaRegistral: z.string().nullable().describe("Número de finca registral"),
  idufir: z.string().nullable().describe("IDUFIR o CRU, 14 dígitos"),
  refCatastral: z.string().nullable(),
  fechaNota: z.string().nullable().describe("Fecha de expedición, AAAA-MM-DD"),
  descripcion: z.object({
    tipo: z.string().nullable().describe("vivienda, local, garaje, trastero, solar…"),
    direccion: z.string().nullable(),
    superficieConstruida: z.number().nullable(),
    superficieUtil: z.number().nullable(),
    cuotaParticipacion: z.string().nullable(),
    anejos: z.array(z.string()).describe("Garaje, trastero u otros anejos vinculados"),
  }),
  titulares: z.array(
    z.object({
      nombre: z.string(),
      porcentaje: z.string().nullable().describe("p. ej. '50% del pleno dominio'"),
      derecho: z.string().nullable().describe("pleno dominio, nuda propiedad, usufructo…"),
      titulo: z.string().nullable().describe("compraventa, herencia, donación…"),
      fecha: z.string().nullable(),
    })
  ),
  cargas: z.array(
    z.object({
      tipo: z.string().describe("hipoteca, embargo, servidumbre, afección fiscal, condición resolutoria…"),
      detalle: z.string().nullable(),
      acreedor: z.string().nullable(),
      importe: z.number().nullable().describe("Responsabilidad o principal en euros"),
      vigente: z.boolean().nullable(),
    })
  ),
  alertas: z.array(z.string()).describe("Lo que un agente debe mirar antes de captar o vender: embargos, usufructos, VPO, prohibiciones de disponer, anotaciones preventivas…"),
});

export type ResumenNota = z.infer<typeof resumenNotaSchema>;

export const INSTRUCCIONES_RESUMEN = `Eres un asistente de una agencia inmobiliaria española. Te paso el texto de una nota simple del Registro de la Propiedad.
Extrae los datos con exactitud, sin inventar: si un dato no aparece, déjalo en null o con lista vacía.
Las afecciones fiscales caducadas o cargas canceladas van con vigente=false.
En "alertas" resume en frases cortas lo que afecta a una venta (embargos, hipotecas vigentes, usufructos, VPO, prohibiciones de disponer, anotaciones preventivas, titulares fallecidos o en proindiviso).`;

/** Cargas que siguen vivas y su importe total conocido. */
export function cargasVigentes(r: Pick<ResumenNota, "cargas">): { numero: number; importe: number } {
  const vivas = r.cargas.filter((c) => c.vigente !== false && !/afecci[oó]n fiscal/i.test(c.tipo));
  return { numero: vivas.length, importe: vivas.reduce((s, c) => s + (c.importe ?? 0), 0) };
}

/** "Libre de cargas" solo si no hay ninguna vigente distinta de afecciones fiscales. */
export function libreDeCargas(r: Pick<ResumenNota, "cargas">): boolean {
  return cargasVigentes(r).numero === 0;
}
