import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-neutral-200 bg-neutral-100 text-neutral-700",
        activo: "border-neutral-900 bg-neutral-900 text-white",
        inactivo: "border-neutral-200 bg-neutral-100 text-neutral-500",
        fallecido: "border-neutral-300 bg-neutral-200 text-neutral-700",
        borrador: "border-neutral-300 bg-neutral-100 text-neutral-700",
        emitida: "border-neutral-400 bg-neutral-200 text-neutral-800",
        pagada: "border-neutral-900 bg-neutral-900 text-white",
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
