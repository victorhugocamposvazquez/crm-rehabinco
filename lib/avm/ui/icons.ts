import {
  Bus,
  Car,
  Construction,
  Factory,
  Fuel,
  Baby,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Hospital,
  Pill,
  Shield,
  ShoppingCart,
  Siren,
  Store,
  TrainFront,
  Trees,
  Umbrella,
  Utensils,
  Volume2,
  Waves,
  Wine,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Categorías que escriben los cargadores (`scripts/env-load`) y las capas
 * sin categoría (ruido, inundación, criminalidad, vulnerabilidad).
 * `ENV_ICONS` tiene que cubrirlas todas: si falta una, no compila.
 */
export const ENV_CATEGORIES = [
  "fuel",
  "supermarket",
  "shop",
  "restaurant",
  "nightlife",
  "school",
  "kindergarten",
  "nursery",
  "health",
  "health_center",
  "health_private",
  "hospital",
  "pac",
  "pharmacy",
  "park",
  "beach",
  "gym",
  "sport",
  "hospitality",
  "bus",
  "rail",
  "railway",
  "main_road",
  "industrial",
  "power_line",
  "noise",
  "flood",
  "T10",
  "T100",
  "T500",
  "fuera",
  "vulnerable_section",
  "crime_municipality",
  "income_section",
  "building_age",
  "daily_services",
  "air_station",
  "zone_mark",
] as const;

export type EnvCategory = (typeof ENV_CATEGORIES)[number];

export const ENV_ICONS: Record<EnvCategory, LucideIcon> = {
  fuel: Fuel,
  supermarket: ShoppingCart,
  shop: Store,
  restaurant: Store,
  nightlife: Wine,
  school: GraduationCap,
  kindergarten: Baby,
  nursery: Baby,
  health: HeartPulse,
  health_center: HeartPulse,
  health_private: HeartPulse,
  hospital: Hospital,
  pac: HeartPulse,
  pharmacy: Pill,
  park: Trees,
  beach: Umbrella,
  gym: Dumbbell,
  sport: Dumbbell,
  hospitality: Utensils,
  bus: Bus,
  rail: TrainFront,
  railway: TrainFront,
  main_road: Car,
  industrial: Factory,
  power_line: Zap,
  noise: Volume2,
  flood: Waves,
  T10: Waves,
  T100: Waves,
  T500: Waves,
  fuera: Waves,
  vulnerable_section: Shield,
  crime_municipality: Siren,
  income_section: Store,
  building_age: Construction,
  daily_services: Store,
  air_station: Waves,
  zone_mark: Construction,
};

export function esEnvCategory(value: string): value is EnvCategory {
  return (ENV_CATEGORIES as readonly string[]).includes(value);
}

/** Icono de la categoría del cargador. La capa `health` / `school` no cae en el genérico. */
export function iconoEntorno(indicator: string): LucideIcon {
  const [layer, category] = indicator.split(":");
  if (category && esEnvCategory(category)) return ENV_ICONS[category];
  if (layer && esEnvCategory(layer)) return ENV_ICONS[layer];
  if (layer === "gtfs_stop") return ENV_ICONS.bus;
  if (layer === "osm_poi") return ENV_ICONS.shop;
  return ENV_ICONS.shop;
}
