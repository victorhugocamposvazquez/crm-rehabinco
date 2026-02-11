import { z } from "zod";

export const clienteStep1Schema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  tipo: z.enum(["particular", "empresa"]),
  nif: z.string().optional(),
  email: z.string().email("Email no válido").optional().or(z.literal("")),
  telefono: z.string().optional(),
});

export const clienteStep2Schema = z.object({
  direccion: z.string().optional(),
  codigo_postal: z.string().optional(),
  localidad: z.string().optional(),
  notas: z.string().optional(),
});

export type ClienteStep1Values = z.infer<typeof clienteStep1Schema>;
export type ClienteStep2Values = z.infer<typeof clienteStep2Schema>;
