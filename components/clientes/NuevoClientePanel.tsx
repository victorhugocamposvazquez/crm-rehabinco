"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AltaField, AltaSection, AltaShell, altaControl } from "@/components/ui/alta-form";
import { BuscadorLocalidad } from "@/components/geo/BuscadorLocalidad";
import { altaCamposVacios, leerAltaBorrador } from "@/lib/ui/alta-borrador";
import { useAltaBorrador } from "@/lib/ui/use-alta-borrador";

type ClienteAltaSnap = {
  tipoCliente: "particular" | "empresa";
  tipoDocumento: "dni" | "nie" | "cif" | "vat";
  nombre: string;
  documentoFiscal: string;
  email: string;
  telefono: string;
  direccion: string;
  codigoPostal: string;
  localidad: string;
  notas: string;
};

function clienteAltaVacia(s: ClienteAltaSnap) {
  return altaCamposVacios(s.nombre, s.documentoFiscal, s.email, s.telefono, s.direccion, s.codigoPostal, s.localidad, s.notas);
}

export function NuevoClientePanel({
  open,
  onOpenChange,
  padreId,
  padreNombre,
  onCreado,
  elevated = false,
  nombreInicial,
  ambito: ambitoProp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  padreId?: string;
  padreNombre?: string;
  onCreado: (id: string, extra?: { nombre: string; telefono: string | null }) => void;
  elevated?: boolean;
  nombreInicial?: string;
  ambito?: string;
}) {
  const empresaAsociada = Boolean(padreId);
  const ambito = ambitoProp ?? padreId ?? "libre";
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

  const snapshot = useMemo<ClienteAltaSnap>(
    () => ({ tipoCliente, tipoDocumento, nombre, documentoFiscal, email, telefono, direccion, codigoPostal, localidad, notas }),
    [tipoCliente, tipoDocumento, nombre, documentoFiscal, email, telefono, direccion, codigoPostal, localidad, notas]
  );
  const altaBorrador = useAltaBorrador({ tipo: "cliente", ambito, open, snapshot, estaVacio: clienteAltaVacia });

  const vaciar = () => {
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
  };

  useEffect(() => {
    if (!open) return;
    const guardado = leerAltaBorrador<ClienteAltaSnap>("cliente", ambito);
    if (guardado && !clienteAltaVacia(guardado.data)) {
      const d = guardado.data;
      setTipoCliente(padreId ? "empresa" : d.tipoCliente);
      setTipoDocumento(d.tipoDocumento);
      setNombre(d.nombre);
      setDocumentoFiscal(d.documentoFiscal);
      setEmail(d.email);
      setTelefono(d.telefono);
      setDireccion(d.direccion);
      setCodigoPostal(d.codigoPostal);
      setLocalidad(d.localidad);
      setNotas(d.notas);
    } else {
      vaciar();
      if (nombreInicial?.trim()) setNombre(nombreInicial.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, padreId, nombreInicial]);

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
    altaBorrador.consumir();
    onOpenChange(false);
    onCreado(data.id, { nombre: nombre.trim(), telefono: telefono.trim() || null });
  };

  return (
    <AltaShell
      open={open}
      onOpenChange={onOpenChange}
      elevated={elevated}
      title={empresaAsociada ? "Nueva empresa" : "Nuevo cliente"}
      hint={
        empresaAsociada
          ? `Se asocia a ${padreNombre ?? "este particular"} para facturar a su nombre.`
          : "La misma ficha que en Clientes: particular o empresa, contacto, documento y zona."
      }
      primaryLabel={empresaAsociada ? "Crear empresa" : "Crear cliente"}
      saving={saving}
      disablePrimary={!nombre.trim()}
      onSubmit={crear}
      borrador={{
        activo: altaBorrador.hayBorrador,
        guardadoEn: altaBorrador.guardadoEn,
        onEliminar: () => {
          altaBorrador.descartar();
          vaciar();
          toast.success("Borrador eliminado.");
        },
      }}
    >
      <AltaSection title="Quién" hint={empresaAsociada ? "Razón social de la empresa asociada." : "Particular o empresa. El nombre es lo único imprescindible."}>
        <div className="flex flex-col gap-5">
          {empresaAsociada ? null : (
            <div className="flex flex-wrap gap-2">
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
          )}
          <AltaField label={tipoCliente === "empresa" ? "Razón social" : "Nombre y apellidos"}>
            <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} className={altaControl} />
          </AltaField>
        </div>
      </AltaSection>

      <AltaSection title="Contacto" hint="El teléfono es lo que más se usa en captación y visitas.">
        <div className="flex flex-col gap-5">
          <AltaField label="Teléfono" optional>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="600 000 000" className={altaControl} />
          </AltaField>
          <AltaField label="Email" optional>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={altaControl} />
          </AltaField>
        </div>
      </AltaSection>

      <AltaSection title="Documento" hint="Si no lo tienes ahora, déjalo vacío.">
        <div className="grid grid-cols-2 gap-3">
          <AltaField label="Tipo" optional>
            <select
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value as "dni" | "nie" | "cif" | "vat")}
              className={altaControl}
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
          </AltaField>
          <AltaField label="Número" optional>
            <input value={documentoFiscal} onChange={(e) => setDocumentoFiscal(e.target.value)} className={altaControl} />
          </AltaField>
        </div>
      </AltaSection>

      <AltaSection title="Dónde" hint="Zona de trabajo, no tiene que ser el padrón.">
        <div className="flex flex-col gap-5">
          <AltaField label="Dirección" optional>
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className={altaControl} />
          </AltaField>
          <div>
            <div className="mb-2.5 text-[12.5px] font-semibold text-[var(--text-2)]">Localidad</div>
            <div className="grid grid-cols-2 gap-3">
              <BuscadorLocalidad
                value={localidad}
                onChange={(valor) => setLocalidad(Array.isArray(valor) ? valor[0] ?? "" : valor)}
                placeholder="Toda España · 3 letras"
              />
              <input value={codigoPostal} onChange={(e) => setCodigoPostal(e.target.value)} placeholder="CP" className={`${altaControl} mt-0`} />
            </div>
          </div>
        </div>
      </AltaSection>

      <AltaSection title="Notas internas" hint="Quedan en el CRM. No salen al portal ni al parte." wide>
        <AltaField label="Notas" optional>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className={`${altaControl} h-auto min-h-[5.5rem] resize-none py-2.5`} />
        </AltaField>
      </AltaSection>
    </AltaShell>
  );
}
