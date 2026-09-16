"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { DocumentoSplit } from "@/components/documentos/DocumentoSplit";
import { PdfFrameEditable } from "@/components/documentos/PdfFrameEditable";
import { useImprimirDocumento } from "@/components/documentos/DialogoGuardarAlImprimir";
import {
  contratoArrasVacio,
  contratoDesdeFila,
  ESTADOS_CIVILES,
  eurosEnPalabras,
  normalizarEstadoCivil,
  personaArrasVacia,
  restoPrecio,
  type ClausulasPersonalizadasArras,
  type ContratoArrasDatos,
  type PersonaArras,
  type TratamientoPersona,
} from "@/lib/contrato-arras";
import { clausulasPersonalizadasDesdeEdicion, prepararContratoArrasExportHtml } from "@/lib/contrato-arras-preview";
import {
  downloadContratoArrasPdf,
  htmlContratoArras,
  htmlContratoArrasExport,
  textosContratoArras,
} from "@/lib/contrato-arras-pdf";
import { EMPRESA_DOCUMENTOS } from "@/lib/empresa-documentos";
import { altaCamposVacios, leerAltaBorrador } from "@/lib/ui/alta-borrador";
import { useAltaBorrador } from "@/lib/ui/use-alta-borrador";
import { cn } from "@/lib/utils";
import type { Json } from "@/lib/supabase/types";

const area =
  "mt-1.5 min-h-[5.5rem] w-full resize-y rounded-[9px] border border-[var(--input)] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15 max-[819px]:text-base";

function personasVacias(personas: PersonaArras[]) {
  return personas.every((p) => altaCamposVacios(p.nombre, p.estado_civil, p.domicilio, p.dni));
}

function snapVacio(s: ContratoArrasDatos) {
  return (
    personasVacias(s.vendedores) &&
    personasVacias(s.compradores) &&
    altaCamposVacios(s.finca_descripcion, s.finca_anejos, s.cuenta_vendedora)
  );
}

