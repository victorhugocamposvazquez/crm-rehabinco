import { z } from "zod";

export const parteVisitaFormSchema = z.object({
  visitante_nombre: z.string().optional(),
  visitante_documento: z.string().optional(),
  visitante_telefono: z.string().optional(),
  visitante_email: z
    .string()
    .email("Correo no válido")
    .optional()
    .or(z.literal("")),
  inmueble_direccion: z.string().min(1, "La dirección del inmueble es obligatoria"),
  inmueble_referencia: z.string().optional(),
  fecha_visita: z.string().min(1, "La fecha es obligatoria"),
  hora_visita: z.string().optional(),
  agente_nombre: z.string().min(1, "El agente comercial es obligatorio"),
  observaciones: z.string().optional(),
  estado: z.enum(["borrador", "pendiente_firma", "firmado"]).default("pendiente_firma"),
});

export const firmarParteVisitaSchema = z.object({
  token: z.string().uuid(),
  visitante_nombre: z.string().min(2, "Indica el nombre y apellidos"),
  visitante_documento: z.string().min(5, "Indica el DNI / NIE"),
  visitante_telefono: z.string().optional(),
  visitante_email: z
    .string()
    .email("Correo no válido")
    .optional()
    .or(z.literal("")),
  observaciones: z.string().optional(),
  firma_visitante: z
    .string()
    .min(100, "La firma del visitante es obligatoria")
    .refine((v) => v.startsWith("data:image/"), "Firma no válida"),
  firma_agente: z
    .string()
    .min(100, "La firma del agente es obligatoria")
    .refine((v) => v.startsWith("data:image/"), "Firma no válida"),
});

export type ParteVisitaFormValues = z.infer<typeof parteVisitaFormSchema>;
export type FirmarParteVisitaValues = z.infer<typeof firmarParteVisitaSchema>;
