export function fotocasaConfigurado(): boolean {
  return false;
}

export function milanunciosConfigurado(): boolean {
  return false;
}

export async function buscarFotocasa(): Promise<never> {
  throw new Error("Fotocasa no está configurado.");
}

export async function buscarMilanuncios(): Promise<never> {
  throw new Error("Milanuncios no está configurado.");
}
