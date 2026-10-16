import { IconoFase360 } from "./IconoMarca";

export type Fase360Item = {
  titulo: string;
  subtitulo: string;
  img: string;
};

export function TarjetaFase360({ item, index }: { item: Fase360Item; index: number }) {
  const paso = String(index + 1).padStart(2, "0");

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[22px] border border-[rgba(254,254,254,.14)] bg-[linear-gradient(165deg,#141414_0%,#0c0c0c_55%,#080808_100%)] shadow-[inset_0_1px_0_rgba(254,254,254,.06)] transition-[border-color,transform] duration-500 hover:-translate-y-0.5 hover:border-[rgba(201,162,122,.5)]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[rgba(201,162,122,.08)] blur-2xl transition-opacity duration-500 group-hover:opacity-100 opacity-0" />
      <div className="relative aspect-[3/2] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.img}
          alt=""
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[rgba(8,8,8,.45)] to-[rgba(8,8,8,.15)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,162,122,.55)] to-transparent opacity-80" />
        <span className="absolute left-4 top-4 grid h-[52px] w-[52px] place-items-center rounded-[15px] border border-[rgba(254,254,254,.22)] bg-[rgba(8,8,8,.45)] text-[#c9a27a] shadow-[0_8px_24px_rgba(8,8,8,.45)] backdrop-blur-md">
          <IconoFase360 index={index} />
        </span>
        <span className="absolute right-4 top-4 rounded-full border border-[rgba(254,254,254,.2)] bg-[rgba(8,8,8,.5)] px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-[rgba(254,254,254,.85)] backdrop-blur-md">
          Paso {paso}
        </span>
      </div>
      <div className="relative flex flex-1 flex-col gap-3.5 p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="max-w-[16ch] text-[clamp(19px,1.6vw,22px)] font-medium leading-[1.15] tracking-[-0.025em] text-[#fefefe]">
            {item.titulo}
          </h3>
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-[rgba(254,254,254,.12)] bg-[rgba(254,254,254,.06)] text-[13px] text-[#c9a27a] transition-colors group-hover:border-[rgba(201,162,122,.35)] group-hover:bg-[rgba(201,162,122,.12)]">
            {paso}
          </span>
        </div>
        <p className="inline-flex w-fit max-w-full items-center gap-2.5 rounded-full border border-[rgba(201,162,122,.35)] bg-[rgba(201,162,122,.1)] px-3.5 py-1.5 text-[13px] leading-snug text-[rgba(254,254,254,.92)]">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#c9a27a] text-[10px] font-semibold text-[#080808]">✓</span>
          {item.subtitulo}
        </p>
        <div className="mt-auto h-[3px] w-0 max-w-full rounded-full bg-[#c9a27a] transition-[width] duration-700 ease-out group-hover:w-full" />
      </div>
    </article>
  );
}

export function GridFases360({ items }: { items: Fase360Item[] }) {
  return (
    <div className="grid w-full min-w-0 grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-3 lg:gap-4">
      {items.map((item, i) => (
        <div key={item.titulo} className="contents">
          <TarjetaFase360 item={item} index={i} />
          {i < items.length - 1 ? (
            <div className="hidden items-center justify-center md:flex" aria-hidden>
              <span className="grid h-10 w-10 place-items-center rounded-full border border-[rgba(254,254,254,.12)] bg-[rgba(254,254,254,.04)] text-[#c9a27a]">
                →
              </span>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
