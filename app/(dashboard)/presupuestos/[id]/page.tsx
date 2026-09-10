"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { anioEmisionFecha, siguienteNumeroFactura } from "@/lib/facturacion-numeracion";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, FileText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-context";
import { isEditor } from "@/lib/auth/roles";
import { fetchEmisorPresupuesto, type EmisorPresupuesto } from "@/lib/emisores-presupuesto";
import {
  buildPresupuestoDocumentHtml,
  downloadPresupuestoPdf,
  presupuestoPdfFilename,
  type PresupuestoPdfCliente,
} from "@/lib/presupuesto-pdf";
import { parsePropuesta } from "@/lib/presupuesto-propuesta";
import { PresupuestoCopiloto } from "@/components/presupuestos/PresupuestoCopiloto";
import {
  aplicarPropuestaTexto,
  propuestaSinBinarios,
  type CopilotoOutput,
} from "@/lib/ai/presupuesto-copiloto";
import { altasDeLineas, lineasParaDb, totalesAmpliacion } from "@/lib/presupuesto-totales";

interface Presupuesto {
  id: string;
  numero: string;
  estado: string;
  fecha: string | null;
  concepto: string | null;
  cliente_id: string | null;
  emisor_id: string | null;
  base_imponible: number;
  porcentaje_impuesto: number;
  importe_impuesto: number;
  porcentaje_descuento: number;
  importe_descuento: number;
  total: number;
  propuesta?: unknown;
  clientes?: PresupuestoPdfCliente | null;
}

interface FacturaConvertida {
  id: string;
  numero: string;
}

const estadoVariant: Record<string, "default" | "activo" | "inactivo" | "borrador" | "emitida" | "pagada"> = {
  borrador: "borrador",
  enviado: "default",
  aceptado: "activo",
  rechazado: "inactivo",
  convertido: "pagada",
};

interface Linea {
  id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  unidad?: string | null;
  capitulo?: string | null;
}

