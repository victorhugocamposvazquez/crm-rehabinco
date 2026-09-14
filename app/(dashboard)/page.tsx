"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin, isComercial } from "@/lib/auth/roles";
import { HoyCaptacion } from "@/components/captacion/HoyCaptacion";

interface MesFacturado {
  mes: string;
  total: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const mostrarFacturacion = isAdmin(user?.role) && !isComercial(user?.role);
  const [facturacionMeses, setFacturacionMeses] = useState<MesFacturado[]>([]);
  const saludo = isAdmin(user?.role)
    ? "Hoy · equipo"
    : `Hola, ${(user?.nombre || user?.email || "").split(" ")[0] || "equipo"}`;
  const fecha = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  useEffect(() => {
    if (!user || !mostrarFacturacion) return;
    const supabase = createClient();
    const now = new Date();
    const meses: { start: string; end: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      meses.push({
        start: d.toISOString().slice(0, 10),
        end: next.toISOString().slice(0, 10),
        label: d.toLocaleDateString("es-ES", { month: "short" }),
      });
    }
    void supabase
      .from("facturas")
      .select("total, fecha_emision")
      .eq("estado", "pagada")
      .gte("fecha_emision", meses[0].start)
      .then(({ data }) => {
        setFacturacionMeses(
          meses.map((mes) => ({
            mes: mes.label.replace(".", ""),
            total: (data ?? [])
              .filter((f) => f.fecha_emision >= mes.start && f.fecha_emision < mes.end)
              .reduce((acc, f) => acc + Number(f.total ?? 0), 0),
          }))
        );
      });
  }, [user, mostrarFacturacion]);

  return (
    <div className="animate-rise">
      <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-[var(--label)]">{fecha}</p>
      <h1 className="mt-1">{saludo}</h1>
      <div className="mt-5">
        <HoyCaptacion facturacionMeses={mostrarFacturacion ? facturacionMeses : undefined} />
      </div>
    </div>
  );
}
