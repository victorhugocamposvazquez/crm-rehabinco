export const PRESETS_RETOQUE = [
  {
    id: "luz",
    etiqueta: "Más luz",
    motor: "crm",
  },
  {
    id: "enderezar",
    etiqueta: "Enderezar",
    motor: "crm",
  },
  {
    id: "trastos",
    etiqueta: "Quitar trastos",
    motor: "ia",
    prompt:
      "Remove clutter, loose cables, bins, clothes and personal items from this real-estate photo. Keep the architecture, windows, floors and permanent furniture. Fill the cleared areas naturally. Photorealistic. Do not add text, people, logos or extra furniture.",
  },
  {
    id: "cielo",
    etiqueta: "Cielo despejado",
    motor: "ia",
    prompt:
      "If sky is visible, replace it with a clear blue sky and soft clouds. Do not change the building, windows, interior or camera angle. If there is no sky, return the photo unchanged. Photorealistic. Do not add text, people or logos.",
  },
  {
    id: "amueblar",
    etiqueta: "Amueblar",
    motor: "ia",
    prompt:
      "If this room is empty, add simple modern furniture that fits the room, matching the existing light and perspective. Do not change walls, windows, floors or the camera angle. If the room is already furnished, only tidy it. Photorealistic. Do not add text, people or logos.",
  },
] as const;

export type PresetRetoqueId = (typeof PRESETS_RETOQUE)[number]["id"];

export function presetRetoque(id: string): (typeof PRESETS_RETOQUE)[number] | null {
  return PRESETS_RETOQUE.find((p) => p.id === id) ?? null;
}

export function etiquetaRetoque(id: string | null | undefined): string {
  if (!id) return "Retoque";
  return presetRetoque(id)?.etiqueta ?? "Retoque";
}
