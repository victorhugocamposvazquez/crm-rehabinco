/**
 * Pantallas agrupadas del valorador (prototipo #nueva / GROUPS).
 * resolveFlow del motor sigue aplicando condiciones por tipo; la UI agrupa campos.
 */
import type { Channel, Twin } from "./types";

export type WizardGroupId = "building" | "state" | "about";
export type WizardScreenId = "address" | "unit" | "building" | "state" | "about" | "email" | "valorar";

export type FieldKind = "chips" | "stepper" | "number" | "multi";

export type GroupField = {
  f: keyof Twin | "extras";
  label: string;
  kind: FieldKind;
  required?: boolean;
  noUnknown?: boolean;
  unit?: string;
  min?: number;
  when?: (t: Twin) => boolean;
  opts?: [unknown, string][] | ((t: Twin) => [unknown, string][]);
};

export const SUBTYPES: Record<string, [string, string][]> = {
  apartment: [
    ["apartment", "Piso"],
    ["studio", "Estudio"],
    ["duplex", "Dúplex"],
    ["penthouse", "Ático"],
  ],
  house: [
    ["house", "Casa"],
    ["villa", "Chalet"],
    ["townhouse", "Adosado"],
  ],
  land: [["land", "Terreno"]],
  building: [["building", "Edificio"]],
};

export const EXTRAS_KEYS = ["hasView", "hasSwimmingPool", "hasGarden", "hasStorageRoom", "hasFireplace"] as const;

export const GROUPS: Record<WizardGroupId, { fields: GroupField[] }> = {
  building: {
    fields: [
      {
        f: "mainType",
        label: "Tipo",
        kind: "chips",
        required: true,
        noUnknown: true,
        opts: [
          ["apartment", "Piso"],
          ["house", "Casa"],
          ["building", "Edificio"],
          ["land", "Terreno"],
        ],
      },
      {
        f: "propertyType",
        label: "Subtipo",
        kind: "chips",
        noUnknown: true,
        when: (t) => !!t.mainType && (SUBTYPES[t.mainType]?.length ?? 0) > 1,
        opts: (t) => SUBTYPES[t.mainType ?? "apartment"] ?? [],
      },
      { f: "builtSurface", label: "Superficie construida", kind: "number", unit: "m²", required: true },
      { f: "constructionYear", label: "Año de construcción", kind: "number" },
      {
        f: "floorOfFlat",
        label: "Planta",
        kind: "chips",
        when: (t) => t.mainType === "apartment",
        opts: [
          [0, "Bajo"],
          [1, "1ª"],
          [2, "2ª"],
          [3, "3ª"],
          [4, "4ª"],
          [5, "5ª"],
          [6, "6ª"],
          [7, "7ª"],
          [8, "8ª"],
          ["more", "9ª o más"],
        ],
      },
      {
        f: "numberOfFloors",
        label: "Plantas del edificio",
        kind: "stepper",
        min: 1,
        when: (t) => t.mainType === "apartment",
      },
      {
        f: "side",
        label: "Orientación",
        kind: "chips",
        when: (t) => t.mainType === "apartment",
        opts: [
          ["exterior", "Exterior · da a la calle"],
          ["interior", "Interior · da al patio"],
        ],
      },
      {
        f: "hasElevator",
        label: "Ascensor",
        kind: "chips",
        when: (t) => t.mainType === "apartment",
        opts: [
          [true, "Sí"],
          [false, "No"],
        ],
      },
      {
        f: "landSurface",
        label: "Parcela",
        kind: "number",
        unit: "m²",
        when: (t) => t.mainType === "house" || t.mainType === "land",
      },
    ],
  },
  state: {
    fields: [
      {
        f: "buildingCondition",
        label: "Estado",
        kind: "chips",
        opts: [
          [5, "Excelente"],
          [4, "Bueno"],
          [3, "Aceptable"],
          [2, "Malo"],
          [1, "Ruina"],
        ],
      },
      {
        f: "isRenovated",
        label: "Reformado",
        kind: "chips",
        opts: [
          [true, "Sí"],
          [false, "No"],
        ],
      },
      {
        f: "renovationYear",
        label: "Año de la reforma",
        kind: "number",
        when: (t) => t.isRenovated === true,
      },
      { f: "numberOfBedrooms", label: "Dormitorios", kind: "stepper", min: 0 },
      { f: "numberOfBathrooms", label: "Baños", kind: "stepper", min: 0 },
      { f: "numberOfIndoorParkings", label: "Plazas de garaje", kind: "stepper", min: 0 },
      {
        f: "hasBalcony",
        label: "Terraza o balcón",
        kind: "chips",
        when: (t) => t.mainType === "apartment",
        opts: [
          [true, "Sí"],
          [false, "No"],
        ],
      },
      {
        f: "balconySurface",
        label: "Superficie de terraza",
        kind: "number",
        unit: "m²",
        when: (t) => t.hasBalcony === true,
      },
      {
        f: "extras",
        label: "Extras",
        kind: "multi",
        opts: [
          ["hasView", "Vistas despejadas"],
          ["hasSwimmingPool", "Piscina"],
          ["hasGarden", "Jardín"],
          ["hasStorageRoom", "Trastero"],
          ["hasFireplace", "Chimenea"],
        ],
      },
    ],
  },
  about: {
    fields: [
      {
        f: "relationship",
        label: "Tu relación con la vivienda",
        kind: "chips",
        required: true,
        noUnknown: true,
        opts: [
          ["owner", "Propietario"],
          ["buyer", "Comprador"],
          ["tenant", "Inquilino"],
          ["agent", "Agente"],
          ["other", "Otro"],
        ],
      },
      {
        f: "saleHorizon",
        label: "¿Estás pensando en vender?",
        kind: "chips",
        noUnknown: true,
        when: (t) => t.relationship === "owner",
        opts: [
          ["asap", "Sí, lo antes posible"],
          ["from_6_to_12_months", "En 6 a 12 meses"],
          ["from_1_to_2_years", "En 1 a 2 años"],
          ["from_2_years", "En 2 años o más"],
          ["already_for_sale", "Ya está a la venta"],
          ["not_selling", "No tengo intención"],
        ],
      },
    ],
  },
};

