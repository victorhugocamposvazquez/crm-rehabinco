import type { Metadata } from "next";
import { ExploradorEdificios } from "@/components/catastro/mapa/ExploradorEdificios";

export const metadata: Metadata = { title: "Mapa de edificios" };

export default function CatastroMapaPage() {
  return <ExploradorEdificios />;
}
