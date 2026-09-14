import { cn } from "@/lib/utils";
import { inicialesNombre } from "@/lib/ui/tokens";

export function AvatarComercial({
  nombre,
  email,
  color,
  size = 22,
  className,
  title,
}: {
  nombre?: string | null;
  email?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
  title?: string;
}) {
  const ini = inicialesNombre(nombre, email);
  const font = size <= 22 ? 9.5 : size <= 30 ? 11 : 12;
  return (
    <span
      title={title ?? nombre ?? undefined}
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold text-white", className)}
      style={{
        width: size,
        height: size,
        background: color || "#3A6A82",
        fontSize: font,
      }}
    >
      {ini}
    </span>
  );
}
