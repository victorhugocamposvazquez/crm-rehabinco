export type WallapopItem = {
  id: string;
  user_id?: string;
  title?: string;
  description?: string;
  category_id?: number;
  price?: { amount?: number; currency?: string };
  images?: Array<{ urls?: { medium?: string; big?: string; small?: string } }>;
  location?: {
    latitude?: number;
    longitude?: number;
    postal_code?: string;
    city?: string;
    region?: string;
    region2?: string;
    country_code?: string;
  };
  web_slug?: string;
  created_at?: string;
  modified_at?: string;
  type_attributes?: {
    operation?: string;
    type?: string;
    surface?: number;
    rooms?: number;
    bathrooms?: number;
  };
  is_top_profile?: { flag?: boolean };
  user?: { type?: string; is_business?: boolean; microsite_slug?: string };
  seller_type?: string;
};

export type WallapopSearchPayload = {
  items?: WallapopItem[];
  pagination?: { next_page?: string | null };
};

export type WallapopSearchResponse = {
  data?: { section?: { payload?: WallapopSearchPayload } };
  search_objects?: WallapopItem[];
};

const PAGE_SIZE = 40;

export function itemsWallapopDesdeJson(body: string): {
  items: WallapopItem[];
  hayMasPaginas: boolean;
} {
  const json = JSON.parse(body) as WallapopSearchResponse;
  const payload = json.data?.section?.payload;
  const legacy = json.search_objects;
  const items = payload?.items ?? legacy ?? [];
  const hayMas = Boolean(payload?.pagination?.next_page) || items.length >= PAGE_SIZE;
  return { items, hayMasPaginas: hayMas };
}

export function operacionDesdeItem(item: WallapopItem): "venta" | "alquiler" {
  const op = item.type_attributes?.operation?.toLowerCase();
  if (op === "rent" || op === "alquiler") return "alquiler";
  return "venta";
}

export function urlItemWallapop(item: WallapopItem): string | undefined {
  if (item.web_slug) return `https://es.wallapop.com/item/${item.web_slug}`;
  if (item.id) return `https://es.wallapop.com/item/${item.id}`;
  return undefined;
}

export function fotosWallapop(item: WallapopItem): string[] | undefined {
  const urls = (item.images ?? [])
    .map((img) => img.urls?.medium ?? img.urls?.big ?? img.urls?.small)
    .filter((u): u is string => Boolean(u));
  return urls.length ? urls : undefined;
}

export function contactoTipoWallapop(item: WallapopItem): "profesional" | "desconocido" {
  if (item.is_top_profile?.flag) return "profesional";
  if (item.user?.is_business) return "profesional";
  const t = (item.user?.type ?? item.seller_type ?? "").toLowerCase();
  if (t.includes("pro") || t.includes("business") || t.includes("professional")) return "profesional";
  return "desconocido";
}
