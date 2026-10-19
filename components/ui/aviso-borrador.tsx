"use client";

import Link from "next/link";

export function AvisoContinuarBorrador({
  visible,
  que,
  onContinuar,
  href,
  nota,
}: {
  visible: boolean;
  que: string;
  onContinuar?: () => void;
  href?: string;
  nota?: string;
}) {
  if (!visible) return null;
  const clase =
    "inline-flex h-9 shrink-0 items-center rounded-[10px] bg-accent px-3.5 text-[13px] font-semibold text-accent-foreground";
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-amber-200 bg-[var(--amber-bg)] px-4 py-3">
      <p className="min-w-0 text-[13.5px] leading-5 text-[var(--amber-ink)]">
        <span className="font-semibold">Tienes un {que} a medias.</span> Sigue editando lo que ya habías escrito. Está solo en este dispositivo.
        {nota ? <span className="mt-0.5 block text-[12.5px]">{nota}</span> : null}
      </p>
      {href ? (
        <Link href={href} className={clase}>
          Seguir editando
        </Link>
      ) : (
        <button type="button" onClick={onContinuar} className={clase}>
          Seguir editando
        </button>
      )}
    </div>
  );
}
