import { cn } from "@/lib/utils";
import { TEXTO_BADGE_CATASTRO } from "@/lib/catastro/explorer";

export function BadgeCatastroExplorer({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-sky-800",
        className
      )}
    >
      {TEXTO_BADGE_CATASTRO}
    </span>
  );
}
