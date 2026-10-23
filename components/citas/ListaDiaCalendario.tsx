"use client";

import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { Button } from "@/components/ui/button";
import { CitaAcciones } from "@/components/citas/CitaAcciones";
import { EnlaceMaps } from "@/components/citas/InmueblePreviewCita";
import { FichaLink } from "@/components/crm/FichaPeek";
import {
  citaAtenuadaEnCalendario,
  direccionDeInmueble,
  entradaConAsistentes,
  horaCita,
  TIPO_CITA_LABEL,
  type EstadoCita,
  type TipoCita,
} from "@/lib/citas/citas";
import { nombreYApellido } from "@/lib/ui/tokens";

export type CitaListaDia = {
  id: string;
  comercial_id: string;
  tipo: string;
  titulo: string;
  empieza: string;
  propiedad_id: string | null;
  cliente_id: string | null;
  clientes_extra_ids?: string[] | null;
  notas?: string | null;
  estado: string;
  lugar?: string | null;
  profiles?: { nombre_completo?: string | null; color?: string | null; email?: string | null } | null;
  propiedades?: { titulo?: string | null; direccion?: string | null; localidad?: string | null; referencia?: string | null } | null;
  clientes?: { nombre?: string | null } | null;
};

export function ListaDiaCalendario({
  dia,
  citas,
  clientes,
  userId,
  puedeGestionar,
  onEditar,
  onEstado,
  onCrearHueco,
}: {
  dia: string;
  citas: CitaListaDia[];
  clientes: Array<{ id: string; nombre: string }>;
  userId?: string;
  puedeGestionar: (comercialId: string) => boolean;
  onEditar: (cita: CitaListaDia) => void;
  onEstado: (id: string, estado: Extract<EstadoCita, "prevista" | "hecha" | "cancelada">) => void;
  onCrearHueco: () => void;
}) {
  const etiquetaDia = new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <section className="mt-6">
      <h2 className="text-[15px] font-semibold capitalize">{etiquetaDia}</h2>
      <ul className="mt-3 space-y-2">
        {citas.map((cita) => {
          const mapsConsulta = cita.lugar?.trim() || direccionDeInmueble(cita.propiedades ?? {});
          return (
            <li
              key={cita.id}
              className={`flex flex-col gap-3 rounded-2xl border border-[#E5E5E5] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                citaAtenuadaEnCalendario(cita.estado) ? "opacity-55" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <AvatarComercial
                  id={cita.comercial_id}
                  nombre={cita.profiles?.nombre_completo}
                  email={cita.profiles?.email}
                  color={cita.profiles?.color}
                  size={28}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium">{cita.titulo}</p>
                  <p className="text-xs text-[#5C5C5C]">
                    {horaCita(cita.empieza)}
                    {nombreYApellido(cita.profiles?.nombre_completo, cita.profiles?.email) &&
                    cita.comercial_id !== userId
                      ? ` · ${nombreYApellido(cita.profiles?.nombre_completo, cita.profiles?.email)}`
                      : ""}{" "}
                    · {TIPO_CITA_LABEL[(cita.tipo as TipoCita) ?? "otro"] ?? cita.tipo}
                  </p>
                  {cita.propiedad_id ? (
                    <FichaLink tipo="propiedad" id={cita.propiedad_id} className="mt-1 inline-block text-xs">
                      {[cita.propiedades?.referencia, cita.propiedades?.titulo || cita.propiedades?.direccion]
                        .filter(Boolean)
                        .join(" · ") || "Ver inmueble"}
                    </FichaLink>
                  ) : null}
                  {mapsConsulta ? (
                    <p className="mt-1 text-xs">
                      <EnlaceMaps consulta={mapsConsulta} />
                    </p>
                  ) : null}
                  {entradaConAsistentes(cita.tipo) &&
                  (cita.clientes?.nombre || (cita.clientes_extra_ids?.length ?? 0) > 0) ? (
                    <p className="mt-1 text-xs text-[#5C5C5C]">
                      {[
                        cita.clientes?.nombre,
                        ...(cita.clientes_extra_ids ?? []).map((id) => {
                          const nombre = clientes.find((c) => c.id === id)?.nombre;
                          return nombre ? `+ ${nombre}` : null;
                        }),
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                  ) : null}
                  {cita.notas?.trim() ? (
                    <p className="mt-1 text-xs italic text-[#5C5C5C]">{cita.notas.trim()}</p>
                  ) : null}
                </div>
              </div>
              {puedeGestionar(cita.comercial_id) ? (
                <CitaAcciones cita={cita} onEstado={onEstado} onEditar={() => onEditar(cita)} />
              ) : null}
            </li>
          );
        })}
        {citas.length === 0 ? (
          <li className="rounded-[14px] border border-dashed border-border px-4 py-6 text-center">
            <p className="text-[13.5px] text-[var(--text-2)]">No hay entradas en agenda este día.</p>
            <Button type="button" size="sm" className="mt-3" onClick={onCrearHueco}>
              Crear en este día
            </Button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

