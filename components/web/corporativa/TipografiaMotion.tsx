import { cn } from "@/lib/utils";

/** Más altura de scroll para que el fill y el reveal no se salten con un flick. */
export function FraseScrollStage({
  children,
  className,
  compact,
}: {
  children: React.ReactNode;
  className?: string;
  /** Titulares h2: menos altura que párrafos fill. */
  compact?: boolean;
}) {
  return (
    <div
      data-frase-stage=""
      data-scroll-stage="hold"
      className={cn(
        "flex flex-col justify-center py-[clamp(20px,4vh,56px)]",
        compact ? "min-h-[min(88svh,760px)]" : "min-h-[min(125svh,980px)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SplitLine({ name, text }: { name: string; text: string }) {
  return (
    <span data-split={name} className="flex max-w-full overflow-hidden" style={{ paddingTop: ".14em", marginTop: "-.14em" }}>
      {[...text].map((ch, i) => (
        <span key={`${name}-${i}`} className="inline-block">
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}

export function FillText({ text, className, center }: { text: string; className?: string; center?: boolean }) {
  return (
    <p
      data-fill=""
      className={[className, center ? "corp-fill--center" : ""].filter(Boolean).join(" ")}
      style={{
        margin: 0,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: center ? "center" : undefined,
        columnGap: ".26em",
      }}
    >
      {text.split(" ").map((w, i) => (
        <span key={i} style={{ display: "inline-block", color: "#080808", opacity: 0.18, filter: "blur(6px)" }}>
          {w}
        </span>
      ))}
    </p>
  );
}

function LetraHero({ ch, stroke }: { ch: string; stroke?: boolean }) {
  if (ch === "A") {
    return (
      <span className="inline-block">
        <svg viewBox="36.5 36 47 46.5" aria-label="A" className="inline-block h-[0.72em] w-[0.7em] overflow-visible align-[0]">
          <path
            d="M39.5 81L60 40L80.5 81"
            fill="none"
            stroke={stroke ? "rgba(254,254,254,.55)" : "currentColor"}
            strokeWidth="7.4"
            strokeLinejoin="miter"
            strokeMiterlimit={10}
          />
        </svg>
      </span>
    );
  }
  return <span className="inline-block">{ch}</span>;
}

export function PalabraHero({ outline }: { outline?: boolean }) {
  const word = "HOGARES";
  return (
    <div
      data-hero-word=""
      className={`pointer-events-none absolute left-0 right-0 top-[clamp(110px,16vh,190px)] px-[clamp(16px,2.6vw,40px)] ${outline ? "z-[2]" : ""}`}
      style={{ willChange: "transform" }}
    >
      <div
        data-split={outline ? "hero2" : "hero"}
        className="flex overflow-hidden whitespace-nowrap text-[clamp(60px,19.5vw,330px)] font-medium leading-[0.86] tracking-[-0.055em]"
        style={{
          paddingTop: ".14em",
          marginTop: "-.14em",
          color: outline ? "transparent" : "#fefefe",
          WebkitTextStroke: outline ? "1px rgba(254,254,254,.55)" : undefined,
        }}
      >
        {[...word].map((ch, i) => (
          <LetraHero key={i} ch={ch} stroke={outline} />
        ))}
      </div>
    </div>
  );
}
