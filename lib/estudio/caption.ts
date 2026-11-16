/** Texto para la publicación: prompt para el modelo y un texto de respaldo sin IA (por si la llamada falla). */
import { AGENCIA, type InmuebleEstudio } from "./data";
import type { FieldKey } from "./config";

export type Canal = 'instagram' | 'facebook' | 'linkedin' | 'whatsapp';
export type Tono = 'cercano' | 'pro' | 'lujo';
export type CaptionRequest = {
  inmueble: Pick<InmuebleEstudio, 'ref' | 'titulo' | 'direccion' | 'zona' | 'barrio' | 'precio' | 'm2' | 'habitaciones' | 'banos' | 'energia'> & { agente: string };
  canal: Canal; tono: Tono;
  /** Etiqueta de la pieza: «Nuevo», «Precio rebajado»… */
  objetivo: string;
  /** Solo se pueden mencionar los datos visibles en la creatividad. */
  visibles: FieldKey[];
  soloZona: boolean;
};

const eur = (n: number) => n.toLocaleString('es-ES') + ' €';

/** Hechos que el modelo puede usar: nada que el usuario haya ocultado, ni la calle si va «solo zona». */
export function captionFacts(r: CaptionRequest): string[] {
  const i = r.inmueble, v = new Set(r.visibles), out: string[] = [];
  if (v.has('titulo')) out.push(`Título: ${i.titulo}`);
  if (v.has('zona')) out.push(`Ubicación: ${r.soloZona ? i.zona : `${i.direccion}, ${i.zona}`}`);
  if (v.has('precio')) out.push(`Precio: ${eur(i.precio)}`);
  if (v.has('m2')) out.push(`Superficie: ${i.m2} m²`);
  if (v.has('hab')) out.push(`Dormitorios: ${i.habitaciones}`);
  if (v.has('banos')) out.push(`Baños: ${i.banos}`);
  if (v.has('energia') && i.energia) out.push(`Certificado energético: ${i.energia}`);
  if (v.has('ref')) out.push(`Referencia: ${i.ref}`);
  if (v.has('agente')) out.push(`Agente: ${i.agente}`);
  out.push(`Teléfono de la agencia: ${AGENCIA.telefono}`, `Web: ${AGENCIA.web}`);
  return out;
}

export function buildCaptionPrompt(r: CaptionRequest): string {
  const canal = { instagram: 'Instagram (hasta 5 hashtags locales al final)', facebook: 'Facebook (2 hashtags como mucho)', linkedin: 'LinkedIn (sin emojis ni hashtags, tono de empresa)', whatsapp: 'WhatsApp (3 párrafos cortos y el enlace a la ficha)' }[r.canal];
  const tono = { cercano: 'cercano y natural, de tú', pro: 'profesional y directo, con los datos en lista', lujo: 'sobrio y aspiracional, sin exagerar' }[r.tono];
  return [
    'Escribe el texto de una publicación para la inmobiliaria Rehabinco (A Coruña), en español de España.',
    `Motivo de la publicación: ${r.objetivo}. Red: ${canal}. Tono: ${tono}.`,
    'Usa SOLO estos datos; no inventes características, calidades, vistas ni cercanías que no estén aquí:',
    ...captionFacts(r).map((f) => `- ${f}`),
    'Termina con una llamada a contactar. Devuelve solo el texto, sin comillas ni explicaciones.',
  ].join('\n');
}

/** Texto correcto pero plano, para cuando el modelo no responde. Igual que el prompt, solo usa datos visibles. */
export function captionFallback(r: CaptionRequest): string {
  const i = r.inmueble, v = new Set(r.visibles);
  const datos = [
    v.has('m2') ? `${i.m2} m²` : '',
    v.has('hab') ? `${i.habitaciones} ${i.habitaciones === 1 ? 'dormitorio' : 'dormitorios'}` : '',
    v.has('banos') ? `${i.banos} ${i.banos === 1 ? 'baño' : 'baños'}` : '',
  ].filter(Boolean).join(', ');
  const lineas = [
    `${r.objetivo}${v.has('titulo') ? `: ${i.titulo}` : ''}`,
    [v.has('zona') ? (r.soloZona ? i.zona : `${i.direccion}, ${i.zona}`) : '', datos].filter(Boolean).join('. '),
    [v.has('precio') ? eur(i.precio) : '', v.has('ref') ? `Ref. ${i.ref}` : ''].filter(Boolean).join(' · '),
    `Información y visitas: ${AGENCIA.telefono}`,
  ].filter(Boolean);
  let t = lineas.join('\n\n');
  if (r.canal === 'instagram') t += `\n\n#ACoruña #${i.barrio.replace(/\s/g, '')} #Rehabinco`;
  if (r.canal === 'whatsapp') t += `\n\n${AGENCIA.web}/${i.ref}`;
  return t;
}
