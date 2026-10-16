import Link from "next/link";
import { DIFERENCIA_LEAD, PILARES_CONFIANZA, type PilarConfianza } from "@/lib/web/corporativa/contenido";
import { IconoPilarConfianza } from "./IconoMarca";
import { SplitLine } from "./TipografiaMotion";

function TarjetaCompacta({ pilar, index }: { pilar: PilarConfianza; index: number }) {
  const num = String(index + 1).padStart(2, "0");
  return (
    <article className="group flex min-h-[220px] flex-col gap-4 rounded-[22px] border border-[rgba(8,8,8,.1)] bg-[#f4f3f1] p-6 transition-[border-color,transform,box-shadow] duration-500 hover:-translate-y-0.5 hover:border-[rgba(201,162,122,.45)] hover:shadow-[0_20px_50px_rgba(8,8,8,.08)]">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-[52px] w-[52px] place-items-center rounded-[15px] border border-[rgba(8,8,8,.08)] bg-[#fefefe] text-[#c9a27a] shadow-[0_4px_16px_rgba(8,8,8,.06)]">
          <IconoPilarConfianza index={index} />
        </span>
        <span className="text-[12px] uppercase tracking-[0.08em] text-[#9a9a9a]">{num}</span>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[12px] uppercase tracking-[0.06em] text-[#c9a27a]">{pilar.gancho}</p>
        <h3 className="text-[clamp(20px,1.6vw,24px)] font-medium leading-[1.15] tracking-[-0.02em]">{pilar.titulo}</h3>
        <p className="max-w-[42ch] text-[15px] leading-relaxed text-[#6b6b6b]">{pilar.texto}</p>
      </div>
      <div className="mt-auto h-[3px] w-0 rounded-full bg-[#c9a27a] transition-[width] duration-700 ease-out group-hover:w-full" />
    </article>
  );
}

function TarjetaHero({ pilar }: { pilar: PilarConfianza }) {
  return (
    <article className="group relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-[22px] border border-[rgba(8,8,8,.12)] md:row-span-2 md:min-h-[480px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pilar.img}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[rgba(8,8,8,.55)] to-[rgba(8,8,8,.2)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,162,122,.55)] to-transparent" />
      <span className="absolute left-5 top-5 grid h-[52px] w-[52px] place-items-center rounded-[15px] border border-[rgba(254,254,254,.22)] bg-[rgba(8,8,8,.45)] text-[#c9a27a] backdrop-blur-md">
        <IconoPilarConfianza index={0} />
      </span>
      <div className="relative flex flex-col gap-3 p-6 text-[#fefefe] md:p-8">
        <p className="text-[12px] uppercase tracking-[0.08em] text-[#c9a27a]">{pilar.gancho}</p>
        <h3 className="max-w-[16ch] text-[clamp(26px,2.4vw,36px)] font-medium leading-[1.05] tracking-[-0.03em]">{pilar.titulo}</h3>
        <p className="max-w-[46ch] text-[16px] leading-relaxed text-[rgba(254,254,254,.88)]">{pilar.texto}</p>
      </div>
    </article>
  );
}

function FilaPostventa({ pilar }: { pilar: PilarConfianza }) {
  return (
    <article className="group relative col-span-1 flex flex-col gap-6 overflow-hidden rounded-[22px] border border-[rgba(254,254,254,.14)] bg-[#080808] p-6 text-[#fefefe] md:col-span-2 md:flex-row md:items-center md:justify-between md:p-8">
      <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-[rgba(201,162,122,.12)] blur-3xl" />
      <div className="relative flex flex-col gap-3 md:max-w-[52ch]">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[14px] border border-[rgba(254,254,254,.18)] bg-[rgba(254,254,254,.08)] text-[#c9a27a]">
            <IconoPilarConfianza index={3} />
          </span>
          <p className="text-[12px] uppercase tracking-[0.08em] text-[#c9a27a]">{pilar.gancho}</p>
        </div>
        <h3 className="text-[clamp(22px,2vw,28px)] font-medium tracking-[-0.02em]">{pilar.titulo}</h3>
        <p className="text-[15px] leading-relaxed text-[rgba(254,254,254,.85)]">{pilar.texto}</p>
      </div>
      <Link href="#contacto" className="corp-btn relative shrink-0 self-start !bg-[#fefefe] !text-[#080808] md:self-center">
        Cuéntanos tu caso
        <span className="corp-btn-icon !bg-[#080808] !text-[#fefefe]">↗</span>
      </Link>
    </article>
  );
}

export function SeccionDiferenciaRehabinco() {
  const [hero, compactaA, compactaB, postventa] = PILARES_CONFIANZA;

  return (
    <section id="por-que-rehabinco" className="corp-pad flex flex-col gap-10 pb-0 pt-[clamp(80px,10vw,150px)]">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p data-enter="0" className="corp-kicker">
            (06) Por qué Rehabinco
          </p>
          <h2 className="corp-h2 mt-3">
            <SplitLine name="dif1" text="LO QUE NOS HACE" />
            <SplitLine name="dif2" text="DIFERENTES" />
          </h2>
        </div>
        <p data-enter="120" className="max-w-[38ch] text-[15px] leading-relaxed text-[#6b6b6b]">
          {DIFERENCIA_LEAD}
        </p>
      </div>

      <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        {hero ? <TarjetaHero pilar={hero} /> : null}
        {compactaA ? <TarjetaCompacta pilar={compactaA} index={1} /> : null}
        {compactaB ? <TarjetaCompacta pilar={compactaB} index={2} /> : null}
        {postventa ? <FilaPostventa pilar={postventa} /> : null}
      </div>
    </section>
  );
}
