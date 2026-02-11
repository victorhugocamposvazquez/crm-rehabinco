import { PresupuestoWizard } from "@/components/presupuestos/PresupuestoWizard";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NuevoPresupuestoPage() {
  return (
    <div>
      <Breadcrumb
        items={[{ label: "Presupuestos", href: "/presupuestos" }, { label: "Nuevo" }]}
        className="mb-4"
      />
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/presupuestos"
          aria-label="Volver a presupuestos"
          className="flex shrink-0 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Nuevo presupuesto
        </h1>
      </div>
      <PresupuestoWizard />
    </div>
  );
}
