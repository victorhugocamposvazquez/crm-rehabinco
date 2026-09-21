"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PapeleraDocumentosPanel } from "@/components/documentos/PapeleraDocumentosPanel";
import { useAuth } from "@/lib/auth/auth-context";
import { puedeVerPapelera } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";

export default function PapeleraHerramientasPage() {
  const { user } = useAuth();

  if (!puedeVerPapelera(user?.role)) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Herramientas", href: "/herramientas" }, { label: "Papelera" }]}
          title="Papelera"
        />
        <p className="mt-6 text-sm text-[var(--text-2)]">Solo el superadministrador puede ver la papelera.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Herramientas", href: "/herramientas" }, { label: "Papelera" }]}
        title="Papelera"
        description="Partes de visita y contratos de arras enviados a borrar. Restaura o confirma el borrado definitivo."
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/herramientas" className="gap-2">
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              Volver a herramientas
            </Link>
          </Button>
        }
      />

      <section className="mt-6 overflow-hidden rounded-[14px] border border-border bg-white">
        <PapeleraDocumentosPanel />
      </section>
    </div>
  );
}
