export type MilanunciosTag = { type?: string; text?: string };

export type MilanunciosAttribute = {
  type?: string;
  value?: string;
  valueFormatted?: string;
};

export type CaracteristicasMilanuncios = {
  superficie?: number;
  habitaciones?: number;
  banos?: number;
  planta?: string;
};

function enteroDeTexto(text?: string): number | undefined {
  if (!text) return undefined;
  const m = text.match(/(\d+)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function m2DeTexto(text?: string): number | undefined {
  if (!text) return undefined;
  const m = text.match(/(\d[\d.,]*)\s*m/i);
  if (m) {
    const n = Number(m[1].replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n) : undefined;
  }
  return enteroDeTexto(text);
}

export function caracteristicasDesdeTags(tags?: MilanunciosTag[]): CaracteristicasMilanuncios {
  const out: CaracteristicasMilanuncios = {};
  for (const tag of tags ?? []) {
    const tipo = tag.type?.toLowerCase() ?? "";
    if (tipo === "dormitorios") out.habitaciones = enteroDeTexto(tag.text) ?? out.habitaciones;
    if (tipo === "baños" || tipo === "banos") out.banos = enteroDeTexto(tag.text) ?? out.banos;
    if (tipo.includes("metro") || tipo.includes("m2") || tipo.includes("m²")) {
      out.superficie = m2DeTexto(tag.text) ?? out.superficie;
    }
  }
  return out;
}

export function caracteristicasDesdeAttributes(attrs?: MilanunciosAttribute[]): CaracteristicasMilanuncios {
  const out: CaracteristicasMilanuncios = {};
  for (const attr of attrs ?? []) {
    const tipo = attr.type?.toLowerCase() ?? "";
    const val = attr.value ?? attr.valueFormatted;
    if (tipo === "bedrooms" || tipo === "dormitorios") {
      out.habitaciones = enteroDeTexto(val) ?? out.habitaciones;
    }
    if (tipo === "bathrooms" || tipo === "baños" || tipo === "banos") {
      out.banos = enteroDeTexto(val) ?? out.banos;
    }
    if (tipo === "squaremeters" || tipo === "metros cuadrados" || tipo === "metres quadrats") {
      out.superficie = m2DeTexto(attr.valueFormatted ?? val) ?? enteroDeTexto(val) ?? out.superficie;
    }
    if (tipo === "floor" || tipo === "planta") {
      const planta = attr.valueFormatted?.trim() || val?.replace(/^floor_/i, "");
      if (planta) out.planta = planta;
    }
  }
  return out;
}

export function mergeCaracteristicas(
  ...parts: Array<CaracteristicasMilanuncios | undefined>
): CaracteristicasMilanuncios {
  return Object.assign({}, ...parts.filter(Boolean));
}
