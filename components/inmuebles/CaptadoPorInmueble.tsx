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
  return nombre?.trim() || "—";
}

export function CaptadoPorInmueble({
  propiedadId,
  captadoPor,
  conjunto,
  nombre,
  subidoPor = null,
  subidoNombre = null,
  onGuardado,
}: {
  propiedadId: string;
  captadoPor: string | null;
  conjunto: boolean;
  nombre: string | null;
  /** Quien creó el inmueble. Si nadie ha cambiado la captación, es quien la hizo. */
  subidoPor?: string | null;
  subidoNombre?: string | null;
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

  const captadorId = conjunto ? null : (captadoPor ?? subidoPor);
  const captadorNombre = conjunto
    ? null
    : (nombre?.trim() || (captadoPor ? null : subidoNombre?.trim() || null));

  const guardar = async (valor: string) => {
    const siguienteConjunto = valor === "conjunto";
    const siguienteId = siguienteConjunto ? null : valor || subidoPor;
    const siguienteNombre = siguienteId
      ? personas.find((persona) => persona.id === siguienteId)?.nombre ??
        (siguienteId === captadoPor ? nombre : siguienteId === subidoPor ? subidoNombre : null)
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
    return <span>{textoCaptado(conjunto, captadorNombre)}</span>;
  }

  const opciones = [...personas];
  if (captadorId && !opciones.some((persona) => persona.id === captadorId)) {
    opciones.unshift({ id: captadorId, nombre: captadorNombre?.trim() || "Captador" });
  }

  return (
    <Selector
      aria-label="Quién ha captado el inmueble"
      value={conjunto ? "conjunto" : captadorId ?? ""}
      disabled={guardando}
      onChange={(evento) => void guardar(evento.target.value)}
      className="h-8 min-w-[12rem]"
    >
      <option value="conjunto">En conjunto</option>
      {opciones.map((persona) => (
        <option key={persona.id} value={persona.id}>
          {persona.nombre}
        </option>
      ))}
    </Selector>
  );
}
