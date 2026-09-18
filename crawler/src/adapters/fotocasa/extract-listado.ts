import { extraerScriptJson } from "../shared/extract-json.js";

export type FotocasaFeature = { key: string; value: number };

export type FotocasaItem = {
  id: number | string;
  realEstateAdId?: string;
  description?: string;
  price?: string;
  rawPrice?: number;
  phone?: string;
  clientType?: string;
  clientAlias?: string;
  buildingType?: string;
  buildingSubtype?: string;
  address?: {
    municipality?: string;
    province?: string;
    district?: string;
    zipCode?: string;
  };
  location?: string;
  coordinates?: { latitude?: number; longitude?: number };
  features?: FotocasaFeature[];
  multimedia?: Array<{ type?: string; src?: string }>;
  detail?: Record<string, string>;
  detailWithParams?: Record<string, string>;
  date?: { timestamp?: number };
};

type FotocasaProps = {
  initialSearch?: {
    result?: {
      realEstates?: FotocasaItem[];
      counters?: { realEstates?: number };
    };
  };
  searchContext?: { pageNumber?: number; pathname?: string };
  counters?: { realEstates?: number };
};

export function propsFotocasaDesdeHtml(html: string): FotocasaProps | null {
  const raw = extraerScriptJson(html, "__initial_props__");
  return raw && typeof raw === "object" ? (raw as FotocasaProps) : null;
}

export function anunciosFotocasa(html: string): FotocasaItem[] {
  return propsFotocasaDesdeHtml(html)?.initialSearch?.result?.realEstates ?? [];
}

export function featureVal(item: FotocasaItem, key: string): number | undefined {
  return item.features?.find((f) => f.key === key)?.value;
}
