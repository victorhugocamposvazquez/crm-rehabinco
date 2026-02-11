import { ClienteWizard } from "@/components/clientes/ClienteWizard";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function NuevoClientePage() {
  return (
    <div>
      <Breadcrumb items={[{ label: "Clientes", href: "/clientes" }, { label: "Nuevo" }]} className="mb-4" />
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clientes" aria-label="Volver a clientes">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Nuevo cliente
        </h1>
      </div>
      <ClienteWizard />
    </div>
  );
}
