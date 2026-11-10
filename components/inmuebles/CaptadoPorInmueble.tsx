"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { isAdmin } from "@/lib/auth/roles";
import { useAuth } from "@/lib/auth/auth-context";
import { nombreComercial } from "@/lib/catastro-host/finca-assignment";
import { cn } from "@/lib/utils";

type Persona = { id: string; nombre: string };

function nombresDe(personas: Persona[]): string {
  return personas.map((persona) => persona.nombre.trim()).filter(Boolean).join(", ") || "—";
}

export function CaptadoPorInmueble({
  propiedadId,
  captadoPor,
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
  onGuardado?: (siguiente: { captadoPor: string | null; conjunto: boolean; nombre: string | null; ids: string[] }) => void;
}) {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const listaId = useId();
  const cajaRef = useRef<HTMLDivElement>(null);
  const [equipo, setEquipo] = useState<Persona[]>([]);
  const [elegidos, setElegidos] = useState<Persona[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void createClient()
      .from("propiedad_captadores")
      .select("profile_id, profiles:profile_id(nombre_completo, email)")
      .eq("propiedad_id", propiedadId)
      .then(({ data }) => {
        if (!vivo) return;
        const filas = (data ?? []).flatMap((fila) => {
          const perfil = Array.isArray(fila.profiles) ? fila.profiles[0] : fila.profiles;
          if (!fila.profile_id) return [];
          return [{ id: fila.profile_id, nombre: nombreComercial(perfil ?? {}) }];
        });
        filas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        setElegidos(filas);
      });
    return () => {
      vivo = false;
    };
  }, [propiedadId]);

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
        setEquipo((data ?? []).map((fila) => ({ id: fila.id, nombre: nombreComercial(fila) })));
      });
    return () => {
      vivo = false;
    };
  }, [admin]);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (evento: MouseEvent) => {
      if (!cajaRef.current?.contains(evento.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  const respaldoId = captadoPor ?? subidoPor;
  const respaldoNombre = nombre?.trim() || subidoNombre?.trim() || null;
  const visibles =
    elegidos && elegidos.length > 0
      ? elegidos
      : respaldoId
        ? [{ id: respaldoId, nombre: respaldoNombre || "Captador" }]
        : [];
  const texto = nombresDe(visibles);

  const guardar = async (ids: string[]) => {
    if (ids.length === 0) {
      toast.error("Tiene que quedar al menos una persona.");
      return;
    }
    const porId = new Map<string, string>();
    for (const persona of [...equipo, ...visibles]) porId.set(persona.id, persona.nombre);
    const siguiente = ids
      .map((id) => ({ id, nombre: porId.get(id) || "Captador" }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    const supabase = createClient();
    setGuardando(true);
    const { error: errorAlta } = await supabase.from("propiedad_captadores").upsert(
      siguiente.map((persona) => ({ propiedad_id: propiedadId, profile_id: persona.id })),
      { onConflict: "propiedad_id,profile_id", ignoreDuplicates: true }
    );
    const { error: errorBaja } = errorAlta
      ? { error: null }
      : await supabase
          .from("propiedad_captadores")
          .delete()
          .eq("propiedad_id", propiedadId)
          .not("profile_id", "in", `(${siguiente.map((persona) => persona.id).join(",")})`);
    const conjunto = siguiente.length > 1;
    const { error: errorFicha } =
      errorAlta || errorBaja
        ? { error: errorAlta ?? errorBaja }
        : await supabase
            .from("propiedades")
            .update({
              captado_por: conjunto ? null : siguiente[0]?.id ?? null,
              captado_conjunto: conjunto,
              updated_at: new Date().toISOString(),
            })
            .eq("id", propiedadId);
    setGuardando(false);
    if (errorAlta || errorBaja || errorFicha) {
      toast.error("No se ha podido guardar quién captó el inmueble.");
      return;
    }
    setElegidos(siguiente);
    onGuardado?.({
      captadoPor: conjunto ? null : siguiente[0]?.id ?? null,
      conjunto,
      nombre: nombresDe(siguiente),
      ids: siguiente.map((persona) => persona.id),
    });
  };

  const alternar = (id: string) => {
    const ids = new Set(visibles.map((persona) => persona.id));
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    void guardar([...ids]);
  };

  if (!admin) return <span>{texto}</span>;

  const opciones = [...equipo];
  for (const persona of visibles) {
    if (!opciones.some((item) => item.id === persona.id)) opciones.unshift(persona);
  }
  const marcados = new Set(visibles.map((persona) => persona.id));

  return (
    <div ref={cajaRef} className="relative min-w-[12rem]">
      <button
        type="button"
        disabled={guardando}
        aria-label="Quién ha captado el inmueble"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={listaId}
        onClick={() => setAbierto((valor) => !valor)}
        className="relative inline-flex min-h-8 w-full items-center justify-between gap-2 rounded-[9px] border border-[var(--input)] bg-[var(--field)] py-1 pl-3 pr-9 text-left text-[13.5px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
      >
        <span className="min-w-0 flex-1 leading-snug">{texto}</span>
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-2)]",
            abierto && "rotate-180"
          )}
          strokeWidth={1.8}
        />
      </button>
      {abierto ? (
        <div
          id={listaId}
          role="listbox"
          aria-multiselectable="true"
          className="caja-flotante absolute left-0 top-full z-30 mt-1 max-h-64 w-full min-w-[14rem] overflow-y-auto rounded-[12px] p-1"
        >
          {opciones.map((persona) => {
            const activa = marcados.has(persona.id);
            return (
              <label
                key={persona.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13.5px]",
                  activa ? "bg-accent-soft" : "hover:bg-[var(--surface-soft)]"
                )}
              >
                <input
                  type="checkbox"
                  role="option"
                  aria-selected={activa}
                  checked={activa}
                  disabled={guardando}
                  onChange={() => alternar(persona.id)}
                />
                <span className="min-w-0 flex-1">{persona.nombre}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
