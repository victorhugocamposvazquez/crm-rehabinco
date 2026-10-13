import Link from "next/link";

const ENLACES = [
  { href: "/valoraciones", label: "Listado" },
  { href: "/valoraciones/nueva", label: "Nueva valoración" },
  { href: "/valoraciones/metodologia", label: "Cómo valoramos" },
  { href: "/valoraciones/ajustes", label: "Ajustes" },
  { href: "/valoraciones/papelera", label: "Papelera" },
];

export function ValoracionesNav({ actual }: { actual: string }) {
  return (
    <nav className="mb-4 flex flex-wrap gap-2 text-[13px]">
      {ENLACES.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          className={actual === e.href ? "rounded-md bg-[var(--surface-soft)] px-2 py-1 font-medium" : "rounded-md px-2 py-1 text-[var(--text-2)]"}
        >
          {e.label}
        </Link>
      ))}
    </nav>
  );
}
