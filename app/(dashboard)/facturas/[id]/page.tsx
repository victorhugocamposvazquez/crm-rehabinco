"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchEmisorFacturacion, resolveInvoiceLogoUrl } from "@/lib/empresa-facturacion";
import {
  FACTURA_HEADER_H,
  FACTURA_PAGE_W,
  INVOICE_REHABINCO_ICON,
  facturaDocumentStyles,
} from "@/lib/factura-pdf";
import { fetchAsDataUrl, composeInvoiceHeaderImage, saveHtmlDocumentPdf } from "@/lib/html-document-pdf";
import { toast } from "sonner";
import { FacturaDetailSkeleton } from "@/components/facturas/FacturaDetailSkeleton";
import { PagosCard } from "@/components/facturas/PagosCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Pencil, FileDown, Trash2, FileEdit } from "lucide-react";
import { FichaLink } from "@/components/crm/FichaPeek";

interface FacturaRow {
  id: string;
  numero: string;
  estado: string;
  concepto: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  irpf_porcentaje?: number | null;
  irpf_importe?: number | null;
  porcentaje_descuento?: number | null;
  importe_descuento?: number | null;
  cliente_id: string | null;
  tipo_factura?: "ordinaria" | "rectificativa";
  factura_original_id?: string | null;
  causa_rectificacion?: string | null;
  clientes: {
    id: string;
    nombre: string;
    documento_fiscal: string | null;
    tipo_cliente: "particular" | "empresa";
    tipo_documento: "dni" | "nie" | "cif" | "vat" | null;
    direccion: string | null;
    codigo_postal?: string | null;
    localidad?: string | null;
    email: string | null;
    telefono?: string | null;
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
  const [facturaOriginal, setFacturaOriginal] = useState<{ id: string; numero: string; fecha_emision: string | null } | null>(null);
  const [rectificativas, setRectificativas] = useState<Array<{ id: string; numero: string }>>([]);
  const [lineas, setLineas] = useState<LineaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);

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
        "id, numero, estado, concepto, fecha_emision, fecha_vencimiento, irpf_porcentaje, irpf_importe, porcentaje_descuento, importe_descuento, cliente_id, tipo_factura, factura_original_id, causa_rectificacion, clientes(id, nombre, documento_fiscal, tipo_cliente, tipo_documento, direccion, codigo_postal, localidad, email, telefono)"
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
            porcentaje_descuento?: number | null;
            importe_descuento?: number | null;
            cliente_id: string | null;
            clientes:
              | {
                  id: string;
                  nombre: string;
                  documento_fiscal: string | null;
                  tipo_cliente: "particular" | "empresa";
                  tipo_documento: "dni" | "nie" | "cif" | "vat" | null;
                  direccion: string | null;
                  codigo_postal: string | null;
                  localidad: string | null;
                  email: string | null;
                  telefono?: string | null;
                }
              | {
                  id: string;
                  nombre: string;
                  documento_fiscal: string | null;
                  tipo_cliente: "particular" | "empresa";
                  tipo_documento: "dni" | "nie" | "cif" | "vat" | null;
                  direccion: string | null;
                  codigo_postal: string | null;
                  localidad: string | null;
                  email: string | null;
                  telefono?: string | null;
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

  useEffect(() => {
    if (!factura?.factura_original_id) return;
    const supabase = createClient();
    supabase
      .from("facturas")
      .select("id, numero, fecha_emision")
      .eq("id", factura.factura_original_id)
      .single()
      .then(({ data }) => setFacturaOriginal(data as { id: string; numero: string; fecha_emision: string | null } | null));
  }, [factura?.factura_original_id]);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    supabase
      .from("facturas")
      .select("id, numero")
      .eq("factura_original_id", id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRectificativas((data ?? []) as Array<{ id: string; numero: string }>));
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
  const porcentajeDescuento = Number(factura?.porcentaje_descuento ?? 0);
  const descuentoImporte = baseImponible * (porcentajeDescuento / 100);
  const totalConIva = baseImponible + ivaImporte - descuentoImporte - irpfImporte;

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

  const htmlEsc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const handleDownloadPdf = async () => {
    if (!factura) return;
    setPrintingPdf(true);
    try {
    const supabase = createClient();
    const emisor = await fetchEmisorFacturacion(supabase);

    const clienteNombre = htmlEsc(factura.clientes?.nombre ?? "Cliente");
    const clienteDoc = htmlEsc(factura.clientes?.documento_fiscal ?? "-");
    const docLabel = htmlEsc(
      factura.clientes?.tipo_documento
        ? String(factura.clientes.tipo_documento).toUpperCase()
        : (factura.clientes?.tipo_cliente === "empresa" ? "NIF" : "DNI")
    );
    const dirParts = [
      factura.clientes?.direccion,
      factura.clientes?.codigo_postal,
      factura.clientes?.localidad,
    ].filter(Boolean);
    const clienteDireccion = htmlEsc(dirParts.length > 0 ? dirParts.join(", ") : "-");
    const clienteEmail = htmlEsc(factura.clientes?.email ?? "-");
    const clienteTelefono = factura.clientes?.telefono ? htmlEsc(factura.clientes.telefono) : "";

    const lineasHtml = lineas
      .map((l, i) => {
        const base = Number(l.cantidad) * Number(l.precio_unitario);
        const ivaPct = Number(l.iva_porcentaje ?? 21) || 0;
        const ivaLinea = base * (ivaPct / 100);
        const totalLinea = base + ivaLinea;
        return `
        <tr>
          <td>${htmlEsc(l.descripcion)}</td>
          <td class="num">${Number(l.cantidad).toFixed(2)}</td>
          <td class="num">${formatCurrency(base)}</td>
          <td class="num">${formatCurrency(ivaLinea)}</td>
          <td class="num">${formatCurrency(totalLinea)}</td>
        </tr>
      `;
      })
      .join("");

    const fechaFormateada = factura.fecha_emision
      ? new Date(factura.fecha_emision + "T12:00:00").toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "—";
    const esRectificativa = factura.tipo_factura === "rectificativa";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const [logoUrl, iconoUrl] = await Promise.all([
      fetchAsDataUrl(resolveInvoiceLogoUrl(emisor.logo_url, origin)),
      fetchAsDataUrl(`${origin}${INVOICE_REHABINCO_ICON}`),
    ]);
    const headerUrl = await composeInvoiceHeaderImage({
      logoDataUrl: logoUrl,
      numeroLabel: `${esRectificativa ? "Factura rectificativa nº" : "Factura nº"} ${factura.numero}`,
      fecha: fechaFormateada,
    });
    const fechaOriginalFormateada = facturaOriginal?.fecha_emision
      ? new Date(facturaOriginal.fecha_emision + "T12:00:00").toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "";

    const pagoBancoLines = (() => {
      const parts: string[] = [];
      if (emisor.iban) {
        parts.push(`IBAN: <strong>${htmlEsc(emisor.iban)}</strong>`);
      }
      if (emisor.numero_cuenta_bancaria) {
        parts.push(`N.º de cuenta: <strong>${htmlEsc(emisor.numero_cuenta_bancaria)}</strong>`);
      }
      if (parts.length === 0) {
        toast.error("Falta IBAN o número de cuenta en ajustes de empresa. Configúralo en Ajustes → Datos de empresa.");
        return null;
      }
      return parts.join(" · ");
    })();

    if (pagoBancoLines === null) {
      return;
    }

    const empresaEmailLine = emisor.email ? `<p>${htmlEsc(emisor.email)}</p>` : "";
    const empresaTelLine = emisor.telefono ? `<p>Tel. ${htmlEsc(emisor.telefono)}</p>` : "";

    const facturaBodyInner = `
          <img class="invoice-header" src=${JSON.stringify(headerUrl)} alt="" width="${FACTURA_PAGE_W}" height="${FACTURA_HEADER_H}" />
          <div class="invoice-body">
            <div class="inv-main">
            ${esRectificativa && (facturaOriginal || factura.causa_rectificacion) ? `
            <div class="inv-rect">
              <p class="inv-rect-title">Documento rectificativo</p>
              ${facturaOriginal ? `<p>Rectifica la factura nº ${htmlEsc(facturaOriginal.numero)}${fechaOriginalFormateada ? `, de fecha ${htmlEsc(fechaOriginalFormateada)}` : ""}.</p>` : ""}
              ${factura.causa_rectificacion ? `<p style="margin-top:6px;"><strong>Causa:</strong> ${htmlEsc(factura.causa_rectificacion)}</p>` : ""}
            </div>
            ` : ""}

            <div class="inv-block inv-grid">
              <div class="inv-grid-row">
                <div class="inv-grid-cell inv-party">
                  <p class="inv-label">Emisor</p>
                  <p><strong>${htmlEsc(emisor.razon_social)}</strong></p>
                  <p>${htmlEsc(emisor.direccion)}</p>
                  <p>${htmlEsc(emisor.codigo_postal)} ${htmlEsc(emisor.localidad)} · ${htmlEsc(emisor.provincia)}</p>
                  <p>${htmlEsc(emisor.nif)}</p>
                  ${empresaEmailLine}
                  ${empresaTelLine}
                </div>
                <div class="inv-grid-cell inv-grid-cell--right inv-party">
                  <p class="inv-label">Cliente</p>
                  <p><strong>${clienteNombre}</strong></p>
                  <p>${clienteDireccion}</p>
                  <p>${docLabel}: ${clienteDoc}</p>
                  <p>${clienteEmail}</p>
                  ${clienteTelefono ? `<p>${clienteTelefono}</p>` : ""}
                </div>
              </div>
            </div>

            <table class="inv-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th class="num">Cant.</th>
                  <th class="num">Base</th>
                  <th class="num">IVA</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>${lineasHtml}</tbody>
            </table>

            <div class="inv-totals-wrap">
              <div class="inv-totals">
                <p class="inv-totals-row"><span>Base imponible</span><span>${formatCurrency(baseImponible)}</span></p>
                <p class="inv-totals-row"><span>IVA</span><span>${formatCurrency(ivaImporte)}</span></p>
                ${porcentajeDescuento > 0 ? `<p class="inv-totals-row"><span>Descuento (${porcentajeDescuento}%)</span><span>− ${formatCurrency(descuentoImporte)}</span></p>` : ""}
                ${irpfPorcentaje > 0 ? `<p class="inv-totals-row"><span>Retención (${irpfPorcentaje}%)</span><span>− ${formatCurrency(irpfImporte)}</span></p>` : ""}
                <p class="inv-totals-total"><span>Total</span><span>${formatCurrency(totalConIva)}</span></p>
              </div>
            </div>

            <div class="inv-footer">
              <p>El pago se realizará mediante <strong>transferencia bancaria</strong>. ${pagoBancoLines}</p>
              <p>Documento emitido conforme al Reglamento por el que se regulan las obligaciones de facturación (Real Decreto 1619/2012).</p>
            </div>
            </div>
            <div class="inv-brand-mark">
              <img class="inv-brand-icon" src=${JSON.stringify(iconoUrl)} alt="" width="40" height="40" />
              <img class="inv-brand-logo" src=${JSON.stringify(logoUrl)} alt="" height="36" />
            </div>
          </div>
    `;

    const facturaDocumentHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${htmlEsc(factura.numero)}</title>
    <style>${facturaDocumentStyles()}</style>
  </head>
  <body>
    ${facturaBodyInner}
  </body>
</html>`;

    const safeBase = factura.numero.replace(/[\\/:*?"<>|]+/g, "-");
    const safeFilename = `Factura-${safeBase}.pdf`;

    await saveHtmlDocumentPdf({
      html: facturaDocumentHtml,
      filename: safeFilename,
      firstPageBanner: headerUrl,
    });
    toast.success("PDF descargado");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al generar el PDF");
    } finally {
      setPrintingPdf(false);
    }
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
      <PageHeader
        breadcrumb={[
          { label: "Facturas", href: "/facturas" },
          { label: factura.numero },
        ]}
        title={factura.numero}
        description={undefined}
        actions={
          <div className="flex shrink-0 items-center gap-1">
          {(factura.tipo_factura !== "rectificativa") && (factura.estado === "emitida" || factura.estado === "pagada") && (
            <Button variant="secondary" size="icon" className="md:h-9 md:w-auto md:gap-2 md:px-3" asChild>
              <Link href={`/facturas/nueva?rectificativa=${id}`} aria-label="Emitir rectificativa">
                <FileEdit className="h-4 w-4" strokeWidth={1.5} />
                <span className="hidden md:inline">Rectificativa</span>
              </Link>
            </Button>
          )}
          <Button variant="secondary" size="icon" className="md:h-9 md:w-auto md:gap-2 md:px-3" asChild>
            <Link href={`/facturas/${id}/editar`} aria-label="Editar">
              <Pencil className="h-4 w-4" strokeWidth={1.5} />
              <span className="hidden md:inline">Editar</span>
            </Link>
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="md:h-9 md:w-auto md:gap-2 md:px-3"
            onClick={() => void handleDownloadPdf()}
            disabled={printingPdf}
            aria-label="Descargar PDF"
          >
            <FileDown className="h-4 w-4" strokeWidth={1.5} />
            <span className="hidden md:inline">{printingPdf ? "Preparando…" : "Descargar PDF"}</span>
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="text-red-600 hover:bg-red-50 hover:text-red-700 md:h-9 md:w-auto md:gap-2 md:px-3"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Eliminar"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            <span className="hidden md:inline">Eliminar</span>
          </Button>
          </div>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={factura.estado as "borrador" | "emitida" | "pagada"}>
          {factura.estado.charAt(0).toUpperCase() + factura.estado.slice(1)}
        </Badge>
        {factura.tipo_factura === "rectificativa" && (
          <Badge variant="borrador" className="bg-amber-100 text-amber-800 border-amber-300">
            Rectificativa
          </Badge>
        )}
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
        {(factura.tipo_factura === "rectificativa" && facturaOriginal) || factura.causa_rectificacion ? (
          <Card>
            <CardHeader>
              <CardTitle>Rectificativa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {facturaOriginal && (
                <p>
                  <span className="text-[var(--text-2)]">Rectifica factura:</span>{" "}
                  <Link href={`/facturas/${factura.factura_original_id}`} className="font-medium hover:underline">
                    {facturaOriginal.numero}
                  </Link>
                </p>
              )}
              {factura.causa_rectificacion && (
                <p>
                  <span className="text-[var(--text-2)]">Causa:</span>{" "}
                  {factura.causa_rectificacion}
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}
        {rectificativas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Rectificativas</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {rectificativas.map((r) => (
                  <li key={r.id}>
                    <Link href={`/facturas/${r.id}`} className="font-medium hover:underline">
                      {r.numero}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Cliente y fechas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-[var(--text-2)]">Cliente:</span>{" "}
              {factura.clientes ? (
                <FichaLink tipo="cliente" id={factura.clientes.id} className="font-medium">
                  {factura.clientes.nombre}
                </FichaLink>
              ) : (
                "—"
              )}
            </p>
            <p>
              <span className="text-[var(--text-2)]">Emisión:</span>{" "}
              {factura.fecha_emision ?? "—"}
            </p>
            <p>
              <span className="text-[var(--text-2)]">Vencimiento:</span>{" "}
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
            <p className="mt-2 text-sm text-[var(--text-2)]">
              Base: {baseImponible.toFixed(2)} € · IVA: {ivaImporte.toFixed(2)} € · IRPF: -{irpfImporte.toFixed(2)} €
            </p>
          </CardContent>
        </Card>
        <PagosCard
          facturaId={id}
          totalFactura={totalConIva}
          estado={factura.estado}
          onPagoAdded={() => {
            setFactura((prev) => (prev ? { ...prev, estado: "pagada" } : prev));
          }}
        />
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
