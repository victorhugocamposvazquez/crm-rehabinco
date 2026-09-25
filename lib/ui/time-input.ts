export function horasCompletas(value: string): boolean {
  const [h] = value.split(":");
  return Boolean(h && h.length === 2 && /^(0[0-9]|1[0-9]|2[0-3])$/.test(h));
}

/** Pega tipo 1530 → 15:30 cuando el campo no trae «:». */
export function horaDesdeDigitosPegado(value: string, prev: string): string | null {
  if (value.includes(":")) return null;
  const digits = value.replace(/\D/g, "");
  const prevDigits = prev.replace(/\D/g, "");
  if (digits.length < 4 || digits === prevDigits) return null;
  const h = Math.min(23, Math.max(0, parseInt(digits.slice(0, 2), 10)));
  const m = Math.min(59, Math.max(0, parseInt(digits.slice(2, 4), 10)));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function seleccionSegmentoMinutos(el: HTMLInputElement): void {
  requestAnimationFrame(() => {
    try {
      if (el.value.length >= 5) el.setSelectionRange(3, 5);
    } catch {
      /* algunos navegadores con type=time */
    }
  });
}
