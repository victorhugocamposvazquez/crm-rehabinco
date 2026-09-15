"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Sheet } from "@/components/ui/sheet";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { ZONAS_DEMANDA } from "@/lib/demandas/nueva";

export function NuevoClientePanel({
  open,
  onOpenChange,
  padreId,
  padreNombre,
  onCreado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  padreId?: string;
  padreNombre?: string;
  onCreado: (id: string) => void;
}) {
  const empresaAsociada = Boolean(padreId);
  const [tipoCliente, setTipoCliente] = useState<"particular" | "empresa">(empresaAsociada ? "empresa" : "particular");
  const [tipoDocumento, setTipoDocumento] = useState<"dni" | "nie" | "cif" | "vat">(empresaAsociada ? "cif" : "dni");
  const [nombre, setNombre] = useState("");
  const [documentoFiscal, setDocumentoFiscal] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipoCliente(padreId ? "empresa" : "particular");
    setTipoDocumento(padreId ? "cif" : "dni");
    setNombre("");
    setDocumentoFiscal("");
    setEmail("");
    setTelefono("");
    setDireccion("");
    setCodigoPostal("");
    setLocalidad("");
    setNotas("");
  }, [open, padreId]);

  const crear = async () => {
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sesión expirada.");
      return;
    }
    const tipoDoc =
      tipoCliente === "empresa" ? (tipoDocumento === "vat" ? "vat" : "cif") : tipoDocumento === "nie" ? "nie" : "dni";
    setSaving(true);
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        user_id: user.id,
        nombre: nombre.trim(),
        tipo_cliente: tipoCliente,
        cliente_padre_id: padreId || null,
        documento_fiscal: documentoFiscal.trim() || null,
        tipo_documento: documentoFiscal.trim() ? tipoDoc : null,
        email: email.trim() || null,
        telefono: telefono.trim() || null,
        direccion: direccion.trim() || null,
        codigo_postal: codigoPostal.trim() || null,
        localidad: localidad.trim() || null,
        notas: notas.trim() || null,
        activo: true,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("No se ha podido crear el cliente.");
      return;
    }
    toast.success(empresaAsociada ? "Empresa asociada creada." : "Cliente creado.");
    onOpenChange(false);
    onCreado(data.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} variant="side" side="right" className="min-[780px]:w-[min(52rem,90vw)]">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2.5 border-b border-[var(--border-soft)] px-5 py-3.5">
          <span className="flex-1 text-[11px] uppercase tracking-[0.08em] text-[var(--label)]">
            {empresaAsociada ? `Nueva empresa${padreNombre ? ` de ${padreNombre}` : ""}` : "Nuevo cliente"}
          </span>
          <button type="button" onClick={() => onOpenChange(false)} className="grid h-[34px] w-[34px] place-items-center rounded-lg text-[var(--text-2)]">
            ×
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 min-[780px]:grid min-[780px]:grid-cols-2 min-[780px]:items-start min-[780px]:gap-x-7 min-[780px]:gap-y-4">
          <div className="flex flex-col gap-4">
            {empresaAsociada ? null : (
              <section>
                <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Tipo</div>
                <div className="flex flex-wrap gap-1.5">
                  <ToggleChip
                    on={tipoCliente === "particular"}
                    onClick={() => {
                      setTipoCliente("particular");
                      setTipoDocumento("dni");
                    }}
                  >
                    Particular
                  </ToggleChip>
                  <ToggleChip
                    on={tipoCliente === "empresa"}
                    onClick={() => {
                      setTipoCliente("empresa");
                      setTipoDocumento("cif");
                    }}
                  >
                    Empresa
                  </ToggleChip>
                </div>
              </section>
            )}
            <label className="block text-[12px] font-semibold text-[var(--text-2)]">
              {tipoCliente === "empresa" ? "Razón social *" : "Nombre y apellidos *"}
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block text-[12px] font-semibold text-[var(--text-2)]">
                Teléfono
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
              </label>
              <label className="block text-[12px] font-semibold text-[var(--text-2)]">
                Email
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block text-[12px] font-semibold text-[var(--text-2)]">
                Documento
                <select
                  value={tipoDocumento}
                  onChange={(e) => setTipoDocumento(e.target.value as "dni" | "nie" | "cif" | "vat")}
                  className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[14px]"
                >
                  {tipoCliente === "empresa" ? (
                    <>
                      <option value="cif">CIF</option>
                      <option value="vat">VAT</option>
                    </>
                  ) : (
                    <>
                      <option value="dni">DNI</option>
                      <option value="nie">NIE</option>
                    </>
                  )}
                </select>
              </label>
              <label className="block text-[12px] font-semibold text-[var(--text-2)]">
                Número
                <input value={documentoFiscal} onChange={(e) => setDocumentoFiscal(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <label className="block text-[12px] font-semibold text-[var(--text-2)]">
              Dirección
              <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
            </label>
            <section>
              <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Localidad</div>
              <div className="flex flex-wrap gap-1.5">
                {ZONAS_DEMANDA.map((zona) => (
                  <ToggleChip key={zona} on={localidad === zona} onClick={() => setLocalidad(localidad === zona ? "" : zona)}>
                    {zona}
                  </ToggleChip>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                <input value={localidad} onChange={(e) => setLocalidad(e.target.value)} placeholder="Otra localidad" className="h-10 rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
                <input value={codigoPostal} onChange={(e) => setCodigoPostal(e.target.value)} placeholder="CP" className="h-10 rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
              </div>
            </section>
            <label className="block text-[12px] font-semibold text-[var(--text-2)]">
              Notas
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className="mt-1.5 w-full resize-none rounded-[9px] border border-[var(--input)] px-3 py-2 text-[14px]" />
            </label>
          </div>
        </div>
        <div className="flex gap-2 border-t border-[var(--border-soft)] px-5 py-3">
          <button type="button" disabled={saving} onClick={() => void crear()} className="h-10 flex-1 rounded-[9px] bg-accent text-[13.5px] font-semibold text-white disabled:opacity-60">
            {saving ? "Guardando…" : empresaAsociada ? "Crear empresa" : "Crear cliente"}
          </button>
          <button type="button" onClick={() => onOpenChange(false)} className="h-10 rounded-[9px] border border-[var(--input)] px-3.5 text-[13.5px] font-semibold">
            Cancelar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
