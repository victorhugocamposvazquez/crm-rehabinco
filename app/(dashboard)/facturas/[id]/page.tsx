"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FacturaDetailSkeleton } from "@/components/facturas/FacturaDetailSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { ChevronLeft, Pencil, FileDown, Trash2 } from "lucide-react";

interface FacturaRow {
  id: string;
  numero: string;
  estado: string;
  concepto: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  irpf_porcentaje?: number | null;
  irpf_importe?: number | null;
  cliente_id: string | null;
  clientes: {
    id: string;
    nombre: string;
    nif: string | null;
    direccion: string | null;
    email: string | null;
  } | null;
}

interface LineaRow {
  id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  iva_porcentaje?: number | null;
}

export default function DetalleFacturaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [factura, setFactura] = useState<FacturaRow | null>(null);
  const [lineas, setLineas] = useState<LineaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const formatCurrency = (value: number) =>
    value.toLocaleString("es-ES", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("facturas")
      .select(
        "id, numero, estado, concepto, fecha_emision, fecha_vencimiento, irpf_porcentaje, irpf_importe, cliente_id, clientes(id, nombre, nif, direccion, email)"
      )
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
            irpf_porcentaje?: number | null;
            irpf_importe?: number | null;
            cliente_id: string | null;
            clientes:
              | {
                  id: string;
                  nombre: string;
                  nif: string | null;
                  direccion: string | null;
                  email: string | null;
                }
              | {
                  id: string;
                  nombre: string;
                  nif: string | null;
                  direccion: string | null;
                  email: string | null;
                }[]
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
      .select("id, descripcion, cantidad, precio_unitario, iva_porcentaje")
      .eq("factura_id", id)
      .order("orden")
      .then(({ data }) => setLineas(data ?? []));
  }, [id]);

  const baseImponible = lineas.reduce(
    (acc, l) => acc + Number(l.cantidad) * Number(l.precio_unitario),
    0
  );
  const ivaImporte = lineas.reduce(
    (acc, l) =>
      acc +
      Number(l.cantidad) *
        Number(l.precio_unitario) *
        ((Number(l.iva_porcentaje ?? 21) || 0) / 100),
    0
  );
  const irpfPorcentaje = Number(factura?.irpf_porcentaje ?? 0);
  const irpfImporte = (baseImponible * irpfPorcentaje) / 100;
  const totalConIva = baseImponible + ivaImporte - irpfImporte;

  const handleDelete = async () => {
    if (!factura) return;
    setDeleting(true);
    const supabase = createClient();
    const { error: err } = await supabase.from("facturas").delete().eq("id", id);
    setDeleting(false);
    if (err) {
      setError(err.message);
      setShowDeleteConfirm(false);
      return;
    }
    router.push("/facturas");
    router.refresh();
  };

  const handleDownloadPdf = () => {
    if (!factura) return;
    const emisor = {
      nombre: process.env.NEXT_PUBLIC_BILLING_COMPANY_NAME ?? "Tu Empresa S.L.",
      nif: process.env.NEXT_PUBLIC_BILLING_COMPANY_NIF ?? "B00000000",
      direccion:
        process.env.NEXT_PUBLIC_BILLING_COMPANY_ADDRESS ??
        "Calle Ejemplo 1, 28001 Madrid, España",
      cp: process.env.NEXT_PUBLIC_BILLING_COMPANY_CP ?? "28001",
      poblacion:
        process.env.NEXT_PUBLIC_BILLING_COMPANY_CITY ?? "Madrid",
      provincia:
        process.env.NEXT_PUBLIC_BILLING_COMPANY_PROVINCE ?? "Madrid",
      iban:
        process.env.NEXT_PUBLIC_BILLING_COMPANY_IBAN ??
        "ES00 0000 0000 0000 0000 0000",
    };
    const clienteNombre = factura.clientes?.nombre ?? "Cliente";
    const clienteNif = factura.clientes?.nif ?? "-";
    const clienteDireccion = factura.clientes?.direccion ?? "-";
    const clienteEmail = factura.clientes?.email ?? "-";
    const lineasHtml = lineas
      .map(
        (l) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;">${l.descripcion}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">${Number(l.cantidad).toFixed(2)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(Number(l.precio_unitario))}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">${Number(l.iva_porcentaje ?? 21).toFixed(2)}%</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(Number(l.cantidad) * Number(l.precio_unitario))}</td>
        </tr>
      `
      )
      .join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Factura ${factura.numero}</title>
          <style>
            @page { size: A4; margin: 18mm; }
            body { font-family: Inter, Arial, sans-serif; color:#111; }
          </style>
        </head>
        <body style="font-family: Inter, Arial, sans-serif; color:#111; padding:4px;">
          <table style="width:100%; margin-bottom:24px;">
            <tr>
              <td style="vertical-align:top; width:40%;">
                <h1 style="margin:0; font-size:28px; letter-spacing:-0.02em;">FACTURA</h1>
                <p style="margin:6px 0 0 0; color:#555; font-size:14px;">Nº ${factura.numero}</p>
                <p style="margin:2px 0 0 0; color:#555; font-size:14px;">Fecha emisión: ${factura.fecha_emision ?? "-"}</p>
                <p style="margin:2px 0 0 0; color:#555; font-size:14px;">Fecha vencimiento: ${factura.fecha_vencimiento ?? "-"}</p>
              </td>
              <td style="vertical-align:top; width:50%;">
                <h3 style="margin:0 0 8px 0; font-size:13px; text-transform:uppercase; letter-spacing:0.06em; color:#6b7280;">Emisor</h3>
                <p style="margin:0;">${emisor.nombre}</p>
                <p style="margin:0;">NIF: ${emisor.nif}</p>
                <p style="margin:0;">${emisor.direccion}</p>
                <p style="margin:0;">${emisor.cp} - ${emisor.poblacion} (${emisor.provincia})</p>
              </td>
              <td style="vertical-align:top; width:40%;">
                <h3 style="margin:0 0 8px 0; font-size:13px; text-transform:uppercase; letter-spacing:0.06em; color:#6b7280;">Cliente</h3>
                <p style="margin:0;">${clienteNombre}</p>
                <p style="margin:0;">NIF/CIF: ${clienteNif}</p>
                <p style="margin:0;">${clienteDireccion}</p>
                <p style="margin:0;">${clienteEmail}</p>
              </td>
            </tr>
          </table>

          <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
            <thead>
              <tr>
                <th style="padding:10px 8px;border-bottom:1px solid #ddd; text-align:left; font-size:12px; text-transform:uppercase; color:#6b7280;">Descripción</th>
                <th style="padding:10px 8px;border-bottom:1px solid #ddd; text-align:right; font-size:12px; text-transform:uppercase; color:#6b7280;">Cantidad</th>
                <th style="padding:10px 8px;border-bottom:1px solid #ddd; text-align:right; font-size:12px; text-transform:uppercase; color:#6b7280;">Precio Unitario</th>
                <th style="padding:10px 8px;border-bottom:1px solid #ddd; text-align:right; font-size:12px; text-transform:uppercase; color:#6b7280;">IVA</th>
                <th style="padding:10px 8px;border-bottom:1px solid #ddd; text-align:right; font-size:12px; text-transform:uppercase; color:#6b7280;">Importe</th>
              </tr>
            </thead>
            <tbody>${lineasHtml}</tbody>
          </table>

          <div style="margin-left:auto; width:320px; border:1px solid #e5e7eb; border-radius:12px; padding:12px 14px;">
            <p style="display:flex; justify-content:space-between; margin:4px 0;"><span>Base imponible:</span><span>${formatCurrency(baseImponible)}</span></p>
            <p style="display:flex; justify-content:space-between; margin:4px 0;"><span>IVA:</span><span>${formatCurrency(ivaImporte)}</span></p>
            <p style="display:flex; justify-content:space-between; margin:4px 0;"><span>Retención IRPF (${irpfPorcentaje.toFixed(2)}%):</span><span>- ${formatCurrency(irpfImporte)}</span></p>
            <p style="display:flex; justify-content:space-between; margin:8px 0; font-weight:700; border-top:1px solid #ddd; padding-top:8px;">
              <span>Total:</span><span>${formatCurrency(totalConIva)}</span>
            </p>
          </div>

          <div style="margin-top:22px; border-top:1px solid #e5e7eb; padding-top:12px;">
            <p style="margin:0; font-size:12px; color:#4b5563;">
              Método de pago recomendado: Transferencia bancaria.
            </p>
            <p style="margin:4px 0 0 0; font-size:12px; color:#4b5563;">
              IBAN: ${emisor.iban}
            </p>
            <p style="margin:8px 0 0 0; font-size:11px; color:#6b7280;">
              Documento emitido conforme al Reglamento por el que se regulan las obligaciones de facturación (Real Decreto 1619/2012).
            </p>
          </div>
        </body>
      </html>
    `;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  if (loading) return <FacturaDetailSkeleton />;

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
    <div>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm">
        <Link href="/facturas" className="text-neutral-500 hover:text-foreground">Facturas</Link>
        <span className="text-neutral-400" aria-hidden>/</span>
        <span className="font-medium text-foreground">{factura.numero}</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/facturas" aria-label="Volver a facturas">
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
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
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/facturas/${id}/editar`}>
            <Pencil className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Editar
          </Link>
        </Button>
        <Button variant="secondary" size="sm" onClick={handleDownloadPdf}>
          <FileDown className="mr-2 h-4 w-4" strokeWidth={1.5} />
          Descargar PDF
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.5} />
          Eliminar
        </Button>
      </div>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`¿Eliminar factura ${factura.numero}?`}
        description="Esta acción no se puede deshacer."
        confirmLabel={deleting ? "Eliminando…" : "Eliminar"}
        onConfirm={handleDelete}
        loading={deleting}
        variant="destructive"
      />

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
            <p className="text-2xl font-semibold">{totalConIva.toFixed(2)} €</p>
            <p className="mt-2 text-sm text-neutral-500">
              Base: {baseImponible.toFixed(2)} € · IVA: {ivaImporte.toFixed(2)} € · IRPF: -{irpfImporte.toFixed(2)} €
            </p>
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
                    IVA {Number(l.iva_porcentaje ?? 21).toFixed(0)}% ·{" "}
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
