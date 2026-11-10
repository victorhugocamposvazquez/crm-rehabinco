"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FechaInput } from "@/components/ui/fecha-hora";
import { Label } from "@/components/ui/label";
import {
  ESTADO_CAPTACION_LABEL,
  ESTADOS_CAPTACION,
  parseEstadoCaptacion,
  type EstadoCaptacion,
} from "@/lib/captacion/estados";
import { detalleCambioEstado, ordenarActividad, type ActividadCaptacion } from "@/lib/captacion/actividad";
import { rutaNuevaVisitaDesdeProperty } from "@/lib/partes-visita";
import { rutaFincaPersistida } from "@/lib/catastro/explorer/history-ui";
import { Selector } from "@/components/ui/selector";
import { ClienteQuickSheet } from "@/components/clientes/ClienteQuickSheet";
import { FichaLink } from "@/components/crm/FichaPeek";
import { relacionUno } from "@/lib/citas/citas";
import { coincideTelefonoBusqueda } from "@/lib/ui/busqueda";
import { mensajeGuardado } from "@/lib/ui/mensaje-guardado";

type ClienteFinca = { id: string; nombre: string; telefono: string | null };

const ACTIVIDAD_LABEL: Record<string, string> = {
  estado: "Estado",
  nota: "Nota",
  llamada: "Llamada",
  tarea: "Tarea",
  asignacion: "Asignación",
  cita: "Cita",
  propiedad: "Propiedad",
  cliente: "Cliente",
};

function textoBusqueda(valor: string) {
  return valor.replace(/[%_\\,]/g, " ").replace(/\s+/g, " ").trim();
}

async function buscarClientes(consulta: string): Promise<ClienteFinca[]> {
  const nombre = textoBusqueda(consulta);
  const digitos = consulta.replace(/\D/g, "");
  if (nombre.length < 2 && digitos.length < 3) return [];
  const supabase = createClient();
  const porNombre =
    nombre.length >= 2
      ? supabase.from("clientes").select("id, nombre, telefono").eq("activo", true).ilike("nombre", `%${nombre}%`).limit(6)
      : Promise.resolve({ data: [] as ClienteFinca[] });
  const porTelefono =
    digitos.length >= 3
      ? supabase
          .from("clientes")
          .select("id, nombre, telefono")
          .eq("activo", true)
          .ilike("telefono", `%${digitos.slice(0, 3)}%`)
          .limit(30)
      : Promise.resolve({ data: [] as ClienteFinca[] });
  const [nombres, telefonos] = await Promise.all([porNombre, porTelefono]);
  const vistos = new Map<string, ClienteFinca>();
  for (const fila of nombres.data ?? []) vistos.set(fila.id, fila);
  for (const fila of telefonos.data ?? []) {
    if (coincideTelefonoBusqueda(fila.telefono, consulta)) vistos.set(fila.id, fila);
  }
  return [...vistos.values()].slice(0, 6);
}

