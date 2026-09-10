"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ClienteQuickSheet } from "@/components/clientes/ClienteQuickSheet";
import { parseDecimalMientrasEscribe } from "@/lib/decimales-input";
import { listEmisoresPresupuesto, type EmisorPresupuesto } from "@/lib/emisores-presupuesto";
import { wizardActionBarClassName } from "@/components/layout/wizard-chrome";
import { GaralPartidasEditor } from "@/components/presupuestos/GaralPartidasEditor";
import { GaralAdjuntosField } from "@/components/presupuestos/GaralAdjuntosField";
import { PresupuestoCopiloto } from "@/components/presupuestos/PresupuestoCopiloto";
import { PresupuestoPresentacionField } from "@/components/presupuestos/PresupuestoPresentacionField";
import { AmpliacionCampos } from "@/components/presupuestos/AmpliacionCampos";
import { useAuth } from "@/lib/auth/auth-context";
import { isEditor } from "@/lib/auth/roles";
import {
  aplicarPropuestaTexto,
  propuestaSinBinarios,
} from "@/lib/ai/presupuesto-copiloto";
import {
  parsePropuesta,
  propuestaVacia,
  type PropuestaPresupuesto,
  type TipoDocumentoPresupuesto,
} from "@/lib/presupuesto-propuesta";
import { altasDeLineas, lineasParaDb, totalesAmpliacion } from "@/lib/presupuesto-totales";

interface Linea {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  unidad: string;
  capitulo: string;
}

type LineaBorrador = Linea & { _precioDraft?: string; _cantDraft?: string };

interface PresupuestoWizardProps {
  presupuestoId?: string;
}

