"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AltaField, AltaPersona, AltaSection, AltaShell, altaControl, type PersonaOpcion } from "@/components/ui/alta-form";
import { NuevoClientePanel } from "@/components/clientes/NuevoClientePanel";
import { nombreYApellido } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import { TIPOS_INMUEBLE, TIPO_INMUEBLE_LABEL } from "@/lib/inmuebles/catalogo";
import { TIPOS_OPERACION_DEMANDA, TIPO_OPERACION_DEMANDA_LABEL } from "@/lib/demandas/matching";
import { criteriosDeDemanda, proponerStockParaDemanda } from "@/lib/demandas/proponer-stock";
import {
  ORIGENES_DEMANDA,
  REQUISITOS_RAPIDOS,
  payloadNuevaDemanda,
  validarNuevaDemanda,
  type BorradorNuevaDemanda,
} from "@/lib/demandas/nueva";
import { BuscadorLocalidad } from "@/components/geo/BuscadorLocalidad";
import type { ComercialFiltro } from "@/components/captacion/FiltroComercial";
import { altaCamposVacios, leerAltaBorrador } from "@/lib/ui/alta-borrador";
import { useAltaBorrador } from "@/lib/ui/use-alta-borrador";

const BORRADOR_VACIO: Omit<BorradorNuevaDemanda, "comercialId"> = {
  clienteId: "",
  tipoOperacion: "compra",
  tiposInmueble: ["piso"],
  zonas: [],
  presupuestoMin: "",
  presupuestoMax: "",
  superficieMin: "",
  superficieMax: "",
  habitacionesMin: "",
  banosMin: "",
  requisitos: "",
  requisitosRapidos: [],
  origen: "llamada",
};

type DemandaAltaSnap = {
  draft: BorradorNuevaDemanda;
  zonaExtra: string;
  fijo: boolean;
};

function demandaAltaVacia(s: DemandaAltaSnap) {
  const d = s.draft;
  const tiposDefault = d.tiposInmueble.length === 1 && d.tiposInmueble[0] === "piso";
  return (
    altaCamposVacios(
      s.fijo ? "" : d.clienteId,
      d.zonas,
      d.presupuestoMin,
      d.presupuestoMax,
      d.superficieMin,
      d.superficieMax,
      d.habitacionesMin,
      d.banosMin,
      d.requisitos,
      d.requisitosRapidos,
      s.zonaExtra
    ) &&
    tiposDefault &&
    d.tipoOperacion === "compra" &&
    d.origen === "llamada"
  );
}

