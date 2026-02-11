"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Linea {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

export function PresupuestoWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string }>>([]);
  const [clienteId, setClienteId] = useState("");
  const [concepto, setConcepto] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [lineas, setLineas] = useState<Linea[]>([
    { descripcion: "", cantidad: 0, precioUnitario: 0 },
  ]);
  const [porcentajeImpuesto, setPorcentajeImpuesto] = useState(21);
  const [porcentajeDescuento, setPorcentajeDescuento] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("clientes")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setClientes(data ?? []));
  }, []);

  const addLinea = () =>
    setLineas((p) => [...p, { descripcion: "", cantidad: 0, precioUnitario: 0 }]);
  const removeLinea = (i: number) =>
    setLineas((p) => p.filter((_, idx) => idx !== i));
  const updateLinea = (i: number, field: keyof Linea, value: string | number) =>
    setLineas((p) =>
      p.map((l, idx) => (idx === i ? { ...l, [field]: value } : l))
    );

  const baseImponible = lineas.reduce(
    (acc, l) => acc + Number(l.cantidad) * Number(l.precioUnitario),
    0
  );
  const impuesto = (baseImponible * (porcentajeImpuesto / 100));
  const descuento = (baseImponible * (porcentajeDescuento / 100));
  const total = baseImponible + impuesto - descuento;

  const canGoStep2 = clienteId && lineas.every((l) => l.descripcion.trim() && l.cantidad > 0 && l.precioUnitario >= 0);

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Sesión expirada");
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
        porcentaje_descuento: porcentajeDescuento,
      })
      .select("id")
      .single();

    if (errPresup || !presupuesto) {
      setError(errPresup?.message ?? "Error al crear presupuesto");
      setCreating(false);
      return;
    }

    const lineasToInsert = lineas
      .filter((l) => l.descripcion.trim() && l.cantidad > 0)
      .map((l, orden) => ({
        presupuesto_id: presupuesto.id,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio_unitario: l.precioUnitario,
        orden,
      }));

    const { error: errLineas } = await supabase
      .from("presupuesto_lineas")
      .insert(lineasToInsert);

    if (errLineas) {
      setError(errLineas.message);
      setCreating(false);
      return;
    }

    toast.success("Presupuesto creado");
    router.push(`/presupuestos/${presupuesto.id}`);
    router.refresh();
    setCreating(false);
  };

  return (
    <div className="relative mx-auto max-w-2xl animate-[fadeIn_0.3s_ease-out] pb-28 md:pb-24">
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "flex flex-1 items-center gap-2",
              s < 3 && "after:h-0.5 after:flex-1 after:bg-border"
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
              {s === 1 ? "Cliente y datos" : s === 2 ? "Líneas" : "Resumen"}
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
            </div>
            <div className="space-y-2">
              <Label>Concepto</Label>
              <Input
                placeholder="Ej. Reforma integral"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Líneas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lineas.map((l, i) => (
              <div
                key={i}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-4"
              >
                <div className="flex-1 min-w-[200px] space-y-2">
                  <Label>Descripción</Label>
                  <Input
                    placeholder="Descripción"
                    value={l.descripcion}
                    onChange={(e) => updateLinea(i, "descripcion", e.target.value)}
                  />
                </div>
                <div className="w-24 space-y-2">
                  <Label>Cant.</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.cantidad || ""}
                    onChange={(e) => updateLinea(i, "cantidad", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="w-32 space-y-2">
                  <Label>Precio</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.precioUnitario || ""}
                    onChange={(e) =>
                      updateLinea(i, "precioUnitario", parseFloat(e.target.value) || 0)
                    }
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
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-neutral-500">Cliente:</span>{" "}
                {clientes.find((c) => c.id === clienteId)?.nombre ?? "—"}
              </p>
              <p>
                <span className="text-neutral-500">Concepto:</span> {concepto || "—"}
              </p>
              <p>
                <span className="text-neutral-500">Base:</span>{" "}
                {baseImponible.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
              </p>
              <p>
                <span className="text-neutral-500">IVA ({porcentajeImpuesto}%):</span>{" "}
                {impuesto.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
              </p>
              <p className="font-semibold">
                <span className="text-neutral-500">Total:</span>{" "}
                {total.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
              </p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Barra fija Atrás / Siguiente */}
      <div className="fixed bottom-[4.25rem] left-0 right-0 z-40 flex justify-center border-t border-border bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur md:bottom-0">
        <div className="flex w-full max-w-2xl justify-end gap-2">
          {step === 1 ? (
            <Button onClick={() => setStep(2)}>Siguiente</Button>
          ) : step === 2 ? (
            <>
              <Button variant="secondary" onClick={() => setStep(1)}>
                Atrás
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canGoStep2}>
                Siguiente
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep(2)} disabled={creating}>
                Atrás
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creando…" : "Crear presupuesto"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
