"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { StepId } from "@/lib/avm/flow";
import type { PropertyType, Twin } from "@/lib/avm/types";

type Props = {
  pasoId: StepId;
  title: string;
  hint: string;
  twin: Twin;
  optional?: boolean;
  onContinuar: (patch: Partial<Twin>) => void;
  onSaltar?: () => void;
};

export function PreguntaPaso({ pasoId, title, hint, twin, optional, onContinuar, onSaltar }: Props) {
  const [num, setNum] = useState("");

  function enviar(patch: Partial<Twin>) {
    onContinuar(patch);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h2>
        {hint ? <p className="mt-1 text-[14px] text-[var(--text-3)]">{hint}</p> : null}
      </div>

      {pasoId === "propertyType" ? (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["apartment", "Piso"],
              ["house", "Casa"],
              ["building", "Edificio"],
              ["land", "Terreno"],
            ] as const
          ).map(([main, label]) => (
            <button
              key={main}
              type="button"
              className="rounded-full border border-[var(--border)] px-4 py-2 text-[14px] hover:border-[var(--border-strong)]"
              onClick={() => enviar({ mainType: main, propertyType: main as PropertyType })}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {pasoId === "side" ? (
        <div className="flex flex-wrap gap-2">
          <Chip label="Exterior" sub="Da a la calle" onClick={() => enviar({ side: "exterior" })} />
          <Chip label="Interior" sub="Da al patio" onClick={() => enviar({ side: "interior" })} />
        </div>
      ) : null}

      {pasoId === "condition" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            [5, "Excelente", "Nueva o reformada recientemente"],
            [4, "Bueno", "Bien mantenida"],
            [3, "Aceptable", "Necesita reparaciones"],
            [2, "Malo", "Problemas importantes"],
            [1, "Ruina", "No habitable"],
          ].map(([v, label, sub]) => (
            <button
              key={v}
              type="button"
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-left hover:bg-[var(--surface-soft)]"
              onClick={() => enviar({ buildingCondition: v as 1 | 2 | 3 | 4 | 5 })}
            >
              <span className="block text-[14px] font-medium">{label}</span>
              <span className="block text-[12px] text-[var(--text-3)]">{sub}</span>
            </button>
          ))}
        </div>
      ) : null}

      {pasoId === "renovated" ? (
        <div className="flex flex-wrap gap-2">
          <Chip label="Sí" onClick={() => enviar({ isRenovated: true })} />
          <Chip label="No" onClick={() => enviar({ isRenovated: false })} />
          {optional ? <Chip label="No lo sé" onClick={() => onSaltar?.()} /> : null}
        </div>
      ) : null}

      {pasoId === "hasBalcony" ? (
        <div className="flex flex-wrap gap-2">
          <Chip label="Sí" onClick={() => enviar({ hasBalcony: true })} />
          <Chip label="No" onClick={() => enviar({ hasBalcony: false })} />
        </div>
      ) : null}

      {pasoId === "counters" ? (
        <Contadores twin={twin} onContinuar={enviar} />
      ) : null}

      {pasoId === "features" ? (
        <Features twin={twin} onContinuar={enviar} />
      ) : null}

      {["surface", "landSurface", "constructionYear", "renovationYear", "balconySurface", "floors"].includes(pasoId) ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(num.replace(",", "."));
            if (!Number.isFinite(n)) return;
            if (pasoId === "surface") enviar({ builtSurface: n });
            else if (pasoId === "landSurface") enviar({ landSurface: n });
            else if (pasoId === "constructionYear") enviar({ constructionYear: Math.round(n) });
            else if (pasoId === "renovationYear") enviar({ renovationYear: Math.round(n) });
            else if (pasoId === "balconySurface") enviar({ balconySurface: n });
            else if (pasoId === "floors") enviar({ floorOfFlat: Math.round(n), numberOfFloors: twin.numberOfFloors });
          }}
        >
          <div className="flex h-12 items-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3">
            <input
              value={num}
              onChange={(e) => setNum(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              inputMode="decimal"
              autoFocus
            />
            <span className="text-[13px] text-[var(--text-3)]">
              {pasoId.includes("Year") ? "" : pasoId === "floors" ? "ª planta" : "m²"}
            </span>
          </div>
          <Button type="submit" size="sm">
            Continuar
          </Button>
        </form>
      ) : null}

      {optional && pasoId !== "renovated" ? (
        <button type="button" className="text-[13px] text-[var(--text-3)] underline-offset-2 hover:underline" onClick={onSaltar}>
          No lo sé
        </button>
      ) : null}
    </div>
  );
}

