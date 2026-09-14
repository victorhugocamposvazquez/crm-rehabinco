"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ComercialRow = {
  id: string;
  nombre_completo: string | null;
  email: string | null;
  zona: string | null;
  color: string;
  activo: boolean;
  role: string;
};

export function EquipoComercialesCard() {
  const [filas, setFilas] = useState<ComercialRow[]>([]);

  const cargar = () => {
    const supabase = createClient();
    void supabase
      .from("profiles")
      .select("id, nombre_completo, email, zona, color, activo, role")
      .in("role", ["comercial", "admin"])
      .order("nombre_completo")
      .then(({ data }) => setFilas((data ?? []) as ComercialRow[]));
  };

  useEffect(() => {
    cargar();
  }, []);

  const toggleActivo = async (id: string, activo: boolean) => {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ activo, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      toast.error("No se ha podido actualizar.");
      return;
    }
    cargar();
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Equipo comercial</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-neutral-500">Color y zona salen en el calendario. Desactiva a quien ya no capta.</p>
        <ul className="space-y-2">
          {filas.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E6E3DD] px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: item.color || "#3A6A82" }} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.nombre_completo || item.email}</p>
                  <p className="text-xs text-neutral-500">{item.zona || "Sin zona"} · {item.role}</p>
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-[#0B7461] hover:underline"
                onClick={() => void toggleActivo(item.id, !item.activo)}
              >
                {item.activo ? "Activo" : "Inactivo"}
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
