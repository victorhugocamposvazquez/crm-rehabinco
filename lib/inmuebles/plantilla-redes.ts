import { createClient } from "@/lib/supabase/client";
import { normalizarPlantillaRedes, plantillaRedesPorDefecto, type PlantillaRedes } from "./publicacion-plantilla";

const CLAVE = "crm.plantilla-redes.v1";

export async function leerPlantillaRedes(): Promise<PlantillaRedes> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("publicacion_plantilla").select("formato, estilo, campos").eq("id", 1).maybeSingle();
    if (!error && data) return normalizarPlantillaRedes(data);
  } catch {
    // Si la tabla aún no está, se usa la copia local.
  }
  try {
    const local = localStorage.getItem(CLAVE);
    if (local) return normalizarPlantillaRedes(JSON.parse(local));
  } catch {
    // El navegador puede bloquear el almacén.
  }
  return plantillaRedesPorDefecto();
}

export async function guardarPlantillaRedes(plantilla: PlantillaRedes): Promise<string | null> {
  const limpia = normalizarPlantillaRedes(plantilla);
  try {
    localStorage.setItem(CLAVE, JSON.stringify(limpia));
  } catch {
    // Sigue el guardado en la base.
  }
  const supabase = createClient();
  const { error } = await supabase.from("publicacion_plantilla").upsert({
    id: 1,
    formato: limpia.formato,
    estilo: limpia.estilo,
    campos: limpia.campos,
    updated_at: new Date().toISOString(),
  });
  return error?.message ?? null;
}
