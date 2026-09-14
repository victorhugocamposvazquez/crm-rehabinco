import type { Inmueble } from "./catalogo";

export type CampoFicha = {
  clave: string;
  label: string;
  ok: boolean;
};

export type CompletitudFicha = {
  porcentaje: number;
  rellenos: number;
  total: number;
  campos: CampoFicha[];
  faltan: string[];
};

function hayTexto(valor: string | null | undefined): boolean {
  return Boolean(valor && valor.trim());
}

function hayNumero(valor: number | null | undefined): boolean {
  return valor != null && Number.isFinite(valor);
}

export function completitudFicha(input: {
  inmueble: Pick<
    Inmueble,
    | "direccion"
    | "localidad"
    | "tipo_inmueble"
    | "tipo_operacion"
    | "precio_venta"
    | "precio_alquiler"
    | "superficie_m2"
    | "superficie_util"
    | "habitaciones"
    | "descripcion"
    | "ofertante_id"
    | "publicado"
  >;
  fotos: number;
}): CompletitudFicha {
  const op = input.inmueble.tipo_operacion;
  const precioOk =
    op === "alquiler"
      ? hayNumero(input.inmueble.precio_alquiler)
      : op === "ambos"
        ? hayNumero(input.inmueble.precio_venta) && hayNumero(input.inmueble.precio_alquiler)
        : hayNumero(input.inmueble.precio_venta);

  const campos: CampoFicha[] = [
    { clave: "direccion", label: "Dirección", ok: hayTexto(input.inmueble.direccion) },
    { clave: "localidad", label: "Localidad", ok: hayTexto(input.inmueble.localidad) },
    { clave: "tipo", label: "Tipo de inmueble", ok: hayTexto(input.inmueble.tipo_inmueble) },
    { clave: "precio", label: "Precio", ok: precioOk },
    {
      clave: "superficie",
      label: "Superficie",
      ok: hayNumero(input.inmueble.superficie_util) || hayNumero(input.inmueble.superficie_m2),
    },
    { clave: "habitaciones", label: "Habitaciones", ok: hayNumero(input.inmueble.habitaciones) },
    { clave: "descripcion", label: "Descripción", ok: hayTexto(input.inmueble.descripcion) },
    { clave: "fotos", label: "Fotos", ok: input.fotos > 0 },
    { clave: "propietario", label: "Propietario", ok: Boolean(input.inmueble.ofertante_id) },
    { clave: "publicado", label: "Listo para matching", ok: Boolean(input.inmueble.publicado) },
  ];
  const rellenos = campos.filter((item) => item.ok).length;
  return {
    porcentaje: Math.round((rellenos / campos.length) * 100),
    rellenos,
    total: campos.length,
    campos,
    faltan: campos.filter((item) => !item.ok).map((item) => item.label),
  };
}
