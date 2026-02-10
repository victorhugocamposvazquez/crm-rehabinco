"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  facturaStep1Schema,
  facturaStep2Schema,
  type FacturaStep1Values,
  type FacturaStep2Values,
  type FacturaLinea,
} from "@/lib/validations/factura";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

const STEPS = [
  { id: 1, title: "Cliente y fechas" },
  { id: 2, title: "Líneas" },
  { id: 3, title: "Resumen" },
  { id: 4, title: "Confirmar" },
];

type EstadoInicial = "borrador" | "emitida";

type WizardData = FacturaStep1Values & FacturaStep2Values & { estadoInicial?: EstadoInicial };

export function FacturaWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Partial<WizardData>>({});
  const [estadoInicial, setEstadoInicial] = useState<EstadoInicial>("borrador");
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string }>>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("clientes")
      .select("id, nombre")
      .order("nombre")
      .then(({ data: list }) => setClientes(list ?? []));
  }, []);

  const formStep1 = useForm<FacturaStep1Values>({
    resolver: zodResolver(facturaStep1Schema),
    defaultValues: { clienteId: "", concepto: "", fechaEmision: "", fechaVencimiento: "" },
  });

  const [lineas, setLineas] = useState<FacturaLinea[]>([
    { descripcion: "", cantidad: 0, precioUnitario: 0 },
  ]);

  const onStep1 = formStep1.handleSubmit((values) => {
    setData((p) => ({ ...p, ...values }));
    setStep(2);
  });

  const onStep2 = () => {
    const valid = lineas.every(
      (l) => l.descripcion.trim() && l.cantidad >= 0 && l.precioUnitario >= 0
    );
    if (!valid) return;
    setData((p) => ({ ...p, lineas }));
    setStep(3);
  };

  const addLinea = () =>
    setLineas((p) => [...p, { descripcion: "", cantidad: 0, precioUnitario: 0 }]);
  const removeLinea = (i: number) =>
    setLineas((p) => p.filter((_, idx) => idx !== i));
  const updateLinea = (i: number, field: keyof FacturaLinea, value: string | number) =>
    setLineas((p) =>
      p.map((l, idx) => (idx === i ? { ...l, [field]: value } : l))
    );

  const total = lineas.reduce(
    (acc, l) => acc + l.cantidad * l.precioUnitario,
    0
  );
  const clienteNombre =
    clientes.find((c) => c.id === data.clienteId)?.nombre ?? "—";

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleCreate = async () => {
    setCreateError(null);
    setCreating(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCreateError("Sesión expirada");
      setCreating(false);
      return;
    }
    const clienteId = data.clienteId || null;
    const { count } = await supabase.from("facturas").select("id", { count: "exact", head: true });
    const nextNum = (count ?? 0) + 1;
    const numero = `FAC-${new Date().getFullYear()}-${String(nextNum).padStart(3, "0")}`;

    const { data: factura, error: errFactura } = await supabase
      .from("facturas")
      .insert({
        user_id: user.id,
        cliente_id: clienteId || null,
        numero,
        estado: estadoInicial,
        concepto: data.concepto || null,
        fecha_emision: data.fechaEmision || null,
        fecha_vencimiento: data.fechaVencimiento || null,
      })
      .select("id")
      .single();

    if (errFactura || !factura) {
      setCreateError(errFactura?.message ?? "Error al crear factura");
      setCreating(false);
      return;
    }

    const lineasToInsert = (data.lineas ?? lineas).map((l, orden) => ({
      factura_id: factura.id,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unitario: l.precioUnitario,
      orden,
    }));
    const { error: errLineas } = await supabase.from("factura_lineas").insert(lineasToInsert);

    setCreating(false);
    if (errLineas) {
      setCreateError(errLineas.message);
      return;
    }
    router.push("/facturas");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-xl animate-[fadeIn_0.3s_ease-out]">
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, idx) => (
          <div
            key={s.id}
            className={cn(
              "flex flex-1 items-center gap-2",
              idx < STEPS.length - 1 && "after:h-0.5 after:flex-1 after:bg-border"
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                step >= s.id
                  ? "bg-foreground text-background"
                  : "bg-neutral-100 text-neutral-500"
              )}
            >
              {s.id}
            </div>
            <span
              className={cn(
                "hidden text-sm font-medium sm:inline",
                step === s.id ? "text-foreground" : "text-neutral-500"
              )}
            >
              {s.title}
            </span>
          </div>
        ))}
      </div>

      <div key={step} className="animate-[slideUp_0.3s_ease-out]">
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Cliente y fechas</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onStep1} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <select
                    className="flex h-11 w-full rounded-lg border border-border bg-white px-4 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...formStep1.register("clienteId")}
                  >
                    <option value="">Selecciona un cliente</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  {formStep1.formState.errors.clienteId && (
                    <p className="text-sm text-red-600">
                      {formStep1.formState.errors.clienteId.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Concepto</Label>
                  <Input
                    placeholder="Ej. Gestión alquiler"
                    {...formStep1.register("concepto")}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fecha emisión</Label>
                    <Input
                      type="date"
                      {...formStep1.register("fechaEmision")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha vencimiento</Label>
                    <Input
                      type="date"
                      {...formStep1.register("fechaVencimiento")}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="submit">Siguiente</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Líneas de factura</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lineas.map((l, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-4"
                >
                  <div className="flex-1 space-y-2 min-w-[200px]">
                    <Label>Descripción</Label>
                    <Input
                      placeholder="Descripción"
                      value={l.descripcion}
                      onChange={(e) =>
                        updateLinea(i, "descripcion", e.target.value)
                      }
                    />
                  </div>
                  <div className="w-24 space-y-2">
                    <Label>Cant.</Label>
                    <Input
                      type="number"
                      min={0}
                      value={l.cantidad || ""}
                      onChange={(e) =>
                        updateLinea(i, "cantidad", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="w-28 space-y-2">
                    <Label>Precio u.</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={l.precioUnitario || ""}
                      onChange={(e) =>
                        updateLinea(
                          i,
                          "precioUnitario",
                          Number(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLinea(i)}
                    disabled={lineas.length === 1}
                    aria-label="Eliminar línea"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={addLinea}>
                <Plus className="mr-2 h-4 w-4" />
                Añadir línea
              </Button>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={handleBack}>
                  Atrás
                </Button>
                <Button onClick={onStep2}>Siguiente</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-neutral-500">Cliente</dt>
                  <dd className="font-medium">{clienteNombre}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Concepto</dt>
                  <dd className="font-medium">{data.concepto || "—"}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Líneas</dt>
                  <dd className="font-medium">{lineas.length}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Total</dt>
                  <dd className="text-lg font-semibold">
                    {total.toFixed(2)} €
                  </dd>
                </div>
              </dl>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={handleBack}>
                  Atrás
                </Button>
                <Button onClick={() => setStep(4)}>Siguiente</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Confirmar y crear</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-neutral-600">
                Estado inicial de la factura:
              </p>
              <div className="flex gap-2">
                <Badge
                  variant={estadoInicial === "borrador" ? "default" : "borrador"}
                  className={cn(
                    "cursor-pointer transition-opacity",
                    estadoInicial === "borrador" && "ring-2 ring-foreground"
                  )}
                  onClick={() => setEstadoInicial("borrador")}
                >
                  Borrador
                </Badge>
                <Badge
                  variant={estadoInicial === "emitida" ? "default" : "emitida"}
                  className={cn(
                    "cursor-pointer transition-opacity",
                    estadoInicial === "emitida" && "ring-2 ring-foreground"
                  )}
                  onClick={() => setEstadoInicial("emitida")}
                >
                  Emitida
                </Badge>
              </div>
              {createError && (
                <p className="text-sm text-red-600">{createError}</p>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={handleBack} disabled={creating}>
                  Atrás
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? "Creando…" : "Crear factura"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
