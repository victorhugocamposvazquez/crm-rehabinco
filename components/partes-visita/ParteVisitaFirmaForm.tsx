"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/partes-visita/SignaturePad";
import {
  firmarParteVisitaPublic,
  type ParteVisitaPublic,
} from "@/lib/actions/partes-visita";
import {
  EMPRESA_PARTE_VISITA,
  formatFechaLargaEs,
  formatHoraVisita,
} from "@/lib/partes-visita";

interface ParteVisitaFirmaFormProps {
  parte: ParteVisitaPublic;
}

export function ParteVisitaFirmaForm({ parte }: ParteVisitaFirmaFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(parte.visitante_nombre ?? "");
  const [documento, setDocumento] = useState(parte.visitante_documento ?? "");
  const [telefono, setTelefono] = useState(parte.visitante_telefono ?? "");
  const [email, setEmail] = useState(parte.visitante_email ?? "");
  const [observaciones, setObservaciones] = useState(parte.observaciones ?? "");
  const [firmaVisitante, setFirmaVisitante] = useState<string | null>(null);
  const [firmaAgente, setFirmaAgente] = useState<string | null>(
    parte.firma_agente
  );
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(parte.estado === "firmado");

  const alreadySigned = parte.estado === "firmado";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firmaVisitante) {
      setError("La firma del visitante es obligatoria.");
      return;
    }
    if (!firmaAgente) {
      setError("La firma del agente comercial es obligatoria.");
      return;
    }

    startTransition(async () => {
      const result = await firmarParteVisitaPublic({
        token: parte.token,
        visitante_nombre: nombre,
        visitante_documento: documento,
        visitante_telefono: telefono,
        visitante_email: email,
        observaciones,
        firma_visitante: firmaVisitante,
        firma_agente: firmaAgente,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  };

  if (done || alreadySigned) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
        <p className="text-lg font-semibold text-emerald-900">
          Parte de visita firmado
        </p>
        <p className="mt-2 text-sm text-emerald-800">
          Gracias. La visita ha quedado registrada correctamente.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-8">
      <header className="rounded-2xl border border-border bg-white px-5 py-6 text-center shadow-sm sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Parte de visita
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          {EMPRESA_PARTE_VISITA.razonSocial}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          CIF: {EMPRESA_PARTE_VISITA.cif}
        </p>
        <p className="text-sm text-neutral-600">
          {EMPRESA_PARTE_VISITA.direccion}
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Inmueble visitado
        </h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <div>
            <dt className="text-neutral-500">Dirección</dt>
            <dd className="font-medium text-foreground">
              {parte.inmueble_direccion || "—"}
            </dd>
          </div>
          {parte.inmueble_referencia && (
            <div>
              <dt className="text-neutral-500">Referencia</dt>
              <dd className="font-medium text-foreground">
                {parte.inmueble_referencia}
              </dd>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-neutral-500">Fecha</dt>
              <dd className="font-medium text-foreground">
                {parte.fecha_visita
                  ? new Date(`${parte.fecha_visita}T12:00:00`).toLocaleDateString(
                      "es-ES"
                    )
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Hora</dt>
              <dd className="font-medium text-foreground">
                {formatHoraVisita(parte.hora_visita)}
              </dd>
            </div>
          </div>
          <div>
            <dt className="text-neutral-500">Agente comercial</dt>
            <dd className="font-medium text-foreground">
              {parte.agente_nombre || "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Datos del visitante
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="nombre">Nombre y apellidos *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="documento">DNI / NIE *</Label>
            <Input
              id="documento"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Confirmación de la visita
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700">
          Mediante la firma del presente documento, el visitante confirma haber
          realizado la visita al inmueble anteriormente identificado acompañado
          por un asesor de {EMPRESA_PARTE_VISITA.razonSocial}.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700">
          Asimismo, reconoce que el inmueble le ha sido presentado por{" "}
          {EMPRESA_PARTE_VISITA.razonSocial} dentro de su labor profesional de
          intermediación inmobiliaria y que la información facilitada durante la
          visita ha sido proporcionada por dicha empresa.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          El presente documento tiene como única finalidad dejar constancia de la
          realización de la visita y de la intervención de{" "}
          {EMPRESA_PARTE_VISITA.razonSocial} en la presentación del inmueble.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Observaciones
        </h2>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={4}
          className="flex w-full rounded-lg border border-border bg-white px-4 py-2 text-base"
          placeholder="Opcional"
        />
      </section>

      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Firmas
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          En {parte.lugar_firma}, a {formatFechaLargaEs(parte.fecha_visita)}.
        </p>
        <div className="mt-5 space-y-6">
          <SignaturePad
            label="Firma del visitante *"
            value={firmaVisitante}
            onChange={setFirmaVisitante}
          />
          <SignaturePad
            label={`Firma ${EMPRESA_PARTE_VISITA.razonSocial} (agente) *`}
            value={firmaAgente}
            onChange={setFirmaAgente}
          />
        </div>
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Guardando firmas…" : "Confirmar y firmar"}
      </Button>
    </form>
  );
}
