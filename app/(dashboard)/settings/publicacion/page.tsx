"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsAdminNav } from "@/components/settings/SettingsAdminNav";
import { IdealistaPublicacionCard } from "@/components/settings/IdealistaPublicacionCard";

export default function SettingsPublicacionPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin(user?.role)) {
      router.replace("/settings");
      return;
    }
    setListo(true);
  }, [user?.role, authLoading, router]);

  if (authLoading || !listo) {
    return (
      <div>
        <PageHeader breadcrumb={[{ label: "Ajustes", href: "/settings" }, { label: "Publicación" }]} title="Publicación" />
        <p className="mt-8 text-sm text-neutral-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Ajustes", href: "/settings" }, { label: "Publicación" }]}
        title="Publicación en portales"
        description="Publicación de los inmuebles marcados en Idealista."
      />
      <SettingsAdminNav role={user?.role} />
      <div className="mt-6 max-w-3xl">
        <IdealistaPublicacionCard />
      </div>
    </div>
  );
}
