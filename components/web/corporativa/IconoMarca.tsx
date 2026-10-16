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
