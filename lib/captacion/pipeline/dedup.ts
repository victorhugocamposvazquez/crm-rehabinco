export type CandidatoDedup = {
  id: string;
  operacion: string;
  tipo: string | null;
  municipio: string | null;
  superficie: number | null;
  habitaciones: number | null;
  lat: number | null;
  lng: number | null;
  geo_aproximada: boolean;
  contacto_telefono: string | null;
  phash_fotos: string[];
};

export type MotivoUnion =
  | { regla: "telefono_municipio_m2"; telefono: string; municipio: string }
  | { regla: "fotos_phash"; coincidencias: number }
  | { regla: "geo_atributos"; distancia_m: number };

function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function hamming(a: string, b: string): number {
  if (a.length !== b.length) return 999;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) d += 1;
  return d;
}

export function buscarInmuebleDuplicado(
  candidato: CandidatoDedup,
  existentes: CandidatoDedup[]
): { id: string; motivo: MotivoUnion } | null {
  for (const ex of existentes) {
    if (
      candidato.contacto_telefono &&
      ex.contacto_telefono === candidato.contacto_telefono &&
      candidato.municipio &&
      ex.municipio === candidato.municipio &&
      candidato.superficie &&
      ex.superficie &&
      Math.abs(candidato.superficie - ex.superficie) / ex.superficie <= 0.05
    ) {
      return {
        id: ex.id,
        motivo: {
          regla: "telefono_municipio_m2",
          telefono: candidato.contacto_telefono,
          municipio: candidato.municipio,
        },
      };
    }

    let coincidenciasPhash = 0;
    for (const h1 of candidato.phash_fotos) {
      for (const h2 of ex.phash_fotos) {
        if (hamming(h1, h2) <= 6) coincidenciasPhash += 1;
      }
    }
    if (coincidenciasPhash >= 2) {
      return { id: ex.id, motivo: { regla: "fotos_phash", coincidencias: coincidenciasPhash } };
    }

    if (
      !candidato.geo_aproximada &&
      !ex.geo_aproximada &&
      candidato.lat != null &&
      candidato.lng != null &&
      ex.lat != null &&
      ex.lng != null &&
      candidato.operacion === ex.operacion &&
      candidato.tipo === ex.tipo &&
      candidato.habitaciones === ex.habitaciones &&
      candidato.superficie &&
      ex.superficie &&
      Math.abs(candidato.superficie - ex.superficie) / ex.superficie <= 0.03
    ) {
      const d = distanciaM({ lat: candidato.lat, lng: candidato.lng }, { lat: ex.lat, lng: ex.lng });
      if (d < 200) {
        return { id: ex.id, motivo: { regla: "geo_atributos", distancia_m: Math.round(d) } };
      }
    }
  }
  return null;
}
