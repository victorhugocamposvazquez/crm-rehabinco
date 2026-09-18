"use client";

import { useEffect, useMemo, useState } from "react";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AltaField, AltaPersona, AltaSection, AltaShell, altaControl, type PersonaOpcion } from "@/components/ui/alta-form";
import { NuevoClientePanel } from "@/components/clientes/NuevoClientePanel";
import { EnlaceMaps, InmueblePreviewCita } from "@/components/citas/InmueblePreviewCita";
import { createClient } from "@/lib/supabase/client";
import {
  coincideInmueble,
  direccionDeInmueble,
  etiquetaInmueble,
  mapInmuebleCalendario,
  orFiltroInmueble,
  SELECT_INMUEBLE_CALENDARIO,
  TIPOS_ALTA_CALENDARIO,
  TIPO_CITA_LABEL,
  type InmuebleCalendario,
  type TipoAltaCalendario,
} from "@/lib/citas/citas";

export type EdicionCalendario = {
  id: string;
  tipo: string;
  titulo: string;
  notas?: string | null;
};

export function NuevaEntradaCalendario({
  open,
  onOpenChange,
  dia,
  onDia,
  hora,
  onHora,
  propiedades,
  clientes,
  propiedadId,
  clienteId,
  cliente2Id,
  notas,
  lugar,
  onPropiedad,
  onCliente,
  onCliente2,
  onNotas,
  onLugar,
  saving,
  edicion,
  onGuardar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dia: string;
  onDia: (dia: string) => void;
  hora: string;
  onHora: (hora: string) => void;
  propiedades: InmuebleCalendario[];
  clientes: PersonaOpcion[];
  propiedadId: string;
  clienteId: string;
  cliente2Id: string;
  notas: string;
  lugar: string;
  onPropiedad: (id: string) => void;
  onCliente: (id: string) => void;
  onCliente2: (id: string) => void;
  onNotas: (notas: string) => void;
  onLugar: (lugar: string) => void;
  saving: boolean;
  edicion?: EdicionCalendario | null;
  onGuardar: (tipo: TipoAltaCalendario, titulo: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoAltaCalendario>("evento");
  const [titulo, setTitulo] = useState("");
  const [qCliente, setQCliente] = useState("");
  const [qCliente2, setQCliente2] = useState("");
  const [agenda, setAgenda] = useState<PersonaOpcion[]>(clientes);
  const [altaClienteOpen, setAltaClienteOpen] = useState(false);
  const [altaClienteNombre, setAltaClienteNombre] = useState("");
  const [altaCliente2Open, setAltaCliente2Open] = useState(false);
  const [altaCliente2Nombre, setAltaCliente2Nombre] = useState("");
  const [qInmueble, setQInmueble] = useState("");
  const [catalogo, setCatalogo] = useState<InmuebleCalendario[]>(propiedades);

  useEffect(() => {
    if (!open) return;
    setQCliente("");
    setQCliente2("");
    setQInmueble("");
    if (edicion) {
      setTitulo(edicion.titulo);
      setTipo(TIPOS_ALTA_CALENDARIO.includes(edicion.tipo as TipoAltaCalendario) ? (edicion.tipo as TipoAltaCalendario) : "evento");
      onNotas(edicion.notas?.trim() ?? "");
      return;
    }
    setTitulo("");
    setTipo("evento");
    onNotas("");
    onCliente2("");
  }, [open, edicion, onNotas, onCliente2]);

  useEffect(() => {
    setAgenda((prev) => {
      const byId = new Map(clientes.map((c) => [c.id, c] as const));
      for (const c of prev) {
        if (!byId.has(c.id)) byId.set(c.id, c);
      }
      return [...byId.values()];
    });
  }, [clientes]);

  useEffect(() => {
    setCatalogo((prev) => {
      const byId = new Map(propiedades.map((p) => [p.id, p] as const));
      for (const p of prev) {
        if (!byId.has(p.id)) byId.set(p.id, p);
      }
      return [...byId.values()];
    });
  }, [propiedades]);

  useEffect(() => {
    const filtro = orFiltroInmueble(qInmueble);
    if (!open || !filtro) return;
    const t = window.setTimeout(() => {
      const supabase = createClient();
      void supabase
        .from("propiedades")
        .select(SELECT_INMUEBLE_CALENDARIO)
        .or(filtro)
        .order("updated_at", { ascending: false })
        .limit(25)
        .then(({ data }) => {
          if (!data?.length) return;
          setCatalogo((prev) => {
            const byId = new Map(prev.map((p) => [p.id, p] as const));
            for (const row of data) byId.set(row.id, mapInmuebleCalendario(row));
            return [...byId.values()];
          });
        });
    }, 200);
    return () => window.clearTimeout(t);
  }, [open, qInmueble]);

  useEffect(() => {
    if (!open || !propiedadId) return;
    const supabase = createClient();
    void supabase
      .from("propiedades")
      .select(`${SELECT_INMUEBLE_CALENDARIO}, inmueble_media(url, portada, tipo)`)
      .eq("id", propiedadId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const mapped = mapInmuebleCalendario(data);
        setCatalogo((prev) => {
          const rest = prev.filter((p) => p.id !== mapped.id);
          return [mapped, ...rest];
        });
      });
  }, [open, propiedadId]);

  const etiquetaDia = new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const clienteSel = agenda.find((c) => c.id === clienteId);
  const cliente2Sel = agenda.find((c) => c.id === cliente2Id);
  const inmuebleSel = catalogo.find((p) => p.id === propiedadId);
  const esEvento = tipo === "evento";
  const tipos = edicion?.tipo === "tarea" ? (["tarea"] as const) : TIPOS_ALTA_CALENDARIO.filter((item) => item !== "tarea" || !edicion);
  const mapsConsulta = lugar.trim() || (inmuebleSel ? direccionDeInmueble(inmuebleSel) : "");
  const sugeridos = useMemo(() => {
    const q = qCliente.trim().toLowerCase();
    if (!q) return [];
    return agenda.filter((c) => `${c.nombre} ${c.telefono ?? ""}`.toLowerCase().includes(q)).slice(0, 6);
  }, [agenda, qCliente]);
  const sugeridos2 = useMemo(() => {
    const q = qCliente2.trim().toLowerCase();
    if (!q) return [];
    return agenda
      .filter((c) => c.id !== clienteId && `${c.nombre} ${c.telefono ?? ""}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [agenda, qCliente2, clienteId]);
  const sugeridosInmueble = useMemo(() => {
    const q = qInmueble.trim();
    const lista = q ? catalogo.filter((p) => coincideInmueble(p, q)) : catalogo;
    return lista.slice(0, 8);
  }, [catalogo, qInmueble]);

  const elegirInmueble = (id: string) => {
    const prev = inmuebleSel ? direccionDeInmueble(inmuebleSel) : "";
    const next = catalogo.find((p) => p.id === id);
    onPropiedad(id);
    const siguiente = next ? direccionDeInmueble(next) : "";
    if (!lugar.trim() || lugar.trim() === prev) onLugar(siguiente);
    setQInmueble("");
  };

  return (
    <>
      <AltaShell
        open={open}
        onOpenChange={onOpenChange}
        title={edicion ? "Editar entrada" : "Nueva entrada"}
        hint={
          edicion
            ? `Cambia hora, inmueble o dirección. Se guarda sobre el ${etiquetaDia} a las ${hora}.`
            : `Hueco del ${etiquetaDia} a las ${hora}. Elige tipo, ajusta la hora y crea.`
        }
        primaryLabel={edicion ? "Guardar cambios" : `Crear ${TIPO_CITA_LABEL[tipo].toLowerCase()}`}
        saving={saving}
        footerHint={
          edicion
            ? "Cerrar descarta los cambios no guardados. Arrastrar en la rejilla también mueve la hora."
            : "Cerrar no crea nada. La hora sale del hueco que has pulsado y se puede cambiar aquí."
        }
        onSubmit={() => onGuardar(tipo, titulo)}
      >
        <AltaSection title="Qué" hint="Evento, recordatorio, tarea o visita. El título es lo que verás en la rejilla.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              {tipos.map((item) => (
                <ToggleChip key={item} on={tipo === item} onClick={() => setTipo(item)}>
                  {TIPO_CITA_LABEL[item]}
                </ToggleChip>
              ))}
            </div>
            <AltaField label="Título" optional>
              <input
                autoFocus
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder={`${TIPO_CITA_LABEL[tipo]} a las ${hora}`}
                className={altaControl}
              />
            </AltaField>
          </div>
        </AltaSection>

        <AltaSection title="Cuándo" hint="Sale del hueco pulsado. Cámbialo si no encaja.">
          <div className="grid grid-cols-2 gap-3">
            <AltaField label="Día">
              <input type="date" value={dia} onChange={(e) => onDia(e.target.value)} className={altaControl} />
            </AltaField>
            <AltaField label="Hora">
              <input type="time" value={hora} onChange={(e) => onHora(e.target.value)} className={altaControl} />
            </AltaField>
          </div>
        </AltaSection>

        <AltaSection wide title="Cliente" hint="Opcional. Si no está en la agenda, abre la misma ficha completa de Clientes.">
          <AltaPersona
            permitirNinguno
            seleccionado={clienteSel}
            onSeleccionar={(persona) => {
              onCliente(persona.id);
              if (persona.id === cliente2Id) onCliente2("");
            }}
            onLimpiar={() => onCliente("")}
            q={qCliente}
            setQ={setQCliente}
            sugeridos={sugeridos}
            onAltaNueva={(nombreSugerido) => {
              setAltaClienteNombre(nombreSugerido ?? "");
              setAltaClienteOpen(true);
            }}
          />
        </AltaSection>

        {esEvento ? (
          <AltaSection wide title="Acompañante" hint="Opcional. Otro cliente que venga al evento.">
            <AltaPersona
              permitirNinguno
              seleccionado={cliente2Sel}
              onSeleccionar={(persona) => {
                if (persona.id === clienteId) return;
                onCliente2(persona.id);
              }}
              onLimpiar={() => onCliente2("")}
              q={qCliente2}
              setQ={setQCliente2}
              sugeridos={sugeridos2}
              onAltaNueva={(nombreSugerido) => {
                setAltaCliente2Nombre(nombreSugerido ?? "");
                setAltaCliente2Open(true);
              }}
            />
          </AltaSection>
        ) : null}

        {esEvento ? (
          <AltaSection title="Notas" hint="Observaciones internas. No salen en el título del calendario.">
            <textarea
              value={notas}
              onChange={(e) => onNotas(e.target.value)}
              placeholder="Detalles, acuerdos, recordatorios…"
              rows={3}
              className="min-h-[5rem] w-full resize-y rounded-[9px] border border-[var(--input)] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15 max-[819px]:text-base"
            />
          </AltaSection>
        ) : null}

        <AltaSection wide title="Inmueble y visita" hint="Busca un inmueble ya creado por referencia, calle o localidad. Al elegirlo verás la ficha y el enlace a Maps.">
          {inmuebleSel ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12.5px] font-semibold text-[var(--text-2)]">Inmueble asociado</p>
                <button
                  type="button"
                  onClick={() => {
                    elegirInmueble("");
                    onLugar("");
                  }}
                  className="text-[13px] font-semibold text-accent"
                >
                  Cambiar
                </button>
              </div>
              <InmueblePreviewCita inmueble={inmuebleSel} />
            </div>
          ) : (
            <div>
              <AltaField label="Inmueble" optional>
                <input
                  value={qInmueble}
                  onChange={(e) => setQInmueble(e.target.value)}
                  placeholder="Referencia, calle o localidad"
                  className={altaControl}
                />
              </AltaField>
              <div className="mt-2 overflow-hidden rounded-[12px] border border-[var(--border)]">
                {sugeridosInmueble.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => elegirInmueble(p.id)}
                    className="flex w-full items-start justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3 text-left last:border-0 hover:bg-[var(--surface-soft)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium">{etiquetaInmueble(p)}</span>
                      {direccionDeInmueble(p) ? (
                        <span className="mt-0.5 block truncate text-[12px] text-[var(--text-2)]">{direccionDeInmueble(p)}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[12px] text-[var(--text-3)]">{p.referencia || ""}</span>
                  </button>
                ))}
                {sugeridosInmueble.length === 0 ? (
                  <div className="px-4 py-3 text-[13px] text-[var(--text-2)]">
                    {qInmueble.trim().length >= 2
                      ? "No hay inmuebles con esa búsqueda."
                      : "Escribe para buscar en el stock ya creado."}
                  </div>
                ) : null}
              </div>
            </div>
          )}
          <div className="mt-4">
            <AltaField label="Dirección de la visita" optional>
              <input
                value={lugar}
                onChange={(e) => onLugar(e.target.value)}
                placeholder={inmuebleSel ? direccionDeInmueble(inmuebleSel) || "Calle, número, localidad" : "Calle, número, localidad"}
                className={altaControl}
              />
            </AltaField>
            {mapsConsulta ? (
              <p className="mt-2 text-[12.5px]">
                <EnlaceMaps consulta={mapsConsulta} lat={inmuebleSel?.lat} lng={inmuebleSel?.lng} />
              </p>
            ) : (
              <p className="mt-2 text-[12.5px] text-[var(--text-3)]">Escribe una dirección o elige un inmueble para abrir Maps.</p>
            )}
          </div>
        </AltaSection>
      </AltaShell>
      <NuevoClientePanel
        open={altaClienteOpen}
        onOpenChange={setAltaClienteOpen}
        elevated
        nombreInicial={altaClienteNombre}
        ambito="desde-calendario"
        onCreado={(id, extra) => {
          setAgenda((prev) => {
            if (prev.some((c) => c.id === id)) return prev;
            return [...prev, { id, nombre: extra?.nombre ?? "Cliente", telefono: extra?.telefono ?? null }].sort((a, b) =>
              a.nombre.localeCompare(b.nombre)
            );
          });
          onCliente(id);
        }}
      />
      <NuevoClientePanel
        open={altaCliente2Open}
        onOpenChange={setAltaCliente2Open}
        elevated
        nombreInicial={altaCliente2Nombre}
        ambito="desde-calendario"
        onCreado={(id, extra) => {
          setAgenda((prev) => {
            if (prev.some((c) => c.id === id)) return prev;
            return [...prev, { id, nombre: extra?.nombre ?? "Cliente", telefono: extra?.telefono ?? null }].sort((a, b) =>
              a.nombre.localeCompare(b.nombre)
            );
          });
          if (id !== clienteId) onCliente2(id);
        }}
      />
    </>
  );
}
