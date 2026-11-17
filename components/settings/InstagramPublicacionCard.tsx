"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Estado = { configurado: boolean; conectado: boolean; username: string | null };

export function InstagramPublicacionCard() {
  const [aviso, setAviso] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [soltando, setSoltando] = useState(false);

  useEffect(() => {
    const valor = new URLSearchParams(window.location.search).get("instagram");
    setAviso(valor);
    let vivo = true;
    fetch("/api/estudio/instagram")
      .then((r) => r.json())
      .then((data: Estado & { ok?: boolean }) => { if (vivo && data.ok) setEstado(data); })
      .catch(() => { if (vivo) setEstado(null); });
    return () => { vivo = false; };
  }, []);

  const soltar = async () => {
    setSoltando(true);
    try {
      const respuesta = await fetch("/api/estudio/instagram", { method: "DELETE" });
      if (respuesta.ok) setEstado((prev) => (prev ? { ...prev, conectado: false, username: null } : prev));
    } finally { setSoltando(false); }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Instagram</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-neutral-500">Desde el Estudio se publica en el perfil de la agencia. La story sale como historia y el resto como post o carrusel.</p>
        {aviso === "ok" && <p className="text-emerald-700">Cuenta enlazada.</p>}
        {aviso && aviso !== "ok" && <p className="text-red-600">{aviso}</p>}
        {!estado && <p className="text-neutral-500">Comprobando la conexión…</p>}
        {estado && !estado.configurado && <p>Falta la app de Instagram en el servidor (INSTAGRAM_APP_ID y INSTAGRAM_APP_SECRET).</p>}
        {estado?.configurado && estado.conectado && (
          <div className="flex items-center gap-3">
            <p>Conectado como @{estado.username}.</p>
            <Button type="button" variant="secondary" disabled={soltando} onClick={soltar}>Desconectar</Button>
          </div>
        )}
        {estado?.configurado && !estado.conectado && (
          <Button asChild>
            <a href="/api/estudio/instagram/conectar">Conectar Instagram</a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
