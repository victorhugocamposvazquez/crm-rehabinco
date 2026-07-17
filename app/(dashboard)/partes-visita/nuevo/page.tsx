"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export default function NuevoParteVisitaPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [visitanteNombre, setVisitanteNombre] = useState("");
  const [visitanteDocumento, setVisitanteDocumento] = useState("");
  const [visitanteTelefono, setVisitanteTelefono] = useState("");
  const [visitanteEmail, setVisitanteEmail] = useState("");
  const [inmuebleDireccion, setInmuebleDireccion] = useState("");
  const [inmuebleReferencia, setInmuebleReferencia] = useState("");
  const [fechaVisita, setFechaVisita] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [horaVisita, setHoraVisita] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [agenteNombre, setAgenteNombre] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [estado, setEstado] = useState<"borrador" | "pendiente_firma">("pendiente_firma");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agenteNombre && user?.email) {
      setAgenteNombre(user.email.split("@")[0] ?? "");
    }
  }, [user?.email, agenteNombre]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inmuebleDireccion.trim()) {
      setError("La dirección del inmueble es obligatoria");
      return;
    }
    if (!agenteNombre.trim()) {
      setError("El agente comercial es obligatorio");
      return;
    }
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      setError("Sesión expirada");
      setSaving(false);
      return;
    }

    const { data, error: err } = await supabase
      .from("partes_visita")
      .insert({
        user_id: authUser.id,
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
      })
      .select("id")
      .single();

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    toast.success("Parte de visita creado");
    router.push(`/partes-visita/${data.id}`);
    router.refresh();
  };

  return (
    <div>
      <nav className="mb-4 flex items-center gap-1.5 text-sm">
        <Link href="/partes-visita" className="text-neutral-500 hover:text-foreground">
          Partes de visita
        </Link>
        <span className="text-neutral-400">/</span>
        <span className="font-medium text-foreground">Nuevo</span>
      </nav>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/partes-visita"
          aria-label="Volver a partes de visita"
          className="flex shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Nuevo parte de visita
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
                <Label htmlFor="fecha_visita">Fecha *</Label>
                <Input
                  id="fecha_visita"
                  type="date"
                  value={fechaVisita}
                  onChange={(e) => setFechaVisita(e.target.value)}
                  required
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

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm font-semibold text-foreground">
                Datos del visitante (opcionales al crear)
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
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
                  setEstado(e.target.value as "borrador" | "pendiente_firma")
                }
                className="flex h-10 w-full rounded-lg border border-border bg-white px-4 text-base"
              >
                <option value="pendiente_firma">Pendiente de firma (enlace activo)</option>
                <option value="borrador">Borrador</option>
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" asChild>
                <Link href="/partes-visita">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Crear parte"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
