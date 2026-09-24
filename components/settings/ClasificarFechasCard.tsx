"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ClasificarFechasCard() {
  const [lanzando, setLanzando] = useState(false);

  const lanzar = async () => {
    setLanzando(true);
    const res = await fetch("/api/captacion/brightdata/clasificar-fechas", { method: "POST" });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    setLanzando(false);
    if (!res.ok || !json.ok) {
      toast.error(json.error || "No se ha podido lanzar la clasificación.");
      return;
    }
    toast.success("Clasificación lanzada. Las franjas se guardan al llegar el listado, sin empeorar una fecha mejor.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fechas de Idealista</CardTitle>
        <CardDescription>
          Una pasada por las cuatro franjas (24 h, 48 h, semana y mes) de las zonas marcadas. No retira anuncios.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="secondary" disabled={lanzando} onClick={() => void lanzar()}>
          {lanzando ? "Lanzando…" : "Clasificar fechas"}
        </Button>
      </CardContent>
    </Card>
  );
}
