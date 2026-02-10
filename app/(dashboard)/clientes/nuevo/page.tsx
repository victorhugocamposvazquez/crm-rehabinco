import { ClienteWizard } from "@/components/clientes/ClienteWizard";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function NuevoClientePage() {
  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clientes" aria-label="Volver a clientes">
            <ChevronLeft className="h-5 w-5" />
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
