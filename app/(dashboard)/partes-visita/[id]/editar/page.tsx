"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export default function EditarParteVisitaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [visitanteNombre, setVisitanteNombre] = useState("");
  const [visitanteDocumento, setVisitanteDocumento] = useState("");
  const [visitanteTelefono, setVisitanteTelefono] = useState("");
  const [visitanteEmail, setVisitanteEmail] = useState("");
  const [inmuebleDireccion, setInmuebleDireccion] = useState("");
  const [inmuebleReferencia, setInmuebleReferencia] = useState("");
  const [fechaVisita, setFechaVisita] = useState("");
  const [horaVisita, setHoraVisita] = useState("");
  const [agenteNombre, setAgenteNombre] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [estado, setEstado] = useState<"borrador" | "pendiente_firma" | "firmado">(
    "pendiente_firma"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("partes_visita")
      .select("*")
      .eq("id", id)
      .single()
      .then((parteRes) => {
      if (parteRes.error || !parteRes.data) {
        setError(parteRes.error?.message ?? "Parte no encontrado");
        setLoading(false);
        return;
      }
      const p = parteRes.data;
      setVisitanteNombre(p.visitante_nombre ?? "");
      setVisitanteDocumento(p.visitante_documento ?? "");
      setVisitanteTelefono(p.visitante_telefono ?? "");
      setVisitanteEmail(p.visitante_email ?? "");
      setInmuebleDireccion(p.inmueble_direccion ?? "");
      setInmuebleReferencia(p.inmueble_referencia ?? "");
      setFechaVisita(p.fecha_visita ?? "");
      setHoraVisita(p.hora_visita ? String(p.hora_visita).slice(0, 5) : "");
      setAgenteNombre(p.agente_nombre ?? "");
      setObservaciones(p.observaciones ?? "");
      setEstado(p.estado);
      setLoading(false);
    });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inmuebleDireccion.trim() || !agenteNombre.trim()) {
      setError("Dirección y agente son obligatorios");
      return;
    }
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("partes_visita")
      .update({
        estado,
        visitante_nombre: visitanteNombre.trim() || null,
        visitante_documento: visitanteDocumento.trim() || null,
        visitante_telefono: visitanteTelefono.trim() || null,
        visitante_email: visitanteEmail.trim() || null,
        inmueble_direccion: inmuebleDireccion.trim(),
        inmueble_referencia: inmuebleReferencia.trim() || null,
        fecha_visita: fechaVisita || null,
        hora_visita: horaVisita || null,
        agente_nombre: agenteNombre.trim(),
        observaciones: observaciones.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    toast.success("Parte actualizado");
    router.push(`/partes-visita/${id}`);
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
      <nav className="mb-4 flex items-center gap-1.5 text-sm">
        <Link href="/partes-visita" className="text-neutral-500 hover:text-foreground">
          Partes de visita
        </Link>
        <span className="text-neutral-400">/</span>
        <Link href={`/partes-visita/${id}`} className="text-neutral-500 hover:text-foreground">
          Detalle
        </Link>
        <span className="text-neutral-400">/</span>
        <span className="font-medium text-foreground">Editar</span>
      </nav>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/partes-visita/${id}`}
          aria-label="Volver"
          className="flex shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Editar parte de visita
        </h1>
      </div>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Datos del parte</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="inmueble_direccion">Dirección del inmueble *</Label>
                <Input
                  id="inmueble_direccion"
                  value={inmuebleDireccion}
                  onChange={(e) => setInmuebleDireccion(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inmueble_referencia">Referencia</Label>
                <Input
                  id="inmueble_referencia"
                  value={inmuebleReferencia}
                  onChange={(e) => setInmuebleReferencia(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agente_nombre">Agente comercial *</Label>
                <Input
                  id="agente_nombre"
                  value={agenteNombre}
                  onChange={(e) => setAgenteNombre(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_visita">Fecha</Label>
                <Input
                  id="fecha_visita"
                  type="date"
                  value={fechaVisita}
                  onChange={(e) => setFechaVisita(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hora_visita">Hora</Label>
                <Input
                  id="hora_visita"
                  type="time"
                  value={horaVisita}
                  onChange={(e) => setHoraVisita(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="visitante_nombre">Nombre y apellidos</Label>
                <Input
                  id="visitante_nombre"
                  value={visitanteNombre}
                  onChange={(e) => setVisitanteNombre(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visitante_documento">DNI / NIE</Label>
                <Input
                  id="visitante_documento"
                  value={visitanteDocumento}
                  onChange={(e) => setVisitanteDocumento(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visitante_telefono">Teléfono</Label>
                <Input
                  id="visitante_telefono"
                  value={visitanteTelefono}
                  onChange={(e) => setVisitanteTelefono(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="visitante_email">Correo electrónico</Label>
                <Input
                  id="visitante_email"
                  type="email"
                  value={visitanteEmail}
                  onChange={(e) => setVisitanteEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <textarea
                id="observaciones"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className="flex w-full rounded-lg border border-border bg-white px-4 py-2 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <select
                value={estado}
                onChange={(e) =>
                  setEstado(e.target.value as typeof estado)
                }
                className="flex h-10 w-full rounded-lg border border-border bg-white px-4 text-base"
                disabled={estado === "firmado"}
              >
                <option value="pendiente_firma">Pendiente de firma</option>
                <option value="borrador">Borrador</option>
                <option value="firmado">Firmado</option>
              </select>
              {estado === "firmado" && (
                <p className="text-xs text-neutral-500">
                  Un parte firmado no debería volver a borrador salvo corrección manual.
                </p>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" asChild>
                <Link href={`/partes-visita/${id}`}>Cancelar</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
