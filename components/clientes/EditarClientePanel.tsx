"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AltaField, AltaSection, AltaShell, altaControl } from "@/components/ui/alta-form";
import { BuscadorLocalidad } from "@/components/geo/BuscadorLocalidad";
import { Selector } from "@/components/ui/selector";
import { mensajeGuardado } from "@/lib/ui/mensaje-guardado";

export type ClienteEditData = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  tipo_cliente: "particular" | "empresa";
  documento_fiscal: string | null;
  tipo_documento: "dni" | "nie" | "cif" | "vat" | string | null;
  direccion: string | null;
  codigo_postal: string | null;
  localidad: string | null;
  notas: string | null;
  activo?: boolean;
  etiqueta?: "fallecido" | null;
};

export type ClienteEditPatch = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  tipo_cliente: "particular" | "empresa";
  documento_fiscal: string | null;
  tipo_documento: "dni" | "nie" | "cif" | "vat" | null;
  direccion: string | null;
  codigo_postal: string | null;
  localidad: string | null;
  notas: string | null;
  activo: boolean;
  etiqueta: "fallecido" | null;
};

type TipoDoc = "dni" | "nie" | "cif" | "vat";

function normalizarTipoDoc(tipoCliente: "particular" | "empresa", raw: string | null | undefined): TipoDoc {
  if (tipoCliente === "empresa") return raw === "vat" ? "vat" : "cif";
  return raw === "nie" ? "nie" : "dni";
}

export function EditarClientePanel({
  open,
  onOpenChange,
  cliente,
  onGuardado,
  elevated = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: ClienteEditData | null;
  onGuardado: (patch: ClienteEditPatch) => void;
  elevated?: boolean;
}) {
  const [tipoCliente, setTipoCliente] = useState<"particular" | "empresa">("particular");
  const [tipoDocumento, setTipoDocumento] = useState<TipoDoc>("dni");
  const [nombre, setNombre] = useState("");
  const [documentoFiscal, setDocumentoFiscal] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [notas, setNotas] = useState("");
  const [activo, setActivo] = useState(true);
  const [fallecido, setFallecido] = useState(false);
  const [saving, setSaving] = useState(false);
  const nombreRef = useRef<HTMLInputElement>(null);
  const guardandoRef = useRef(false);

  useEffect(() => {
    if (!open || !cliente) return;
    setTipoCliente(cliente.tipo_cliente);
    setTipoDocumento(normalizarTipoDoc(cliente.tipo_cliente, cliente.tipo_documento));
    setNombre(cliente.nombre ?? "");
    setDocumentoFiscal(cliente.documento_fiscal ?? "");
    setEmail(cliente.email ?? "");
    setTelefono(cliente.telefono ?? "");
    setDireccion(cliente.direccion ?? "");
    setCodigoPostal(cliente.codigo_postal ?? "");
    setLocalidad(cliente.localidad ?? "");
    setNotas(cliente.notas ?? "");
    setActivo(cliente.activo !== false);
    setFallecido(cliente.etiqueta === "fallecido");
    requestAnimationFrame(() => nombreRef.current?.focus());
  }, [open, cliente]);

  const guardar = async () => {
    if (!cliente || guardandoRef.current || saving) return;
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    const tipoDoc = normalizarTipoDoc(tipoCliente, tipoDocumento);
    const patch: ClienteEditPatch = {
      id: cliente.id,
      nombre: nombre.trim(),
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      tipo_cliente: tipoCliente,
      documento_fiscal: documentoFiscal.trim() || null,
      tipo_documento: documentoFiscal.trim() ? tipoDoc : null,
      direccion: direccion.trim() || null,
      codigo_postal: codigoPostal.trim() || null,
      localidad: localidad.trim() || null,
      notas: notas.trim() || null,
      activo,
      etiqueta: fallecido ? "fallecido" : null,
    };

    guardandoRef.current = true;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("clientes")
        .update({
          nombre: patch.nombre,
          email: patch.email,
          telefono: patch.telefono,
          tipo_cliente: patch.tipo_cliente,
          documento_fiscal: patch.documento_fiscal,
          tipo_documento: patch.tipo_documento,
          direccion: patch.direccion,
          codigo_postal: patch.codigo_postal,
          localidad: patch.localidad,
          notas: patch.notas,
          activo: patch.activo,
          etiqueta: patch.etiqueta,
        })
        .eq("id", cliente.id)
        .select("id")
        .maybeSingle();
      const aviso = mensajeGuardado(error, "No se ha podido guardar el contacto.", data);
      if (aviso || !data) {
        toast.error(aviso ?? "No se ha podido guardar el contacto.");
        return;
      }
      toast.success("Contacto actualizado.");
      onGuardado(patch);
      onOpenChange(false);
    } finally {
      setSaving(false);
      guardandoRef.current = false;
    }
  };

  return (
    <AltaShell
      open={open}
      onOpenChange={onOpenChange}
      elevated={elevated}
      title="Editar contacto"
      hint="Cambia nombre, teléfono, documento o notas. Se guarda sobre este contacto."
      primaryLabel="Guardar cambios"
      saving={saving}
      disablePrimary={!nombre.trim()}
      onSubmit={() => void guardar()}
    >
      <AltaSection title="Quién" hint="Particular o empresa. El nombre es lo único imprescindible.">
        <div className="flex flex-col gap-5">
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
          <AltaField label={tipoCliente === "empresa" ? "Razón social" : "Nombre y apellidos"}>
            <input
              ref={nombreRef}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={altaControl}
            />
          </AltaField>
          <div className="flex flex-wrap gap-2">
            <ToggleChip on={activo && !fallecido} onClick={() => { setActivo(true); setFallecido(false); }}>
              Activo
            </ToggleChip>
            <ToggleChip on={!activo && !fallecido} onClick={() => { setActivo(false); setFallecido(false); }}>
              Inactivo
            </ToggleChip>
            <ToggleChip on={fallecido} onClick={() => { setFallecido(true); setActivo(false); }}>
              Fallecido
            </ToggleChip>
          </div>
        </div>
      </AltaSection>

      <AltaSection title="Contacto" hint="Teléfono y email que usáis en el día a día.">
        <div className="flex flex-col gap-5">
          <AltaField label="Teléfono" optional>
            <input
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="600 000 000"
              className={altaControl}
            />
          </AltaField>
          <AltaField label="Email" optional>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={altaControl} />
          </AltaField>
        </div>
      </AltaSection>

      <AltaSection title="Documento" hint="Si no lo tienes ahora, déjalo vacío.">
        <div className="grid grid-cols-2 gap-3">
          <AltaField label="Tipo" optional>
            <Selector
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value as TipoDoc)}
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
            </Selector>
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
              <input
                value={codigoPostal}
                onChange={(e) => setCodigoPostal(e.target.value)}
                placeholder="CP"
                className={`${altaControl} mt-0`}
              />
            </div>
          </div>
        </div>
      </AltaSection>

      <AltaSection title="Notas internas" hint="Quedan en el CRM. No salen al portal ni al parte." wide>
        <AltaField label="Notas" optional>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            className={`${altaControl} h-auto min-h-[5.5rem] resize-none py-2.5`}
          />
        </AltaField>
      </AltaSection>
    </AltaShell>
  );
}
