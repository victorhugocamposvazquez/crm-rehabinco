import { z } from "zod";

export const facturaStep1Schema = z.object({
  clienteId: z.string().min(1, "Selecciona un cliente"),
  concepto: z.string().optional(),
  fechaEmision: z.string().optional(),
  fechaVencimiento: z.string().optional(),
});

export const facturaLineaSchema = z.object({
  descripcion: z.string().min(1, "Descripción requerida"),
  cantidad: z.coerce.number().min(0),
  precioUnitario: z.coerce.number().min(0),
});

export const facturaStep2Schema = z.object({
  lineas: z.array(facturaLineaSchema).min(1, "Añade al menos una línea"),
});

export type FacturaStep1Values = z.infer<typeof facturaStep1Schema>;
export type FacturaLinea = z.infer<typeof facturaLineaSchema>;
export type FacturaStep2Values = z.infer<typeof facturaStep2Schema>;