export function wizardScreens(channel: Channel, needsUnit: boolean): { id: WizardScreenId; label: string }[] {
  const base: { id: WizardScreenId; label: string }[] = [
    { id: "address", label: "Inmueble" },
  ];
  if (needsUnit) base.push({ id: "unit", label: "Vivienda" });
  base.push(
    { id: "building", label: "Datos del inmueble" },
    { id: "state", label: "Estado y distribución" },
  );
  if (channel === "landing") {
    base.push({ id: "about", label: "Sobre ti" }, { id: "email", label: "Email" });
  }
  base.push({ id: "valorar", label: "Valorar" });
  return base;
}

export function groupFields(group: WizardGroupId, twin: Twin): GroupField[] {
  return GROUPS[group].fields.filter((x) => !x.when || x.when(twin));
}

export function groupIsValid(group: WizardGroupId, twin: Twin, unknown: Set<string>): boolean {
  for (const x of groupFields(group, twin)) {
    if (!x.required) continue;
    if (x.f === "extras") continue;
    const key = x.f as keyof Twin;
    if (unknown.has(String(key))) return false;
    const v = twin[key];
    if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return false;
  }
  return true;
}

export function canContinueScreen(
  screen: WizardScreenId,
  twin: Twin | null,
  unknown: Set<string>,
  opts: { email?: string; consent?: boolean; channel: Channel },
): boolean {
  if (!twin && screen !== "address") return false;
  if (screen === "address") return false;
  if (screen === "building") return groupIsValid("building", twin!, unknown);
  if (screen === "state") return true;
  if (screen === "about") return groupIsValid("about", twin!, unknown);
  if (screen === "email") {
    return opts.channel === "landing" && /^.+@.+\..+$/.test(opts.email ?? "") && !!opts.consent;
  }
  if (screen === "valorar") return groupIsValid("building", twin!, unknown);
  return true;
}

export function screenForField(f: string): WizardScreenId {
  if (f === "address" || f === "catastralRef") return "address";
  if (GROUPS.building.fields.some((x) => x.f === f)) return "building";
  if (GROUPS.state.fields.some((x) => x.f === f || (x.f === "extras" && EXTRAS_KEYS.includes(f as (typeof EXTRAS_KEYS)[number]))))
    return "state";
  if (GROUPS.about.fields.some((x) => x.f === f)) return "about";
  return "building";
}
