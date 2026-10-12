import { NuevaValoracionWizard } from "@/components/avm/NuevaValoracionWizard";
import { ValoracionesNav } from "@/components/avm/ValoracionesNav";

/** Vista previa autenticada del flujo landing (7 pantallas). La pública irá en /v/[slug]. */
export default function ValoracionLandingPreviewPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <ValoracionesNav actual="/valoraciones/landing" />
      <p className="mb-4 text-[13px] text-[var(--text-3)]">
        Previsualización del canal público (mismo wizard, sin pestaña CRM).
      </p>
      <NuevaValoracionWizard channel="landing" landingSlug="rehabinco" />
    </div>
  );
}
