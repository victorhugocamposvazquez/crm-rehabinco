import { cn } from "@/lib/utils";

export function EstadoDot({
  label,
  color,
  className,
}: {
  label: string;
  color: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px] font-medium", className)} style={{ color }}>
      <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export function EstadoPastilla({
  label,
  bg,
  fg,
  className,
}: {
  label: string;
  bg: string;
  fg: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex rounded-[7px] px-[11px] py-1 text-[11.5px] font-semibold", className)}
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}
