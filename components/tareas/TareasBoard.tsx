"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, Plus } from "lucide-react";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { COLUMNAS_TAREA, type ColumnaTarea } from "@/lib/tareas/tareas";
import { nombreYApellido } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export type PersonaTarjeta = { id: string; nombre: string; color: string | null; email?: string | null };

export type TareaTarjeta = {
  id: string;
  titulo: string;
  col: ColumnaTarea;
  venceLabel: string;
  hora?: string | null;
  vencida?: boolean;
  hecha: boolean;
  link?: string | null;
  creador: PersonaTarjeta;
  asignado: PersonaTarjeta;
};

export function AvataresTarea({
  creador,
  asignado,
  size = 22,
}: {
  creador: PersonaTarjeta;
  asignado: PersonaTarjeta;
  size?: number;
}) {
  const delegada = asignado.id !== creador.id;
  const nombreCreador = nombreYApellido(creador.nombre, creador.email);
  const nombreAsignado = nombreYApellido(asignado.nombre, asignado.email);
  const etiqueta = delegada && nombreAsignado ? `${nombreCreador} → ${nombreAsignado}` : nombreCreador;
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <AvatarComercial
        nombre={creador.nombre}
        email={creador.email}
        color={creador.color}
        size={size}
        title={`Creada por ${nombreCreador || creador.nombre}`}
      />
      {delegada ? (
        <AvatarComercial
          className="-ml-1.5 ring-2 ring-white"
          nombre={asignado.nombre}
          email={asignado.email}
          color={asignado.color}
          size={size}
          title={`Asignada a ${nombreAsignado || asignado.nombre}`}
        />
      ) : null}
      {etiqueta ? (
        <span className="min-w-0 truncate text-[11.5px] text-[var(--text-2)]" title={etiqueta}>
          {etiqueta}
        </span>
      ) : null}
    </span>
  );
}

function CampoTituloTarea({
  valor,
  placeholder,
  onChange,
  onConfirmar,
  onCancelar,
}: {
  valor: string;
  placeholder?: string;
  onChange: (valor: string) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <div data-titulo-tarea className="flex items-center gap-1.5">
      <input
        autoFocus
        enterKeyHint="done"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onConfirmar();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancelar();
          }
        }}
        onBlur={() => {
          window.setTimeout(() => onConfirmar(), 80);
        }}
        placeholder={placeholder}
        className="h-10 min-w-0 flex-1 rounded-[11px] border border-accent bg-white px-3 text-[13.5px] outline-none"
      />
      <button
        type="button"
        aria-label="Aceptar"
        onPointerDown={(e) => e.preventDefault()}
        onClick={onConfirmar}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-accent text-white"
      >
        <Check size={16} strokeWidth={2.8} />
      </button>
    </div>
  );
}