export function PresupuestoWizard({ presupuestoId }: PresupuestoWizardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const soloGaral = isEditor(user?.role);
  const [step, setStep] = useState(1);
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string }>>([]);
  const [clienteId, setClienteId] = useState("");
  const [emisorId, setEmisorId] = useState("");
  const [emisores, setEmisores] = useState<EmisorPresupuesto[]>([]);
  const [concepto, setConcepto] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [lineas, setLineas] = useState<LineaBorrador[]>([
    { descripcion: "", cantidad: 0, precioUnitario: 0, unidad: "ud", capitulo: "" },
  ]);
  const [propuesta, setPropuesta] = useState<PropuestaPresupuesto>(propuestaVacia());
  const [porcentajeImpuesto, setPorcentajeImpuesto] = useState(21);
  const [porcentajeDescuento, setPorcentajeDescuento] = useState(0);
  const [estado, setEstado] = useState("borrador");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(!!presupuestoId);
  const [error, setError] = useState<string | null>(null);
  const [showQuickClient, setShowQuickClient] = useState(false);
  const esGaralEmisor =
    soloGaral || emisores.find((e) => e.id === emisorId)?.slug === "garal";

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("clientes")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setClientes(data ?? []));
    listEmisoresPresupuesto(supabase).then((list) => {
      const visible = soloGaral ? list.filter((e) => e.slug === "garal") : list;
      setEmisores(visible);
      setEmisorId((current) => {
        if (soloGaral) {
          return visible.find((e) => e.slug === "garal")?.id ?? visible[0]?.id ?? "";
        }
        if (current && visible.some((e) => e.id === current)) return current;
        const rehabinco = visible.find((e) => e.slug === "rehabinco");
        return rehabinco?.id ?? visible[0]?.id ?? "";
      });
    });
  }, [soloGaral]);

  useEffect(() => {
    if (!presupuestoId) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("presupuestos").select("cliente_id, concepto, fecha, porcentaje_impuesto, porcentaje_descuento, estado, emisor_id, propuesta").eq("id", presupuestoId).single(),
      supabase.from("presupuesto_lineas").select("descripcion, cantidad, precio_unitario, unidad, capitulo").eq("presupuesto_id", presupuestoId).order("orden"),
    ]).then(([pRes, lRes]) => {
      const p = pRes.data as { cliente_id: string | null; concepto: string | null; fecha: string | null; porcentaje_impuesto: number; porcentaje_descuento: number; estado: string; emisor_id: string | null; propuesta?: unknown } | null;
      const l = (lRes.data ?? []) as Array<{ descripcion: string; cantidad: number; precio_unitario: number; unidad?: string | null; capitulo?: string | null }>;
      if (p) {
        setClienteId(p.cliente_id ?? "");
        setConcepto(p.concepto ?? "");
        setFecha(p.fecha ?? new Date().toISOString().slice(0, 10));
        setPorcentajeImpuesto(p.porcentaje_impuesto ?? 21);
        setPorcentajeDescuento(p.porcentaje_descuento ?? 0);
        setEstado(p.estado ?? "borrador");
        if (p.emisor_id) setEmisorId(p.emisor_id);
        setPropuesta(parsePropuesta(p.propuesta));
      }
      const altas = altasDeLineas(l).map((x) => ({
        descripcion: x.descripcion,
        cantidad: x.cantidad,
        precioUnitario: x.precio_unitario,
        unidad: x.unidad || "ud",
        capitulo: x.capitulo ?? "",
      }));
      setLineas(
        altas.length > 0
          ? altas
          : [{ descripcion: "", cantidad: 0, precioUnitario: 0, unidad: "ud", capitulo: "" }]
      );
      setLoading(false);
    });
  }, [presupuestoId]);

  useEffect(() => {
    if (!esGaralEmisor) return;
    setLineas((rows) => {
      if (rows.some((l) => l.capitulo.trim())) return rows;
      return rows.map((l) => ({ ...l, capitulo: "01 · Actuación" }));
    });
  }, [esGaralEmisor]);

  const addLinea = () =>
    setLineas((p) => [...p, { descripcion: "", cantidad: 0, precioUnitario: 0, unidad: "ud", capitulo: "" }]);
  const removeLinea = (i: number) =>
    setLineas((p) => p.filter((_, idx) => idx !== i));
  const updateLinea = (i: number, field: keyof Linea, value: string | number) =>
    setLineas((p) =>
      p.map((l, idx) => (idx === i ? { ...l, [field]: value } : l))
    );

  const commitLineasBorrador = (rows: LineaBorrador[]): Linea[] =>
    rows.map((l) => ({
      descripcion: l.descripcion,
      unidad: l.unidad || "ud",
      capitulo: l.capitulo || "",
      cantidad:
        l._cantDraft !== undefined
          ? parseDecimalMientrasEscribe(l._cantDraft, { allowNegative: false })
          : l.cantidad,
      precioUnitario:
        l._precioDraft !== undefined
          ? parseDecimalMientrasEscribe(l._precioDraft, { allowNegative: false })
          : l.precioUnitario,
    }));

  const lineasFijas = commitLineasBorrador(lineas);
  const lineasValidas = lineasFijas.filter((l) => l.descripcion.trim() && l.cantidad > 0 && l.precioUnitario >= 0);
  const step2Valid = z.array(z.object({
    descripcion: z.string().min(1),
    cantidad: z.number().min(0.001),
    precioUnitario: z.number().min(0),
  })).min(1).safeParse(lineasValidas).success;

  const esAmpliacion = propuesta.tipo === "ampliacion";
  const totAmp = totalesAmpliacion({
    lineas: lineasFijas,
    bajas: propuesta.bajas,
    ajusteComercial: propuesta.ajuste_comercial,
    origenTotal: propuesta.origen_total,
    porcentajeImpuesto,
  });
  const baseImponible = esAmpliacion
    ? totAmp.incrementoNeto
    : lineasFijas.reduce((acc, l) => acc + Number(l.cantidad) * Number(l.precioUnitario), 0);
  const impuesto = baseImponible * (porcentajeImpuesto / 100);
  const descuento = esAmpliacion ? 0 : baseImponible * (porcentajeDescuento / 100);
  const total = baseImponible + impuesto - descuento;
  const descuentoSave = esAmpliacion ? 0 : porcentajeDescuento;

  const setTipoDocumento = (tipo: TipoDocumentoPresupuesto) => {
    setPropuesta((p) => ({
      ...p,
      tipo,
      mostrar_zonas: tipo !== "ampliacion",
      mostrar_programa: tipo !== "ampliacion",
      mostrar_repercusion: tipo === "ampliacion",
      densidad_tabla: tipo === "ampliacion" ? "compacta" : p.densidad_tabla,
    }));
    if (tipo === "ampliacion") setPorcentajeDescuento(0);
  };

  const filasParaInsert = (presupuestoIdDest: string) =>
    lineasParaDb(lineasFijas, propuesta).map((l, orden) => ({
      presupuesto_id: presupuestoIdDest,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      unidad: l.unidad,
      capitulo: l.capitulo,
      orden,
    }));


  const handleSave = async () => {
    setError(null);
    setCreating(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Sesión expirada");
      setCreating(false);
      return;
    }

    if (presupuestoId) {
      const { error: errUpd } = await supabase
        .from("presupuestos")
        .update({
          cliente_id: clienteId || null,
          concepto: concepto || null,
          fecha,
          porcentaje_impuesto: porcentajeImpuesto,
          porcentaje_descuento: descuentoSave,
          estado,
          emisor_id: emisorId || undefined,
          propuesta,
        })
        .eq("id", presupuestoId);

      if (errUpd) {
        setError(errUpd.message);
        setCreating(false);
        return;
      }

      await supabase.from("presupuesto_lineas").delete().eq("presupuesto_id", presupuestoId);

      const lineasToInsert = filasParaInsert(presupuestoId);

      if (lineasToInsert.length > 0) {
        const { error: errLineas } = await supabase.from("presupuesto_lineas").insert(lineasToInsert);
        if (errLineas) {
          setError(errLineas.message);
          setCreating(false);
          return;
        }
      }

      toast.success("Presupuesto actualizado");
      router.push(`/presupuestos/${presupuestoId}`);
      router.refresh();
      setCreating(false);
      return;
    }

    const serie = process.env.NEXT_PUBLIC_BILLING_SERIE ?? "PRS";
    const year = new Date().getFullYear();
    const prefix = `${serie}-${year}-`;
    const { data: existing } = await supabase
      .from("presupuestos")
      .select("numero")
      .like("numero", `${prefix}%`)
      .order("numero", { ascending: false })
      .limit(1);
    const last = existing?.[0]?.numero;
    const lastCorrelative = last ? Number(last.split("-").pop() ?? "0") : 0;
    const numero = `${prefix}${String(lastCorrelative + 1).padStart(4, "0")}`;

    const { data: presupuesto, error: errPresup } = await supabase
      .from("presupuestos")
      .insert({
        user_id: user.id,
        cliente_id: clienteId || null,
        numero,
        estado: "borrador",
        fecha,
        concepto: concepto || null,
        porcentaje_impuesto: porcentajeImpuesto,
        porcentaje_descuento: descuentoSave,
        emisor_id: emisorId || undefined,
        propuesta,
      })
      .select("id")
      .single();

    if (errPresup || !presupuesto) {
      setError(errPresup?.message ?? "Error al crear presupuesto");
      setCreating(false);
      return;
    }

    const lineasToInsert = filasParaInsert(presupuesto.id);

    if (lineasToInsert.length > 0) {
      const { error: errLineas } = await supabase.from("presupuesto_lineas").insert(lineasToInsert);

      if (errLineas) {
        setError(errLineas.message);
        setCreating(false);
        return;
      }
    }

    toast.success("Presupuesto creado");
    router.push(`/presupuestos/${presupuesto.id}`);
    router.refresh();
    setCreating(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" aria-busy="true" aria-live="polite">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" role="status" aria-label="Cargando" />
      </div>
    );
  }

  const emisorSlug =
    soloGaral || emisores.find((e) => e.id === emisorId)?.slug === "garal" ? "garal" : "rehabinco";

  return (
    <div className="relative mx-auto max-w-2xl animate-[fadeIn_0.3s_ease-out] pb-36 md:pb-24">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="hidden min-w-0 text-sm text-neutral-500 sm:block">
          El copiloto guarda el contexto: suelta Word, PDF y correcciones; acepta cuando quieras volcar.
        </p>
        <div className="ml-auto shrink-0">
        <PresupuestoCopiloto
          estado={{
            emisor: emisorSlug,
            concepto,
            porcentaje_impuesto: porcentajeImpuesto,
            porcentaje_descuento: porcentajeDescuento,
            lineas: lineasFijas,
            propuesta: propuestaSinBinarios(propuesta),
          }}
          onAccept={(output) => {
            if (output.concepto.trim()) setConcepto(output.concepto);
            setPorcentajeDescuento(output.propuesta.tipo === "ampliacion" ? 0 : output.porcentaje_descuento);
            setLineas(output.lineas.map((l) => ({ ...l })));
            setPropuesta((p) => aplicarPropuestaTexto(p, output.propuesta));
          }}
        />
        </div>
      </div>
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={cn(
              "flex flex-1 items-center gap-2",
              s < 4 && "after:h-0.5 after:flex-1 after:bg-border"
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                step >= s ? "bg-foreground text-background" : "bg-neutral-100 text-neutral-500"
              )}
            >
              {s}
            </div>
            <span className={cn("hidden text-sm sm:inline", step === s ? "text-foreground" : "text-neutral-500")}>
              {s === 1 ? "Cliente" : s === 2 ? (esGaralEmisor ? "Partidas" : "Líneas") : s === 3 ? "Propuesta" : "Resumen"}
            </span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Cliente y datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Emisor</Label>
              <div className="flex rounded-lg border border-border p-1">
                {emisores.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      if (soloGaral) return;
                      setEmisorId(e.id);
                    }}
                    disabled={soloGaral && emisores.length === 1}
                    className={cn(
                      "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      emisorId === e.id
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted",
                      soloGaral && "cursor-default"
                    )}
                  >
                    {e.nombre_corto}
                  </button>
                ))}
              </div>
              <p className="text-xs text-neutral-500">
                {soloGaral
                  ? "Este perfil emite siempre como Garal."
                  : "El PDF usará el logotipo y los datos fiscales de este emisor."}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Tipo de documento</Label>
              <div className="flex rounded-lg border border-border p-1">
                {(
                  [
                    ["presupuesto", "Presupuesto"],
                    ["ampliacion", "Ampliación"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTipoDocumento(id)}
                    className={
                      propuesta.tipo === id
                        ? "flex-1 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
                        : "flex-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-neutral-500">
                {esAmpliacion
                  ? "Dos hojas: portada + desglose. El total de portada es el incremento neto (altas − bajas + ajuste)."
                  : "Propuesta completa (datos, mediciones, programa y cierre)."}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-white px-4 text-base"
              >
                <option value="">Selecciona un cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {!soloGaral && (
              <button
                type="button"
                onClick={() => setShowQuickClient(true)}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
              >
                <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                Crear cliente desde aquí
              </button>
              )}
              {!soloGaral && (
              <ClienteQuickSheet
                open={showQuickClient}
                onOpenChange={setShowQuickClient}
                onSuccess={(cliente) => {
                  setClientes((prev) => [...prev, cliente].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                  setClienteId(cliente.id);
                }}
              />
              )}
            </div>
            <div className="space-y-2">
              <Label>Título (portada)</Label>
              <Input
                placeholder="Ej. Mantenimiento de pintura"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo de portada</Label>
              <Input
                placeholder="Ej. Estadio Abanca-Riazor"
                value={propuesta.subtitulo_portada}
                onChange={(e) => setPropuesta((p) => ({ ...p, subtitulo_portada: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Texto de portada</Label>
              <textarea
                className="flex min-h-[88px] w-full rounded-lg border border-border bg-white px-4 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Resumen que aparece bajo el título en la portada"
                value={propuesta.descripcion_portada}
                onChange={(e) => setPropuesta((p) => ({ ...p, descripcion_portada: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            {presupuestoId && (
              <div className="space-y-2">
                <Label>Estado</Label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-border bg-white px-4 text-base"
                >
                  <option value="borrador">Borrador</option>
                  <option value="enviado">Enviado</option>
                  <option value="aceptado">Aceptado</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>{esGaralEmisor ? "Mediciones y partidas" : "Líneas"}</CardTitle>
            {esAmpliacion && (
              <CardDescription>
                Solo las altas de la ampliación. Las bajas y el ajuste comercial van debajo.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {esGaralEmisor ? (
              <GaralPartidasEditor lineas={lineas} onChange={setLineas} />
            ) : (
            <>
            {lineas.map((l, i) => (
              <div
                key={i}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-4"
              >
                <div className="flex-1 min-w-[200px] space-y-2">
                  <Label>Descripción</Label>
                  <Input
                    placeholder="Descripción de la partida"
                    value={l.descripcion}
                    onChange={(e) => updateLinea(i, "descripcion", e.target.value)}
                  />
                </div>
                <div className="w-full min-w-[160px] flex-1 space-y-2">
                  <Label>Capítulo</Label>
                  <Input
                    placeholder="01 · Pavimentos"
                    value={l.capitulo}
                    onChange={(e) => updateLinea(i, "capitulo", e.target.value)}
                  />
                </div>
                <div className="w-20 space-y-2">
                  <Label>Ud</Label>
                  <Input
                    placeholder="ud"
                    value={l.unidad}
                    onChange={(e) => updateLinea(i, "unidad", e.target.value)}
                  />
                </div>
                <div className="w-24 space-y-2">
                  <Label>Cant.</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={
                      l._cantDraft !== undefined
                        ? l._cantDraft
                        : l.cantidad === 0
                          ? ""
                          : String(l.cantidad)
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      setLineas((p) =>
                        p.map((line, idx) =>
                          idx === i
                            ? {
                                ...line,
                                _cantDraft: raw,
                                cantidad: parseDecimalMientrasEscribe(raw, { allowNegative: false }),
                              }
                            : line
                        )
                      );
                    }}
                    onBlur={() => {
                      setLineas((p) =>
                        p.map((line, idx) => {
                          if (idx !== i) return line;
                          if (line._cantDraft === undefined) return line;
                          const n = parseDecimalMientrasEscribe(line._cantDraft, { allowNegative: false });
                          const { _cantDraft, ...rest } = line;
                          return { ...rest, cantidad: n };
                        })
                      );
                    }}
                  />
                </div>
                <div className="w-32 space-y-2">
                  <Label>Precio</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0,00"
                    value={
                      l._precioDraft !== undefined
                        ? l._precioDraft
                        : l.precioUnitario === 0
                          ? ""
                          : String(l.precioUnitario)
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      setLineas((p) =>
                        p.map((line, idx) =>
                          idx === i
                            ? {
                                ...line,
                                _precioDraft: raw,
                                precioUnitario: parseDecimalMientrasEscribe(raw, { allowNegative: false }),
                              }
                            : line
                        )
                      );
                    }}
                    onBlur={() => {
                      setLineas((p) =>
                        p.map((line, idx) => {
                          if (idx !== i) return line;
                          if (line._precioDraft === undefined) return line;
                          const n = parseDecimalMientrasEscribe(line._precioDraft, { allowNegative: false });
                          const { _precioDraft, ...rest } = line;
                          return { ...rest, precioUnitario: n };
                        })
                      );
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={() => removeLinea(i)}
                  disabled={lineas.length === 1}
                  aria-label="Eliminar línea"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </div>
            ))}
            <Button variant="secondary" onClick={addLinea} className="gap-2">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Añadir línea
            </Button>
            </>
            )}
            {esAmpliacion && (
              <AmpliacionCampos
                propuesta={propuesta}
                lineas={lineasFijas}
                porcentajeImpuesto={porcentajeImpuesto}
                onChange={setPropuesta}
              />
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Propuesta técnica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Emplazamiento</Label>
                <Input
                  placeholder="Obra o dirección de intervención"
                  value={propuesta.emplazamiento}
                  onChange={(e) => setPropuesta((p) => ({ ...p, emplazamiento: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Contacto</Label>
                <Input
                  placeholder="Persona o departamento"
                  value={propuesta.contacto}
                  onChange={(e) => setPropuesta((p) => ({ ...p, contacto: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Plazo de ejecución</Label>
                <Input
                  placeholder="Ej. 12 semanas · por fases"
                  value={propuesta.plazo_ejecucion}
                  onChange={(e) => setPropuesta((p) => ({ ...p, plazo_ejecucion: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Validez de la oferta</Label>
                <Input
                  value={propuesta.validez_oferta}
                  onChange={(e) => setPropuesta((p) => ({ ...p, validez_oferta: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Escala (portada)</Label>
                <Input
                  placeholder="1:1000"
                  value={propuesta.escala}
                  onChange={(e) => setPropuesta((p) => ({ ...p, escala: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>2. Objeto y alcance</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-lg border border-border bg-white px-4 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Texto de la sección objeto y alcance"
                value={propuesta.objeto_alcance}
                onChange={(e) => setPropuesta((p) => ({ ...p, objeto_alcance: e.target.value }))}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={propuesta.mostrar_zonas}
                    onChange={(e) => setPropuesta((p) => ({ ...p, mostrar_zonas: e.target.checked }))}
                  />
                  Incluir zonas de intervención en el PDF
                </label>
                {propuesta.mostrar_zonas && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  onClick={() =>
                    setPropuesta((p) => ({
                      ...p,
                      zonas: [...p.zonas, { codigo: `Z-${String(p.zonas.length + 1).padStart(2, "0")}`, titulo: "", descripcion: "" }],
                    }))
                  }
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Zona
                </Button>
                )}
              </div>
              {propuesta.mostrar_zonas && propuesta.zonas.map((z, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input
                      placeholder="Z-01"
                      value={z.codigo}
                      onChange={(e) =>
                        setPropuesta((p) => ({
                          ...p,
                          zonas: p.zonas.map((item, idx) => (idx === i ? { ...item, codigo: e.target.value } : item)),
                        }))
                      }
                    />
                    <Input
                      className="sm:col-span-2"
                      placeholder="Título"
                      value={z.titulo}
                      onChange={(e) =>
                        setPropuesta((p) => ({
                          ...p,
                          zonas: p.zonas.map((item, idx) => (idx === i ? { ...item, titulo: e.target.value } : item)),
                        }))
                      }
                    />
                  </div>
                  <textarea
                    className="flex min-h-[64px] w-full rounded-lg border border-border bg-white px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Descripción de la zona"
                    value={z.descripcion}
                    onChange={(e) =>
                      setPropuesta((p) => ({
                        ...p,
                        zonas: p.zonas.map((item, idx) => (idx === i ? { ...item, descripcion: e.target.value } : item)),
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPropuesta((p) => ({ ...p, zonas: p.zonas.filter((_, idx) => idx !== i) }))}
                  >
                    Quitar zona
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={propuesta.mostrar_programa}
                    onChange={(e) => setPropuesta((p) => ({ ...p, mostrar_programa: e.target.checked }))}
                  />
                  Incluir programa de trabajos en el PDF
                </label>
                {propuesta.mostrar_programa && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  onClick={() =>
                    setPropuesta((p) => ({
                      ...p,
                      programa: [...p.programa, { codigo: "", descripcion: "" }],
                    }))
                  }
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Fase
                </Button>
                )}
              </div>
              {propuesta.mostrar_programa && propuesta.programa.map((f, i) => (
                <div key={i} className="flex flex-wrap items-start gap-2">
                  <Input
                    className="w-28"
                    placeholder="S 01–02"
                    value={f.codigo}
                    onChange={(e) =>
                      setPropuesta((p) => ({
                        ...p,
                        programa: p.programa.map((item, idx) => (idx === i ? { ...item, codigo: e.target.value } : item)),
                      }))
                    }
                  />
                  <Input
                    className="min-w-[180px] flex-1"
                    placeholder="Descripción de la fase"
                    value={f.descripcion}
                    onChange={(e) =>
                      setPropuesta((p) => ({
                        ...p,
                        programa: p.programa.map((item, idx) =>
                          idx === i ? { ...item, descripcion: e.target.value } : item
                        ),
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label="Quitar fase"
                    onClick={() => setPropuesta((p) => ({ ...p, programa: p.programa.filter((_, idx) => idx !== i) }))}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </div>
              ))}
            </div>
            {esGaralEmisor && (
              <GaralAdjuntosField
                adjuntos={propuesta.adjuntos}
                onChange={(adjuntos) => setPropuesta((p) => ({ ...p, adjuntos }))}
              />
            )}
            <PresupuestoPresentacionField propuesta={propuesta} onChange={setPropuesta} />
            {!esAmpliacion && (
            <div className="space-y-2">
              <Label>6. Condiciones y garantías</Label>
              <textarea
                className="flex min-h-[140px] w-full rounded-lg border border-border bg-white px-4 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={propuesta.condiciones}
                onChange={(e) => setPropuesta((p) => ({ ...p, condiciones: e.target.value }))}
              />
            </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-neutral-500">Emisor:</span>{" "}
                {emisores.find((e) => e.id === emisorId)?.nombre_corto ?? "—"}
              </p>
              <p>
                <span className="text-neutral-500">Cliente:</span>{" "}
                {clientes.find((c) => c.id === clienteId)?.nombre ?? "—"}
              </p>
              <p>
                <span className="text-neutral-500">Concepto:</span> {concepto || "—"}
              </p>
              {esAmpliacion && (
                <>
                  <p>
                    <span className="text-neutral-500">Tipo:</span> Ampliación
                    {propuesta.origen_numero.trim() ? ` sobre ${propuesta.origen_numero}` : ""}
                  </p>
                  <p>
                    <span className="text-neutral-500">Altas / bajas / ajuste:</span>{" "}
                    {totAmp.altas.toLocaleString("es-ES", { style: "currency", currency: "EUR" })} −{" "}
                    {totAmp.bajas.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                    {totAmp.ajuste !== 0
                      ? ` ${totAmp.ajuste < 0 ? "−" : "+"} ${Math.abs(totAmp.ajuste).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}`
                      : ""}
                  </p>
                </>
              )}
              {esGaralEmisor && (
                <>
                  <p>
                    <span className="text-neutral-500">Partidas:</span>{" "}
                    {lineasValidas.length} en{" "}
                    {new Set(lineasValidas.map((l) => l.capitulo.trim() || "01 · Actuación")).size}{" "}
                    capítulo{new Set(lineasValidas.map((l) => l.capitulo.trim() || "01")).size === 1 ? "" : "s"}
                  </p>
                  <p>
                    <span className="text-neutral-500">Anexos:</span>{" "}
                    {propuesta.adjuntos.length === 0
                      ? "Ninguno"
                      : `${propuesta.adjuntos.length} foto${propuesta.adjuntos.length === 1 ? "" : "s"}`}
                  </p>
                </>
              )}
              <p>
                <span className="text-neutral-500">{esAmpliacion ? "Incremento neto" : "Base"}:</span>{" "}
                {baseImponible.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
              </p>
              <p>
                <span className="text-neutral-500">IVA ({porcentajeImpuesto}%):</span>{" "}
                {impuesto.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
              </p>
              <p className="font-semibold">
                <span className="text-neutral-500">Total oferta:</span>{" "}
                {total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
              </p>
              {esAmpliacion && propuesta.origen_total > 0 && (
                <p>
                  <span className="text-neutral-500">Resultante del proyecto:</span>{" "}
                  {totAmp.resultante.toLocaleString("es-ES", { style: "currency", currency: "EUR" })} + IVA{" "}
                  {totAmp.ivaResultante.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                </p>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Barra fija Atrás / Siguiente: al pie, por encima de la zona segura del móvil */}
      <div className={cn(wizardActionBarClassName, "flex justify-center px-4")}>
        <div className="flex w-full max-w-2xl justify-end gap-2">
          {step === 1 ? (
            <Button onClick={() => setStep(2)}>Siguiente</Button>
          ) : step === 2 ? (
            <>
              <Button variant="secondary" onClick={() => setStep(1)}>
                Atrás
              </Button>
              <Button onClick={() => setStep(3)} disabled={!step2Valid}>
                Siguiente
              </Button>
            </>
          ) : step === 3 ? (
            <>
              <Button variant="secondary" onClick={() => setStep(2)}>
                Atrás
              </Button>
              <Button onClick={() => setStep(4)}>Siguiente</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep(3)} disabled={creating}>
                Atrás
              </Button>
              <Button onClick={handleSave} disabled={creating}>
                {creating ? "Guardando…" : presupuestoId ? "Guardar presupuesto" : "Crear presupuesto"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
