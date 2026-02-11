import { ClienteWizard } from "@/components/clientes/ClienteWizard";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function NuevoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ padre?: string }>;
}) {
  const params = await searchParams;
  const padreId = params?.padre ?? undefined;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Clientes", href: "/clientes" },
          padreId ? { label: "Nueva empresa" } : { label: "Nuevo" },
        ]}
        className="mb-4"
      />
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={padreId ? `/clientes/${padreId}` : "/clientes"}
          aria-label={padreId ? "Volver al cliente" : "Volver a clientes"}
          className="flex shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {padreId ? "Nueva empresa asociada" : "Nuevo cliente"}
        </h1>
      </div>
      <ClienteWizard initialClientePadreId={padreId} />
    </div>
  );
}
