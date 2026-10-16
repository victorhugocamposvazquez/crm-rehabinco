import Link from "next/link";
import { ContactoFooter } from "./ContactoFooter";
import { NavCorporativa } from "./NavCorporativa";
import type { BloqueLegal } from "@/lib/web/corporativa/legal";
import { hrefInicio } from "@/lib/web/dominio";

export function PaginaLegalCorporativa({
  titulo,
  subtitulo,
  bloques,
  enDominio,
}: {
  titulo: string;
  subtitulo: string;
  bloques: BloqueLegal[];
  enDominio: boolean;
}) {
  return (
    <div className="corp-page">
      <header className="relative w-full min-w-0 bg-[#fefefe] pb-4 pt-24 text-[#080808]">
        <NavCorporativa enDominio={enDominio} clara />
        <div className="corp-pad mx-auto w-full min-w-0 max-w-[720px]">
          <Link href={hrefInicio(enDominio)} className="text-[14px] font-medium text-[#6b6b6b] hover:text-[#080808]">
            ← Inicio
          </Link>
          <p className="corp-kicker mt-8">{subtitulo}</p>
          <h1 className="mt-3 text-[clamp(32px,4.2vw,48px)] font-medium leading-[0.95] tracking-[-0.035em]">{titulo}</h1>
        </div>
      </header>
      <main className="corp-pad mx-auto w-full min-w-0 max-w-[720px] pb-20 pt-6">
        <article className="flex flex-col gap-10">
          {bloques.map((b) => (
            <section key={b.id} id={b.id} className="scroll-mt-28">
              <h2 className="text-[20px] font-medium tracking-[-0.02em] text-[#080808]">{b.titulo}</h2>
              <div className="mt-4 flex flex-col gap-3.5">
                {b.parrafos.map((p, i) => (
                  <p key={i} className="text-[16px] leading-[1.65] text-[#6b6b6b]">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </article>
      </main>
      <ContactoFooter enDominio={enDominio} />
    </div>
  );
}
