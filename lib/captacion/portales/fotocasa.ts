import { leerCredencialesPortal } from "./credenciales";

export async function fotocasaConfigurado(): Promise<boolean> {
  return Boolean(await leerCredencialesPortal("fotocasa"));
}

export function milanunciosConfigurado(): boolean {
  return false;
}

export async function buscarFotocasa(): Promise<never> {
  if (await fotocasaConfigurado()) {
    throw new Error("Fotocasa aún no tiene API de lectura de anuncios.");
  }
  throw new Error("Fotocasa no está configurado.");
}

export async function buscarMilanuncios(): Promise<never> {
  throw new Error("Milanuncios no está configurado.");
}