export function PipelineFinca({
  fincaReference,
  propertyId,
}: {
  fincaReference: string;
  propertyId?: string | null;
}) {
  const [estado, setEstado] = useState<EstadoCaptacion>("nueva");
  const [proximaAccion, setProximaAccion] = useState("");
  const [proximaAccionEn, setProximaAccionEn] = useState("");
  const [actividad, setActividad] = useState<ActividadCaptacion[]>([]);
  const [nota, setNota] = useState("");
  const [tarea, setTarea] = useState("");
  const [tareaVence, setTareaVence] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cliente, setCliente] = useState<ClienteFinca | null>(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [qCliente, setQCliente] = useState("");
  const [sugeridos, setSugeridos] = useState<ClienteFinca[]>([]);
  const [quickCliente, setQuickCliente] = useState(false);

  const cargar = useCallback(() => {
    const supabase = createClient();
    const pipeline = supabase
      .from("catastro_explorer_pipeline")
      .select("estado, proxima_accion, proxima_accion_en, cliente_id")
      .eq("finca_reference", fincaReference)
      .maybeSingle();
    const actividadQ = supabase
      .from("catastro_explorer_actividad")
      .select("id, finca_reference, actor_id, tipo, detalle, payload, created_at")
      .eq("finca_reference", fincaReference)
      .order("created_at", { ascending: false })
      .limit(30);
    const propiedad = propertyId
      ? supabase
          .from("propiedades")
          .select("ofertante_id, clientes:ofertante_id(id, nombre, telefono)")
          .eq("id", propertyId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });
    void Promise.all([pipeline, actividadQ, propiedad]).then(async ([pipe, act, prop]) => {
      let fila = pipe.error ? null : pipe.data;
      if (pipe.error && /cliente_id/.test(pipe.error.message)) {
        const respaldo = await supabase
          .from("catastro_explorer_pipeline")
          .select("estado, proxima_accion, proxima_accion_en")
          .eq("finca_reference", fincaReference)
          .maybeSingle();
        fila = respaldo.data ? { ...respaldo.data, cliente_id: null } : null;
      }
      if (fila) {
        setEstado(parseEstadoCaptacion(fila.estado));
        setProximaAccion(fila.proxima_accion ?? "");
        setProximaAccionEn(fila.proxima_accion_en ?? "");
      }
      const ofertante = relacionUno(
        (prop.data?.clientes ?? null) as ClienteFinca | ClienteFinca[] | null
      );
      const clienteId = fila?.cliente_id ?? null;
      if (clienteId && clienteId !== ofertante?.id) {
        const { data } = await supabase
          .from("clientes")
          .select("id, nombre, telefono")
          .eq("id", clienteId)
          .maybeSingle();
        setCliente(data ?? ofertante);
      } else {
        setCliente(ofertante);
      }
      setActividad(
        ordenarActividad(
          (act.data ?? []).map((row) => ({
            id: row.id,
            fincaReference: row.finca_reference,
            actorId: row.actor_id,
            tipo: row.tipo,
            detalle: row.detalle,
            payload: (row.payload ?? {}) as Record<string, unknown>,
            createdAt: row.created_at,
          }))
        )
      );
    });
  }, [fincaReference, propertyId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarEstado = async (siguiente: EstadoCaptacion, fecha = proximaAccionEn) => {
    setGuardando(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("catastro_explorer_pipeline").upsert(
      {
        finca_reference: fincaReference,
        estado: siguiente,
        proxima_accion: proximaAccion || null,
        proxima_accion_en: fecha || null,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "finca_reference" }
    );
    if (error) {
      toast.error("No se ha podido guardar el estado.");
      setGuardando(false);
      return;
    }
    if (siguiente !== estado) {
      await supabase.from("catastro_explorer_actividad").insert({
        finca_reference: fincaReference,
        actor_id: user?.id ?? null,
        tipo: "estado",
        detalle: detalleCambioEstado(estado, siguiente),
        payload: { de: estado, a: siguiente },
      });
    }
    setEstado(siguiente);
    setGuardando(false);
    toast.success("Captación actualizada.");
    cargar();
  };

  const guardarCliente = async (siguiente: ClienteFinca | null) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("catastro_explorer_pipeline").upsert(
      {
        finca_reference: fincaReference,
        cliente_id: siguiente?.id ?? null,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "finca_reference" }
    );
    const aviso = mensajeGuardado(error, "No se ha podido guardar el cliente.");
    if (aviso) {
      toast.error(aviso);
      return;
    }
    if (propertyId) {
      const { error: errorPropiedad } = await supabase
        .from("propiedades")
        .update({ ofertante_id: siguiente?.id ?? null })
        .eq("id", propertyId);
      if (errorPropiedad) toast.message("El cliente queda en la finca. La propiedad no se ha actualizado.");
    }
    await supabase.from("catastro_explorer_actividad").insert({
      finca_reference: fincaReference,
      actor_id: user?.id ?? null,
      tipo: "cliente",
      detalle: siguiente ? siguiente.nombre : "Cliente quitado",
      payload: { cliente_id: siguiente?.id ?? null },
    });
    setCliente(siguiente);
    setBuscandoCliente(false);
    setQCliente("");
    setSugeridos([]);
    toast.success(siguiente ? "Cliente guardado." : "Cliente quitado.");
    cargar();
  };

  useEffect(() => {
    if (!buscandoCliente && cliente) return;
    const q = qCliente.trim();
    if (q.length < 2) {
      setSugeridos([]);
      return;
    }
    let vivo = true;
    const timer = window.setTimeout(() => {
      void buscarClientes(q).then((filas) => {
        if (vivo) setSugeridos(filas);
      });
    }, 200);
    return () => {
      vivo = false;
      window.clearTimeout(timer);
    };
  }, [qCliente, buscandoCliente, cliente]);

  const guardarNota = async () => {
    const texto = nota.trim();
    if (!texto) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("catastro_explorer_actividad").insert({
      finca_reference: fincaReference,
      actor_id: user?.id ?? null,
      tipo: "llamada",
      detalle: texto,
    });
    if (error) {
      toast.error("No se ha podido guardar la nota.");
      return;
    }
    setNota("");
    toast.success("Anotado.");
    cargar();
  };

  const crearTarea = async () => {
    const titulo = tarea.trim();
    if (!titulo) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("tareas").insert({
      comercial_id: user.id,
      titulo,
      vence: tareaVence || null,
      finca_reference: fincaReference,
      propiedad_id: propertyId ?? null,
      cliente_id: cliente?.id ?? null,
    });
    if (error) {
      toast.error("No se ha podido crear la tarea.");
      return;
    }
    await supabase.from("catastro_explorer_actividad").insert({
      finca_reference: fincaReference,
      actor_id: user.id,
      tipo: "tarea",
      detalle: titulo,
    });
    setTarea("");
    toast.success("Tarea creada.");
    cargar();
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="text-[12px] font-medium text-[var(--text-3)]">Captación</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="estado-captacion">Estado</Label>
          <Selector
            id="estado-captacion"
            value={estado}
            disabled={guardando}
            onChange={(e) => void guardarEstado(parseEstadoCaptacion(e.target.value))}
            className="flex h-10 w-full rounded-lg border border-border bg-[var(--surface)] px-3 text-sm"
          >
            {ESTADOS_CAPTACION.map((item) => (
              <option key={item} value={item}>
                {ESTADO_CAPTACION_LABEL[item]}
              </option>
            ))}
          </Selector>
        </div>
        <div className="space-y-1">
          <Label htmlFor="proxima-en">Próxima acción</Label>
          <FechaInput
            id="proxima-en"
            value={proximaAccionEn}
            onChange={(fecha) => {
              setProximaAccionEn(fecha);
              void guardarEstado(estado, fecha);
            }}
          />
        </div>
      </div>
      <Input
        className="mt-3"
        placeholder="Qué hay que hacer (llamar, pasar, recoger llaves…)"
        value={proximaAccion}
        onChange={(e) => setProximaAccion(e.target.value)}
        onBlur={() => void guardarEstado(estado)}
      />
      {propertyId ? (
        <Button asChild size="sm" className="mt-3">
          <a href={rutaNuevaVisitaDesdeProperty(propertyId)}>Hacer parte de visita</a>
        </Button>
      ) : (
        <p className="mt-3 text-xs text-[var(--text-2)]">
          Crea la propiedad cuando quieras documentar la visita.{" "}
          <a className="font-medium text-foreground hover:underline" href={rutaFincaPersistida(fincaReference)}>
            Ver ficha
          </a>
        </p>
      )}

      <div className="mt-4">
        <Label htmlFor="cliente-finca">Cliente</Label>
        {cliente && !buscandoCliente ? (
          <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <div className="min-w-0">
              <FichaLink tipo="cliente" id={cliente.id} className="block truncate text-sm">
                {cliente.nombre}
              </FichaLink>
              {cliente.telefono ? (
                <a href={`tel:${cliente.telefono.replace(/\s/g, "")}`} className="font-mono text-xs text-[var(--text-2)]">
                  {cliente.telefono}
                </a>
              ) : (
                <p className="text-xs text-[var(--text-3)]">Sin teléfono</p>
              )}
            </div>
            <div className="flex shrink-0 gap-3">
              <button
                type="button"
                className="text-xs font-medium text-foreground hover:underline"
                onClick={() => {
                  setBuscandoCliente(true);
                  setQCliente("");
                }}
              >
                Cambiar
              </button>
              <button type="button" className="text-xs font-medium text-[var(--text-2)] hover:underline" onClick={() => void guardarCliente(null)}>
                Quitar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1">
            <Input
              id="cliente-finca"
              value={qCliente}
              onChange={(e) => setQCliente(e.target.value)}
              onKeyDown={(evento) => {
                if (evento.key !== "Enter" || sugeridos.length !== 1) return;
                evento.preventDefault();
                void guardarCliente(sugeridos[0]);
              }}
              placeholder="Nombre o teléfono"
              autoComplete="off"
            />
            {qCliente.trim().length >= 2 ? (
              <ul className="mt-2 overflow-hidden rounded-lg border border-border">
                {sugeridos.map((persona) => (
                  <li key={persona.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-[var(--surface-soft)]"
                      onClick={() => void guardarCliente(persona)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{persona.nombre}</span>
                        {persona.telefono ? (
                          <span className="mt-0.5 block font-mono text-xs text-[var(--text-2)]">{persona.telefono}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs font-semibold">Elegir</span>
                    </button>
                  </li>
                ))}
                {sugeridos.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-[var(--text-2)]">Sin coincidencias en la agenda.</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-1.5 text-xs text-[var(--text-3)]">Busca en la agenda o crea el contacto de esta finca.</p>
            )}
            <div className="mt-2 flex flex-wrap gap-3">
              <button type="button" className="text-xs font-medium text-foreground hover:underline" onClick={() => setQuickCliente(true)}>
                Crear cliente
              </button>
              {cliente ? (
                <button
                  type="button"
                  className="text-xs font-medium text-[var(--text-2)] hover:underline"
                  onClick={() => {
                    setBuscandoCliente(false);
                    setQCliente("");
                    setSugeridos([]);
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>
        )}
        <ClienteQuickSheet
          open={quickCliente}
          onOpenChange={setQuickCliente}
          nombreInicial={qCliente.trim()}
          onSuccess={(creado) => {
            void guardarCliente({
              id: creado.id,
              nombre: creado.nombre,
              telefono: creado.telefono ?? null,
            });
          }}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Anotar llamada / nota</Label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            placeholder="Hablé con el portero, 3º izda, teléfono…"
          />
          <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => void guardarNota()}>
            Guardar nota
          </Button>
        </div>
        <div>
          <Label>Tarea de seguimiento</Label>
          <Input className="mt-1" value={tarea} onChange={(e) => setTarea(e.target.value)} placeholder="Llamar el jueves" />
          <FechaInput className="mt-2" value={tareaVence} onChange={setTareaVence} />
          <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => void crearTarea()}>
            Crear tarea
          </Button>
        </div>
      </div>

      <ol className="mt-5 space-y-2">
        {actividad.map((item) => (
          <li key={item.id} className="rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-sm">
            <p className="font-medium text-foreground">{item.detalle || item.tipo}</p>
            <p className="text-[11px] text-[var(--text-3)]">
              {new Date(item.createdAt).toLocaleString("es-ES")} · {ACTIVIDAD_LABEL[item.tipo] ?? item.tipo}
            </p>
          </li>
        ))}
        {actividad.length === 0 ? (
          <li className="text-sm text-[var(--text-3)]">Aún no hay actividad en esta finca.</li>
        ) : null}
      </ol>
    </section>
  );
}
