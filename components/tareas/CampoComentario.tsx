"use client";

import { useEffect, useRef, useState } from "react";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import {
  candidatosMencion,
  extraerMenciones,
  insertarMencion,
  partesConMenciones,
  type PersonaMencion,
} from "@/lib/tareas/menciones";

export function TextoConMenciones({ texto, equipo }: { texto: string; equipo: PersonaMencion[] }) {
  return (
    <span>
      {partesConMenciones(texto, equipo).map((parte, i) =>
        parte.mencion ? (
          <span key={`${parte.texto}-${i}`} className="font-semibold text-accent">
            {parte.texto}
          </span>
        ) : (
          <span key={`t-${i}`}>{parte.texto}</span>
        )
      )}
    </span>
  );
}

export function CampoComentario({
  equipo,
  onEnviar,
}: {
  equipo: PersonaMencion[];
  onEnviar: (texto: string, mencionados: string[]) => void;
}) {
  const [texto, setTexto] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const menu = candidatosMencion(texto, cursor, equipo);

  useEffect(() => {
    const nodo = inputRef.current;
    if (!nodo) return;
    const sync = () => setCursor(nodo.selectionStart ?? nodo.value.length);
    nodo.addEventListener("click", sync);
    nodo.addEventListener("keyup", sync);
    return () => {
      nodo.removeEventListener("click", sync);
      nodo.removeEventListener("keyup", sync);
    };
  }, []);

  const enviar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    onEnviar(
      limpio,
      extraerMenciones(limpio, equipo).map((p) => p.id)
    );
    setTexto("");
  };

  const elegir = (persona: PersonaMencion) => {
    if (!menu) return;
    const next = insertarMencion(texto, menu.start, cursor, persona.nombre);
    setTexto(next.texto);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(next.cursor, next.cursor);
      setCursor(next.cursor);
    });
  };

  return (
    <div className="relative mt-2">
      {menu && menu.items.length > 0 ? (
        <ul className="absolute bottom-full mb-1 max-h-40 w-full overflow-auto rounded-[10px] border border-border bg-white p-1 shadow-[0_10px_24px_rgba(19,28,26,.12)]">
          {menu.items.map((persona) => (
            <li key={persona.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(persona);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-accent-soft"
              >
                <AvatarComercial nombre={persona.nombre} color={persona.color} size={22} />
                {persona.nombre}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setCursor(e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !menu?.items.length) {
              e.preventDefault();
              enviar();
            }
            if (e.key === "Enter" && menu?.items[0]) {
              e.preventDefault();
              elegir(menu.items[0]);
            }
          }}
          placeholder="Escribe un comentario… Usa @ para mencionar"
          className="h-[38px] min-w-0 flex-1 rounded-[9px] border border-[var(--input)] px-3 text-[13.5px] outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={enviar}
          className="h-[38px] rounded-[9px] border border-[var(--input)] bg-white px-3 text-[13px] font-semibold hover:border-accent hover:text-accent"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
