"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";

interface Propiedad {
  id: string;
  titulo: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  localidad: string | null;
  tipo_operacion: string;
  precio_venta: number | null;
  precio_alquiler: number | null;
  superficie_m2: number | null;
  habitaciones: number | null;
  estado: string;
  notas: string | null;
  ofertante_id: string;
  clientes?: { nombre: string } | { nombre: string }[] | null;
}

export default function DetallePropiedadPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [propiedad, setPropiedad] = useState<Propiedad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("propiedades")
      .select("*, clientes:ofertante_id(nombre)")
      .eq("id", id)
      .single()
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setPropiedad(null);
        } else {
          const raw = data as Propiedad;
          const cliente = Array.isArray(raw.clientes) ? raw.clientes[0] : raw.clientes;
          setPropiedad({ ...raw, clientes: cliente });
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" />
      </div>
    );
  }

  if (error || !propiedad) {
    return (
      <div className="animate-[fadeIn_0.3s_ease-out]">
        <p className="text-red-600">{error ?? "Propiedad no encontrada"}</p>
        <Button variant="secondary" asChild className="mt-4">
          <Link href="/propiedades">Volver a propiedades</Link>
        </Button>
      </div>
    );
  }

  const ofertanteNombre =
    Array.isArray(propiedad.clientes) ? propiedad.clientes[0]?.nombre : propiedad.clientes?.nombre;

  const handleDelete = async () => {
    setDeleting(true);
    const supabase = createClient();
    const { error: err } = await supabase.from("propiedades").delete().eq("id", id);
    setDeleting(false);
    setShowDeleteConfirm(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/propiedades");
    router.refresh();
  };

  const formatPrecio = (p: number | null) =>
    p != null
      ? p.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
      : "—";

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Propiedades", href: "/propiedades" },
          { label: propiedad.titulo || propiedad.direccion || "Sin título" },
        ]}
        title={propiedad.titulo || propiedad.direccion || "Sin título"}
        description={undefined}
        actions={
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/propiedades/${id}/editar`} className="gap-2">
              <Pencil className="h-4 w-4" strokeWidth={1.5} />
              Editar
            </Link>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/clientes/${propiedad.ofertante_id}`} className="gap-2">
              Ver propietario
            </Link>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Eliminar propiedad"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
        }
      />
      <div className="mb-6 flex items-center gap-2">
        <Badge variant="default">{propiedad.estado}</Badge>
      </div>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="¿Eliminar esta propiedad?"
        description="Esta acción no se puede deshacer."
        confirmLabel={deleting ? "Eliminando…" : "Eliminar"}
        onConfirm={handleDelete}
        loading={deleting}
        variant="destructive"
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ubicación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-neutral-500">Dirección:</span>{" "}
              {propiedad.direccion ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">CP / Localidad:</span>{" "}
              {[propiedad.codigo_postal, propiedad.localidad].filter(Boolean).join(" ") || "—"}
            </p>
            <p>
              <span className="text-neutral-500">Propietario:</span>{" "}
              <Link
                href={`/clientes/${propiedad.ofertante_id}`}
                className="font-medium text-foreground hover:underline"
              >
                {ofertanteNombre ?? "—"}
              </Link>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Precios y características</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-neutral-500">Tipo:</span>{" "}
              {propiedad.tipo_operacion}
            </p>
            {(propiedad.tipo_operacion === "venta" || propiedad.tipo_operacion === "ambos") && (
              <p>
                <span className="text-neutral-500">Precio venta:</span>{" "}
                {formatPrecio(propiedad.precio_venta)}
              </p>
            )}
            {(propiedad.tipo_operacion === "alquiler" || propiedad.tipo_operacion === "ambos") && (
              <p>
                <span className="text-neutral-500">Precio alquiler:</span>{" "}
                {formatPrecio(propiedad.precio_alquiler)}/mes
              </p>
            )}
            {propiedad.superficie_m2 != null && (
              <p>
                <span className="text-neutral-500">Superficie:</span>{" "}
                {propiedad.superficie_m2} m²
              </p>
            )}
            {propiedad.habitaciones != null && (
              <p>
                <span className="text-neutral-500">Habitaciones:</span>{" "}
                {propiedad.habitaciones}
              </p>
            )}
          </CardContent>
        </Card>
        {propiedad.notas && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{propiedad.notas}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
