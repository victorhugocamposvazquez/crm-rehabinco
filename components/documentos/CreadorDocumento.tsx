"use client";

import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { relacionUno } from "@/lib/citas/citas";
import { nombreYApellido } from "@/lib/ui/tokens";

type PerfilCreador = { nombre_completo?: string | null; color?: string | null; email?: string | null };

export function CreadorDocumento({
  userId,
  comercialId,
  creador,
  viewerId,
  admin,
  size = 22,
  className = "",
}: {
  userId?: string | null;
  comercialId?: string | null;
  creador?: PerfilCreador | PerfilCreador[] | null;
  viewerId?: string;
  admin?: boolean;
  size?: number;
  className?: string;
}) {
  if (!admin) return null;
  const id = comercialId ?? userId;
  if (!id) return null;
  const perfil = relacionUno(creador);
  const nombre =
    nombreYApellido(perfil?.nombre_completo, perfil?.email) ||
    perfil?.nombre_completo?.trim() ||
    (id === viewerId ? "Tú" : "Usuario");
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-[12px] text-[var(--text-2)] ${className}`}>
      <AvatarComercial id={id} nombre={perfil?.nombre_completo} color={perfil?.color} size={size} />
      <span className="max-w-[8rem] truncate">{nombre}</span>
    </span>
  );
}
