"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, FileText } from "lucide-react";
import { toast } from "sonner";

interface Presupuesto {
  id: string;
  numero: string;
  estado: string;
  fecha: string | null;
  concepto: string | null;
  cliente_id: string | null;
  base_imponible: number;
  porcentaje_impuesto: number;
  importe_impuesto: number;
  porcentaje_descuento: number;
  importe_descuento: number;
  total: number;
  clientes?: { nombre: string } | null;
}

interface Linea {
  id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

export default function DetallePresupuestoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("presupuestos")
      .select("*, clientes(nombre)")
      .eq("id", id)
      .single()
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setPresupuesto(null);
        } else {
          const raw = data as Presupuesto;
          const cliente = Array.isArray(raw.clientes) ? raw.clientes[0] : raw.clientes;
          setPresupuesto({ ...raw, clientes: cliente });
        }
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    supabase
      .from("presupuesto_lineas")
      .select("id, descripcion, cantidad, precio_unitario")
      .eq("presupuesto_id", id)
      .order("orden")
      .then(({ data }) => setLineas(data ?? []));
  }, [id]);

  const handleConvertirAFactura = async () => {
    if (!presupuesto || presupuesto.estado === "convertido") return;
    setConverting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sesión expirada");
      setConverting(false);
      return;
    }

    const serie = process.env.NEXT_PUBLIC_BILLING_SERIE ?? "RHB";
    const year = new Date().getFullYear();
    const prefix = `${serie}-${year}-`;
    const { data: existing } = await supabase
      .from("facturas")
      .select("numero")
      .like("numero", `${prefix}%`)
      .order("numero", { ascending: false })
      .limit(1);
    const last = existing?.[0]?.numero;
    const lastCorrelative = last ? Number(last.split("-").pop() ?? "0") : 0;
    const numero = `${prefix}${String(lastCorrelative + 1).padStart(4, "0")}`;

    const today = new Date().toISOString().slice(0, 10);

    const { data: factura, error: errFactura } = await supabase
      .from("facturas")
      .insert({
        user_id: user.id,
        cliente_id: presupuesto.cliente_id,
        presupuesto_id: presupuesto.id,
        numero,
        estado: "borrador",
        concepto: presupuesto.concepto,
        fecha_emision: today,
        fecha_vencimiento: null,
        irpf_porcentaje: 0,
        porcentaje_descuento: presupuesto.porcentaje_descuento,
      })
      .select("id")
      .single();

    if (errFactura || !factura) {
      toast.error(errFactura?.message ?? "Error al crear factura");
      setConverting(false);
      return;
    }

    const ivaPct = Number(presupuesto.porcentaje_impuesto ?? 21);
    const lineasFactura = lineas.map((l, orden) => ({
      factura_id: factura.id,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      iva_porcentaje: ivaPct,
      orden,
    }));

    const { error: errLineas } = await supabase
      .from("factura_lineas")
      .insert(lineasFactura);

    if (errLineas) {
      toast.error(errLineas.message);
      setConverting(false);
      return;
    }

    await supabase
      .from("presupuestos")
      .update({ estado: "convertido" })
      .eq("id", presupuesto.id);

    toast.success("Factura creada");
    router.push(`/facturas/${factura.id}`);
    router.refresh();
    setConverting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" />
      </div>
    );
  }

  if (error || !presupuesto) {
    return (
      <div className="animate-[fadeIn_0.3s_ease-out]">
        <p className="text-red-600">{error ?? "Presupuesto no encontrado"}</p>
        <Button variant="secondary" asChild className="mt-4">
          <Link href="/presupuestos">Volver a presupuestos</Link>
        </Button>
      </div>
    );
  }

  const clienteNombre =
    Array.isArray(presupuesto.clientes) ? presupuesto.clientes[0]?.nombre : presupuesto.clientes?.nombre;
  const puedeConvertir =
    presupuesto.estado !== "convertido" && lineas.length > 0;

  return (
    <div>
      <nav className="mb-4 flex items-center gap-1.5 text-sm">
        <Link href="/presupuestos" className="text-neutral-500 hover:text-foreground">
          Presupuestos
        </Link>
        <span className="text-neutral-400">/</span>
        <span className="font-medium text-foreground">{presupuesto.numero}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href="/presupuestos"
            aria-label="Volver a presupuestos"
            className="flex shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {presupuesto.numero}
            </h1>
            <Badge variant="default" className="mt-1">
              {presupuesto.estado}
            </Badge>
          </div>
        </div>
        {puedeConvertir && (
          <Button
            onClick={handleConvertirAFactura}
            disabled={converting}
            className="gap-2"
          >
            <FileText className="h-4 w-4" strokeWidth={1.5} />
            {converting ? "Creando factura…" : "Convertir a factura"}
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-neutral-500">Cliente:</span>{" "}
              {clienteNombre ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">Fecha:</span>{" "}
              {presupuesto.fecha
                ? new Date(presupuesto.fecha + "T12:00:00").toLocaleDateString("es-ES")
                : "—"}
            </p>
            <p>
              <span className="text-neutral-500">Concepto:</span>{" "}
              {presupuesto.concepto ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Totales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-neutral-500">Base:</span>{" "}
              {Number(presupuesto.base_imponible).toLocaleString("es-ES", {
                style: "currency",
                currency: "EUR",
              })}
            </p>
            <p>
              <span className="text-neutral-500">IVA ({presupuesto.porcentaje_impuesto}%):</span>{" "}
              {Number(presupuesto.importe_impuesto).toLocaleString("es-ES", {
                style: "currency",
                currency: "EUR",
              })}
            </p>
            {Number(presupuesto.importe_descuento) > 0 && (
              <p>
                <span className="text-neutral-500">Descuento:</span> -{" "}
                {Number(presupuesto.importe_descuento).toLocaleString("es-ES", {
                  style: "currency",
                  currency: "EUR",
                })}
              </p>
            )}
            <p className="font-semibold">
              <span className="text-neutral-500">Total:</span>{" "}
              {Number(presupuesto.total).toLocaleString("es-ES", {
                style: "currency",
                currency: "EUR",
              })}
            </p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Líneas</CardTitle>
          </CardHeader>
          <CardContent>
            {lineas.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin líneas.</p>
            ) : (
              <ul className="space-y-2">
                {lineas.map((l, i) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-neutral-50/50 px-4 py-3"
                  >
                    <span className="font-medium">{l.descripcion}</span>
                    <span className="text-sm text-neutral-500">
                      {Number(l.cantidad).toFixed(2)} ×{" "}
                      {Number(l.precio_unitario).toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR",
                      })}{" "}
                      ={" "}
                      {(
                        Number(l.cantidad) * Number(l.precio_unitario)
                      ).toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
