/** Portales que el informe del propietario no enseña salvo que se pidan. */
const PORTALES_OPCIONALES = new Set(["idealista", "fotocasa"]);

export function portalOpcional(portal: string | null | undefined): boolean {
  const clave = portal?.trim().toLowerCase() ?? "";
  return PORTALES_OPCIONALES.has(clave);
}

export function visibleAlCliente<T extends { portal: string | null | undefined }>(
  comparable: T,
  incluirPortales: boolean,
): boolean {
  if (incluirPortales) return true;
  return !portalOpcional(comparable.portal);
}
