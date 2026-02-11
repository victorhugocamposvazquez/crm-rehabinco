"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export default function NuevaPropiedadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ofertanteFromUrl = searchParams.get("ofertante");
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string }>>([]);
  const [ofertanteId, setOfertanteId] = useState(ofertanteFromUrl ?? "");
  const [titulo, setTitulo] = useState("");
  const [direccion, setDireccion] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [tipoOperacion, setTipoOperacion] = useState<"venta" | "alquiler" | "ambos">("ambos");
  const [precioVenta, setPrecioVenta] = useState("");
  const [precioAlquiler, setPrecioAlquiler] = useState("");
  const [superficie, setSuperficie] = useState("");
  const [habitaciones, setHabitaciones] = useState("");
  const [estado, setEstado] = useState("disponible");
  const [notas, setNotas] = useState("");
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
    if (ofertanteFromUrl) setOfertanteId(ofertanteFromUrl);
  }, [ofertanteFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ofertanteId) {
      setError("Selecciona un propietario (ofertante)");
      return;
    }
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Sesión expirada");
      setSaving(false);
      return;
    }

    const { data, error: err } = await supabase
      .from("propiedades")
      .insert({
        user_id: user.id,
        ofertante_id: ofertanteId,
        titulo: titulo || null,
        direccion: direccion || null,
        codigo_postal: codigoPostal || null,
        localidad: localidad || null,
        tipo_operacion: tipoOperacion,
        precio_venta: precioVenta ? parseFloat(precioVenta) : null,
        precio_alquiler: precioAlquiler ? parseFloat(precioAlquiler) : null,
        superficie_m2: superficie ? parseFloat(superficie) : null,
        habitaciones: habitaciones ? parseInt(habitaciones, 10) : null,
        estado,
        notas: notas || null,
      })
      .select("id")
      .single();

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    toast.success("Propiedad creada");
    router.push(`/propiedades/${data.id}`);
    router.refresh();
  };

  return (
    <div>
      <nav className="mb-4 flex items-center gap-1.5 text-sm">
        <Link href="/propiedades" className="text-neutral-500 hover:text-foreground">
          Propiedades
        </Link>
        <span className="text-neutral-400">/</span>
        <span className="font-medium text-foreground">Nueva</span>
      </nav>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/propiedades"
          aria-label="Volver a propiedades"
          className="flex shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Nueva propiedad
        </h1>
      </div>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Datos de la propiedad</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Propietario (ofertante) *</Label>
              <select
                value={ofertanteId}
                onChange={(e) => setOfertanteId(e.target.value)}
                required
                className="flex h-10 w-full rounded-lg border border-border bg-white px-4 text-base"
              >
                <option value="">Selecciona un cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                placeholder="Ej. Piso céntrico con terraza"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input
                placeholder="Calle, número"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Código postal</Label>
                <Input
                  placeholder="28001"
                  value={codigoPostal}
                  onChange={(e) => setCodigoPostal(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Localidad</Label>
                <Input
                  placeholder="Madrid"
                  value={localidad}
                  onChange={(e) => setLocalidad(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de operación</Label>
              <select
                value={tipoOperacion}
                onChange={(e) => setTipoOperacion(e.target.value as "venta" | "alquiler" | "ambos")}
                className="flex h-10 w-full rounded-lg border border-border bg-white px-4 text-base"
              >
                <option value="venta">Venta</option>
                <option value="alquiler">Alquiler</option>
                <option value="ambos">Venta y Alquiler</option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Precio venta (€)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={precioVenta}
                  onChange={(e) => setPrecioVenta(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Precio alquiler (€/mes)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={precioAlquiler}
                  onChange={(e) => setPrecioAlquiler(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Superficie (m²)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={superficie}
                  onChange={(e) => setSuperficie(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Habitaciones</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={habitaciones}
                  onChange={(e) => setHabitaciones(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-white px-4 text-base"
              >
                <option value="disponible">Disponible</option>
                <option value="reservada">Reservada</option>
                <option value="vendida">Vendida</option>
                <option value="alquilada">Alquilada</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-lg border border-border bg-white px-4 py-2 text-base"
                placeholder="Notas internas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="secondary" asChild>
                <Link href="/propiedades">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Crear propiedad"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
