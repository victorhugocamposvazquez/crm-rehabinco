/**
 * statecrm · AVM · Tipos del dominio (fase 1)
 * Esquema calcado al "twin" de RealAdvisor, sin campos suizos ni fingerprint.
 */

export type CountryCode = 'es';
export type MainType = 'apartment' | 'house' | 'land' | 'building';
export type PropertyType =
  | 'apartment' | 'studio' | 'duplex' | 'penthouse'
  | 'house' | 'villa' | 'townhouse'
  | 'land' | 'building';
export type Side = 'exterior' | 'interior';
export type Operation = 'sale' | 'rent';
export type Channel = 'crm' | 'landing' | 'batch';

export type Relationship = 'owner' | 'buyer' | 'tenant' | 'agent' | 'other';
export type SaleHorizon =
  | 'asap' | 'from_6_to_12_months' | 'from_1_to_2_years' | 'from_2_years'
  | 'already_for_sale' | 'not_selling';
export type PropertyOccupied = 'owner_occupied' | 'tenant_occupied' | 'empty';
export type PropertyUsage = 'primary_residence' | 'second_home';

export interface Address {
  formattedAddress: string | null;
  route: string | null;
  streetNumber: string | null;
  postcode: string | null;
  locality: string | null;
  municipalityCode: string | null;   // INE 5 dígitos
  censusSection: string | null;      // INE 10 dígitos
  province: string | null;
  countryCode: CountryCode;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  catastralRef: string | null;       // 20 caracteres
}

/** Gemelo digital del inmueble: lo que se valora. */
export interface Twin {
  address: Address;
  mainType: MainType | null;
  propertyType: PropertyType | null;

  // Edificio / planta
  floorOfFlat: number | null;
  numberOfFloors: number | null;
  side: Side | null;
  hasElevator: boolean | null;

  // Superficies (m²)
  builtSurface: number | null;
  livingSurface: number | null;
  landSurface: number | null;
  balconySurface: number | null;
  gardenSurface: number | null;

  // Antigüedad / estado
  constructionYear: number | null;
  renovationYear: number | null;
  isRenovated: boolean | null;
  buildingCondition: 1 | 2 | 3 | 4 | 5 | null;   // 1 ruina … 5 excelente

  // Distribución
  numberOfRooms: number | null;
  numberOfBedrooms: number | null;
  numberOfBathrooms: number | null;
  numberOfIndoorParkings: number | null;
  numberOfOutdoorParkings: number | null;

  // Extras
  hasView: boolean | null;
  hasSwimmingPool: boolean | null;
  hasBalcony: boolean | null;
  hasGarden: boolean | null;
  hasStorageRoom: boolean | null;
  hasFireplace: boolean | null;

  // Edificio completo
  numberOfResidentialUnits: number | null;
  residentialYearlyRentalIncome: number | null;
  numberOfCommercialUnits: number | null;
  commercialYearlyRentalIncome: number | null;

  // Solo landing (lead)
  relationship: Relationship | null;
  saleHorizon: SaleHorizon | null;
  propertyOccupied: PropertyOccupied | null;
  propertyUsage: PropertyUsage | null;
  perceivedValue: number | null;
}

export const emptyAddress = (): Address => ({
  formattedAddress: null, route: null, streetNumber: null, postcode: null,
  locality: null, municipalityCode: null, censusSection: null, province: null,
  countryCode: 'es', lat: null, lng: null, googlePlaceId: null, catastralRef: null,
});

export const emptyTwin = (): Twin => ({
  address: emptyAddress(),
  mainType: null, propertyType: null,
  floorOfFlat: null, numberOfFloors: null, side: null, hasElevator: null,
  builtSurface: null, livingSurface: null, landSurface: null, balconySurface: null, gardenSurface: null,
  constructionYear: null, renovationYear: null, isRenovated: null, buildingCondition: null,
  numberOfRooms: null, numberOfBedrooms: null, numberOfBathrooms: null,
  numberOfIndoorParkings: null, numberOfOutdoorParkings: null,
  hasView: null, hasSwimmingPool: null, hasBalcony: null, hasGarden: null, hasStorageRoom: null, hasFireplace: null,
  numberOfResidentialUnits: null, residentialYearlyRentalIncome: null,
  numberOfCommercialUnits: null, commercialYearlyRentalIncome: null,
  relationship: null, saleHorizon: null, propertyOccupied: null, propertyUsage: null, perceivedValue: null,
});

/** Estadística de zona (fila de market_zone_trend o respaldo). */
export type ZoneLevel = 'census_section' | 'postcode' | 'municipality' | 'province' | 'country';
export interface ZoneStats {
  zoneLevel: ZoneLevel;
  zoneKey: string;
  label: string;
  month: string;              // 'YYYY-MM-01'
  n: number;
  medianPpm2: number;
  p25Ppm2: number | null;
  p75Ppm2: number | null;
  trend12mPct: number | null;
  source: 'market_listings' | 'portal_report' | 'official_series' | 'country_base';
}

/** Comparable devuelto por avm_comparables(). */
export interface Comparable {
  listingId: string;
  portal: string;
  title: string | null;
  price: number;
  surface: number;
  pricePerM2: number;
  rooms: number | null;
  floor: number | null;
  hasElevator: boolean | null;
  hasGarage: boolean | null;
  hasTerrace: boolean | null;
  isExterior: boolean | null;
  conditionHint: string | null;
  lastSeen: string;           // 'YYYY-MM-DD'
  distanceM: number;
  radiusM: number;
}

export interface AdjustedComparable extends Comparable {
  adjustments: Record<string, number>;   // factor por atributo (1.00 = sin ajuste)
  adjustedPpm2: number;
  weight: number;
}

/** Qué eslabón se usó en cada capa. */
export type SourceStatus = 'primary' | 'fallback' | 'degraded' | 'missing';
export interface SourceUsed {
  layer: 'geocoding' | 'property' | 'market' | 'comparables' | 'close_series' | 'environment' | 'rent';
  source: string;
  status: SourceStatus;
  note?: string;
}

export interface EnvironmentItem {
  indicator: string;
  label: string;
  value?: number | string;
  distanceM?: number;
  sense: 'positive' | 'negative' | 'both' | 'info';
  source: string;
}

export interface Environment {
  score: number | null;      // 0..100, informativo
  positives: EnvironmentItem[];
  negatives: EnvironmentItem[];
  flags: EnvironmentItem[];  // riesgos y avisos de conocimiento local
}

export interface ValuationResult {
  methodVersion: string;
  operation: Operation;
  valueMid: number;
  valueLow: number;
  valueHigh: number;
  pricePerM2: number | null;
  rentMonthly: number | null;
  rentSource: 'comparables' | 'zone_adjusted' | 'yield' | null;
  rangeMethod: 'iqr' | 'iqr_shrunk' | null;
  grossYield: number | null;
  confidence: number;        // 0..100
  precisionScore: number;    // completitud del twin, 0..100
  sourcesUsed: SourceUsed[];
  comparables: AdjustedComparable[];
  zoneStats: ZoneStats | null;
  environment: Environment | null;
  explanation: string[];
}
