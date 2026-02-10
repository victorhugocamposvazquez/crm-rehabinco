"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Pencil } from "lucide-react";

interface FacturaRow {
  id: string;
  numero: string;
  estado: string;
  concepto: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  cliente_id: string | null;
  clientes: { id: string; nombre: string } | null;
}

interface LineaRow {
  id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

export default function DetalleFacturaPage() {
  const params = useParams();
  const id = params.id as string;
  const [factura, setFactura] = useState<FacturaRow | null>(null);
  const [lineas, setLineas] = useState<LineaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("facturas")
      .select("id, numero, estado, concepto, fecha_emision, fecha_vencimiento, cliente_id, clientes(id, nombre)")
      .eq("id", id)
      .single()
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setFactura(null);
        } else {
          const raw = data as {
            id: string;
            numero: string;
            estado: string;
            concepto: string | null;
            fecha_emision: string | null;
            fecha_vencimiento: string | null;
            cliente_id: string | null;
            clientes:
              | { id: string; nombre: string }
              | { id: string; nombre: string }[]
              | null;
          };

          const cliente = Array.isArray(raw.clientes)
            ? (raw.clientes[0] ?? null)
            : raw.clientes;

          setFactura({
            ...raw,
            clientes: cliente,
          });
        }
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    supabase
      .from("factura_lineas")
      .select("id, descripcion, cantidad, precio_unitario")
      .eq("factura_id", id)
      .order("orden")
      .then(({ data }) => setLineas(data ?? []));
  }, [id]);

  const total = lineas.reduce(
    (acc, l) => acc + Number(l.cantidad) * Number(l.precio_unitario),
    0
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" />
      </div>
    );
  }

  if (error || !factura) {
    return (
      <div className="animate-[fadeIn_0.3s_ease-out]">
        <p className="text-red-600">{error ?? "Factura no encontrada"}</p>
        <Button variant="secondary" asChild className="mt-4">
          <Link href="/facturas">Volver a facturas</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/facturas" aria-label="Volver a facturas">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {factura.numero}
            </h1>
            <Badge variant={factura.estado as "borrador" | "emitida" | "pagada"} className="mt-1">
              {factura.estado.charAt(0).toUpperCase() + factura.estado.slice(1)}
            </Badge>
          </div>
        </div>
        <Button variant="secondary" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cliente y fechas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-neutral-500">Cliente:</span>{" "}
              {factura.clientes ? (
                <Link href={`/clientes/${factura.clientes.id}`} className="font-medium hover:underline">
                  {factura.clientes.nombre}
                </Link>
              ) : (
                "—"
              )}
            </p>
            <p>
              <span className="text-neutral-500">Emisión:</span>{" "}
              {factura.fecha_emision ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">Vencimiento:</span>{" "}
              {factura.fecha_vencimiento ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{total.toFixed(2)} €</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Líneas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {lineas.map((l) => (
                <li
                  key={l.id}
                  className="flex justify-between border-b border-border pb-2 last:border-0"
                >
                  <span>{l.descripcion}</span>
                  <span>
                    {Number(l.cantidad)} × {Number(l.precio_unitario)} € ={" "}
                    {(Number(l.cantidad) * Number(l.precio_unitario)).toFixed(2)} €
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
