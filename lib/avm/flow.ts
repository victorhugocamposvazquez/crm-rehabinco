/**
 * statecrm · AVM · Flujo de micro-preguntas (fase 1)
 *
 * Mismo patrón que `resolveDetailsFlow` de RealAdvisor: una lista de pasos
 * con condición. Los pasos que Catastro ya ha rellenado se saltan y se
 * muestran como "confirmados" (la diferencia clave con RealAdvisor).
 *
 * Dos canales:
 *   - 'crm': sin preguntas de lead (relación, horizonte, uso…).
 *   - 'landing': con ellas, al final, como hace RealAdvisor.
 */
import type { Channel, Twin } from './types';

export type StepId =
  | 'address' | 'location' | 'propertyType'
  | 'floors' | 'side' | 'surface' | 'condition' | 'constructionYear'
  | 'renovated' | 'renovationYear' | 'hasBalcony' | 'balconySurface'
  | 'counters' | 'features' | 'landSurface' | 'buildingUnits' | 'buildingIncome'
  | 'relationship' | 'horizon' | 'occupied' | 'usage' | 'perceivedValue';

export interface Step {
  id: StepId;
  /** Campos del twin que rellena; si todos vienen de Catastro, el paso se salta. */
  fields: (keyof Twin)[];
  title: string;
  hint: string;
  when?: (twin: Twin, channel: Channel) => boolean;
  /** Puede dejarse sin responder ("No lo sé"). */
  optional?: boolean;
}

const isApartment = (t: Twin) => t.mainType === 'apartment';
const isHouse = (t: Twin) => t.mainType === 'house';
const isBuilding = (t: Twin) => t.mainType === 'building';
const isLandOrHouseOrBuilding = (t: Twin) => t.mainType === 'house' || t.mainType === 'land' || t.mainType === 'building';
const isLanding = (_t: Twin, c: Channel) => c === 'landing';

