"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Gasto = {
  saldo: number | null;
  pendiente: number | null;
  gastoMes: number | null;
  mes: string;
  aviso: string | null;
};

function usd(valor: number | null): string {
  if (valor == null) return "—";
  return valor.toLocaleString("es-ES", { style: "currency", currency: "USD" });
}

export function SaldoBrightDataCard() {
  const [gasto, setGasto] = useState<Gasto | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    setCargando(true);
    const res = await fetch("/api/captacion/brightdata/saldo");
    const json = (await res.json()) as Gasto & { ok?: boolean; error?: string };
    setCargando(false);
    if (!res.ok || !json.ok) {
      toast.error(json.error || "No se ha podido leer el gasto de Bright Data.");
      return;
    }
    setGasto(json);
  };

  useEffect(() => {
    void cargar();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gasto de Bright Data</CardTitle>
        <CardDescription>
          Saldo de la cuenta y lo facturado en {gasto?.mes ?? "este mes"}. Las cifras son las de Bright Data, en dólares.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cargando && !gasto ? <p className="text-sm text-neutral-500">Leyendo Bright Data…</p> : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[12.5px] text-[var(--text-3)]">Saldo</p>
            <p className="text-2xl font-semibold tabular-nums">{usd(gasto?.saldo ?? null)}</p>
          </div>
          <div>
            <p className="text-[12.5px] text-[var(--text-3)]">Gasto de {gasto?.mes ?? "este mes"}</p>
            <p className="text-2xl font-semibold tabular-nums">{usd(gasto?.gastoMes ?? null)}</p>
          </div>
          <div>
            <p className="text-[12.5px] text-[var(--text-3)]">Pendiente de facturar</p>
            <p className="text-2xl font-semibold tabular-nums">{usd(gasto?.pendiente ?? null)}</p>
          </div>
        </div>
        {gasto?.aviso ? <p className="text-[13px] text-[var(--text-2)]">{gasto.aviso}</p> : null}
        <Button type="button" variant="secondary" disabled={cargando} onClick={() => void cargar()}>
          {cargando ? "Actualizando…" : "Actualizar"}
        </Button>
      </CardContent>
    </Card>
  );
}
