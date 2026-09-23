"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { nombreYApellido } from "@/lib/ui/tokens";
import { syncTareaDesdeCita } from "@/lib/tareas/sync-cita";
import { euros } from "@/lib/captacion/portales/modelo";
import type { AnuncioCaptacion } from "@/lib/captacion/portales/modelo";
import {
  PLANTILLAS_WHATSAPP,
  notasRecordatorioCaptacion,
  rellenarPlantilla,
  urlWhatsapp,
} from "@/lib/captacion/portales/contacto";

function mananaIso(): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 1);
  return fecha.toISOString().slice(0, 10);
}

export type HechoCaptacion = { id: string; tipo: string; texto: string; cuando: string };

const ETIQUETA_HECHO: Record<string, string> = {
  fase: "Seguimiento",
  nota: "Nota",
  asignacion: "Asignación",
  bajada: "Precio",
  captado: "Captado",
  detectado: "Entrada",
  retirado: "Retirado",
};

function etiquetaHecho(item: HechoCaptacion): string {
  const texto = item.texto.toLowerCase();
  if (texto.startsWith("whatsapp")) return "WhatsApp";
  if (texto.startsWith("recordatorio")) return "Recordatorio";
  if (texto.startsWith("llamada")) return "Llamada";
  return ETIQUETA_HECHO[item.tipo] ?? "Actividad";
}

