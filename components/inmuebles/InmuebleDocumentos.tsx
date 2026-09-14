"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  BUCKET_DOCS_INMUEBLE,
  TIPOS_DOCUMENTO_INMUEBLE,
  TIPO_DOCUMENTO_LABEL,
  type TipoDocumentoInmueble,
} from "@/lib/inmuebles/documentos";

export type DocInmueble = {
  id: string;
  tipo: string;
  nombre: string;
  path: string;
  created_at: string;
};

export function InmuebleDocumentos({
  propiedadId,
  userId,
  documentos,
  onChange,
}: {
  propiedadId: string;
  userId: string;
  documentos: DocInmueble[];
  onChange: (next: DocInmueble[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<TipoDocumentoInmueble>("nota_simple");
  const [busy, setBusy] = useState(false);

  const subir = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const supabase = createClient();
    const next = [...documentos];
    try {
      for (const file of Array.from(files)) {
        if (file.size > 12_000_000) {
          toast.error(`${file.name} supera 12 MB.`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
        const path = `${propiedadId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET_DOCS_INMUEBLE).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr) {
          toast.error(upErr.message);
          continue;
        }
        const { data, error } = await supabase
          .from("inmueble_documentos")
          .insert({
            propiedad_id: propiedadId,
            user_id: userId,
            tipo,
            nombre: file.name,
            path,
          })
          .select("id, tipo, nombre, path, created_at")
          .single();
        if (error || !data) {
          toast.error(error?.message ?? "No se ha podido guardar el documento.");
          continue;
        }
        next.push(data as DocInmueble);
      }
      onChange(next);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const abrir = async (doc: DocInmueble) => {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from(BUCKET_DOCS_INMUEBLE).createSignedUrl(doc.path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("No se ha podido abrir el documento.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const borrar = async (doc: DocInmueble) => {
    const supabase = createClient();
    await supabase.storage.from(BUCKET_DOCS_INMUEBLE).remove([doc.path]);
    const { error } = await supabase.from("inmueble_documentos").delete().eq("id", doc.id);
    if (error) {
      toast.error("No se ha podido eliminar.");
      return;
    }
    onChange(documentos.filter((item) => item.id !== doc.id));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-500">
        Privados: nota simple, energético, cédula, escritura. No salen en matching ni al imprimir la ficha.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Tipo
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoDocumentoInmueble)}
            className="mt-1 flex h-10 rounded-lg border border-border bg-white px-3 text-sm"
          >
            {TIPOS_DOCUMENTO_INMUEBLE.map((item) => (
              <option key={item} value={item}>
                {TIPO_DOCUMENTO_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" strokeWidth={1.5} />
          {busy ? "Subiendo…" : "Subir"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          multiple
          onChange={(e) => void subir(e.target.files)}
        />
      </div>
      <ul className="divide-y divide-neutral-100">
        {documentos.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <button type="button" className="flex min-w-0 items-center gap-2 text-left hover:underline" onClick={() => void abrir(doc)}>
              <FileText className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.5} />
              <span className="truncate">{doc.nombre}</span>
              <span className="shrink-0 text-neutral-400">
                {TIPO_DOCUMENTO_LABEL[doc.tipo as TipoDocumentoInmueble] ?? doc.tipo}
              </span>
            </button>
            <Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={() => void borrar(doc)}>
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </li>
        ))}
        {documentos.length === 0 ? <li className="py-2 text-sm text-neutral-500">Aún no hay documentos.</li> : null}
      </ul>
    </div>
  );
}
