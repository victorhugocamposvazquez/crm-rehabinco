import React from "react";
import { cn } from "@/lib/utils";

/**
 * Barra de página del diseño Aire: título a la izquierda, búsqueda y filtros
 * en el centro y la acción principal a la derecha, pegada bajo la barra superior.
 * En el diseño clásico se ve como una cabecera normal.
 */
export function BarraPagina({
  titulo,
  children,
  acciones,
  className,
}: {
  titulo: React.ReactNode;
  children?: React.ReactNode;
  acciones?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "barra-pagina flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 min-[820px]:flex-nowrap min-[820px]:gap-3 min-[820px]:px-6",
        className
      )}
      data-testid="barra-pagina"
    >
      <h1 className="mr-1 shrink-0 text-xl font-medium leading-8 text-[var(--titulo,var(--foreground))] min-[820px]:text-2xl">{titulo}</h1>
      {children ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div> : <div className="flex-1" />}
      {acciones ? <div className="flex shrink-0 items-center gap-2">{acciones}</div> : null}
    </div>
  );
}

/** Botón de la barra (40 px, borde suave). */
export function BotonBarra({
  activo,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { activo?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-foreground hover:bg-[var(--accent-soft)] disabled:opacity-50",
        activo && "border-[var(--border-strong)] bg-[var(--accent-soft)]",
        className
      )}
    />
  );
}

/** Acción principal de la barra (oscura, 40 px). */
export function BotonPrincipal({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-[6px] border border-[var(--accent)] bg-[var(--accent)] px-3 text-sm text-[var(--accent-foreground)] hover:bg-[var(--accent-dark)] disabled:opacity-50",
        className
      )}
    />
  );
}
