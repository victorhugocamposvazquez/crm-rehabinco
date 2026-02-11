"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  clienteStep1Schema,
  clienteStep2Schema,
  type ClienteStep1Values,
  type ClienteStep2Values,
} from "@/lib/validations/cliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Datos básicos" },
  { id: 2, title: "Dirección y notas" },
  { id: 3, title: "Resumen" },
];

type WizardData = ClienteStep1Values & ClienteStep2Values & { activo?: boolean };

interface ClienteWizardProps {
  clienteId?: string;
}

export function ClienteWizard({ clienteId }: ClienteWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Partial<WizardData>>({});
  const [loading, setLoading] = useState(!!clienteId);

  useEffect(() => {
    if (!clienteId) return;
    const supabase = createClient();
    supabase
      .from("clientes")
      .select("*")
      .eq("id", clienteId)
      .single()
      .then(({ data: row, error }) => {
        if (error || !row) {
          setLoading(false);
          return;
        }
        const r = row as { nombre: string; email: string | null; telefono: string | null; nif: string | null; direccion: string | null; notas: string | null; activo: boolean };
        setData({
          nombre: r.nombre,
          email: r.email ?? "",
          telefono: r.telefono ?? "",
          nif: r.nif ?? "",
          direccion: r.direccion ?? "",
          notas: r.notas ?? "",
          activo: r.activo ?? true,
        });
        setLoading(false);
      });
  }, [clienteId]);

  const formStep1 = useForm<ClienteStep1Values>({
    resolver: zodResolver(clienteStep1Schema),
    defaultValues: { nombre: "", email: "", telefono: "", nif: "" },
    values: data?.nombre ? { nombre: data.nombre, email: data.email ?? "", telefono: data.telefono ?? "", nif: data.nif ?? "" } : undefined,
  });

  const formStep2 = useForm<ClienteStep2Values>({
    resolver: zodResolver(clienteStep2Schema),
    defaultValues: { direccion: "", notas: "" },
    values: data ? { direccion: data.direccion ?? "", notas: data.notas ?? "" } : undefined,
  });

  const onStep1 = formStep1.handleSubmit((values) => {
    setData((p) => ({ ...p, ...values }));
    setStep(2);
  });

  const onStep2 = formStep2.handleSubmit((values) => {
    setData((p) => ({ ...p, ...values }));
    setStep(3);
  });

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaveError("Sesión expirada");
      setSaving(false);
      return;
    }
    const payload = {
      nombre: data.nombre ?? "",
      email: data.email || null,
      telefono: data.telefono || null,
      nif: data.nif || null,
      direccion: data.direccion || null,
      notas: data.notas || null,
      activo: data.activo ?? true,
    };
    const { error } = clienteId
      ? await supabase.from("clientes").update(payload).eq("id", clienteId)
      : await supabase.from("clientes").insert({ ...payload, user_id: user.id });
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    router.push(clienteId ? `/clientes/${clienteId}` : "/clientes");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl animate-[fadeIn_0.3s_ease-out]">
      <div className="mb-8 flex items-center justify-between gap-2">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={cn(
              "flex flex-1 items-center gap-2",
              s.id < STEPS.length && "after:h-0.5 after:flex-1 after:bg-border"
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

      <div
        key={step}
        className="animate-[slideUp_0.3s_ease-out]"
        style={{ animationDuration: "0.3s" }}
      >
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Datos básicos</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onStep1} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    placeholder="Nombre del cliente"
                    {...formStep1.register("nombre")}
                  />
                  {formStep1.formState.errors.nombre && (
                    <p className="text-sm text-red-600">
                      {formStep1.formState.errors.nombre.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@ejemplo.com"
                    {...formStep1.register("email")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    placeholder="+34 600 000 000"
                    {...formStep1.register("telefono")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nif">NIF</Label>
                  <Input
                    id="nif"
                    placeholder="12345678A"
                    {...formStep1.register("nif")}
                  />
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
              <CardTitle>Dirección y notas</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onStep2} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input
                    id="direccion"
                    placeholder="Calle, número, ciudad"
                    {...formStep2.register("direccion")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notas">Notas</Label>
                  <textarea
                    id="notas"
                    className="flex min-h-[100px] w-full rounded-lg border border-border bg-white px-4 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Notas internas"
                    {...formStep2.register("notas")}
                  />
                </div>
                {clienteId && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="activo"
                      checked={data.activo ?? true}
                      onChange={(e) => setData((p) => ({ ...p, activo: e.target.checked }))}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="activo">Cliente activo</Label>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="secondary" onClick={handleBack}>
                    Atrás
                  </Button>
                  <Button type="submit">Siguiente</Button>
                </div>
              </form>
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
                  <dt className="text-neutral-500">Nombre</dt>
                  <dd className="font-medium">{data.nombre ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Email</dt>
                  <dd className="font-medium">{data.email || "—"}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Teléfono</dt>
                  <dd className="font-medium">{data.telefono || "—"}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Dirección</dt>
                  <dd className="font-medium">{data.direccion || "—"}</dd>
                </div>
                {clienteId && (
                  <div>
                    <dt className="text-neutral-500">Estado</dt>
                    <dd className="font-medium">{data.activo !== false ? "Activo" : "Inactivo"}</dd>
                  </div>
                )}
              </dl>
              {saveError && (
                <p className="text-sm text-red-600">{saveError}</p>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={handleBack} disabled={saving}>
                  Atrás
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando…" : "Guardar cliente"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
