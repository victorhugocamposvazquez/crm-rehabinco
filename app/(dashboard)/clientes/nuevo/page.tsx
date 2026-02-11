import { ClienteWizard } from "@/components/clientes/ClienteWizard";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NuevoClientePage() {
  return (
    <div>
      <Breadcrumb items={[{ label: "Clientes", href: "/clientes" }, { label: "Nuevo" }]} className="mb-4" />
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/clientes"
          aria-label="Volver a clientes"
          className="flex shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Nuevo cliente
        </h1>
      </div>
      <ClienteWizard />
    </div>
  );
}
