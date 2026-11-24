export type SoporteAvisos =
  | { ok: true }
  | { ok: false; motivo: "ios-pestana" | "ios-antiguo" | "sin-push" };

export function versionIos(ua: string): { major: number; minor: number } | null {
  const match = ua.match(/(?:iPhone|CPU) OS (\d+)[_.](\d+)/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

/** Web Push en iPhone existe desde iOS 16.4, y solo con la app en la pantalla de inicio. */
export function iosSoportaPush(version: { major: number; minor: number } | null): boolean {
  if (!version) return true;
  return version.major > 16 || (version.major === 16 && version.minor >= 4);
}

export function soporteAvisos(input: {
  ua: string;
  notification: boolean;
  serviceWorker: boolean;
  pushManager: boolean;
  instalada: boolean;
}): SoporteAvisos {
  if (input.notification && input.serviceWorker && input.pushManager) return { ok: true };
  const ios = /iPhone|iPad|iPod/i.test(input.ua);
  if (ios && !iosSoportaPush(versionIos(input.ua))) return { ok: false, motivo: "ios-antiguo" };
  if (ios && !input.instalada) return { ok: false, motivo: "ios-pestana" };
  return { ok: false, motivo: "sin-push" };
}
