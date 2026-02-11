"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ClienteDetailSkeleton } from "@/components/clientes/ClienteDetailSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";

interface Cliente {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  nif: string | null;
  direccion: string | null;
  notas: string | null;
  activo: boolean;
}

export default function DetalleClientePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [facturas, setFacturas] = useState<Array<{ id: string; numero: string; estado: string; total?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("clientes")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setCliente(null);
        } else {
          setCliente(data as Cliente);
        }
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    supabase
      .from("facturas")
      .select("id, numero, estado")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setFacturas(data ?? []);
      });
  }, [id]);

  const handleDelete = async () => {
    if (!cliente) return;
    setDeleting(true);
    const supabase = createClient();
    const { error: err } = await supabase.from("clientes").delete().eq("id", id);
    setDeleting(false);
    if (err) {
      setError(err.message);
      setShowDeleteConfirm(false);
      return;
    }
    router.push("/clientes");
    router.refresh();
  };

  if (loading) return <ClienteDetailSkeleton />;

  if (error || !cliente) {
    return (
      <div className="animate-[fadeIn_0.3s_ease-out]">
        <p className="text-red-600">{error ?? "Cliente no encontrado"}</p>
        <Button variant="secondary" asChild className="mt-4">
          <Link href="/clientes">Volver a clientes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <nav className="mb-4 flex items-center gap-1.5 text-sm">
        <Link href="/clientes" className="text-neutral-500 hover:text-foreground">Clientes</Link>
        <span className="text-neutral-400">/</span>
        <span className="font-medium text-foreground">{cliente.nombre}</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/clientes" aria-label="Volver a clientes">
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {cliente.nombre}
            </h1>
            <Badge
              variant={cliente.activo ? "activo" : "inactivo"}
              className="mt-1"
            >
              {cliente.activo ? "Activo" : "Inactivo"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/clientes/${id}/editar`}>
              <Pencil className="mr-2 h-4 w-4" strokeWidth={1.5} />
              Editar
            </Link>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Eliminar
          </Button>
        </div>
      </div>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`¿Eliminar cliente ${cliente.nombre}?`}
        description={
          facturas.length > 0
            ? `Tiene ${facturas.length} factura(s) asociada(s). El cliente se eliminará y las facturas quedarán sin cliente asignado.`
            : "Esta acción no se puede deshacer."
        }
        confirmLabel={deleting ? "Eliminando…" : "Eliminar"}
        onConfirm={handleDelete}
        loading={deleting}
        variant="destructive"
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-neutral-500">Email:</span>{" "}
              {cliente.email ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">Teléfono:</span>{" "}
              {cliente.telefono ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">NIF:</span>{" "}
              {cliente.nif ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dirección</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{cliente.direccion ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Facturas</CardTitle>
          </CardHeader>
          <CardContent>
            {facturas.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin facturas aún.</p>
            ) : (
              <ul className="space-y-2">
                {facturas.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/facturas/${f.id}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {f.numero}
                    </Link>
                    <Badge variant={f.estado as "borrador" | "emitida" | "pagada"} className="ml-2">
                      {f.estado}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
