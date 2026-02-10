"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ClienteCard } from "@/components/clientes/ClienteCard";
import { ClienteListSkeleton } from "@/components/clientes/ClienteListSkeleton";
import { Fab } from "@/components/ui/fab";

export default function ClientesPage() {
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<Array<{
    id: string;
    nombre: string;
    email: string | null;
    telefono: string | null;
    activo: boolean;
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("clientes")
      .select("id, nombre, email, telefono, activo")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setClientes([]);
        } else {
          setClientes(data ?? []);
        }
        setLoading(false);
      });
  }, []);

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Clientes
      </h1>
      <p className="mt-1 text-base text-neutral-600">
        Gestiona tus clientes y contactos
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-8">
        {loading ? (
          <ClienteListSkeleton />
        ) : clientes.length === 0 && !error ? (
          <p className="text-neutral-500">Aún no hay clientes. Crea el primero con el botón +.</p>
        ) : (
          <div className="space-y-3">
            {clientes.map((c) => (
              <ClienteCard
                key={c.id}
                id={c.id}
                nombre={c.nombre}
                email={c.email}
                telefono={c.telefono}
                activo={c.activo}
              />
            ))}
          </div>
        )}
      </div>

      <Fab href="/clientes/nuevo" label="Añadir cliente" />
    </div>
  );
}