export function TareasBoard({
  tareas,
  onMover,
  onToggle,
  onAbrir,
  onCrearEnColumna,
  onRenombrar,
}: {
  tareas: TareaTarjeta[];
  onMover: (id: string, col: ColumnaTarea) => void;
  onToggle: (id: string) => void;
  onAbrir: (id: string) => void;
  onCrearEnColumna: (col: ColumnaTarea, titulo: string) => void;
  onRenombrar: (id: string, titulo: string) => void;
}) {
  const [over, setOver] = useState<ColumnaTarea | null>(null);
  const [nuevaCol, setNuevaCol] = useState<ColumnaTarea | null>(null);
  const [textoCol, setTextoCol] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState("");
  const draggingRef = useRef(false);
  const hechoRef = useRef(false);
  const originalRef = useRef("");
  const estadoRef = useRef({ nuevaCol, textoCol, editId, editTexto });
  const accRef = useRef({ onCrearEnColumna, onRenombrar });
  estadoRef.current = { nuevaCol, textoCol, editId, editTexto };
  accRef.current = { onCrearEnColumna, onRenombrar };

  const cerrarCampos = () => {
    setNuevaCol(null);
    setTextoCol("");
    setEditId(null);
    setEditTexto("");
  };

  const confirmarNueva = (col: ColumnaTarea) => {
    if (hechoRef.current) return;
    hechoRef.current = true;
    const titulo = estadoRef.current.textoCol.trim();
    cerrarCampos();
    if (titulo) accRef.current.onCrearEnColumna(col, titulo);
  };

  const confirmarEdicion = () => {
    if (hechoRef.current) return;
    const { editId: id, editTexto: texto } = estadoRef.current;
    if (!id) return;
    hechoRef.current = true;
    const limpio = texto.trim();
    cerrarCampos();
    if (limpio && limpio !== originalRef.current) accRef.current.onRenombrar(id, limpio);
  };

  const cancelar = () => {
    if (hechoRef.current) return;
    hechoRef.current = true;
    cerrarCampos();
  };

  useEffect(() => {
    if (!nuevaCol && !editId) return;
    hechoRef.current = false;
    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest("[data-titulo-tarea]")) return;
      if (estadoRef.current.nuevaCol) confirmarNueva(estadoRef.current.nuevaCol);
      else confirmarEdicion();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [nuevaCol, editId]);

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-2.5">
      {COLUMNAS_TAREA.map((col) => {
        const items = tareas.filter((t) => t.col === col.id);
        const hot = over === col.id;
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.id);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (id) onMover(id, col.id);
              setOver(null);
            }}
            className="min-h-[260px] w-[82vw] shrink-0 rounded-[14px] p-2.5 min-[820px]:w-[290px]"
            style={{
              background: hot ? "#E8F3EF" : "#F4F3EF",
              border: `1px solid ${hot ? "#0B7461" : "transparent"}`,
            }}
          >
            <div className="mb-2.5 flex items-center gap-2 px-1 text-[13px]">
              <span className="h-2 w-2 rounded-full" style={{ background: col.dot }} />
              <strong className="font-semibold">{col.label}</strong>
              <span className="text-[12px] text-[var(--text-3)]">{items.length}</span>
              <span className="flex-1" />
              {col.hint ? <span className="text-[11.5px] text-[var(--text-3)]">{col.hint}</span> : null}
              <button
                type="button"
                aria-label={`Nueva tarea en ${col.label}`}
                onClick={() => {
                  setEditId(null);
                  setNuevaCol(col.id);
                  setTextoCol("");
                  hechoRef.current = false;
                }}
                className="grid h-7 w-7 place-items-center rounded-[7px] text-accent hover:bg-white"
              >
                <Plus size={14} strokeWidth={2.6} />
              </button>
            </div>
            {items.map((t) =>
              editId === t.id ? (
                <div key={t.id} className="mb-2">
                  <CampoTituloTarea
                    valor={editTexto}
                    onChange={setEditTexto}
                    onConfirmar={confirmarEdicion}
                    onCancelar={cancelar}
                  />
                </div>
              ) : (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => {
                    draggingRef.current = true;
                    e.dataTransfer.setData("text/plain", t.id);
                  }}
                  onDragEnd={() => {
                    window.setTimeout(() => {
                      draggingRef.current = false;
                    }, 0);
                  }}
                  onClick={() => {
                    if (draggingRef.current) {
                      draggingRef.current = false;
                      return;
                    }
                    onAbrir(t.id);
                  }}
                  className={cn("mb-2 cursor-grab rounded-[11px] border border-border bg-white px-3 py-2.5", t.hecha && "opacity-55")}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      aria-label="Hecha"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle(t.id);
                      }}
                      className="mt-0.5 h-[17px] w-[17px] shrink-0 rounded-[5px] border-[1.5px]"
                      style={{
                        borderColor: t.hecha ? "#0B7461" : "#CFCBC2",
                        background: t.hecha ? "#0B7461" : "#fff",
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNuevaCol(null);
                        setEditId(t.id);
                        setEditTexto(t.titulo);
                        originalRef.current = t.titulo;
                        hechoRef.current = false;
                      }}
                      className={cn(
                        "min-w-0 flex-1 text-left text-[13.5px] font-medium leading-snug",
                        t.hecha && "line-through"
                      )}
                    >
                      {t.titulo}
                    </button>
                  </div>
                  {t.link ? (
                    <div className="ml-[25px] mt-2 w-fit max-w-full truncate rounded-md bg-accent-soft px-1.5 py-0.5 text-[11.5px] text-accent">
                      {t.link}
                    </div>
                  ) : null}
                  <div className="ml-[25px] mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-md px-1.5 py-0.5 font-mono text-[11.5px] font-medium tabular-nums"
                      style={{
                        color: t.hecha ? "#8A938F" : t.vencida ? "#A33B2A" : t.venceLabel === "Hoy" ? "#7A5A10" : "#5D6B67",
                        background: t.hecha ? "#F4F3EF" : t.vencida ? "#FBEAE5" : t.venceLabel === "Hoy" ? "#FBF0D8" : "#F4F3EF",
                      }}
                    >
                      {t.venceLabel}
                    </span>
                    {t.hora ? (
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-2)]">
                        <CalendarDays size={12} />
                        {t.hora.slice(0, 5)}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1" />
                    <AvataresTarea creador={t.creador} asignado={t.asignado} />
                  </div>
                </div>
              )
            )}
            {nuevaCol === col.id ? (
              <div className="mb-2">
                <CampoTituloTarea
                  valor={textoCol}
                  placeholder="Nueva tarea…"
                  onChange={setTextoCol}
                  onConfirmar={() => confirmarNueva(col.id)}
                  onCancelar={cancelar}
                />
              </div>
            ) : null}
            {items.length === 0 && nuevaCol !== col.id ? (
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setNuevaCol(col.id);
                  setTextoCol("");
                  hechoRef.current = false;
                }}
                className="w-full rounded-[10px] border border-dashed border-[var(--input)] px-2.5 py-4 text-center text-[12.5px] text-[var(--text-3)] hover:border-accent hover:text-accent"
              >
                + Añadir tarea
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
