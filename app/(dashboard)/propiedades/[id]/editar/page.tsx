"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { InmuebleForm } from "@/components/inmuebles/InmuebleForm";
import { InmuebleMultimedia } from "@/components/inmuebles/InmuebleMultimedia";
import { InmuebleDocumentos, type DocInmueble } from "@/components/inmuebles/InmuebleDocumentos";
import {
  formDesdeInmueble,
  inmuebleDesdeForm,
  INMUEBLE_FORM_VACIO,
  type Inmueble,
  type InmuebleFormValues,
  type InmuebleMedia,
} from "@/lib/inmuebles/catalogo";
import { useAuth } from "@/lib/auth/auth-context";

export default function EditarPropiedadPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string }>>([]);
  const [values, setValues] = useState<InmuebleFormValues>(INMUEBLE_FORM_VACIO);
  const [media, setMedia] = useState<InmuebleMedia[]>([]);
  const [documentos, setDocumentos] = useState<DocInmueble[]>([]);
  const [referencia, setReferencia] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("clientes")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setClientes(data ?? []));
  }, []);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("propiedades").select("*").eq("id", id).single(),
      supabase.from("inmueble_media").select("id, propiedad_id, tipo, path, url, orden, portada").eq("propiedad_id", id),
      supabase.from("inmueble_documentos").select("id, tipo, nombre, path, created_at").eq("propiedad_id", id),
    ]).then(([prop, med, docs]) => {
      if (prop.error || !prop.data) {
        setLoading(false);
        return;
      }
      const p = prop.data as Inmueble;
      setReferencia(p.referencia);
      setValues(formDesdeInmueble(p));
      setMedia((med.data ?? []) as InmuebleMedia[]);
      setDocumentos((docs.data ?? []) as DocInmueble[]);
      setLoading(false);
    });
  }, [id]);

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("propiedades")
      .update({
        ...inmuebleDesdeForm(values),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    toast.success("Inmueble actualizado");
    router.push(`/propiedades/${id}`);
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Inmuebles", href: "/propiedades" },
          { label: referencia || "Inmueble", href: `/propiedades/${id}` },
          { label: "Editar" },
        ]}
        title={referencia ? `Editar ${referencia}` : "Editar inmueble"}
      />
      <div className="mb-4">
        <Link
          href={`/propiedades/${id}`}
          className="inline-flex items-center text-sm text-neutral-500 hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          Volver a la ficha
        </Link>
      </div>

      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
          </CardHeader>
          <CardContent>
            <InmuebleForm
              values={values}
              onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
              clientes={clientes}
              onClienteCreado={(cliente) =>
                setClientes((prev) => [...prev, cliente].sort((a, b) => a.nombre.localeCompare(b.nombre)))
              }
              cancelHref={`/propiedades/${id}`}
              saving={saving}
              error={error}
              submitLabel="Guardar"
              onSubmit={() => void handleSubmit()}
            />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fotos, planos y visita virtual</CardTitle>
            </CardHeader>
            <CardContent>
              {user?.id ? (
                <InmuebleMultimedia
                  propiedadId={id}
                  userId={user.id}
                  media={media}
                  onChange={setMedia}
                  videoUrl={values.video_url}
                  tourUrl={values.tour_url}
                  onUrlsChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
                />
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Documentos privados</CardTitle>
            </CardHeader>
            <CardContent>
              {user?.id ? (
                <InmuebleDocumentos
                  propiedadId={id}
                  userId={user.id}
                  documentos={documentos}
                  onChange={setDocumentos}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