export function AccionesContactoAnuncio({
  anuncio,
  hechos,
  onRegistrado,
}: {
  anuncio: AnuncioCaptacion;
  hechos: HechoCaptacion[];
  onRegistrado?: () => void;
}) {
  const { user } = useAuth();
  const telefono = anuncio.contacto_telefono?.trim() || "";
  const [modo, setModo] = useState<null | "recordatorio" | "whatsapp">(null);
  const [dia, setDia] = useState(mananaIso);
  const [hora, setHora] = useState("10:00");
  const [guardando, setGuardando] = useState(false);
  const [plantillaId, setPlantillaId] = useState(PLANTILLAS_WHATSAPP[0].id);

  const comercial = nombreYApellido(user?.nombre, user?.email) || "Rehabinco";
  const plantilla = PLANTILLAS_WHATSAPP.find((item) => item.id === plantillaId) ?? PLANTILLAS_WHATSAPP[0];
  const mensaje = rellenarPlantilla(plantilla.texto, {
    nombre: anuncio.contacto_nombre,
    comercial,
    titulo: anuncio.titulo,
    zona: anuncio.zona,
    municipio: anuncio.municipio,
  });
  const donde = [anuncio.zona, anuncio.municipio].filter(Boolean).join(", ");

  const crearRecordatorio = async () => {
    if (!user) return;
    const empieza = new Date(`${dia}T${hora}:00`);
    if (Number.isNaN(empieza.getTime())) {
      toast.error("Elige un día y una hora.");
      return;
    }
    const termina = new Date(empieza.getTime() + 30 * 60 * 1000);
    const quien = anuncio.contacto_nombre?.trim() || "el anunciante";
    const titulo = `Captación: llamar a ${quien}`;
    const notas = notasRecordatorioCaptacion({
      titulo: anuncio.titulo,
      zona: anuncio.zona,
      municipio: anuncio.municipio,
      precio: anuncio.precio != null ? euros(anuncio.precio, anuncio.operacion === "alquiler") : null,
      telefono,
      nombre: anuncio.contacto_nombre,
      url: anuncio.url,
    });
    setGuardando(true);
    const supabase = createClient();
    const { data: cita, error } = await supabase
      .from("citas")
      .insert({
        comercial_id: user.id,
        tipo: "recordatorio",
        titulo,
        empieza: empieza.toISOString(),
        termina: termina.toISOString(),
        propiedad_id: anuncio.propiedad_id,
        cliente_id: anuncio.cliente_id,
        lugar: donde || anuncio.direccion,
        notas,
      })
      .select("id, comercial_id, tipo, titulo, empieza, propiedad_id, cliente_id, estado, tarea_id")
      .single();
    if (error || !cita) {
      setGuardando(false);
      toast.error("No se ha podido crear el recordatorio.");
      return;
    }
    try {
      await syncTareaDesdeCita(supabase, cita, { creadoPor: user.id });
    } catch {
      setGuardando(false);
      toast.error("El recordatorio está en el calendario, pero no pasó a Tareas.");
      return;
    }
    await supabase.from("captacion_anuncios_actividad").insert({
      anuncio_id: anuncio.id,
      actor_id: user.id,
      tipo: "nota",
      detalle: `Recordatorio de llamada de captación el ${dia} a las ${hora}`,
    });
    setGuardando(false);
    setModo(null);
    onRegistrado?.();
    toast.success("Recordatorio en el calendario y en Tareas.");
  };

  const abrirWhatsapp = async () => {
    window.open(urlWhatsapp(telefono, mensaje), "_blank", "noopener,noreferrer");
    if (user) {
      const supabase = createClient();
      await supabase.from("captacion_anuncios_actividad").insert({
        anuncio_id: anuncio.id,
        actor_id: user.id,
        tipo: "nota",
        detalle: `WhatsApp · ${plantilla.nombre}`,
      });
      onRegistrado?.();
    }
    setModo(null);
  };

  const registrarLlamada = async () => {
    if (!user) return;
    const supabase = createClient();
    await supabase.from("captacion_anuncios_actividad").insert({
      anuncio_id: anuncio.id,
      actor_id: user.id,
      tipo: "nota",
      detalle: "Llamada desde captación",
    });
    onRegistrado?.();
  };

  const hechosOrdenados = [...hechos].reverse();

  return (
    <div className="border-b border-[var(--border-soft)] px-4 py-3">
      {telefono ? (
      <>
      <div className="text-[11px] uppercase tracking-[0.07em] text-[var(--label)]">Contacto</div>
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <a href={`tel:${telefono.replace(/\s/g, "")}`} className="font-mono text-[18px] font-semibold tracking-tight text-[var(--text)] no-underline">
          {telefono}
        </a>
        {anuncio.contacto_nombre ? <span className="truncate text-[13px] text-[var(--text-2)]">{anuncio.contacto_nombre}</span> : null}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        <a
          href={`tel:${telefono.replace(/\s/g, "")}`}
          onClick={() => void registrarLlamada()}
          className="flex h-9 items-center justify-center rounded-lg border border-[var(--input)] bg-white text-[12.5px] font-semibold no-underline"
        >
          Llamar
        </a>
        <button
          type="button"
          onClick={() => setModo(modo === "recordatorio" ? null : "recordatorio")}
          className="h-9 rounded-lg border text-[12.5px] font-semibold"
          style={{
            borderColor: modo === "recordatorio" ? "#0B7461" : "var(--input)",
            background: modo === "recordatorio" ? "#E7F3EF" : "white",
          }}
        >
          Recordatorio
        </button>
        <button
          type="button"
          onClick={() => setModo(modo === "whatsapp" ? null : "whatsapp")}
          className="h-9 rounded-lg text-[12.5px] font-semibold text-white"
          style={{ background: modo === "whatsapp" ? "#075E54" : "#128C7E" }}
        >
          WhatsApp
        </button>
      </div>

      {modo === "recordatorio" ? (
        <div className="mt-3 rounded-[10px] border border-[var(--border)] bg-[#F7F6F3] p-3">
          <p className="text-[12.5px] text-[var(--text-2)]">
            Se crea un recordatorio de captación en el calendario y una tarea, con el anuncio escrito en el inmueble. {anuncio.propiedad_id ? "El inmueble del CRM queda enlazado." : ""}
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="date"
              value={dia}
              onChange={(event) => setDia(event.target.value)}
              className="h-9 flex-1 rounded-lg border border-[var(--input)] bg-white px-2 text-[13px]"
            />
            <input
              type="time"
              value={hora}
              onChange={(event) => setHora(event.target.value)}
              className="h-9 w-[108px] rounded-lg border border-[var(--input)] bg-white px-2 text-[13px]"
            />
          </div>
          <button
            type="button"
            disabled={guardando}
            onClick={() => void crearRecordatorio()}
            className="mt-2 h-9 w-full rounded-lg bg-accent text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {guardando ? "Creando…" : "Crear recordatorio de llamada"}
          </button>
        </div>
      ) : null}

      {modo === "whatsapp" ? (
        <div className="mt-3 rounded-[10px] border border-[var(--border)] bg-[#F7F6F3] p-3">
          <div className="flex flex-wrap gap-1.5">
            {PLANTILLAS_WHATSAPP.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPlantillaId(item.id)}
                className="h-8 rounded-full border px-2.5 text-[12px] font-semibold"
                style={{
                  borderColor: item.id === plantillaId ? "#128C7E" : "var(--border)",
                  background: item.id === plantillaId ? "#E7F6F3" : "white",
                }}
              >
                {item.nombre}
              </button>
            ))}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-snug text-[var(--text)]">{mensaje}</p>
          <button
            type="button"
            onClick={abrirWhatsapp}
            className="mt-2 h-9 w-full rounded-lg bg-[#128C7E] text-[13px] font-semibold text-white"
          >
            Abrir WhatsApp
          </button>
        </div>
      ) : null}
      </>
      ) : null}

      <div className={telefono ? "mt-4" : ""}>
        <div className="text-[11px] uppercase tracking-[0.07em] text-[var(--label)]">Hecho</div>
        {hechosOrdenados.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-[var(--text-3)]">Todavía no hay llamadas, WhatsApp ni recordatorios.</p>
        ) : (
          <ol className="mt-2">
            {hechosOrdenados.map((item, indice) => (
              <li key={item.id} className="grid grid-cols-[16px_1fr] gap-2">
                <span className="flex flex-col items-center">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-accent" />
                  {indice < hechosOrdenados.length - 1 ? <span className="w-px flex-1 bg-[var(--border)]" /> : null}
                </span>
                <div className="pb-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] font-semibold text-accent">{etiquetaHecho(item)}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-3)]">{item.cuando}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-snug">{item.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
