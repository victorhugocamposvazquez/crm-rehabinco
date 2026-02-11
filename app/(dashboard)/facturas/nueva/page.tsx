import { FacturaWizard } from "@/components/facturas/FacturaWizard";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function NuevaFacturaPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: "Facturas", href: "/facturas" }, { label: "Nueva" }]} className="mb-4" />
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/facturas" aria-label="Volver a facturas">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Nueva factura
        </h1>
      </div>
      <FacturaWizard />
    </div>
  );
}
