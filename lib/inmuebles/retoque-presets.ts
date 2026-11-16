export const PRESETS_RETOQUE = [
  {
    id: "luz",
    etiqueta: "Más luz",
    prompt:
      "Improve the exposure, white balance and natural daylight of this real-estate photo. Keep the same room, furniture, windows, walls and framing. Photorealistic. Do not add text, people, logos, watermarks or new objects.",
  },
  {
    id: "enderezar",
    etiqueta: "Enderezar",
    prompt:
      "Straighten vertical lines and the horizon of this real-estate photo. Correct mild lens distortion. Keep the same room and as much of the original framing as possible. Photorealistic. Do not add text, people, logos or new objects.",
  },
  {
    id: "trastos",
    etiqueta: "Quitar trastos",
    prompt:
      "Remove clutter, loose cables, bins, clothes and personal items from this real-estate photo. Keep the architecture, windows, floors and permanent furniture. Fill the cleared areas naturally. Photorealistic. Do not add text, people, logos or extra furniture.",
  },
  {
    id: "cielo",
    etiqueta: "Cielo despejado",
    prompt:
      "If sky is visible, replace it with a clear blue sky and soft clouds. Do not change the building, windows, interior or camera angle. If there is no sky, return the photo unchanged. Photorealistic. Do not add text, people or logos.",
  },
  {
    id: "amueblar",
    etiqueta: "Amueblar",
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
