"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MobileNav } from "./MobileNav";
import { AppTopBar } from "./AppTopBar";
import { Sidebar } from "./Sidebar";
import { isWizardRoute } from "./wizard-chrome";
import { cn } from "@/lib/utils";
import { FiltroComercialProvider } from "@/lib/ui/filtro-comercial";
import { FichaPeekProvider } from "@/components/crm/FichaPeek";
import { AlertasPwaHost } from "@/components/pwa/AvisosPwa";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { bandejaDeTarea } from "@/lib/tareas/tareas";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wizard = isWizardRoute(pathname);
  const { user } = useAuth();
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const hoy = new Date().toISOString().slice(0, 10);
    void Promise.all([
      supabase.from("tareas").select("vence, estado"),
      supabase.from("partes_visita").select("id", { count: "exact", head: true }).eq("estado", "pendiente_firma"),
      supabase.from("captacion_anuncios").select("publicado_en, fase").eq("fase", "novedad"),
    ]).then(([tareas, partes, anuncios]) => {
      const pendientes = (tareas.data ?? []).filter((row) => {
        const bandeja = bandejaDeTarea(row.vence, hoy, row.estado);
        return bandeja === "VENCIDAS" || bandeja === "HOY";
      }).length;
      const nuevosHoy = ((anuncios.data ?? []) as Array<{ publicado_en: string | null }>).filter((row) => {
        const dia = row.publicado_en?.slice(0, 10);
        return dia === hoy;
      }).length;
      setBadges({
        "/tareas": pendientes,
        "/partes-visita": partes.count ?? 0,
        "/captacion": nuevosHoy,
      });
    });
  }, [user]);

  return (
    <FiltroComercialProvider>
      <FichaPeekProvider>
      <div className="flex min-h-screen bg-[var(--background)]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-foreground focus:px-4 focus:py-2 focus:text-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Saltar al contenido
        </a>
        {!wizard && <Sidebar badges={badges} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopBar />
          <main
            id="main-content"
            className={cn(
              "mx-auto w-full max-w-[1600px] flex-1 px-3.5 pt-5 min-[820px]:px-6 min-[820px]:pt-6",
              wizard
                ? "pb-4 md:pb-10"
                : "pb-[calc(6rem+env(safe-area-inset-bottom,0px))] min-[820px]:pb-10"
            )}
          >
            {children}
          </main>
          {!wizard && <MobileNav />}
        </div>
      </div>
      <AlertasPwaHost />
      </FichaPeekProvider>
    </FiltroComercialProvider>
  );
}
