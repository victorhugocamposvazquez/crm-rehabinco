"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { anunciosDeZonas, type ZonaIdealista } from "@/lib/captacion/brightdata/zonas";

export function ZonasIdealistaCard() {
  const [zonas, setZonas] = useState<ZonaIdealista[]>([]);
  const [activas, setActivas] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/captacion/brightdata/zonas");
      const json = (await res.json()) as { ok?: boolean; error?: string; zonas?: ZonaIdealista[]; activas?: string[] };
      if (!res.ok || !json.ok || !json.zonas) {
        toast.error(json.error || "No se han podido leer las zonas.");
        setCargando(false);
        return;
      }
      setZonas(json.zonas);
      setActivas(json.activas ?? json.zonas.map((zona) => zona.id));
      setCargando(false);
    })();
  }, []);

  const grupos = zonas.reduce<Array<{ nombre: string; zonas: ZonaIdealista[] }>>((lista, zona) => {
    const grupo = lista.find((item) => item.nombre === zona.grupo);
    if (grupo) grupo.zonas.push(zona);
    else lista.push({ nombre: zona.grupo, zonas: [zona] });
    return lista;
  }, []);

  const alternar = (id: string) => {
    setActivas((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const guardar = async () => {
    setGuardando(true);
    const res = await fetch("/api/captacion/brightdata/zonas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activas }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string; activas?: string[] };
    setGuardando(false);
    if (!res.ok || !json.ok) {
      toast.error(json.error || "No se han podido guardar las zonas.");
      return;
    }
    if (json.activas) setActivas(json.activas);
    toast.success("Zonas guardadas. El listado usará solo estas.");
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Zonas de Idealista</CardTitle>
        <CardDescription>
          El listado de Idealista entra solo por las zonas marcadas. Hoy son{" "}
          {anunciosDeZonas(activas).toLocaleString("es-ES")} anuncios en Idealista. Cada pasada lee hasta 10 páginas de
          cada zona.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cargando ? <p className="text-sm text-neutral-500">Cargando zonas…</p> : null}
        {grupos.map((grupo) => (
          <fieldset key={grupo.nombre} className="space-y-2">
            <legend className="text-[13px] font-semibold text-neutral-800">{grupo.nombre}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {grupo.zonas.map((zona) => (
                <label key={zona.id} className="flex items-center gap-2 text-[13.5px]">
                  <input
                    type="checkbox"
                    checked={activas.includes(zona.id)}
                    onChange={() => alternar(zona.id)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <span>
                    {zona.nombre}{" "}
                    <span className="text-[var(--text-3)]">({zona.anuncios.toLocaleString("es-ES")})</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <Button type="button" disabled={guardando || cargando} onClick={() => void guardar()}>
          {guardando ? "Guardando…" : "Guardar zonas"}
        </Button>
      </CardContent>
    </Card>
  );
}
