"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TokenExtensionCard({ userId }: { userId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("profiles")
      .select("token_extension")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => setToken(data?.token_extension ?? null));
  }, [userId]);

  const generar = async () => {
    setGuardando(true);
    const nuevo = `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ token_extension: nuevo }).eq("id", userId);
    setGuardando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setToken(nuevo);
    toast.success("Token de la extensión guardado.");
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Extensión de Idealista</CardTitle>
        <CardDescription>
          Pega este token en las opciones de la extensión de Chrome. Sirve para guardar el teléfono que revelas en Idealista.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="break-all font-mono text-[13px]">{token ?? "Todavía no hay token."}</p>
        <Button type="button" variant="secondary" disabled={guardando} onClick={() => void generar()}>
          {guardando ? "Generando…" : token ? "Generar otro token" : "Generar token"}
        </Button>
      </CardContent>
    </Card>
  );
}
