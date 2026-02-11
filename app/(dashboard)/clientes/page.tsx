"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ClienteCard } from "@/components/clientes/ClienteCard";
import { ClienteListSkeleton } from "@/components/clientes/ClienteListSkeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

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
    <div>
      <PageHeader
        breadcrumb={[{ label: "Clientes", href: "/clientes" }]}
        title="Clientes"
        description="Gestiona tus clientes y contactos"
        actions={
          <Button asChild size="sm">
            <Link href="/clientes/nuevo" className="gap-2">
              <UserPlus className="h-4 w-4" strokeWidth={1.5} />
              Crear cliente
            </Link>
          </Button>
        }
      />

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-10">
        {loading ? (
          <ClienteListSkeleton />
        ) : clientes.length === 0 && !error ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center">
            <p className="text-neutral-500">Aún no hay clientes.</p>
            <Button asChild className="mt-4">
              <Link href="/clientes/nuevo" className="gap-2">
                <UserPlus className="h-4 w-4" strokeWidth={1.5} />
                Añadir primer cliente
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
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
