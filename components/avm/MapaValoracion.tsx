"use client";

import { AvmMap } from "@/lib/avm/ui/Map";
import type { AdjustedComparable } from "@/lib/avm/types";

type Props = {
  lat: number;
  lng: number;
  comparables?: AdjustedComparable[];
  arrastrable?: boolean;
  onMover?: (lat: number, lng: number) => void;
  className?: string;
  ortofotoToggle?: boolean;
};

export function MapaValoracion({ comparables = [], ortofotoToggle = true, className, ...rest }: Props) {
  return (
    <AvmMap
      {...rest}
      className={className ?? "aspect-square w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[#0f1114]"}
      comparables={comparables}
      anillos
      ortofotoToggle={ortofotoToggle}
    />
  );
}
