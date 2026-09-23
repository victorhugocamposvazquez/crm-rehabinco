"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { isSuperAdmin } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsAdminNav } from "@/components/settings/SettingsAdminNav";
import { SaldoBrightDataCard } from "@/components/settings/SaldoBrightDataCard";
import { ZonasIdealistaCard } from "@/components/settings/ZonasIdealistaCard";

export default function SettingsPortalesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isSuperAdmin(user?.role)) {
      router.replace("/settings");
      return;
    }
    setListo(true);
  }, [user?.role, authLoading, router]);

  if (authLoading || !listo) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Ajustes", href: "/settings" }, { label: "Captación" }]}
          title="Captación"
        />
        <p className="mt-8 text-sm text-neutral-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Ajustes", href: "/settings" }, { label: "Captación" }]}
        title="Captación"
        description="Zonas de Idealista y el gasto de Bright Data. Solo el superadministrador."
      />
      <SettingsAdminNav role={user?.role} />
      <div className="mt-6 space-y-4">
        <SaldoBrightDataCard />
        <ZonasIdealistaCard />
      </div>
    </div>
  );
}
