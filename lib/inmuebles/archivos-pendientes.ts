import { validarArchivoMedia, type TipoMediaInmueble } from "./media";

export function claveArchivo(file: File): string {
  return `${file.name}\0${file.size}\0${file.lastModified}`;
}

export function validarArchivosEntrada(
  tipo: TipoMediaInmueble,
  incoming: Iterable<File>
): { ok: File[]; errores: string[] } {
  const ok: File[] = [];
  const errores: string[] = [];
  for (const file of incoming) {
    const fallo = validarArchivoMedia(tipo, file);
    if (fallo) errores.push(fallo);
    else ok.push(file);
  }
  return { ok, errores };
}

export function fusionarArchivos(prev: File[], nuevos: File[]): File[] {
  const vistos = new Set(prev.map(claveArchivo));
  const extra = nuevos.filter((file) => !vistos.has(claveArchivo(file)));
  return [...prev, ...extra];
}

export function reordenarIndice<T>(lista: T[], desde: number, hasta: number): T[] {
  if (desde === hasta || desde < 0 || hasta < 0 || desde >= lista.length || hasta >= lista.length) {
    return lista;
  }
  const copia = [...lista];
  const [item] = copia.splice(desde, 1);
  copia.splice(hasta, 0, item);
  return copia;
}

export function esImagenArchivo(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(file.name);
}

export function esPdfArchivo(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function arrastrandoArchivos(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer?.types?.length) return false;
  return [...dataTransfer.types].includes("Files");
}
