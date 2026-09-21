"use client";

import { useEffect, useState } from "react";
import { Contact } from "lucide-react";
import { toast } from "sonner";
import {
  contactPickerDisponible,
  importarContactoTelefono,
  mostrarBotonImportarContacto,
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
  const [visible, setVisible] = useState(false);
  const [conAgenda, setConAgenda] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setVisible(mostrarBotonImportarContacto());
    setConAgenda(contactPickerDisponible());
  }, []);

  if (!visible) return null;

  const importar = async () => {
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
      toast.error(error instanceof Error ? error.message : "No se pudo importar el contacto.", {
        duration: 6000,
      });
    }
    setLoading(false);
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <button
        type="button"
        onClick={() => void importar()}
        disabled={loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[10px] border border-[var(--input)] bg-[var(--surface-soft)] px-3 py-2.5 text-[13px] font-medium text-[var(--text-2)] transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
        )}
      >
        <Contact className="h-4 w-4 shrink-0" strokeWidth={1.6} />
        {loading ? "Importando…" : conAgenda ? "Elegir de contactos del teléfono" : "Importar de contactos"}
      </button>
      {!conAgenda ? (
        <p className="text-[11.5px] leading-4 text-[var(--text-3)]">
          En iPhone: copia el contacto desde la app Contactos y pulsa este botón para pegarlo aquí.
        </p>
      ) : null}
    </div>
  );
}
