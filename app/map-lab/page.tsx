import { notFound } from "next/navigation";
import { MapLabClient } from "./MapLabClient";

/** Solo desarrollo: capturas del mapa AVM (OpenFreeMap + ortofoto). */
export default function MapLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <MapLabClient />;
}
