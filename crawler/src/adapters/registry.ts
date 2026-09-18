import type { Portal, PortalAdapter } from "./types.js";

const adapters = new Map<Portal, PortalAdapter>();

export function registrarAdapter(adapter: PortalAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function adapterDe(portalId: Portal): PortalAdapter | null {
  return adapters.get(portalId) ?? null;
}

export function listarAdapters(): PortalAdapter[] {
  return [...adapters.values()];
}
