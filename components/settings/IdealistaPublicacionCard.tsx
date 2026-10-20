"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConfigResp = {
  ok: boolean;
  config?: {
    customerCode: string | null;
    ftpHost: string | null;
    ftpPort: number;
    ftpUser: string | null;
    ftpSecure: boolean;
    ftpPasswordHint: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    apiClientId: string | null;
    apiClientSecretHint: string | null;
    apiBaseUrl: string | null;
    listoParaApi: boolean;
    listoParaFtp: boolean;
  };
  ultimaEjecucion?: {
    created_at: string;
    ok: boolean;
    anuncios_enviados: number;
    anuncios_omitidos: number;
    error: string | null;
  } | null;
};

export function IdealistaPublicacionCard() {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [enviandoFtp, setEnviandoFtp] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [customerCode, setCustomerCode] = useState("");
  const [apiClientId, setApiClientId] = useState("");
  const [apiClientSecret, setApiClientSecret] = useState("");
  const [apiSecretHint, setApiSecretHint] = useState<string | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [ftpHost, setFtpHost] = useState("");
  const [ftpPort, setFtpPort] = useState("21");
  const [ftpUser, setFtpUser] = useState("");
  const [ftpPassword, setFtpPassword] = useState("");
  const [ftpSecure, setFtpSecure] = useState(true);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [listoApi, setListoApi] = useState(false);
  const [listoFtp, setListoFtp] = useState(false);
  const [ultima, setUltima] = useState<ConfigResp["ultimaEjecucion"]>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const res = await fetch("/api/inmuebles/idealista/config");
    const json = (await res.json()) as ConfigResp;
    setCargando(false);
    if (!json.ok || !json.config) {
      setError("No se pudo cargar la configuración.");
      return;
    }
    const c = json.config;
    setCustomerCode(c.customerCode ?? "");
    setApiClientId(c.apiClientId ?? "");
    setApiSecretHint(c.apiClientSecretHint);
    setApiBaseUrl(c.apiBaseUrl ?? "");
    setFtpHost(c.ftpHost ?? "");
    setFtpPort(String(c.ftpPort ?? 21));
    setFtpUser(c.ftpUser ?? "");
    setFtpSecure(c.ftpSecure ?? true);
    setContactName(c.contactName ?? "");
    setContactEmail(c.contactEmail ?? "");
    setContactPhone(c.contactPhone ?? "");
    setListoApi(c.listoParaApi);
    setListoFtp(c.listoParaFtp);
    setUltima(json.ultimaEjecucion ?? null);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function cuerpo() {
    return {
      customerCode,
      apiClientId,
      apiClientSecret: apiClientSecret.trim() || undefined,
      apiBaseUrl,
      ftpHost,
      ftpPort: Number(ftpPort) || 21,
      ftpUser,
      ftpPassword: ftpPassword.trim() || undefined,
      ftpSecure,
      contactName,
      contactEmail,
      contactPhone,
    };
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    setError(null);
    const res = await fetch("/api/inmuebles/idealista/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo()),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    setGuardando(false);
    if (!json.ok) {
      setError(json.error ?? "No se ha guardado.");
      return;
    }
    setApiClientSecret("");
    setFtpPassword("");
    setMensaje("Configuración guardada.");
    await cargar();
  }

  async function probar() {
    setProbando(true);
    setMensaje(null);
    setError(null);
    const res = await fetch("/api/inmuebles/idealista/probar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiClientId,
        apiClientSecret: apiClientSecret.trim() || undefined,
      }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string; mensaje?: string };
    setProbando(false);
    if (!json.ok) {
      setError(json.error ?? "Idealista no ha aceptado las credenciales.");
      return;
    }
    setMensaje(json.mensaje ?? "Credenciales aceptadas.");
  }

  async function sincronizar() {
    setSincronizando(true);
    setMensaje(null);
    setError(null);
    const res = await fetch("/api/inmuebles/idealista/sincronizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todos: true }),
    });
    const json = (await res.json()) as {
      ok: boolean;
      error?: string;
      total?: number;
      publicados?: number;
      esperando?: number;
      errores?: number;
    };
    setSincronizando(false);
    if (!json.ok && json.error) {
      setError(json.error);
      return;
    }
    setMensaje(
      `Revisados ${json.total ?? 0}: ${json.publicados ?? 0} publicados o dados de baja, ${json.esperando ?? 0} a la espera de la API, ${json.errores ?? 0} con error.`
    );
  }

  async function enviarFtp() {
    setEnviandoFtp(true);
    setMensaje(null);
    setError(null);
    const res = await fetch("/api/inmuebles/idealista/volcado", { method: "POST" });
    const json = (await res.json()) as { ok: boolean; error?: string; anunciosEnviados?: number; fileName?: string };
    setEnviandoFtp(false);
    if (!json.ok) {
      setError(json.error ?? "Error al enviar el fichero.");
      return;
    }
    setMensaje(`Fichero subido (${json.fileName ?? "FTP"}): ${json.anunciosEnviados ?? 0} anuncios.`);
    await cargar();
  }

  if (cargando) {
    return <p className="text-sm text-neutral-500">Cargando Idealista…</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publicación en Idealista</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-neutral-600">
          Al guardar un inmueble con «Publicar en Idealista», el CRM lo envía por la API. Hasta que Idealista active el
          acceso, el inmueble queda marcado y se publica en cuanto pegues aquí las credenciales.
        </p>

        <form onSubmit={guardar} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ilc">Código ILC</Label>
            <Input
              id="ilc"
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value.trim())}
              placeholder="ilc…"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-client">Cliente API</Label>
            <Input
              id="api-client"
              value={apiClientId}
              onChange={(e) => setApiClientId(e.target.value)}
              autoComplete="off"
              placeholder="Lo envía Idealista"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-secret">Secreto API</Label>
            <Input
              id="api-secret"
              type="password"
              value={apiClientSecret}
              onChange={(e) => setApiClientSecret(e.target.value)}
              placeholder={apiSecretHint ? `Guardado (${apiSecretHint})` : "Lo envía Idealista"}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="api-url">URL base de la API</Label>
            <Input
              id="api-url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://… (la que indique Idealista)"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-name">Contacto en el anuncio</Label>
            <Input id="contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Rehabinco" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input id="contact-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="contact-phone">Teléfono</Label>
            <Input id="contact-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
            <Button type="button" variant="secondary" disabled={probando || (!apiClientId && !apiSecretHint)} onClick={() => void probar()}>
              {probando ? "Probando…" : "Probar credenciales"}
            </Button>
            <Button type="button" variant="secondary" disabled={sincronizando} onClick={() => void sincronizar()}>
              {sincronizando ? "Sincronizando…" : listoApi ? "Publicar marcados" : "Revisar marcados"}
            </Button>
          </div>
        </form>

        {mensaje ? <p className="text-sm text-green-700">{mensaje}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!listoApi ? (
          <p className="text-xs text-amber-800">
            Alta pedida. Cuando Idealista responda, pega el cliente, el secreto y la URL. El código ILC ya identifica la
            cuenta.
          </p>
        ) : null}

        <details className="rounded-lg border border-neutral-200 p-3 text-sm">
          <summary className="cursor-pointer font-medium">Respaldo por fichero FTP</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ftp-host">Servidor FTP</Label>
              <Input id="ftp-host" value={ftpHost} onChange={(e) => setFtpHost(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ftp-port">Puerto</Label>
              <Input id="ftp-port" value={ftpPort} onChange={(e) => setFtpPort(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ftp-user">Usuario</Label>
              <Input id="ftp-user" value={ftpUser} onChange={(e) => setFtpUser(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ftp-pass">Contraseña</Label>
              <Input
                id="ftp-pass"
                type="password"
                value={ftpPassword}
                onChange={(e) => setFtpPassword(e.target.value)}
                placeholder="Vacío para no cambiar"
                autoComplete="new-password"
              />
            </div>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={ftpSecure} onChange={(e) => setFtpSecure(e.target.checked)} />
              FTPS
            </label>
            <Button type="button" variant="secondary" disabled={enviandoFtp || !listoFtp} onClick={() => void enviarFtp()}>
              {enviandoFtp ? "Enviando…" : "Subir fichero ahora"}
            </Button>
          </div>
          {ultima ? (
            <p className="mt-3 text-xs text-neutral-500">
              Último fichero: {new Date(ultima.created_at).toLocaleString("es-ES")} · {ultima.ok ? "OK" : "Error"} ·{" "}
              {ultima.anuncios_enviados} anuncios
              {ultima.error ? ` · ${ultima.error}` : ""}
            </p>
          ) : null}
        </details>
      </CardContent>
    </Card>
  );
}