export default function DetallePresupuestoPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;
  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [facturaConvertida, setFacturaConvertida] = useState<FacturaConvertida | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [emisor, setEmisor] = useState<EmisorPresupuesto | null>(null);
  const [printingPdf, setPrintingPdf] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("presupuestos")
      .select(
        "*, clientes(nombre, documento_fiscal, tipo_documento, tipo_cliente, direccion, codigo_postal, localidad, email, telefono, presupuesto_logo_url, presupuesto_cabecera_url, plantilla_presupuesto)"
      )
      .eq("id", id)
      .single()
      .then(async ({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setPresupuesto(null);
          setLoading(false);
          return;
        }
        const raw = data as Presupuesto;
        const cliente = Array.isArray(raw.clientes) ? raw.clientes[0] : raw.clientes;
        setPresupuesto({ ...raw, clientes: cliente ?? null });
        if (raw.emisor_id) {
          const loaded = await fetchEmisorPresupuesto(supabase, raw.emisor_id);
          setEmisor(loaded);
        }
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    supabase
      .from("presupuesto_lineas")
      .select("id, descripcion, cantidad, precio_unitario, unidad, capitulo")
      .eq("presupuesto_id", id)
      .order("orden")
      .then(({ data }) => setLineas(data ?? []));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    supabase
      .from("facturas")
      .select("id, numero")
      .eq("presupuesto_id", id)
      .maybeSingle()
      .then(({ data }) => setFacturaConvertida(data as FacturaConvertida | null));
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

    const today = new Date().toISOString().slice(0, 10);
    const year = anioEmisionFecha(today);
    let numero: string;
    try {
      numero = await siguienteNumeroFactura(supabase, { year, esRectificativa: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al asignar el número de factura");
      setConverting(false);
      return;
    }

    const propuesta = parsePropuesta(presupuesto.propuesta);
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
        porcentaje_descuento: propuesta.tipo === "ampliacion" ? 0 : presupuesto.porcentaje_descuento,
      })
      .select("id")
      .single();

    if (errFactura || !factura) {
      toast.error(errFactura?.message ?? "Error al crear factura");
      setConverting(false);
      return;
    }

    const ivaPct = Number(presupuesto.porcentaje_impuesto ?? 21);
    const lineasFactura =
      propuesta.tipo === "ampliacion"
        ? [
            {
              factura_id: factura.id,
              descripcion: presupuesto.concepto?.trim() || "Ampliación sobre presupuesto inicial",
              cantidad: 1,
              precio_unitario: Number(presupuesto.base_imponible),
              iva_porcentaje: ivaPct,
              orden: 0,
            },
          ]
        : lineas.map((l, orden) => ({
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

  const handleDownloadPdf = async () => {
    if (!presupuesto) return;
    setPrintingPdf(true);
    try {
      let emisorDoc = emisor;
      if (!emisorDoc && presupuesto.emisor_id) {
        emisorDoc = await fetchEmisorPresupuesto(createClient(), presupuesto.emisor_id);
        setEmisor(emisorDoc);
      }
      if (!emisorDoc) {
        toast.error("No se encontró el emisor del presupuesto.");
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const html = buildPresupuestoDocumentHtml({
        emisor: emisorDoc,
        cliente: presupuesto.clientes ?? null,
        datos: {
          numero: presupuesto.numero,
          fecha: presupuesto.fecha,
          concepto: presupuesto.concepto,
          porcentaje_impuesto: Number(presupuesto.porcentaje_impuesto),
          importe_impuesto: Number(presupuesto.importe_impuesto),
          porcentaje_descuento: Number(presupuesto.porcentaje_descuento),
          importe_descuento: Number(presupuesto.importe_descuento),
          base_imponible: Number(presupuesto.base_imponible),
          total: Number(presupuesto.total),
          lineas,
          propuesta: parsePropuesta(presupuesto.propuesta),
        },
        origin,
      });
      await downloadPresupuestoPdf({
        html,
        filename: presupuestoPdfFilename(presupuesto.numero),
      });
      toast.success("PDF descargado");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al generar el PDF");
    } finally {
      setPrintingPdf(false);
    }
  };

  const handleAcceptCopiloto = async (output: CopilotoOutput) => {
    if (!presupuesto) return;
    const supabase = createClient();
    const actual = parsePropuesta(presupuesto.propuesta);
    const nextPropuesta = aplicarPropuestaTexto(actual, output.propuesta);
    const descuento = nextPropuesta.tipo === "ampliacion" ? 0 : output.porcentaje_descuento;
    const { error: errUpd } = await supabase
      .from("presupuestos")
      .update({
        concepto: output.concepto.trim() || presupuesto.concepto,
        porcentaje_descuento: descuento,
        propuesta: nextPropuesta,
      })
      .eq("id", presupuesto.id);
    if (errUpd) {
      toast.error(errUpd.message);
      return;
    }
    await supabase.from("presupuesto_lineas").delete().eq("presupuesto_id", presupuesto.id);
    const rows = lineasParaDb(output.lineas, nextPropuesta).map((l, orden) => ({
      presupuesto_id: presupuesto.id,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      unidad: l.unidad,
      capitulo: l.capitulo,
      orden,
    }));
    if (rows.length > 0) {
      const { error: errLineas } = await supabase.from("presupuesto_lineas").insert(rows);
      if (errLineas) {
        toast.error(errLineas.message);
        return;
      }
    }
    const [{ data: p }, { data: ls }] = await Promise.all([
      supabase
        .from("presupuestos")
        .select(
          "*, clientes(nombre, documento_fiscal, tipo_documento, tipo_cliente, direccion, codigo_postal, localidad, email, telefono, presupuesto_logo_url, presupuesto_cabecera_url, plantilla_presupuesto)"
        )
        .eq("id", presupuesto.id)
        .single(),
      supabase
        .from("presupuesto_lineas")
        .select("id, descripcion, cantidad, precio_unitario, unidad, capitulo")
        .eq("presupuesto_id", presupuesto.id)
        .order("orden"),
    ]);
    if (p) {
      const raw = p as Presupuesto;
      const cliente = Array.isArray(raw.clientes) ? raw.clientes[0] : raw.clientes;
      setPresupuesto({ ...raw, clientes: cliente ?? null });
    }
    setLineas((ls ?? []) as Linea[]);
    toast.success("Copiloto aplicado y guardado.");
    router.refresh();
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
    !isEditor(user?.role) && presupuesto.estado !== "convertido" && lineas.length > 0;
  const propuesta = parsePropuesta(presupuesto.propuesta);
  const esAmpliacion = propuesta.tipo === "ampliacion";
  const lineasVisibles = altasDeLineas(lineas);
  const totAmp = esAmpliacion
    ? totalesAmpliacion({
        lineas: lineas.map((l) => ({
          descripcion: l.descripcion,
          cantidad: Number(l.cantidad),
          precioUnitario: Number(l.precio_unitario),
          capitulo: l.capitulo,
        })),
        bajas: propuesta.bajas,
        ajusteComercial: propuesta.ajuste_comercial,
        origenTotal: propuesta.origen_total,
        porcentajeImpuesto: Number(presupuesto.porcentaje_impuesto),
      })
    : null;
  const euro = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Presupuestos", href: "/presupuestos" },
          { label: presupuesto.numero },
        ]}
        title={presupuesto.numero}
        description={undefined}
        actions={
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <PresupuestoCopiloto
            estado={{
              emisor: emisor?.slug === "garal" ? "garal" : "rehabinco",
              concepto: presupuesto.concepto ?? "",
              porcentaje_impuesto: Number(presupuesto.porcentaje_impuesto),
              porcentaje_descuento: Number(presupuesto.porcentaje_descuento),
              lineas: altasDeLineas(lineas).map((l) => ({
                descripcion: l.descripcion,
                cantidad: Number(l.cantidad),
                precioUnitario: Number(l.precio_unitario),
                unidad: l.unidad || "ud",
                capitulo: l.capitulo ?? "",
              })),
              propuesta: propuestaSinBinarios(propuesta),
            }}
            onAccept={(output) => void handleAcceptCopiloto(output)}
          />
          <Button variant="secondary" size="sm" className="gap-2" asChild>
            <Link href={`/presupuestos/${presupuesto.id}/editar`}>
              <Pencil className="h-4 w-4" strokeWidth={1.5} />
              Editar
            </Link>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={handleDownloadPdf}
            disabled={printingPdf}
          >
            <FileDown className="h-4 w-4" strokeWidth={1.5} />
            {printingPdf ? "Generando PDF…" : "Descargar PDF"}
          </Button>
          {facturaConvertida && !isEditor(user?.role) && (
            <Button variant="secondary" size="sm" asChild className="gap-2">
              <Link href={`/facturas/${facturaConvertida.id}`}>
                <FileText className="h-4 w-4" strokeWidth={1.5} />
                Ver factura {facturaConvertida.numero}
              </Link>
            </Button>
          )}
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
        }
      />
      <div className="mb-6 flex items-center gap-2">
        <Badge variant={estadoVariant[presupuesto.estado] ?? "default"}>
          {presupuesto.estado.charAt(0).toUpperCase() + presupuesto.estado.slice(1)}
        </Badge>
        {esAmpliacion && (
          <Badge variant="emitida">Ampliación</Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-neutral-500">Emisor:</span>{" "}
              {emisor?.nombre_corto ?? emisor?.razon_social ?? "—"}
            </p>
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
            {esAmpliacion && propuesta.origen_numero.trim() && (
              <p>
                <span className="text-neutral-500">Inicial:</span> {propuesta.origen_numero}
                {propuesta.origen_total > 0 ? ` · ${euro(propuesta.origen_total)}` : ""}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Totales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-neutral-500">{esAmpliacion ? "Incremento neto" : "Base"}:</span>{" "}
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
            {totAmp && propuesta.origen_total > 0 && (
              <p>
                <span className="text-neutral-500">Resultante:</span> {euro(totAmp.resultante)} + IVA{" "}
                {euro(totAmp.ivaResultante)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Líneas</CardTitle>
          </CardHeader>
          <CardContent>
            {lineasVisibles.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin líneas.</p>
            ) : (
              <ul className="space-y-2">
                {lineasVisibles.map((l) => (
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
            {esAmpliacion && propuesta.bajas.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Bajas</p>
                <ul className="space-y-2">
                  {propuesta.bajas.map((b, i) => (
                    <li
                      key={`${b.descripcion}-${i}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 text-sm"
                    >
                      <span>{b.descripcion}</span>
                      <span className="text-neutral-500">− {euro(b.importe)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {esAmpliacion && propuesta.ajuste_comercial !== 0 && (
              <p className="mt-3 text-sm text-neutral-600">
                Ajuste comercial: {euro(propuesta.ajuste_comercial)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
