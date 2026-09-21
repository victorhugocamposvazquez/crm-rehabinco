"use client";

import { useEffect, useState } from "react";
import { Contact, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  contactPickerDisponible,
  importarContactoTelefono,
  mostrarAyudaCompartirContacto,
  type ContactoImportado,
} from "@/lib/contacts/contact-picker";
import { cn } from "@/lib/utils";

export function BotonImportarContacto({
  onImport,
  className,
}: {
  onImport: (datos: ContactoImportado) => void;
  className?: string;
}) {
  const [conAgenda, setConAgenda] = useState(false);
  const [ayudaIos, setAyudaIos] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setConAgenda(contactPickerDisponible());
    setAyudaIos(mostrarAyudaCompartirContacto());
  }, []);

  if (!conAgenda && !ayudaIos) return null;

  const elegirDeAgenda = async () => {
    setLoading(true);
    try {
      const datos = await importarContactoTelefono();
      if (!datos) {
        setLoading(false);
        return;
      }
      if (!datos.nombre && !datos.telefono && !datos.email) {
        toast.error("El contacto no tenía nombre ni teléfono.");
        setLoading(false);
        return;
      }
      onImport(datos);
      toast.success("Contacto importado.");
    } catch (error) {
      if (error instanceof Error && /abort|cancel/i.test(error.name + error.message)) {
        setLoading(false);
        return;
      }
      toast.error(error instanceof Error ? error.message : "No se pudo abrir la agenda.", {
        duration: 7000,
      });
    }
    setLoading(false);
  };

  if (ayudaIos && !conAgenda) {
    return (
      <div
        className={cn(
          "rounded-[10px] border border-[var(--input)] bg-[var(--surface-soft)] px-3 py-3 text-[12.5px] text-[var(--text-2)]",
          className
        )}
      >
        <p className="flex items-center gap-2 font-medium text-[var(--text-1)]">
          <Share2 className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.6} />
          Importar desde Contactos (iPhone)
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 leading-5">
          <li>Abre la app <strong>Contactos</strong></li>
          <li>Elige un contacto → <strong>Compartir contacto</strong></li>
          <li>Selecciona <strong>CRM REHABINCO</strong></li>
        </ol>
        <p className="mt-2 text-[11.5px] text-[var(--text-3)]">
          iPhone no permite abrir la agenda dentro de la web; compartir es la única forma.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void elegirDeAgenda()}
      disabled={loading}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--input)] bg-[var(--surface-soft)] px-3 py-2.5 text-[13px] font-medium text-[var(--text-2)] transition-colors hover:border-accent hover:text-accent disabled:opacity-60",
        className
      )}
    >
      <Contact className="h-4 w-4 shrink-0" strokeWidth={1.6} />
      {loading ? "Abriendo agenda…" : "Elegir de la agenda del teléfono"}
    </button>
  );
}
