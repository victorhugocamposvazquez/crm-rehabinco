const INITIAL_VARS = ["window.__INITIAL_PROPS__", "window.__INITIAL_CONTEXT_VALUE__"] as const;

export function extraerJsonParse(html: string, varName: string): unknown | null {
  const spaced = `${varName} = JSON.parse(`;
  const tight = `${varName}=JSON.parse(`;
  for (const marker of [spaced, tight]) {
    const idx = html.indexOf(marker);
    if (idx < 0) continue;
    const parsed = leerStringJsonParse(html, idx + marker.length);
    if (parsed != null) return parsed;
  }
  return null;
}

function leerStringJsonParse(html: string, start: number): unknown | null {
  let i = start;
  while (i < html.length && html[i] !== '"') i += 1;
  if (html[i] !== '"') return null;
  i += 1;
  const chunks: string[] = [];
  for (; i < html.length; i += 1) {
    const c = html[i];
    if (c === "\\") {
      const n = html[++i];
      if (n === "n") chunks.push("\n");
      else if (n === "r") chunks.push("\r");
      else if (n === "t") chunks.push("\t");
      else if (n === '"') chunks.push('"');
      else if (n === "\\") chunks.push("\\");
      else if (n === "u") {
        chunks.push(String.fromCharCode(parseInt(html.slice(i + 1, i + 5), 16)));
        i += 4;
      } else chunks.push(n ?? "");
      continue;
    }
    if (c === '"') break;
    chunks.push(c);
  }
  try {
    return JSON.parse(chunks.join(""));
  } catch {
    return null;
  }
}

export type HabitacliaListPage = {
  initialSearchResultsPage?: {
    initialSearchContext?: {
      results?: {
        items?: HabitacliaItem[];
        pagination?: { page: number; pageSize: number; totalCount: number; totalPages: number };
      };
    };
  };
};

export type HabitacliaItem = {
  id: string;
  legacyNumericId: string;
  navigationUrl?: string;
  summary?: {
    title?: string;
    description?: string;
    location?: {
      visibility?: string;
      municipality?: string;
      district?: string;
      province?: string;
      displayAddressLine?: string;
      displayZoneLine?: string;
      coordinates?: { latitude?: number; longitude?: number };
    };
    multimedia?: {
      images?: Array<{ url?: string }>;
      counts?: { images?: number };
    };
    publisher?: {
      isAgent?: boolean;
      name?: string | null;
      tradeName?: string | null;
      legacyPublisherId?: string | null;
      navigationUrl?: string | null;
    };
    updatedAt?: string;
  };
  property?: {
    propertyType?: string;
    propertySubtype?: string;
    rooms?: number;
    bathrooms?: number;
    builtSurface?: number;
    floor?: number | string | null;
  };
  transaction?: {
    type?: string;
    price?: { amount?: number; hidden?: boolean };
  };
  contact?: { email?: string; phone?: string };
};

function itemsDesdePagina(page: HabitacliaListPage | null): HabitacliaItem[] {
  return page?.initialSearchResultsPage?.initialSearchContext?.results?.items ?? [];
}

export function paginaListadoDesdeHtml(html: string): HabitacliaListPage | null {
  for (const varName of INITIAL_VARS) {
    const raw = extraerJsonParse(html, varName);
    if (!raw || typeof raw !== "object") continue;
    const page = raw as HabitacliaListPage;
    if (itemsDesdePagina(page).length > 0) return page;
  }
  const props = extraerJsonParse(html, "window.__INITIAL_PROPS__");
  return props && typeof props === "object" ? (props as HabitacliaListPage) : null;
}

export function paginacionDesdeHtml(html: string) {
  const page = paginaListadoDesdeHtml(html);
  return page?.initialSearchResultsPage?.initialSearchContext?.results?.pagination ?? null;
}
