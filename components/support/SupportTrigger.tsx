"use client";

import { useCallback, useEffect, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { isSuperAdmin } from "@/lib/auth/roles";
import { fetchSupportStatus } from "@/lib/support/client";
import { initSupportTelemetry } from "@/lib/support/telemetry";
import { SupportDrawer } from "./SupportDrawer";

export function SupportTrigger() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [activo, setActivo] = useState(true);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [pendientesAccion, setPendientesAccion] = useState(0);

  useEffect(() => {
    initSupportTelemetry();
  }, []);

  const refrescar = useCallback(() => {
    if (!user) return;
    void fetchSupportStatus()
      .then((res) => {
        setActivo(res.activo);
        setMotivo(res.motivo);
        setPendientesAccion(res.esperandoConfirmacionCount);
        setCargado(true);
      })
      .catch(() => {
        setCargado(true);
      });
  }, [user]);

  useEffect(() => {
    refrescar();
    const timer = window.setInterval(refrescar, 45000);
    return () => window.clearInterval(timer);
  }, [refrescar]);

  if (!user) return null;
  // Si la empresa NO tiene el plan activo, ocultamos el icono a usuarios finales salvo admin/superadmin
  if (cargado && !activo && !isSuperAdmin(user.role) && user.role !== "admin") {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={
          pendientesAccion > 0
            ? `Soporte (${pendientesAccion} esperando tu confirmación)`
            : "Soporte y ayuda"
        }
        aria-label="Soporte y ayuda"
        className="relative grid h-9 w-9 place-items-center rounded-[9px] text-[var(--text-2)] hover:bg-[var(--surface-soft)] hover:text-foreground"
      >
        <LifeBuoy className="h-4 w-4" strokeWidth={1.75} />
        {pendientesAccion > 0 ? (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500" />
        ) : null}
      </button>
      <SupportDrawer
        open={open}
        onOpenChange={setOpen}
        activo={activo}
        motivoInactivo={motivo}
        onCreated={refrescar}
      />
    </>
  );
}
