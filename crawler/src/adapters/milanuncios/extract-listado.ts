import { extraerInitialProps } from "../shared/extract-json.js";

import type { MilanunciosAttribute, MilanunciosTag } from "./caracteristicas.js";

export type MilanunciosAd = {
  id: string;
  url?: string;
  title?: string;
  description?: string;
  price?: { cashPrice?: { value?: number } };
  sellerType?: string;
  isPhoneAvailable?: boolean;
  images?: string[];
  tags?: MilanunciosTag[];
  attributes?: MilanunciosAttribute[];
  location?: {
    province?: { name?: string };
    city?: { name?: string };
    district?: string;
    geolocation?: { latitude?: number; longitude?: number };
  };
  province?: { name?: string };
  city?: { name?: string };
  publishDate?: string;
  updateDate?: string;
};

export type MilanunciosPage = {
  adListPagination?: {
    adList?: { ads?: MilanunciosAd[] };
    pagination?: { page?: number; totalPages?: number; totalAds?: number };
  };
};

export function paginaMilanunciosDesdeHtml(html: string): MilanunciosPage | null {
  const raw = extraerInitialProps(html);
  return raw && typeof raw === "object" ? (raw as MilanunciosPage) : null;
}

export function anunciosMilanuncios(html: string): MilanunciosAd[] {
  return paginaMilanunciosDesdeHtml(html)?.adListPagination?.adList?.ads ?? [];
}
