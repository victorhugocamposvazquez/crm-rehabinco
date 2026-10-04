import { cn } from "@/lib/utils";
import { colorComercial, inicialesNombre } from "@/lib/ui/tokens";

export function AvatarComercial({
  id,
  nombre,
  email,
  color,
  size = 22,
  className,
  title,
}: {
  id?: string | null;
  nombre?: string | null;
  email?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
  title?: string;
}) {
  const ini = inicialesNombre(nombre, email);
  const font = size <= 22 ? 9.5 : size <= 30 ? 11 : 12;
  const fondo = colorComercial(id, color);
  const gris = ["#111111", "#2a2a2a", "#404040", "#525252", "#666666", "#7a7a7a"].indexOf(fondo.toLowerCase());
  return (
    <span
      title={title ?? nombre ?? undefined}
      data-gris={gris >= 0 ? String(gris) : undefined}
      className={cn("avatar-comercial grid shrink-0 place-items-center rounded-full font-semibold text-white", className)}
      style={{
        width: size,
        height: size,
        background: fondo,
        fontSize: font,
      }}
    >
      {ini}
    </span>
  );
}
