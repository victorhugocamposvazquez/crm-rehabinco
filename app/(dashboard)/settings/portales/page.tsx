"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SettingsAdminNav } from "@/components/settings/SettingsAdminNav";
import type { PortalApi } from "@/lib/captacion/portales/credenciales";

type EstadoPortal = { enApp: boolean; enServidor: boolean; keyHint: string | null };

const PORTALES: Array<{
  id: PortalApi;
  nombre: string;
  color: string;
  ayuda: string;
  enlace: { href: string; label: string };
}> = [
  {
    id: "idealista",
    nombre: "Idealista",
    color: "#B5D334",
    ayuda: "Search API oficial (OAuth2). Pide acceso en developers.idealista.com y pega aquí la API key y el secret.",
    enlace: { href: "https://developers.idealista.com/access-request", label: "Pedir acceso a Idealista" },
  },
  {
    id: "fotocasa",
    nombre: "Fotocasa",
    color: "#5B4FC9",
    ayuda: "Puedes guardar las claves ya. Fotocasa Pro sirve para publicar cartera; la lectura de anuncios ajenos se activa cuando exista un canal oficial.",
    enlace: { href: "https://www.fotocasa.es/es/info/profesionales", label: "Fotocasa profesionales" },
  },
];

const vacio = { api_key: "", api_secret: "" };

export default function SettingsPortalesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState<Record<PortalApi, EstadoPortal>>({
    idealista: { enApp: false, enServidor: false, keyHint: null },
    fotocasa: { enApp: false, enServidor: false, keyHint: null },
  });
  const [forms, setForms] = useState<Record<PortalApi, { api_key: string; api_secret: string }>>({
    idealista: { ...vacio },
    fotocasa: { ...vacio },
  });
  const [saving, setSaving] = useState<PortalApi | null>(null);
  const [probando, setProbando] = useState(false);

  const cargar = async () => {
    const res = await fetch("/api/captacion/portales/credenciales");
    const json = (await res.json()) as { ok?: boolean; error?: string; portales?: Record<PortalApi, EstadoPortal> };
    if (!res.ok || !json.ok || !json.portales) {
      toast.error(json.error || "No se han podido leer las APIs.");
      setLoading(false);
      return;
    }
    setEstado(json.portales);
    setForms({ idealista: { ...vacio }, fotocasa: { ...vacio } });
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (user?.role !== "admin") {
      router.replace("/settings");
      return;
    }
    void cargar();
  }, [user?.role, authLoading, router]);

  const guardar = async (portal: PortalApi, borrar = false) => {
    setSaving(portal);
    const form = forms[portal];
    const res = await fetch("/api/captacion/portales/credenciales", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portal,
        borrar,
        api_key: borrar ? "" : form.api_key,
        api_secret: borrar ? "" : form.api_secret,
      }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string; portal?: EstadoPortal };
    setSaving(null);
    if (!res.ok || !json.ok) {
      toast.error(json.error || "No se ha podido guardar.");
      return;
    }
    if (json.portal) setEstado((prev) => ({ ...prev, [portal]: json.portal! }));
    setForms((prev) => ({ ...prev, [portal]: { ...vacio } }));
    toast.success(borrar ? "Claves eliminadas." : "Claves guardadas.");
  };

  const probar = async () => {
    setProbando(true);
    const res = await fetch("/api/captacion/portales/credenciales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portal: "idealista",
        api_key: forms.idealista.api_key,
        api_secret: forms.idealista.api_secret,
      }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    setProbando(false);
    if (!res.ok || !json.ok) {
      toast.error(json.error || "Idealista no ha aceptado las claves.");
      return;
    }
    toast.success("Conexión correcta con Idealista.");
  };

  if (authLoading || loading) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Ajustes", href: "/settings" }, { label: "APIs de portales" }]}
          title="APIs de portales"
        />
        <p className="mt-8 text-sm text-neutral-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Ajustes", href: "/settings" }, { label: "APIs de portales" }]}
        title="APIs de portales"
        description="Solo dirección. Las claves no se muestran enteras después de guardar y no van al navegador de los comerciales."
      />
      <SettingsAdminNav />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {PORTALES.map((portal) => {
          const st = estado[portal.id];
          const form = forms[portal.id];
          const listo = st.enApp || st.enServidor;
          return (
            <Card key={portal.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: portal.color }} />
                  {portal.nombre}
                </CardTitle>
                <CardDescription>{portal.ayuda}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-[13px]">
                  {st.enApp ? (
                    <span className="font-medium text-accent-dark">Guardadas en el CRM{st.keyHint ? ` (${st.keyHint})` : ""}.</span>
                  ) : st.enServidor ? (
                    <span className="font-medium text-accent-dark">Hay claves en el servidor (Vercel).</span>
                  ) : (
                    <span className="text-[var(--text-2)]">Sin configurar.</span>
                  )}
                </p>
                <div className="space-y-2">
                  <Label htmlFor={`${portal.id}-key`}>API key</Label>
                  <Input
                    id={`${portal.id}-key`}
                    type="password"
                    autoComplete="off"
                    placeholder={st.keyHint ?? "Pega la API key"}
                    value={form.api_key}
                    onChange={(e) => setForms((prev) => ({ ...prev, [portal.id]: { ...prev[portal.id], api_key: e.target.value } }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${portal.id}-secret`}>API secret</Label>
                  <Input
                    id={`${portal.id}-secret`}
                    type="password"
                    autoComplete="off"
                    placeholder={listo ? "••••••••" : "Pega el secret"}
                    value={form.api_secret}
                    onChange={(e) => setForms((prev) => ({ ...prev, [portal.id]: { ...prev[portal.id], api_secret: e.target.value } }))}
                  />
                </div>
                <p className="text-[12.5px] text-[var(--text-3)]">
                  Si dejas un campo vacío al guardar, se conserva el valor anterior.{" "}
                  <a href={portal.enlace.href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-dark">
                    {portal.enlace.label}
                  </a>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={saving === portal.id} onClick={() => void guardar(portal.id)}>
                    {saving === portal.id ? "Guardando…" : "Guardar"}
                  </Button>
                  {portal.id === "idealista" ? (
                    <Button type="button" variant="secondary" disabled={probando} onClick={() => void probar()}>
                      {probando ? "Comprobando…" : "Comprobar conexión"}
                    </Button>
                  ) : null}
                  {st.enApp ? (
                    <Button type="button" variant="secondary" disabled={saving === portal.id} onClick={() => void guardar(portal.id, true)}>
                      Quitar
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="mt-6 text-[13px] text-[var(--text-2)]">
        Con Idealista configurado, abre{" "}
        <Link href="/captacion" className="font-medium text-accent-dark">
          Captación
        </Link>{" "}
        y pulsa Actualizar, o espera al cron diario.
      </p>
    </div>
  );
}
