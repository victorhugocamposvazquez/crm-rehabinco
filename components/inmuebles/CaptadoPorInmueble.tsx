"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Selector } from "@/components/ui/selector";
import { isAdmin } from "@/lib/auth/roles";
import { useAuth } from "@/lib/auth/auth-context";
import { nombreComercial } from "@/lib/catastro-host/finca-assignment";

type Persona = { id: string; nombre: string };

export function textoCaptado(conjunto: boolean, nombre: string | null): string {
  if (conjunto) return "En conjunto";
  const limpio = nombre?.trim();
  return limpio || "Sin indicar";
}

export function CaptadoPorInmueble({
  propiedadId,
  captadoPor,
  conjunto,
  nombre,
  onGuardado,
}: {
  propiedadId: string;
  captadoPor: string | null;
  conjunto: boolean;
  nombre: string | null;
  onGuardado?: (siguiente: { captadoPor: string | null; conjunto: boolean; nombre: string | null }) => void;
}) {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!admin) return;
    let vivo = true;
    void createClient()
      .from("profiles")
      .select("id, nombre_completo, email, role, activo")
      .in("role", ["comercial", "agente", "admin", "superadmin", "catastro_user"])
      .eq("activo", true)
      .order("nombre_completo")
      .then(({ data }) => {
        if (!vivo) return;
        setPersonas(
          (data ?? []).map((fila) => ({
            id: fila.id,
            nombre: nombreComercial(fila),
          }))
        );
      });
    return () => {
      vivo = false;
    };
  }, [admin]);

  const guardar = async (valor: string) => {
    const siguienteConjunto = valor === "conjunto";
    const siguienteId = siguienteConjunto || valor === "" ? null : valor;
    const siguienteNombre = siguienteId
      ? personas.find((persona) => persona.id === siguienteId)?.nombre ?? (siguienteId === captadoPor ? nombre : null)
      : null;
    setGuardando(true);
    const { error } = await createClient()
      .from("propiedades")
      .update({
        captado_por: siguienteId,
        captado_conjunto: siguienteConjunto,
        updated_at: new Date().toISOString(),
      })
      .eq("id", propiedadId);
    setGuardando(false);
    if (error) {
      toast.error("No se ha podido guardar quién captó el inmueble.");
      return;
    }
    onGuardado?.({ captadoPor: siguienteId, conjunto: siguienteConjunto, nombre: siguienteNombre });
  };

  if (!admin) {
    return <span>{textoCaptado(conjunto, nombre)}</span>;
  }

  const opciones = [...personas];
  if (captadoPor && !opciones.some((persona) => persona.id === captadoPor)) {
    opciones.unshift({ id: captadoPor, nombre: nombre?.trim() || "Captador" });
  }

  return (
    <Selector
      aria-label="Quién ha captado el inmueble"
      value={conjunto ? "conjunto" : captadoPor ?? ""}
      disabled={guardando}
      onChange={(evento) => void guardar(evento.target.value)}
      className="h-8 min-w-[12rem]"
    >
      <option value="">Sin indicar</option>
      <option value="conjunto">En conjunto</option>
      {opciones.map((persona) => (
        <option key={persona.id} value={persona.id}>
          {persona.nombre}
        </option>
      ))}
    </Selector>
  );
}
