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
import { InmuebleGaleria } from "@/components/inmuebles/InmuebleGaleria";
import {
  formatPrecioInmueble,
  labelEstadoInmueble,
  labelTipoInmueble,
  labelTipoOperacion,
  type Inmueble,
  type InmuebleMedia,
} from "@/lib/inmuebles/catalogo";
import { useAuth } from "@/lib/auth/auth-context";
import { ClipboardPenLine, Pencil, Trash2 } from "lucide-react";

type ParteMini = {
  id: string;
  fecha_visita: string | null;
  visitante_nombre: string | null;
  estado: string;
};

export default function DetallePropiedadPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;
  const [propiedad, setPropiedad] = useState<Inmueble | null>(null);
  const [ofertanteNombre, setOfertanteNombre] = useState<string | null>(null);
  const [comercialNombre, setComercialNombre] = useState<string | null>(null);
  const [media, setMedia] = useState<InmuebleMedia[]>([]);
  const [visitas, setVisitas] = useState<ParteMini[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("propiedades").select("*, clientes:ofertante_id(nombre)").eq("id", id).single(),
      supabase.from("inmueble_media").select("id, propiedad_id, tipo, path, url, orden, portada").eq("propiedad_id", id),
      supabase
        .from("partes_visita")
        .select("id, fecha_visita, visitante_nombre, estado")
        .eq("propiedad_id", id)
        .order("fecha_visita", { ascending: false })
        .limit(8),
    ]).then(async ([prop, med, vis]) => {
      if (prop.error || !prop.data) {
        setError(prop.error?.message ?? "Inmueble no encontrado");
        setLoading(false);
        return;
      }
      const raw = prop.data as Inmueble & { clientes?: { nombre: string } | { nombre: string }[] | null };
      const cliente = Array.isArray(raw.clientes) ? raw.clientes[0] : raw.clientes;
      setPropiedad(raw);
      setOfertanteNombre(cliente?.nombre ?? null);
      setMedia((med.data ?? []) as InmuebleMedia[]);
      setVisitas((vis.data ?? []) as ParteMini[]);
      if (raw.comercial_id) {
        const { data: perfil } = await supabase
          .from("profiles")
          .select("nombre_completo, email")
          .eq("id", raw.comercial_id)
          .single();
        setComercialNombre(perfil?.nombre_completo || perfil?.email || null);
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
        <p className="text-red-600">{error ?? "Inmueble no encontrado"}</p>
        <Button variant="secondary" asChild className="mt-4">
          <Link href="/propiedades">Volver a inmuebles</Link>
        </Button>
      </div>
    );
  }

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

  const titulo = propiedad.titulo || propiedad.direccion || propiedad.referencia || "Sin título";
  const portada = media.find((m) => m.portada) ?? media.find((m) => m.tipo === "foto");

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Inmuebles", href: "/propiedades" }, { label: propiedad.referencia || titulo }]}
        title={titulo}
        description={propiedad.referencia ? `Ref. ${propiedad.referencia}` : undefined}
        actions={
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/partes-visita/nuevo?propiedad=${id}`} className="gap-2">
                <ClipboardPenLine className="h-4 w-4" strokeWidth={1.5} />
                Parte de visita
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/propiedades/${id}/editar`} className="gap-2">
                <Pencil className="h-4 w-4" strokeWidth={1.5} />
                Editar
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/clientes/${propiedad.ofertante_id}`}>Propietario</Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Eliminar inmueble"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant="default">{labelEstadoInmueble(propiedad.estado)}</Badge>
        <Badge variant="default">{labelTipoOperacion(propiedad.tipo_operacion)}</Badge>
        {propiedad.tipo_inmueble ? <Badge variant="default">{labelTipoInmueble(propiedad.tipo_inmueble)}</Badge> : null}
        {propiedad.publicado ? <Badge variant="default">Matching</Badge> : null}
      </div>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="¿Eliminar este inmueble?"
        description="Se quitarán también las fotos. Los partes de visita quedan sin inmueble."
        confirmLabel={deleting ? "Eliminando…" : "Eliminar"}
        onConfirm={handleDelete}
        loading={deleting}
        variant="destructive"
      />

      {portada && (
        <div className="mb-6 overflow-hidden rounded-2xl bg-neutral-100">
          <img src={portada.url} alt="" className="max-h-[420px] w-full object-cover" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ubicación y ficha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-neutral-500">Referencia:</span> {propiedad.referencia ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">Dirección:</span> {propiedad.direccion ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">Zona:</span>{" "}
              {[propiedad.codigo_postal, propiedad.localidad].filter(Boolean).join(" ") || "—"}
            </p>
            <p>
              <span className="text-neutral-500">Catastro:</span> {propiedad.referencia_catastral ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">Propietario:</span>{" "}
              <Link href={`/clientes/${propiedad.ofertante_id}`} className="font-medium hover:underline">
                {ofertanteNombre ?? "—"}
              </Link>
            </p>
            <p>
              <span className="text-neutral-500">Comercial:</span> {comercialNombre ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Características y precio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(propiedad.tipo_operacion === "venta" || propiedad.tipo_operacion === "ambos") && (
              <p>
                <span className="text-neutral-500">Venta:</span> {formatPrecioInmueble(propiedad.precio_venta)}
              </p>
            )}
            {(propiedad.tipo_operacion === "alquiler" || propiedad.tipo_operacion === "ambos") && (
              <p>
                <span className="text-neutral-500">Alquiler:</span> {formatPrecioInmueble(propiedad.precio_alquiler)}/mes
              </p>
            )}
            <p>
              <span className="text-neutral-500">m²:</span>{" "}
              {propiedad.superficie_util ?? propiedad.superficie_construida ?? propiedad.superficie_m2 ?? "—"}
              {propiedad.superficie_util && propiedad.superficie_construida
                ? ` útiles / ${propiedad.superficie_construida} construidos`
                : ""}
            </p>
            <p>
              <span className="text-neutral-500">Hab. / baños:</span>{" "}
              {propiedad.habitaciones ?? "—"} / {propiedad.banos ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">Planta / ascensor:</span> {propiedad.planta || "—"} /{" "}
              {propiedad.ascensor ? "sí" : "no"}
            </p>
            {propiedad.tipologia ? (
              <p>
                <span className="text-neutral-500">Tipología:</span> {propiedad.tipologia}
              </p>
            ) : null}
          </CardContent>
        </Card>
        {propiedad.descripcion ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Descripción</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{propiedad.descripcion}</p>
            </CardContent>
          </Card>
        ) : null}
        {propiedad.video_url ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Vídeo</CardTitle>
            </CardHeader>
            <CardContent>
              <a href={propiedad.video_url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
                {propiedad.video_url}
              </a>
            </CardContent>
          </Card>
        ) : null}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Galería</CardTitle>
          </CardHeader>
          <CardContent>
            {user?.id ? (
              <InmuebleGaleria propiedadId={id} userId={user.id} media={media} onChange={setMedia} />
            ) : null}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Visitas</CardTitle>
          </CardHeader>
          <CardContent>
            {visitas.length === 0 ? (
              <p className="text-sm text-neutral-500">Aún no hay partes ligados a este inmueble.</p>
            ) : (
              <ul className="divide-y divide-neutral-100 text-sm">
                {visitas.map((v) => (
                  <li key={v.id} className="flex items-center justify-between py-2">
                    <Link href={`/partes-visita/${v.id}`} className="hover:underline">
                      {v.visitante_nombre || "Visitante"} · {v.fecha_visita || "sin fecha"}
                    </Link>
                    <span className="text-neutral-400">{v.estado}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        {propiedad.notas ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Notas internas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{propiedad.notas}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
