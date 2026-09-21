"use client";

import { useEffect, useState } from "react";
import { Contact } from "lucide-react";
import { toast } from "sonner";
import {
  contactPickerDisponible,
  esIos,
  importarContactoTelefono,
  mostrarBotonAgenda,
  type ContactoImportado,
} from "@/lib/contacts/contact-picker";
import { cn } from "@/lib/utils";

export function BotonImportarContacto({
  onImport,
  onIosFocusCampo,
  className,
}: {
  onImport: (datos: ContactoImportado) => void;
  /** En iPhone: enfoca el campo Nombre para que Safari muestre AutoFill Contact. */
  onIosFocusCampo?: () => void;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [conPicker, setConPicker] = useState(false);
  const [ios, setIos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pistaIos, setPistaIos] = useState(false);

  useEffect(() => {
    setVisible(mostrarBotonAgenda());
    setConPicker(contactPickerDisponible());
    setIos(esIos());
  }, []);

  if (!visible) return null;

  const elegirDeAgenda = async () => {
    setLoading(true);
    try {
      if (conPicker) {
        const datos = await importarContactoTelefono();
        if (datos && (datos.nombre || datos.telefono || datos.email)) {
          onImport(datos);
          toast.success("Contacto importado.");
          setLoading(false);
          return;
        }
      }
    } catch (error) {
      if (!(error instanceof Error && /abort|cancel|InvalidState/i.test(error.name + error.message))) {
        if (!ios) {
          toast.error(error instanceof Error ? error.message : "No se pudo abrir la agenda.");
          setLoading(false);
          return;
        }
      }
    }

    if (ios) {
      setPistaIos(true);
      onIosFocusCampo?.();
      setLoading(false);
      return;
    }

    toast.error("Tu navegador no permite abrir la agenda. Prueba Chrome en Android.");
    setLoading(false);
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <button
        type="button"
        onClick={() => void elegirDeAgenda()}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--input)] bg-[var(--surface-soft)] px-3 py-2.5 text-[13px] font-medium text-[var(--text-2)] transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
      >
        <Contact className="h-4 w-4 shrink-0" strokeWidth={1.6} />
        {loading ? "Abriendo agenda…" : "Elegir de la agenda del teléfono"}
      </button>
      {pistaIos ? (
        <p className="text-[12px] leading-4 text-accent">
          Encima del teclado pulsa <strong>AutoFill Contact</strong> y luego <strong>Otro contacto</strong> para
          abrir tu agenda.
        </p>
      ) : ios && !conPicker ? (
        <p className="text-[11.5px] leading-4 text-[var(--text-3)]">
          iPhone abre la agenda desde el teclado: AutoFill Contact → Otro contacto.
        </p>
      ) : null}
    </div>
  );
}
