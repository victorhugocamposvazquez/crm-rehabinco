/** Misma regla que el trigger de market_listings: un piso en varios portales. */

export type FichaCluster = {
  operation: string;
  mainType: string;
  lat: number | null;
  lng: number | null;
  surface: number | null;
  rooms: number | null;
  price: number | null;
  active?: boolean;
};

export function distanciaMetros(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const tierra = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
  return 2 * tierra * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function encajanEnCluster(a: FichaCluster, b: FichaCluster): boolean {
  if (a.active === false || b.active === false) return false;
  if (a.operation !== b.operation || a.mainType !== b.mainType) return false;
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return false;
  if (distanciaMetros(a.lat, a.lng, b.lat, b.lng) > 40) return false;
  if (a.surface == null || b.surface == null || Math.abs(a.surface - b.surface) > 3) return false;
  if (a.rooms != null && b.rooms != null && a.rooms !== b.rooms) return false;
  if (a.price == null || b.price == null || a.price <= 0 || b.price <= 0) return false;
  const menor = Math.min(a.price, b.price);
  return Math.abs(a.price - b.price) <= menor * 0.03;
}

/** Índice del representante de cada ficha. Las que encajan comparten índice. */
export function agruparClusters(fichas: FichaCluster[]): number[] {
  const parent = fichas.map((_, i) => i);
  const find = (i: number): number => {
    let x = i;
    while (parent[x] !== x) x = parent[x];
    return x;
  };
  for (let i = 0; i < fichas.length; i += 1) {
    for (let j = i + 1; j < fichas.length; j += 1) {
      if (!encajanEnCluster(fichas[i], fichas[j])) continue;
      const ra = find(i);
      const rb = find(j);
      if (ra !== rb) parent[rb] = ra;
    }
  }
  return fichas.map((_, i) => find(i));
}
