"use client";

import { useState } from "react";
import { Contact } from "lucide-react";
import { toast } from "sonner";
import { contactPickerDisponible, importarContactoTelefono, type ContactoImportado } from "@/lib/contacts/contact-picker";
import { cn } from "@/lib/utils";

export function BotonImportarContacto({
  onImport,
  className,
}: {
  onImport: (datos: ContactoImportado) => void;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  if (!contactPickerDisponible()) return null;

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
      toast.error(error instanceof Error ? error.message : "No se pudo importar el contacto.");
    }
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={() => void importar()}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-2 rounded-[10px] border border-[var(--input)] bg-[var(--surface-soft)] px-3 py-2 text-[13px] font-medium text-[var(--text-2)] transition-colors hover:border-accent hover:text-accent disabled:opacity-60",
        className
      )}
    >
      <Contact className="h-4 w-4 shrink-0" strokeWidth={1.6} />
      {loading ? "Abriendo agenda…" : "Elegir de contactos del teléfono"}
    </button>
  );
}
