import { FacturaWizard } from "@/components/facturas/FacturaWizard";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function NuevaFacturaPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params?.cliente;
  const clienteId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

  return (
    <div>
      <Breadcrumb items={[{ label: "Facturas", href: "/facturas" }, { label: "Nueva" }]} className="mb-4" />
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/facturas"
          aria-label="Volver a facturas"
          className="flex shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Nueva factura
        </h1>
      </div>
      <FacturaWizard initialClienteId={clienteId} />
    </div>
  );
}