function PersonaCard({
  titulo,
  persona,
  onChange,
  onRemove,
  puedeQuitar,
}: {
  titulo: string;
  persona: PersonaArras;
  onChange: (p: PersonaArras) => void;
  onRemove: () => void;
  puedeQuitar: boolean;
}) {
  const set = (patch: Partial<PersonaArras>) => onChange({ ...persona, ...patch });
  const estadoCivil = normalizarEstadoCivil(persona.estado_civil);
  return (
    <div className="rounded-[12px] border border-[var(--border-soft)] p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold">{titulo}</p>
        {puedeQuitar ? (
          <button type="button" onClick={onRemove} className="text-[var(--text-2)] hover:text-red-600" aria-label="Quitar">
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 min-[820px]:grid-cols-2">
        <div className="min-[820px]:col-span-2">
          <div className="mb-2 flex flex-wrap gap-2">
            {(["Don", "Doña"] as TratamientoPersona[]).map((t) => (
              <ToggleChip key={t} on={persona.tratamiento === t} onClick={() => set({ tratamiento: t })}>
                {t}
              </ToggleChip>
            ))}
          </div>
          <Label>Nombre y apellidos</Label>
          <Input className="mt-1.5" value={persona.nombre} onChange={(e) => set({ nombre: e.target.value })} />
        </div>
        <div>
          <Label>Estado civil</Label>
          <select
            className="mt-1.5 flex h-9 w-full rounded-[9px] border border-[var(--input)] bg-white px-3 py-0 text-[13.5px] outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15 max-[819px]:h-[46px] max-[819px]:text-base"
            value={estadoCivil}
            onChange={(e) => set({ estado_civil: e.target.value })}
          >
            <option value="">Seleccionar</option>
            {ESTADOS_CIVILES.map((e) => (
              <option key={e.value} value={e.value}>
                {persona.tratamiento === "Doña" ? e.labelDona : e.labelDon}
              </option>
            ))}
            {estadoCivil && !ESTADOS_CIVILES.some((e) => e.value === estadoCivil) ? (
              <option value={estadoCivil}>{persona.estado_civil}</option>
            ) : null}
          </select>
        </div>
        <div>
          <Label>DNI</Label>
          <Input className="mt-1.5" value={persona.dni} onChange={(e) => set({ dni: e.target.value })} />
        </div>
        <div>
          <Label>Vecino/a de</Label>
          <Input className="mt-1.5" value={persona.vecindad} onChange={(e) => set({ vecindad: e.target.value })} />
        </div>
        <div>
          <Label>Domicilio</Label>
          <Input className="mt-1.5" value={persona.domicilio} onChange={(e) => set({ domicilio: e.target.value })} placeholder="calle …" />
        </div>
      </div>
    </div>
  );
}

export function ContratoArrasEditor({ contratoId }: { contratoId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(Boolean(contratoId));
  const [datos, setDatos] = useState<ContratoArrasDatos>(() => ({
    ...contratoArrasVacio(),
    fecha: new Date().toISOString().slice(0, 10),
  }));
  const [propiedadId, setPropiedadId] = useState("");
  const [propiedades, setPropiedades] = useState<
    Array<{ id: string; titulo: string | null; direccion: string | null; referencia: string | null }>
  >([]);
  const [estado, setEstado] = useState<"borrador" | "cerrado">("borrador");
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [listo, setListo] = useState(!contratoId);

  const altaBorrador = useAltaBorrador({
    tipo: "arras",
    ambito: contratoId ? `id:${contratoId}` : "libre",
    open: !contratoId && listo,
    snapshot: datos,
    estaVacio: snapVacio,
  });

  const htmlPreview = useMemo(() => htmlContratoArras(datos, { editable: true }), [datos]);
  const htmlExport = useMemo(() => htmlContratoArrasExport(datos), [datos]);
  const resto = restoPrecio(datos.precio, datos.arras);
  const tieneClausulasPersonalizadas = Object.keys(datos.clausulas_personalizadas ?? {}).length > 0;

  const setClausulasPersonalizadas = (clausulas: ClausulasPersonalizadasArras) => {
    setDatos((d) => {
      const generadas = textosContratoArras({ ...d, clausulas_personalizadas: {} });
      return { ...d, clausulas_personalizadas: clausulasPersonalizadasDesdeEdicion(clausulas, generadas) };
    });
  };

  const restablecerClausulas = () => {
    setDatos((d) => ({ ...d, clausulas_personalizadas: {} }));
    toast.message("Cláusulas restablecidas desde el formulario.");
  };

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("propiedades")
      .select("id, titulo, direccion, referencia")
      .order("created_at", { ascending: false })
      .then(({ data }) => setPropiedades(data ?? []));
  }, []);

  useEffect(() => {
    if (contratoId) return;
    const guardado = leerAltaBorrador<ContratoArrasDatos>("arras", "libre");
    if (guardado && !snapVacio(guardado.data)) {
      setDatos({
        ...contratoArrasVacio(),
        ...guardado.data,
        fecha: guardado.data.fecha || new Date().toISOString().slice(0, 10),
      });
    }
    setListo(true);
  }, [contratoId]);

  useEffect(() => {
    if (!contratoId) return;
    const supabase = createClient();
    void supabase
      .from("contratos_arras")
      .select("*")
      .eq("id", contratoId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error(error?.message ?? "No se ha podido cargar el contrato.");
          setLoading(false);
          return;
        }
        setDatos(contratoDesdeFila(data));
        setPropiedadId(data.propiedad_id ?? "");
        setEstado(data.estado);
        setLoading(false);
      });
  }, [contratoId]);

  const setPersonas = (lado: "vendedores" | "compradores", next: PersonaArras[]) => {
    setDatos((d) => ({ ...d, [lado]: next }));
  };

  const guardar = async (_opts?: { quedarse?: boolean }): Promise<boolean> => {
    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      toast.error("Sesión expirada.");
      return false;
    }
    setSaving(true);
    const payload = {
      estado,
      lugar: datos.lugar.trim() || EMPRESA_DOCUMENTOS.lugar,
      fecha: datos.fecha,
      vendedores: datos.vendedores as unknown as Json,
      compradores: datos.compradores as unknown as Json,
      finca_descripcion: datos.finca_descripcion.trim() || null,
      finca_anejos: datos.finca_anejos.trim() || null,
      registro_libro: datos.registro_libro.trim() || null,
      registro_folio: datos.registro_folio.trim() || null,
      registro_finca: datos.registro_finca.trim() || null,
      registro_numero: datos.registro_numero.trim() || null,
      precio: datos.precio,
      arras: datos.arras,
      cuenta_vendedora: datos.cuenta_vendedora.trim() || null,
      plazo_escritura_dias: datos.plazo_escritura_dias,
      incluye_anejos: datos.incluye_anejos,
      hay_hipoteca: datos.hay_hipoteca,
      clausulas_personalizadas: datos.clausulas_personalizadas as unknown as Json,
      propiedad_id: propiedadId || null,
      updated_at: new Date().toISOString(),
    };
    if (contratoId) {
      const { error } = await supabase.from("contratos_arras").update(payload).eq("id", contratoId);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success("Contrato guardado.");
      return true;
    }
    const { data, error } = await supabase
      .from("contratos_arras")
      .insert({
        ...payload,
        user_id: authUser.id,
        comercial_id: authUser.id,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "No se ha podido guardar el contrato.");
      return false;
    }
    altaBorrador.consumir();
    toast.success("Contrato de arras guardado.");
    router.replace(`/contratos-arras/${data.id}`);
    router.refresh();
    return true;
  };

  const descargar = async () => {
    setPrinting(true);
    try {
      await downloadContratoArrasPdf(datos);
      toast.success("PDF descargado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido generar el PDF.");
    } finally {
      setPrinting(false);
    }
  };

  const prepararImpresion = useCallback(
    (html: string) => prepararContratoArrasExportHtml(html),
    []
  );
  const imprimir = useImprimirDocumento(htmlExport, guardar, { prepararHtml: prepararImpresion });

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" />
      </div>
    );
  }

  const form = (
    <div className="space-y-4">
      <section className="rounded-[14px] border border-border bg-white p-4 min-[820px]:p-5">
        <h2 className="text-[15px] font-semibold">Fecha y lugar</h2>
        <div className="mt-4 grid gap-4 min-[820px]:grid-cols-2">
          <div>
            <Label htmlFor="lugar">Lugar</Label>
            <Input id="lugar" className="mt-1.5" value={datos.lugar} onChange={(e) => setDatos((d) => ({ ...d, lugar: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              className="mt-1.5"
              value={datos.fecha ?? ""}
              onChange={(e) => setDatos((d) => ({ ...d, fecha: e.target.value || null }))}
            />
          </div>
        </div>
      </section>

      {(["vendedores", "compradores"] as const).map((lado) => (
        <section key={lado} className="rounded-[14px] border border-border bg-white p-4 min-[820px]:p-5">
          <h2 className="text-[15px] font-semibold">{lado === "vendedores" ? "Parte vendedora" : "Parte compradora"}</h2>
          <div className="mt-4 space-y-3">
            {datos[lado].map((persona, i) => (
              <PersonaCard
                key={`${lado}-${i}`}
                titulo={`${persona.tratamiento} ${i + 1}`}
                persona={persona}
                onChange={(p) => setPersonas(lado, datos[lado].map((x, j) => (j === i ? p : x)))}
                onRemove={() => setPersonas(lado, datos[lado].filter((_, j) => j !== i))}
                puedeQuitar={datos[lado].length > 1}
              />
            ))}
            {datos[lado].length < 4 ? (
              <button
                type="button"
                onClick={() => {
                  const ultimo = datos[lado][datos[lado].length - 1];
                  const siguiente: TratamientoPersona = ultimo?.tratamiento === "Doña" ? "Don" : "Doña";
                  setPersonas(lado, [...datos[lado], personaArrasVacia(datos[lado].length === 0 ? "Don" : siguiente)]);
                }}
                className="flex min-h-[72px] w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-[var(--input)] px-3 text-[13.5px] font-semibold text-[var(--text-2)] hover:border-accent hover:text-accent"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                {lado === "vendedores" ? "Añadir vendedor" : "Añadir comprador"}
              </button>
            ) : null}
          </div>
        </section>
      ))}

      <section className="rounded-[14px] border border-border bg-white p-4 min-[820px]:p-5">
        <h2 className="text-[15px] font-semibold">Finca</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="stock">Inmueble del stock</Label>
            <select
              id="stock"
              value={propiedadId}
              onChange={(e) => {
                const id = e.target.value;
                setPropiedadId(id);
                const p = propiedades.find((x) => x.id === id);
                if (p?.direccion && !datos.finca_descripcion.trim()) {
                  setDatos((d) => ({ ...d, finca_descripcion: p.direccion ?? "" }));
                }
              }}
              className={cn(area, "h-9 min-h-0 py-0 max-[819px]:h-[46px]")}
            >
              <option value="">Sin ficha (solo descripción)</option>
              {propiedades.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.referencia, p.titulo || p.direccion].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="finca">Descripción de la finca</Label>
            <textarea
              id="finca"
              value={datos.finca_descripcion}
              onChange={(e) => setDatos((d) => ({ ...d, finca_descripcion: e.target.value }))}
              className={area}
              placeholder="Vivienda sita en…"
            />
          </div>
          <div>
            <Label htmlFor="anejos">Anejos</Label>
            <Input
              id="anejos"
              className="mt-1.5"
              value={datos.finca_anejos}
              onChange={(e) => setDatos((d) => ({ ...d, finca_anejos: e.target.value }))}
              placeholder="Garaje, trastero…"
            />
          </div>
          <div className="grid gap-3 min-[820px]:grid-cols-2">
            <div>
              <Label>Libro</Label>
              <Input className="mt-1.5" value={datos.registro_libro} onChange={(e) => setDatos((d) => ({ ...d, registro_libro: e.target.value }))} />
            </div>
            <div>
              <Label>Folio</Label>
              <Input className="mt-1.5" value={datos.registro_folio} onChange={(e) => setDatos((d) => ({ ...d, registro_folio: e.target.value }))} />
            </div>
            <div>
              <Label>Finca nº</Label>
              <Input className="mt-1.5" value={datos.registro_finca} onChange={(e) => setDatos((d) => ({ ...d, registro_finca: e.target.value }))} />
            </div>
            <div>
              <Label>Registro de la Propiedad</Label>
              <Input className="mt-1.5" value={datos.registro_numero} onChange={(e) => setDatos((d) => ({ ...d, registro_numero: e.target.value }))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ToggleChip on={datos.incluye_anejos} onClick={() => setDatos((d) => ({ ...d, incluye_anejos: !d.incluye_anejos }))}>
              Incluye trastero o garaje
            </ToggleChip>
            <ToggleChip on={datos.hay_hipoteca} onClick={() => setDatos((d) => ({ ...d, hay_hipoteca: !d.hay_hipoteca }))}>
              Hay hipoteca a cancelar
            </ToggleChip>
          </div>
        </div>
      </section>

      <section className="rounded-[14px] border border-border bg-white p-4 min-[820px]:p-5">
        <h2 className="text-[15px] font-semibold">Precio y arras</h2>
        <div className="mt-4 grid gap-4 min-[820px]:grid-cols-2">
          <div>
            <Label htmlFor="precio">Precio (€)</Label>
            <Input
              id="precio"
              type="number"
              min={0}
              step="0.01"
              className="mt-1.5"
              value={datos.precio ?? ""}
              onChange={(e) => setDatos((d) => ({ ...d, precio: e.target.value === "" ? null : Number(e.target.value) }))}
            />
            <p className="mt-1 text-[11.5px] text-[var(--text-2)]">{eurosEnPalabras(datos.precio)}</p>
          </div>
          <div>
            <Label htmlFor="arras">Arras (€)</Label>
            <Input
              id="arras"
              type="number"
              min={0}
              step="0.01"
              className="mt-1.5"
              value={datos.arras ?? ""}
              onChange={(e) => setDatos((d) => ({ ...d, arras: e.target.value === "" ? null : Number(e.target.value) }))}
            />
            <p className="mt-1 text-[11.5px] text-[var(--text-2)]">{eurosEnPalabras(datos.arras)}</p>
          </div>
          <div className="min-[820px]:col-span-2 rounded-[10px] bg-[var(--surface-soft)] px-3 py-2.5 text-[13px]">
            Resto en escritura: <strong>{resto == null ? "—" : eurosEnPalabras(resto)}</strong>
          </div>
          <div className="min-[820px]:col-span-2">
            <Label htmlFor="iban">Cuenta de la parte vendedora</Label>
            <Input
              id="iban"
              className="mt-1.5"
              value={datos.cuenta_vendedora}
              onChange={(e) => setDatos((d) => ({ ...d, cuenta_vendedora: e.target.value }))}
              placeholder="ES…"
            />
          </div>
          <div>
            <Label htmlFor="plazo">Plazo escritura (días)</Label>
            <Input
              id="plazo"
              type="number"
              min={1}
              className="mt-1.5"
              value={datos.plazo_escritura_dias ?? ""}
              onChange={(e) =>
                setDatos((d) => ({ ...d, plazo_escritura_dias: e.target.value === "" ? null : Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <Label>Estado</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <ToggleChip on={estado === "borrador"} onClick={() => setEstado("borrador")}>
                Borrador
              </ToggleChip>
              <ToggleChip on={estado === "cerrado"} onClick={() => setEstado("cerrado")}>
                Cerrado
              </ToggleChip>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/herramientas"
          aria-label="Volver"
          className="flex shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:text-foreground"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight min-[820px]:text-[28px]">
            {contratoId ? "Contrato de arras" : "Nuevo contrato de arras"}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">
            Las cláusulas de protección de datos salen con Rehabinco, no con Conchado. Año {new Date().getFullYear()}.
          </p>
        </div>
        <div className="hidden gap-2 min-[820px]:flex">
          <Button type="button" variant="secondary" onClick={imprimir.pedirImprimir}>
            Imprimir
          </Button>
          <Button type="button" onClick={() => void guardar()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      <DocumentoSplit
        form={form}
        preview={
          <PdfFrameEditable
            html={htmlPreview}
            onClausulasChange={setClausulasPersonalizadas}
            onRestablecerClausulas={restablecerClausulas}
            tienePersonalizadas={tieneClausulasPersonalizadas}
            onDownload={descargar}
            downloading={printing}
            onPrint={imprimir.pedirImprimir}
          />
        }
      />

      {imprimir.dialogo}

      <div className="fixed bottom-0 left-0 right-0 z-40 flex gap-2 border-t border-border bg-white/95 px-4 py-3 min-[820px]:hidden">
        <Button type="button" variant="secondary" className="flex-1" onClick={imprimir.pedirImprimir}>
          Imprimir
        </Button>
        <Button type="button" className="flex-1" onClick={() => void guardar()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
