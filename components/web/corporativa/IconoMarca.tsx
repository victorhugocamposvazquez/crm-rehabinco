export function IconoLetraA({ className, stroke = "currentColor" }: { className?: string; stroke?: string }) {
  return (
    <svg viewBox="36.5 36 47 46.5" aria-hidden className={className}>
      <path d="M39.5 81L60 40L80.5 81" fill="none" stroke={stroke} strokeWidth="7.4" strokeLinejoin="miter" strokeMiterlimit={10} />
    </svg>
  );
}

export function IconoMarcaCompleto({ className }: { className?: string }) {
  return (
    <svg viewBox="-3.5 25.5 127 69" aria-hidden className={className}>
      <path d="M39 81L60 39L81 81" fill="none" stroke="currentColor" strokeWidth="7" strokeLinejoin="miter" />
      <rect x="6.5" y="80.2" width="22" height="1.6" fill="currentColor" />
      <rect x="91.5" y="80.2" width="22" height="1.6" fill="currentColor" />
    </svg>
  );
}

const ICONS_SERV = [
  "M3 20h18M6 16l4-5 3 3 5-7M15 7h3v3",
  "M14.5 9.5a4 4 0 1 1-5.66 5.66 4 4 0 0 1 5.66-5.66zM14.5 9.5L21 3M18 6l2 2M16 8l2 2",
  "M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3zM8.5 12l2.5 2.5 4.5-5",
  "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5 5-2z",
  "M19 5L5 19M7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM16.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  "M14 3H6v18h12V7l-4-4zM14 3v4h4M9 14l2 2 4-4",
  "M4 20l4-1L19 8l-3-3L5 16l-1 4zM14 7l3 3",
  "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c2 .6 3.2 2.5 3.6 5.2",
];

export function IconoServicio({ index, className }: { index: number; className?: string }) {
  const d = ICONS_SERV[index] ?? ICONS_SERV[0]!;
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d={d} />
    </svg>
  );
}

/** Iconos del recorrido 360° (búsqueda → obra → entrega). */
const ICONS_FASE_360: string[][] = [
  ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.35-4.35"],
  [
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
    "M3 21h18",
  ],
  ["M21 2l-2 2", "M7.5 11.5a4.5 4.5 0 1 0 0-6.36 4.5 4.5 0 0 0 0 6.36z", "M13 7l4 4"],
];

export function IconoFase360({ index, className }: { index: number; className?: string }) {
  const paths = ICONS_FASE_360[index] ?? ICONS_FASE_360[0]!;
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Iconos del bloque «Lo que nos hace diferentes». */
const ICONS_PILAR_CONFIANZA: string[][] = [
  ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  ["M9 12h6", "M9 16h6", "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-4-4z", "M14 3v4h4"],
  ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "M9 12l2 2 4-4"],
  ["M3 18v-6a9 9 0 0 1 18 0v6", "M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z", "M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"],
];

export function IconoPilarConfianza({ index, className }: { index: number; className?: string }) {
  const paths = ICONS_PILAR_CONFIANZA[index] ?? ICONS_PILAR_CONFIANZA[0]!;
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
