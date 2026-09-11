"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PerfilComercialCard({ userId }: { userId: string }) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [zona, setZona] = useState("");
  const [color, setColor] = useState("#3A6A82");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("nombre_completo, telefono, zona, color")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setNombre(data.nombre_completo ?? "");
        setTelefono(data.telefono ?? "");
        setZona(data.zona ?? "");
        setColor(data.color ?? "#3A6A82");
      });
  }, [userId]);

  const save = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        nombre_completo: nombre.trim() || null,
        telefono: telefono.trim() || null,
        zona: zona.trim() || null,
        color,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Perfil guardado.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil de comercial</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-neutral-500">
          Nombre y color que se verán en el calendario y en las visitas.
        </p>
        <div className="space-y-2">
          <Label>Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellidos" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Zona</Label>
            <Input value={zona} onChange={(e) => setZona(e.target.value)} placeholder="A Coruña, Oleiros…" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-border bg-white p-1"
            />
            <span className="text-sm tabular-nums text-neutral-500">{color}</span>
          </div>
        </div>
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar perfil"}
        </Button>
      </CardContent>
    </Card>
  );
}
