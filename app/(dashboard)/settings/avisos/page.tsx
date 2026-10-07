"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { isSuperAdmin } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsAdminNav } from "@/components/settings/SettingsAdminNav";
import { AvisosPwaCard } from "@/components/pwa/AvisosPwa";
import { SistemaAvisosCard } from "@/components/settings/SistemaAvisosCard";

export default function SettingsAvisosPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role === "editor") {
      router.replace("/settings");
      return;
    }
    setListo(true);
  }, [user, authLoading, router]);

  if (authLoading || !listo) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Ajustes", href: "/settings" }, { label: "Avisos" }]}
          title="Avisos"
        />
        <p className="mt-8 text-sm text-neutral-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Ajustes", href: "/settings" }, { label: "Avisos" }]}
        title="Avisos"
        description="Este dispositivo, de quién quieres recibir avisos y qué tipos."
      />
      <SettingsAdminNav role={user?.role} />
      <div className="mt-6 space-y-4 min-[820px]:overflow-hidden">
        <AvisosPwaCard />
        {isSuperAdmin(user?.role) ? <SistemaAvisosCard /> : null}
      </div>
    </div>
  );
}
