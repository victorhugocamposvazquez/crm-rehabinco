export const TIPOS_ALTA = ["inmueble", "cliente", "demanda", "parte"] as const;
export type TipoAlta = (typeof TIPOS_ALTA)[number];

export const EVENTO_ALTA_BORRADOR = "crm-alta-borrador";

export type SobreAltaBorrador<T> = {
  v: 1;
  savedAt: string;
  data: T;
};

type Memoria = {
  getItem: (clave: string) => string | null;
  setItem: (clave: string, valor: string) => void;
  removeItem: (clave: string) => void;
};

let memoriaTest: Memoria | null = null;

export function conMemoriaAltaBorrador(memoria: Memoria | null) {
  memoriaTest = memoria;
}

function memoria(): Memoria | null {
  if (memoriaTest) return memoriaTest;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function claveAltaBorrador(tipo: TipoAlta, ambito = "libre"): string {
  const limpio = (ambito || "libre").replace(/[^\w:-]/g, "_").slice(0, 80) || "libre";
  return `crm.alta.${tipo}.${limpio}`;
}

export function hayTexto(valor: string | null | undefined): boolean {
  return Boolean(valor?.trim());
}

export function altaCamposVacios(...valores: Array<string | boolean | string[] | null | undefined>): boolean {
  return valores.every((valor) => {
    if (valor == null) return true;
    if (typeof valor === "boolean") return !valor;
    if (Array.isArray(valor)) return valor.length === 0;
    return !valor.trim();
  });
}

function avisar() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENTO_ALTA_BORRADOR));
}

export function leerAltaBorrador<T>(tipo: TipoAlta, ambito = "libre"): SobreAltaBorrador<T> | null {
  const store = memoria();
  if (!store) return null;
  try {
    const raw = store.getItem(claveAltaBorrador(tipo, ambito));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SobreAltaBorrador<T>;
    if (!parsed || parsed.v !== 1 || parsed.data == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hayAltaBorrador(tipo: TipoAlta, ambito = "libre"): boolean {
  return leerAltaBorrador(tipo, ambito) != null;
}

export function escribirAltaBorrador<T>(tipo: TipoAlta, ambito: string, data: T): string {
  const savedAt = new Date().toISOString();
  const store = memoria();
  if (store) {
    store.setItem(claveAltaBorrador(tipo, ambito), JSON.stringify({ v: 1, savedAt, data } satisfies SobreAltaBorrador<T>));
    avisar();
  }
  return savedAt;
}

export function borrarAltaBorrador(tipo: TipoAlta, ambito = "libre") {
  const store = memoria();
  if (!store) return;
  store.removeItem(claveAltaBorrador(tipo, ambito));
  avisar();
}

export function horaAltaBorrador(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
