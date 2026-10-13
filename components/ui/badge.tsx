import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-2)]",
        activo: "border-[var(--foreground)] bg-[var(--accent)] text-[var(--accent-foreground)]",
        inactivo: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-3)]",
        fallecido: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-2)]",
        borrador: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-2)]",
        emitida: "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-2)]",
        pagada: "border-[var(--foreground)] bg-[var(--accent)] text-[var(--accent-foreground)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
