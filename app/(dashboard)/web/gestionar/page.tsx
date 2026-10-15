import { redirect } from "next/navigation";
import { EditorWeb } from "@/components/web/EditorWeb";
import { cargarEditorWeb } from "@/lib/web/cargar";

export const dynamic = "force-dynamic";

export default async function GestionarWebPage() {
  const carga = await cargarEditorWeb();
  if (!carga.ok && carga.motivo === "sesion") redirect("/login?redirect=/web/gestionar");
  if (!carga.ok && carga.motivo === "permiso") redirect("/");
  if (!carga.ok) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <h1 className="text-2xl font-semibold">Diseño Web</h1>
        <p className="mt-3 text-[14px] text-[var(--text-2)]">
          Falta aplicar la migración de la web. Cuando esté en la base, aquí salen el diseño y los bloques.
        </p>
      </div>
    );
  }
  return <EditorWeb datos={carga.datos} />;
}
