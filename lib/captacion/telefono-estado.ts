import { esAgencia } from "@/lib/captacion/captacion-activos";
import { esTelefonoVirtualIdealista, telefonoE164 } from "@/lib/captacion/contacto";
import type { AnunciantePortal, FuentePortal } from "@/lib/captacion/portales/modelo";

export type TelefonoEstado =
  | "pendiente"
  | "solo_mensaje"
  | "virtual"
  | "real"
  | "fallo"
  | "no_solicitado";

export type TelefonoAnuncioCampos = {
  fuente: FuentePortal;
  anunciante: AnunciantePortal;
  contacto_telefono: string | null;
  telefono_estado?: string | null;
  telefono_tipo?: string | null;
  telefono_pendiente?: boolean;
  telefono_capturado_en?: string | null;
  telefono_capturado_por?: string | null;
  contacto_telefono_fuente?: string | null;
  telefono_reintentar_en?: string | null;
  ficha_pendiente?: boolean;
};

export function resolverEstadoTelefono(a: TelefonoAnuncioCampos, enCola = false): TelefonoEstado {
  const guardado = a.telefono_estado as TelefonoEstado | null | undefined;
  if (guardado && esTelefonoEstado(guardado)) return guardado;

  if (a.fuente === "idealista" && esAgencia({ anunciante: a.anunciante }) && !telefonoReal(a)) {
    return "no_solicitado";
  }
  if (a.telefono_pendiente) return "fallo";
  const tel = a.contacto_telefono;
  if (tel && (a.telefono_tipo === "virtual_idealista" || esTelefonoVirtualIdealista(tel))) return "virtual";
  if (tel && telefonoE164(tel)) return "real";
  if (enCola || a.ficha_pendiente) return "pendiente";
  return "pendiente";
}

export function esTelefonoEstado(v: string): v is TelefonoEstado {
  return ["pendiente", "solo_mensaje", "virtual", "real", "fallo", "no_solicitado"].includes(v);
}

function telefonoReal(a: TelefonoAnuncioCampos): boolean {
  const tel = a.contacto_telefono;
  if (!tel) return false;
  return Boolean(telefonoE164(tel) && !esTelefonoVirtualIdealista(tel));
}

/** Chip «Sin teléfono»: pendiente + fallo (no virtual, solo mensaje, real). */
export function cuentaSinTelefonoChip(a: TelefonoAnuncioCampos, enCola: boolean): boolean {
  const e = resolverEstadoTelefono(a, enCola);
  return e === "pendiente" || e === "fallo";
}

export function cuentaSoloMensajeChip(a: TelefonoAnuncioCampos): boolean {
  return resolverEstadoTelefono(a) === "solo_mensaje";
}
