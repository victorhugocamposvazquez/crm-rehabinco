import { headers } from "next/headers";

export async function enDominioPublico(): Promise<boolean> {
  return (await headers()).get("x-rehabinco-sitio") === "publico";
}