export const STEPS: Step[] = [
  { id: 'address', fields: [], title: '¿Dónde está el inmueble?', hint: 'Dirección o referencia catastral.' },
  { id: 'location', fields: [], title: 'Hemos encontrado el inmueble', hint: 'Confirma la ubicación en el mapa.' },
  { id: 'propertyType', fields: ['mainType', 'propertyType'], title: '¿Qué tipo de inmueble es?', hint: 'Nos ayuda a elegir los comparables.' },

  { id: 'floors', fields: ['floorOfFlat', 'numberOfFloors'], title: '¿En qué planta está?', hint: 'Planta y número de plantas del edificio.', when: isApartment },
  { id: 'side', fields: ['side'], title: '¿A qué lado da?', hint: 'Exterior (calle) o interior (patio).', when: isApartment },
  { id: 'surface', fields: ['builtSurface'], title: '¿Qué superficie tiene?', hint: 'Construida, en m². Es el dato que más pesa.' },
  { id: 'landSurface', fields: ['landSurface'], title: '¿Qué superficie tiene la parcela?', hint: 'En m².', when: isLandOrHouseOrBuilding },
  { id: 'condition', fields: ['buildingCondition'], title: '¿En qué estado está?', hint: 'Sé sincero: solo afina la valoración.' },
  { id: 'constructionYear', fields: ['constructionYear'], title: '¿Cuándo se construyó?', hint: 'Un año aproximado basta.', optional: true },
  { id: 'renovated', fields: ['isRenovated'], title: '¿Se ha reformado?', hint: 'Las reformas suben el valor.', optional: true },
  { id: 'renovationYear', fields: ['renovationYear'], title: '¿Cuándo fue la última reforma?', hint: 'Un año aproximado basta.', when: (t) => t.isRenovated === true, optional: true },
  { id: 'hasBalcony', fields: ['hasBalcony'], title: '¿Tiene balcón o terraza?', hint: 'El espacio exterior añade valor.', when: isApartment },
  { id: 'balconySurface', fields: ['balconySurface'], title: '¿Qué tamaño tiene?', hint: 'En m².', when: (t) => isApartment(t) && t.hasBalcony === true, optional: true },
  { id: 'counters', fields: ['numberOfBedrooms', 'numberOfBathrooms', 'numberOfIndoorParkings', 'numberOfOutdoorParkings'], title: 'Dormitorios, baños y aparcamiento', hint: '' },
  { id: 'features', fields: ['hasView', 'hasSwimmingPool', 'hasGarden', 'hasElevator', 'hasStorageRoom', 'hasFireplace'], title: '¿Qué más tiene?', hint: 'Marca todo lo que corresponda.' },
  { id: 'buildingUnits', fields: ['numberOfResidentialUnits', 'numberOfCommercialUnits'], title: '¿Cuántas unidades tiene el edificio?', hint: 'Viviendas y locales.', when: isBuilding },
  { id: 'buildingIncome', fields: ['residentialYearlyRentalIncome', 'commercialYearlyRentalIncome'], title: '¿Qué renta anual genera?', hint: 'Si está alquilado total o parcialmente.', when: isBuilding, optional: true },

  // Solo landing
  { id: 'relationship', fields: ['relationship'], title: '¿Cuál es tu relación con el inmueble?', hint: 'Nos ayuda a adaptar el informe.', when: isLanding },
  { id: 'horizon', fields: ['saleHorizon'], title: '¿Estás pensando en vender?', hint: 'Sin compromiso.', when: (t, c) => isLanding(t, c) && t.relationship === 'owner' },
  { id: 'occupied', fields: ['propertyOccupied'], title: '¿Quién vive en el inmueble?', hint: 'Influye en el plazo de venta.', when: (t, c) => isLanding(t, c) && (isApartment(t) || isHouse(t)) },
  { id: 'usage', fields: ['propertyUsage'], title: '¿Cómo lo usas?', hint: 'Residencia principal o segunda residencia.', when: (t, c) => isLanding(t, c) && t.relationship === 'owner' && t.propertyOccupied === 'owner_occupied' },
  { id: 'perceivedValue', fields: ['perceivedValue'], title: 'En tu opinión, ¿cuánto vale?', hint: 'Opcional. No cambia el resultado.', when: isLanding, optional: true },
];

export interface ResolvedStep extends Step {
  /** true si Catastro (u otra fuente) ya rellenó todos sus campos. */
  prefilled: boolean;
}

/**
 * Pasos aplicables a este twin y canal. `prefilledFields` son los campos que
 * vinieron de Catastro o del anuncio; sus pasos se marcan como `prefilled`
 * y la UI los enseña como "confirmados" en vez de preguntarlos.
 */
export function resolveFlow(twin: Twin, channel: Channel, prefilledFields: Set<keyof Twin> = new Set()): ResolvedStep[] {
  return STEPS
    .filter((s) => !s.when || s.when(twin, channel))
    .map((s) => ({
      ...s,
      prefilled: s.fields.length > 0 && s.fields.every((f) => prefilledFields.has(f)),
    }));
}

/** Siguiente paso sin responder (ni prefilled). */
export function nextStep(twin: Twin, channel: Channel, prefilledFields?: Set<keyof Twin>): ResolvedStep | null {
  const flow = resolveFlow(twin, channel, prefilledFields);
  return (
    flow.find((s) => {
      if (s.prefilled) return false;
      if (s.fields.length === 0) return false; // address/location se gestionan aparte
      return s.fields.some((f) => twin[f] === null || twin[f] === undefined);
    }) ?? null
  );
}

/** Cuántos pasos tienen respuesta (para "N detalles confirmados"). */
export function confirmedCount(twin: Twin, channel: Channel, prefilledFields?: Set<keyof Twin>): number {
  return resolveFlow(twin, channel, prefilledFields).filter(
    (s) => s.fields.length > 0 && (s.prefilled || s.fields.every((f) => twin[f] !== null && twin[f] !== undefined)),
  ).length;
}