function Chip({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="min-w-[120px] rounded-lg border border-[var(--border)] px-4 py-2 text-left hover:border-[var(--border-strong)]"
      onClick={onClick}
    >
      <span className="block text-[14px] font-medium">{label}</span>
      {sub ? <span className="block text-[12px] text-[var(--text-3)]">{sub}</span> : null}
    </button>
  );
}

function Contadores({ twin, onContinuar }: { twin: Twin; onContinuar: (p: Partial<Twin>) => void }) {
  const [bed, setBed] = useState(twin.numberOfBedrooms ?? 3);
  const [bath, setBath] = useState(twin.numberOfBathrooms ?? 1);
  const [inP, setInP] = useState(twin.numberOfIndoorParkings ?? 0);
  const [outP, setOutP] = useState(twin.numberOfOutdoorParkings ?? 0);
  return (
    <div className="space-y-3">
      <Stepper label="Dormitorios" value={bed} onChange={setBed} />
      <Stepper label="Baños" value={bath} onChange={setBath} />
      <Stepper label="Plazas cubiertas" value={inP} onChange={setInP} />
      <Stepper label="Plazas exteriores" value={outP} onChange={setOutP} />
      <Button
        type="button"
        size="sm"
        onClick={() =>
          onContinuar({
            numberOfBedrooms: bed,
            numberOfBathrooms: bath,
            numberOfIndoorParkings: inP,
            numberOfOutdoorParkings: outP,
          })
        }
      >
        Continuar
      </Button>
    </div>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[14px]">
      <span className="text-[var(--text-2)]">{label}</span>
      <div className="flex h-11 items-center rounded-lg border border-[var(--border)]">
        <button type="button" className="h-full w-10 text-[var(--text-3)]" onClick={() => onChange(Math.max(0, value - 1))}>
          −
        </button>
        <span className="min-w-[2rem] text-center font-semibold tabular-nums">{value}</span>
        <button type="button" className="h-full w-10 text-[var(--text-3)]" onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

function Features({ twin, onContinuar }: { twin: Twin; onContinuar: (p: Partial<Twin>) => void }) {
  const [flags, setFlags] = useState({
    hasView: twin.hasView ?? false,
    hasSwimmingPool: twin.hasSwimmingPool ?? false,
    hasGarden: twin.hasGarden ?? false,
    hasElevator: twin.hasElevator ?? false,
    hasStorageRoom: twin.hasStorageRoom ?? false,
    hasFireplace: twin.hasFireplace ?? false,
  });
  const items: { key: keyof typeof flags; label: string }[] = [
    { key: "hasView", label: "Vistas despejadas" },
    { key: "hasSwimmingPool", label: "Piscina" },
    { key: "hasGarden", label: "Jardín" },
    { key: "hasElevator", label: "Ascensor" },
    { key: "hasStorageRoom", label: "Trastero" },
    { key: "hasFireplace", label: "Chimenea" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-[13px] ${flags[it.key] ? "border-foreground bg-[var(--surface-soft)]" : "border-[var(--border)]"}`}
            onClick={() => setFlags((f) => ({ ...f, [it.key]: !f[it.key] }))}
          >
            {it.label}
          </button>
        ))}
      </div>
      <Button type="button" size="sm" onClick={() => onContinuar(flags)}>
        Continuar
      </Button>
    </div>
  );
}
