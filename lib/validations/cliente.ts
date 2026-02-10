import { z } from "zod";

export const clienteStep1Schema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Email no válido").optional().or(z.literal("")),
  telefono: z.string().optional(),
  nif: z.string().optional(),
});

export const clienteStep2Schema = z.object({
  direccion: z.string().optional(),
  notas: z.string().optional(),
});

export type ClienteStep1Values = z.infer<typeof clienteStep1Schema>;
export type ClienteStep2Values = z.infer<typeof clienteStep2Schema>;
