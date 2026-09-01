/** Rutas de altas/edición con barra Atrás/Siguiente (sin menú inferior). */
export function isWizardRoute(pathname: string) {
  return /\/(nuevo|nueva|editar)(\/|$)/.test(pathname);
}

export const wizardActionBarClassName =
  "fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white/95 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]";
