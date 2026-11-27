"use client";

export function TestigosPortales({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (valor: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-border bg-[var(--surface)] px-3 py-2.5 text-[13.5px] font-semibold leading-snug">
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--foreground)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        Utilizar testigos de Idealista y Fotocasa
        <span className="mt-0.5 block text-[12px] font-normal text-[var(--text-3)]">
          Si no se marca, no entran en el cálculo ni salen al cliente.
        </span>
      </span>
    </label>
  );
}