export function NuevaDemandaPanel({
  open,
  onOpenChange,
  clienteIdInicial,
  clienteNombre,
  editarId,
  onCreada,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteIdInicial?: string;
  clienteNombre?: string;
  editarId?: string;
  onCreada: (id: string) => void;
}) {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const clienteFijo = Boolean(clienteIdInicial) || Boolean(editarId);
  const ambito = editarId ? `editar:${editarId}` : clienteIdInicial ?? "libre";
  const [clientes, setClientes] = useState<PersonaOpcion[]>([]);
  const [comerciales, setComerciales] = useState<ComercialFiltro[]>([]);
  const [qCliente, setQCliente] = useState("");
  const [altaClienteOpen, setAltaClienteOpen] = useState(false);
  const [altaClienteNombre, setAltaClienteNombre] = useState("");
  const [zonaExtra, setZonaExtra] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<BorradorNuevaDemanda>({
    ...BORRADOR_VACIO,
    comercialId: user?.id ?? "",
  });

  const snapshot = useMemo<DemandaAltaSnap>(
    () => ({ draft, zonaExtra, fijo: clienteFijo }),
    [draft, zonaExtra, clienteFijo]
  );
  const altaBorrador = useAltaBorrador({ tipo: "demanda", ambito, open, snapshot, estaVacio: demandaAltaVacia });

  const vaciar = () => {
    setDraft({
      ...BORRADOR_VACIO,
      clienteId: clienteIdInicial ?? "",
      comercialId: user?.id ?? "",
    });
    setQCliente("");
    setAltaClienteOpen(false);
    setAltaClienteNombre("");
    setZonaExtra("");
  };

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    void Promise.all([
      supabase.from("clientes").select("id, nombre, telefono").eq("activo", true).order("nombre"),
      supabase.from("profiles").select("id, nombre_completo, color, email, role").eq("activo", true),
    ]).then(([cli, com]) => {
      setClientes((cli.data ?? []) as PersonaOpcion[]);
      setComerciales(
        ((com.data ?? []) as Array<{ id: string; nombre_completo: string | null; color: string | null; email: string | null; role: string }>)
          .filter((row) => row.role !== "editor")
          .map((row) => ({
            id: row.id,
            nombre: nombreYApellido(row.nombre_completo, row.email) || row.email || "—",
            color: row.color,
          }))
      );
    });
    if (editarId) {
      void supabase
        .from("demandas")
        .select(
          "cliente_id, comercial_id, tipo_operacion, tipos_inmueble, zonas, presupuesto_min, presupuesto_max, superficie_min, superficie_max, habitaciones_min, banos_min, requisitos, origen"
        )
        .eq("id", editarId)
        .single()
        .then(({ data }) => {
          if (!data) return;
          setDraft({
            clienteId: String(data.cliente_id),
            comercialId: String(data.comercial_id || user?.id || ""),
            tipoOperacion: (data.tipo_operacion as BorradorNuevaDemanda["tipoOperacion"]) || "compra",
            tiposInmueble: (data.tipos_inmueble as string[]) ?? ["piso"],
            zonas: (data.zonas as string[]) ?? [],
            presupuestoMin: data.presupuesto_min != null ? String(data.presupuesto_min) : "",
            presupuestoMax: data.presupuesto_max != null ? String(data.presupuesto_max) : "",
            superficieMin: data.superficie_min != null ? String(data.superficie_min) : "",
            superficieMax: data.superficie_max != null ? String(data.superficie_max) : "",
            habitacionesMin: data.habitaciones_min != null ? String(data.habitaciones_min) : "",
            banosMin: data.banos_min != null ? String(data.banos_min) : "",
            requisitos: data.requisitos ?? "",
            requisitosRapidos: [],
            origen: data.origen || "llamada",
          });
          setAltaClienteOpen(false);
          setAltaClienteNombre("");
          setZonaExtra("");
          setQCliente("");
        });
      return;
    }
    const guardado = leerAltaBorrador<DemandaAltaSnap>("demanda", ambito);
    if (guardado && !demandaAltaVacia(guardado.data)) {
      setDraft({
        ...BORRADOR_VACIO,
        ...guardado.data.draft,
        clienteId: clienteFijo ? clienteIdInicial ?? "" : guardado.data.draft.clienteId,
        comercialId: guardado.data.draft.comercialId || user?.id || "",
      });
      setZonaExtra(guardado.data.zonaExtra);
      setQCliente("");
    } else {
      vaciar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const clienteSel = clientes.find((c) => c.id === draft.clienteId);
  const sugeridos = useMemo(() => {
    const q = qCliente.trim().toLowerCase();
    if (!q) return [];
    return clientes.filter((c) => `${c.nombre} ${c.telefono ?? ""}`.toLowerCase().includes(q)).slice(0, 6);
  }, [clientes, qCliente]);

  const set = <K extends keyof BorradorNuevaDemanda>(key: K, value: BorradorNuevaDemanda[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const toggleLista = (key: "tiposInmueble" | "zonas" | "requisitosRapidos", valor: string) => {
    setDraft((prev) => {
      const lista = prev[key];
      return { ...prev, [key]: lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor] };
    });
  };

  const crear = async () => {
    if (!user) return;
    const clienteId = draft.clienteId;
    if (!clienteId) {
      toast.error("Elige o crea un cliente.");
      return;
    }
    const supabase = createClient();
    const paraCrear = { ...draft, clienteId, comercialId: draft.comercialId || user.id };
    const fallo = validarNuevaDemanda(paraCrear);
    if (fallo) {
      toast.error(fallo);
      return;
    }
    setSaving(true);
    if (editarId) {
      const { estado: _estado, ...resto } = payloadNuevaDemanda(paraCrear);
      void _estado;
      const { error } = await supabase.from("demandas").update(resto).eq("id", editarId);
      if (error) {
        setSaving(false);
        toast.error("No se ha podido guardar la demanda.");
        return;
      }
      const n = await proponerStockParaDemanda(supabase, editarId, criteriosDeDemanda(payloadNuevaDemanda(paraCrear)));
      setSaving(false);
      toast.success(n > 0 ? `Demanda actualizada. ${n} inmuebles encajan.` : "Demanda actualizada.");
      altaBorrador.consumir();
      onOpenChange(false);
      onCreada(editarId);
      return;
    }
    const { data, error } = await supabase.from("demandas").insert(payloadNuevaDemanda(paraCrear)).select("id").single();
    if (error || !data) {
      setSaving(false);
      toast.error("No se ha podido crear la demanda.");
      return;
    }
    const n = await proponerStockParaDemanda(supabase, data.id, criteriosDeDemanda(payloadNuevaDemanda(paraCrear)));
    setSaving(false);
    toast.success(n > 0 ? `Demanda creada. ${n} inmuebles encajan.` : "Demanda creada.");
    altaBorrador.consumir();
    onOpenChange(false);
    onCreada(data.id);
  };

  const faltaCliente = !draft.clienteId;

  return (
    <>
    <AltaShell
      open={open}
      onOpenChange={onOpenChange}
      title={editarId ? "Editar demanda" : "Nueva demanda"}
      hint={editarId ? "Cambia criterios sin recrear la demanda." : "Lo que busca esta persona. Al crear, proponemos inmuebles publicados que encajan; tú confirmas."}
      primaryLabel={editarId ? "Guardar demanda" : "Crear demanda"}
      saving={saving}
      disablePrimary={faltaCliente}
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
      <AltaSection wide title="Cliente" hint="Primero quién busca. Si no está en la agenda, abre la misma ficha completa de Clientes.">
        <AltaPersona
          fijo={clienteFijo}
          fijoNombre={clienteNombre}
          seleccionado={clienteSel}
          onSeleccionar={(persona) => set("clienteId", persona.id)}
          onLimpiar={() => set("clienteId", "")}
          q={qCliente}
          setQ={setQCliente}
          sugeridos={sugeridos}
          onAltaNueva={(nombreSugerido) => {
            setAltaClienteNombre(nombreSugerido ?? "");
            setAltaClienteOpen(true);
          }}
          autoFocus={!clienteFijo}
        />
      </AltaSection>

      <AltaSection title="Qué busca" hint="Operación, tipo y zona. Puedes marcar varios.">
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-2.5 text-[12.5px] font-semibold text-[var(--text-2)]">Operación</div>
            <div className="flex flex-wrap gap-2">
              {TIPOS_OPERACION_DEMANDA.map((op) => (
                <ToggleChip key={op} on={draft.tipoOperacion === op} onClick={() => set("tipoOperacion", op)}>
                  {TIPO_OPERACION_DEMANDA_LABEL[op]}
                </ToggleChip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2.5 text-[12.5px] font-semibold text-[var(--text-2)]">Tipo de inmueble</div>
            <div className="flex flex-wrap gap-2">
              {TIPOS_INMUEBLE.map((tipo) => (
                <ToggleChip key={tipo} on={draft.tiposInmueble.includes(tipo)} onClick={() => toggleLista("tiposInmueble", tipo)}>
                  {TIPO_INMUEBLE_LABEL[tipo]}
                </ToggleChip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2.5 text-[12.5px] font-semibold text-[var(--text-2)]">Zonas</div>
            <BuscadorLocalidad
              multiple
              value={draft.zonas}
              onChange={(valor) => set("zonas", Array.isArray(valor) ? valor : valor ? [valor] : [])}
              placeholder="Toda España · 3 letras para añadir"
            />
          </div>
        </div>
      </AltaSection>

      <AltaSection title="Números" hint="Todo opcional. Sirve para filtrar, no para encasillar.">
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-2.5 text-[12.5px] font-semibold text-[var(--text-2)]">
              Presupuesto {draft.tipoOperacion === "alquiler" ? "€/mes" : "€"}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <AltaField label="Mínimo" optional>
                <input value={draft.presupuestoMin} onChange={(e) => set("presupuestoMin", e.target.value)} inputMode="numeric" placeholder="—" className={altaControl} />
              </AltaField>
              <AltaField label="Máximo" optional>
                <input value={draft.presupuestoMax} onChange={(e) => set("presupuestoMax", e.target.value)} inputMode="numeric" placeholder="Hasta" className={altaControl} />
              </AltaField>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <AltaField label="m² mín." optional>
              <input value={draft.superficieMin} onChange={(e) => set("superficieMin", e.target.value)} inputMode="numeric" className={altaControl} />
            </AltaField>
            <AltaField label="m² máx." optional>
              <input value={draft.superficieMax} onChange={(e) => set("superficieMax", e.target.value)} inputMode="numeric" className={altaControl} />
            </AltaField>
            <AltaField label="Hab. mín." optional>
              <input value={draft.habitacionesMin} onChange={(e) => set("habitacionesMin", e.target.value)} inputMode="numeric" className={altaControl} />
            </AltaField>
            <AltaField label="Baños mín." optional>
              <input value={draft.banosMin} onChange={(e) => set("banosMin", e.target.value)} inputMode="numeric" className={altaControl} />
            </AltaField>
          </div>
        </div>
      </AltaSection>

      <AltaSection title="Imprescindible" hint="Ascensor, reforma, planta… lo que no puede faltar.">
        <div className="flex flex-wrap gap-2">
          {REQUISITOS_RAPIDOS.map((item) => (
            <ToggleChip key={item} on={draft.requisitosRapidos.includes(item)} onClick={() => toggleLista("requisitosRapidos", item)}>
              {item}
            </ToggleChip>
          ))}
        </div>
        <textarea
          value={draft.requisitos}
          onChange={(e) => set("requisitos", e.target.value)}
          placeholder="Orientación, reforma, colegios, planta baja…"
          rows={3}
          className={`${altaControl} mt-4 h-auto min-h-[5.5rem] resize-none py-2.5`}
        />
      </AltaSection>
      <AltaSection title="Origen">
          <div className="flex flex-wrap gap-2">
            {ORIGENES_DEMANDA.map((item) => (
              <ToggleChip key={item.id} on={draft.origen === item.id} onClick={() => set("origen", item.id)}>
                {item.label}
              </ToggleChip>
            ))}
          </div>
        </AltaSection>
        {admin ? (
          <AltaSection title="Comercial">
            <div className="flex flex-wrap gap-2">
              {comerciales.map((c) => {
                const on = draft.comercialId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set("comercialId", c.id)}
                    className={cn("flex h-9 items-center gap-1.5 rounded-full border pr-3 pl-1 text-[13px] font-medium", on ? "border-accent bg-accent-soft" : "border-[var(--border)] bg-white text-[var(--text-2)]")}
                  >
                    <AvatarComercial nombre={c.nombre} color={c.color} size={24} />
                    {c.nombre.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </AltaSection>
        ) : null}
    </AltaShell>
    <NuevoClientePanel
      open={altaClienteOpen}
      onOpenChange={setAltaClienteOpen}
      elevated
      nombreInicial={altaClienteNombre}
      ambito="desde-demanda"
      onCreado={(id, extra) => {
        setClientes((prev) => {
          if (prev.some((c) => c.id === id)) return prev;
          return [...prev, { id, nombre: extra?.nombre ?? "Cliente", telefono: extra?.telefono ?? null }].sort((a, b) =>
            a.nombre.localeCompare(b.nombre)
          );
        });
        set("clienteId", id);
        setQCliente("");
      }}
    />
    </>
  );
}
