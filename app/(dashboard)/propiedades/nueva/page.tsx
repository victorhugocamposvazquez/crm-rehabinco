"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { InmuebleForm } from "@/components/inmuebles/InmuebleForm";
import {
  INMUEBLE_FORM_VACIO,
  inmuebleDesdeForm,
  type InmuebleFormValues,
} from "@/lib/inmuebles/catalogo";

export default function NuevaPropiedadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ofertanteFromUrl = searchParams.get("ofertante");
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string }>>([]);
  const [values, setValues] = useState<InmuebleFormValues>({
    ...INMUEBLE_FORM_VACIO,
    ofertante_id: ofertanteFromUrl ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ofertanteNombre = values.ofertante_id
    ? clientes.find((c) => c.id === values.ofertante_id)?.nombre
    : null;

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
    if (ofertanteFromUrl) setValues((v) => ({ ...v, ofertante_id: ofertanteFromUrl }));
  }, [ofertanteFromUrl]);

  const handleSubmit = async () => {
    if (!values.ofertante_id) {
      setError("Selecciona un propietario (ofertante)");
      return;
    }
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sesión expirada");
      setSaving(false);
      return;
    }

    const { data, error: err } = await supabase
      .from("propiedades")
      .insert({
        user_id: user.id,
        comercial_id: user.id,
        ...inmuebleDesdeForm(values),
      })
      .select("id")
      .single();

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    toast.success("Inmueble creado. Ya puedes subir fotos.");
    router.push(`/propiedades/${data.id}`);
    router.refresh();
  };

  return (
    <div>
      <nav className="mb-4 flex items-center gap-1.5 text-sm">
        <Link href="/propiedades" className="text-neutral-500 hover:text-foreground">
          Inmuebles
        </Link>
        <span className="text-neutral-400">/</span>
        <span className="font-medium text-foreground">Nuevo</span>
      </nav>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/propiedades"
          aria-label="Volver a inmuebles"
          className="flex shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ofertanteNombre ? `Nuevo inmueble de ${ofertanteNombre}` : "Nuevo inmueble"}
        </h1>
      </div>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Ficha del inmueble</CardTitle>
        </CardHeader>
        <CardContent>
          <InmuebleForm
            values={values}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            clientes={clientes}
            onClienteCreado={(cliente) =>
              setClientes((prev) => [...prev, cliente].sort((a, b) => a.nombre.localeCompare(b.nombre)))
            }
            cancelHref="/propiedades"
            saving={saving}
            error={error}
            submitLabel="Crear inmueble"
            onSubmit={() => void handleSubmit()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
