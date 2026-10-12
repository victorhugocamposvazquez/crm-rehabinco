"use client";

import React from "react";
import { TagAvm } from "@/components/avm/nueva/wizard-ui";
import { groupFields, type WizardGroupId } from "@/lib/avm/wizard-groups";
import type { PropertyType, Twin } from "@/lib/avm/types";

type Props = {
  group: WizardGroupId;
  twin: Twin;
  unknown: Set<string>;
  sources: Partial<Record<keyof Twin, string>>;
  onPatch: (patch: Partial<Twin>, touched: (keyof Twin)[]) => void;
};

function Chip({
  pressed,
  onClick,
  children,
  sub,
}: {
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`rounded-full border px-3.5 py-2 text-[13px] transition-colors ${
        pressed ? "border-foreground bg-[var(--surface-soft)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
      }`}
      onClick={onClick}
    >
      {children}
      {sub ? <span className="mt-0.5 block text-[12px] text-[var(--text-3)]">{sub}</span> : null}
    </button>
  );
}

export function PantallaGrupo({ group, twin, unknown, sources, onPatch }: Props) {
  const fields = groupFields(group, twin);

  function srcTag(f: keyof Twin) {
    const s = sources[f];
    if (!s) return null;
    const good = s === "catastro_local" || s === "catastro_sede";
    return (
      <TagAvm className={good ? "border-transparent bg-emerald-500/10 text-emerald-600" : ""}>
        {good ? "Catastro" : s === "listing" ? "Anuncio" : s}
      </TagAvm>
    );
  }

  function setField(f: keyof Twin, value: unknown) {
    onPatch({ [f]: value } as Partial<Twin>, [f]);
  }

  function setUnknown(f: keyof Twin) {
    onPatch({ [f]: null } as Partial<Twin>, [f]);
  }

  return (
    <div className="form grid gap-4">
      {fields.map((x) => {
        const f = x.f;
        if (f === "extras") {
          const opts = (typeof x.opts === "function" ? x.opts(twin) : x.opts) ?? [];
          return (
            <div key="extras" className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-3)]">
                <span>{x.label}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {opts.map(([k, label]) => {
                  const key = k as keyof Twin;
                  const on = twin[key] === true;
                  return (
                    <Chip key={String(k)} pressed={on} onClick={() => setField(key, !on)}>
                      {on ? "✓ " : ""}
                      {label}
                    </Chip>
                  );
                })}
              </div>
            </div>
          );
        }

        const key = f as keyof Twin;
        const opts = typeof x.opts === "function" ? x.opts(twin) : x.opts;
        const isUnk = unknown.has(String(key));

        return (
          <div key={String(f)} className="space-y-2" data-field={String(f)}>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-3)]">
              <span>
                {x.label}
                {x.required ? <span className="text-foreground"> ·</span> : null}
              </span>
              {srcTag(key)}
            </div>

            {x.kind === "chips" && opts ? (
              <div className="flex flex-wrap gap-2">
                {opts.map(([v, label], i) => {
                  const more = v === "more";
                  const pressed =
                    more && typeof twin.floorOfFlat === "number" && twin.floorOfFlat >= 9
                      ? true
                      : twin[key] === v;
                  return (
                    <Chip
                      key={`${String(f)}-${i}`}
                      pressed={pressed}
                      onClick={() => {
                        if (more) setField(key, Math.max(9, typeof twin.floorOfFlat === "number" ? twin.floorOfFlat : 9));
                        else if (key === "mainType") {
                          onPatch(
                            { mainType: v as Twin["mainType"], propertyType: v as PropertyType },
                            ["mainType", "propertyType"],
                          );
                        } else if (key === "isRenovated" && v !== true) {
                          onPatch({ isRenovated: v as boolean, renovationYear: null }, ["isRenovated", "renovationYear"]);
                        } else if (key === "hasBalcony" && v !== true) {
                          onPatch({ hasBalcony: v as boolean, balconySurface: null }, ["hasBalcony", "balconySurface"]);
                        } else if (key === "relationship" && v !== "owner") {
                          onPatch({ relationship: v as Twin["relationship"], saleHorizon: null }, ["relationship", "saleHorizon"]);
                        } else setField(key, v);
                      }}
                    >
                      {label}
                    </Chip>
                  );
                })}
                {!x.noUnknown ? (
                  <Chip pressed={isUnk} onClick={() => setUnknown(key)}>
                    No lo sé
                  </Chip>
                ) : null}
              </div>
            ) : null}

            {x.kind === "chips" && key === "floorOfFlat" && typeof twin.floorOfFlat === "number" && twin.floorOfFlat >= 9 ? (
              <div className="flex h-11 max-w-[150px] items-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]">
                <button
                  type="button"
                  className="h-full w-10 text-lg text-[var(--text-3)] hover:text-foreground"
                  aria-label="Planta menos"
                  onClick={() => setField(key, Math.max(9, (twin.floorOfFlat ?? 9) - 1))}
                >
                  −
                </button>
                <span className="flex-1 text-center text-[15px] font-semibold tabular-nums">{twin.floorOfFlat}ª</span>
                <button
                  type="button"
                  className="h-full w-10 text-lg text-[var(--text-3)] hover:text-foreground"
                  aria-label="Planta más"
                  onClick={() => setField(key, (twin.floorOfFlat ?? 9) + 1)}
                >
                  +
                </button>
              </div>
            ) : null}

            {x.kind === "stepper" ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-11 w-[150px] items-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]">
                  <button
                    type="button"
                    className="h-full w-10 text-lg text-[var(--text-3)]"
                    onClick={() => setField(key, Math.max(x.min ?? 0, (Number(twin[key]) || 0) - 1))}
                  >
                    −
                  </button>
                  <span className="flex-1 text-center text-[15px] font-semibold tabular-nums">{String(twin[key] ?? "—")}</span>
                  <button
                    type="button"
                    className="h-full w-10 text-lg text-[var(--text-3)]"
                    onClick={() => setField(key, (Number(twin[key]) || 0) + 1)}
                  >
                    +
                  </button>
                </div>
                {!x.noUnknown ? (
                  <Chip pressed={isUnk} onClick={() => setUnknown(key)}>
                    No lo sé
                  </Chip>
                ) : null}
              </div>
            ) : null}

            {x.kind === "number" ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-11 w-[170px] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3">
                  <input
                    inputMode="numeric"
                    className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                    value={twin[key] == null ? "" : String(twin[key])}
                    placeholder="—"
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setField(key, Number.isFinite(v) ? v : null);
                    }}
                  />
                  {x.unit ? <span className="text-[13px] text-[var(--text-3)]">{x.unit}</span> : null}
                </div>
                {!x.required ? (
                  <Chip pressed={isUnk} onClick={() => setUnknown(key)}>
                    No lo sé
                  </Chip>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
