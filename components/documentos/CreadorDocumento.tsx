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
  variant = "lista",
  size = 22,
  className = "",
}: {
  userId?: string | null;
  comercialId?: string | null;
  creador?: PerfilCreador | PerfilCreador[] | null;
  viewerId?: string;
  admin?: boolean;
  /** lista: solo iniciales; detalle: iniciales + nombre */
  variant?: "lista" | "detalle";
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

  if (variant === "lista") {
    return (
      <span className={`inline-flex shrink-0 ${className}`}>
        <AvatarComercial
          id={id}
          nombre={perfil?.nombre_completo}
          email={perfil?.email}
          color={perfil?.color}
          size={size}
          title={nombre}
          className="cursor-default"
        />
      </span>
    );
  }

  return (
    <span className={`inline-flex shrink-0 items-center gap-2 text-[13px] text-[var(--text-2)] ${className}`}>
      <AvatarComercial
        id={id}
        nombre={perfil?.nombre_completo}
        email={perfil?.email}
        color={perfil?.color}
        size={size}
        title={nombre}
      />
      <span className="font-medium text-foreground">{nombre}</span>
    </span>
  );
}
