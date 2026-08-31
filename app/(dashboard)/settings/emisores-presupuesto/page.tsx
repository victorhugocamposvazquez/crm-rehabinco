"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { resolveInvoiceLogoUrl } from "@/lib/empresa-facturacion";
import type { EmisorPresupuesto } from "@/lib/emisores-presupuesto";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

type FormEmisor = Omit<EmisorPresupuesto, "activo">;

function EmisorForm({
  emisor,
  onSaved,
}: {
  emisor: FormEmisor;
  onSaved: (next: FormEmisor) => void;
}) {
  const [form, setForm] = useState(emisor);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(emisor);
  }, [emisor]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("emisores_presupuesto")
      .update({
        nombre_corto: form.nombre_corto.trim(),
        razon_social: form.razon_social.trim(),
        nif: form.nif.trim(),
        direccion: form.direccion.trim(),
        codigo_postal: form.codigo_postal.trim(),
        localidad: form.localidad.trim(),
        provincia: form.provincia.trim(),
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        iban: form.iban.trim() || null,
        numero_cuenta_bancaria: form.numero_cuenta_bancaria.trim() || null,
        logo_url: form.logo_url.trim() || null,
      })
      .eq("id", form.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onSaved(form);
    toast.success(`Datos de ${form.nombre_corto || form.slug} guardados.`);
  };

  const prefix = form.slug;

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-logo`}>Logotipo</Label>
        <Input
          id={`${prefix}-logo`}
          value={form.logo_url}
          onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
          placeholder="https://… o /images/mi-logo.png"
          autoComplete="off"
        />
        {form.logo_url.trim() && typeof window !== "undefined" ? (
          <img
            src={resolveInvoiceLogoUrl(form.logo_url, window.location.origin)}
            alt={`Vista previa logo ${form.nombre_corto}`}
            className="mt-2 h-12 w-auto max-w-[200px] object-contain"
            onError={(ev) => {
              (ev.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-corto`}>Nombre en el selector</Label>
        <Input
          id={`${prefix}-corto`}
          value={form.nombre_corto}
          onChange={(e) => setForm((f) => ({ ...f, nombre_corto: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-razon`}>Razón social</Label>
        <Input
          id={`${prefix}-razon`}
          value={form.razon_social}
          onChange={(e) => setForm((f) => ({ ...f, razon_social: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-nif`}>NIF / CIF</Label>
        <Input
          id={`${prefix}-nif`}
          value={form.nif}
          onChange={(e) => setForm((f) => ({ ...f, nif: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-dir`}>Dirección</Label>
        <Input
          id={`${prefix}-dir`}
          value={form.direccion}
          onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-cp`}>Código postal</Label>
          <Input
            id={`${prefix}-cp`}
            value={form.codigo_postal}
            onChange={(e) => setForm((f) => ({ ...f, codigo_postal: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-loc`}>Localidad</Label>
          <Input
            id={`${prefix}-loc`}
            value={form.localidad}
            onChange={(e) => setForm((f) => ({ ...f, localidad: e.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-prov`}>Provincia</Label>
        <Input
          id={`${prefix}-prov`}
          value={form.provincia}
          onChange={(e) => setForm((f) => ({ ...f, provincia: e.target.value }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-tel`}>Teléfono</Label>
          <Input
            id={`${prefix}-tel`}
            type="tel"
            value={form.telefono}
            onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            placeholder="Opcional"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}-em`}>Email</Label>
          <Input
            id={`${prefix}-em`}
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Opcional"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-iban`}>IBAN</Label>
        <Input
          id={`${prefix}-iban`}
          value={form.iban}
          onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-ncta`}>Número de cuenta</Label>
        <Input
          id={`${prefix}-ncta`}
          value={form.numero_cuenta_bancaria}
          onChange={(e) => setForm((f) => ({ ...f, numero_cuenta_bancaria: e.target.value }))}
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}

export default function EmisoresPresupuestoPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [emisores, setEmisores] = useState<FormEmisor[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (user?.role !== "admin") {
      router.replace("/settings");
      return;
    }
    const supabase = createClient();
    supabase
      .from("emisores_presupuesto")
      .select("*")
      .order("nombre_corto")
      .then(({ data, error }) => {
        if (error) {
          toast.error(error.message);
        } else {
          setEmisores(
            (data ?? []).map((row) => ({
              id: row.id,
              slug: row.slug,
              nombre_corto: row.nombre_corto ?? "",
              razon_social: row.razon_social ?? "",
              nif: row.nif ?? "",
              direccion: row.direccion ?? "",
              codigo_postal: row.codigo_postal ?? "",
              localidad: row.localidad ?? "",
              provincia: row.provincia ?? "",
              telefono: row.telefono ?? "",
              email: row.email ?? "",
              iban: row.iban ?? "",
              numero_cuenta_bancaria: row.numero_cuenta_bancaria ?? "",
              logo_url: row.logo_url ?? "",
            }))
          );
        }
        setLoading(false);
      });
  }, [user?.role, authLoading, router]);

  if (authLoading) {
    return (
      <div>
        <PageHeader
          breadcrumb={[
            { label: "Ajustes", href: "/settings" },
            { label: "Emisores de presupuesto" },
          ]}
          title="Emisores de presupuesto"
        />
        <p className="mt-6 text-sm text-neutral-500">Cargando…</p>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return null;
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Ajustes", href: "/settings" },
          { label: "Emisores de presupuesto" },
        ]}
        title="Emisores de presupuesto"
        description="Rehabinco S.L. y Garal. Cada uno tiene su logotipo y datos fiscales en el PDF del presupuesto. Las facturas no usan estos datos."
      />

      {loading ? (
        <p className="mt-8 text-sm text-neutral-500">Cargando…</p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {emisores.map((emisor) => (
            <Card key={emisor.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5" strokeWidth={1.5} />
                  {emisor.nombre_corto || emisor.slug}
                </CardTitle>
                <CardDescription>
                  {emisor.slug === "garal"
                    ? "Datos pendientes: rellénalos cuando tengas NIF, dirección y logo."
                    : "Datos del emisor Rehabinco en presupuestos."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmisorForm
                  emisor={emisor}
                  onSaved={(next) =>
                    setEmisores((list) => list.map((e) => (e.id === next.id ? next : e)))
                  }
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Button type="button" variant="secondary" asChild>
          <Link href="/settings">Volver a ajustes</Link>
        </Button>
      </div>
    </div>
  );
}
