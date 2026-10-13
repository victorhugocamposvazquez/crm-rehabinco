"use client";

import { useState } from "react";
import { toast } from "sonner";
import { guardarMarcaAgencia, type MarcaGuardada } from "@/lib/actions/agency-branding";

export function MarcaAgenciaForm({ marca }: { marca: MarcaGuardada }) {
  const [guardando, setGuardando] = useState(false);

  return (
    <form
      className="mb-8 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setGuardando(true);
        const result = await guardarMarcaAgencia(new FormData(event.currentTarget));
        setGuardando(false);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Marca guardada. El próximo PDF la usa.");
      }}
    >
      <h2 className="text-[18px] font-semibold tracking-tight">Marca del informe</h2>
      <p className="mb-4 mt-1 max-w-2xl text-[13px] text-[var(--text-2)]">
        Logo, color y papel del PDF. Si no hay logo, el informe usa las iniciales sobre el color. Rehabinco va en papel oscuro, con el logo blanco.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Nombre" name="name" defaultValue={marca.name} />
        <Campo label="Color" name="color" defaultValue={marca.color} />
        <Campo label="Teléfono" name="phone" defaultValue={marca.phone ?? ""} />
        <Campo label="Email" name="email" defaultValue={marca.email ?? ""} />
        <Campo label="Web" name="web" defaultValue={marca.web ?? ""} />
        <label className="flex flex-col gap-1 text-[12px] text-[var(--text-2)]">
          Papel del PDF
          <select
            name="pdf_theme"
            defaultValue={marca.pdf_theme}
            className="h-9 rounded-[9px] border border-[var(--input)] bg-[var(--surface)] px-2 text-[13px] text-foreground"
          >
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--text-2)]">
          Logo para papel claro
          <input name="logo_light" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="text-[13px]" />
          {marca.logo_light_path ? <span className="text-[11px] text-[var(--text-3)]">{marca.logo_light_path}</span> : null}
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--text-2)]">
          Logo para papel oscuro
          <input name="logo_dark" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="text-[13px]" />
          {marca.logo_dark_path ? <span className="text-[11px] text-[var(--text-3)]">{marca.logo_dark_path}</span> : null}
        </label>
      </div>
      <button
        type="submit"
        disabled={guardando}
        className="mt-4 h-9 rounded-[9px] bg-accent px-3.5 text-[13.5px] font-semibold text-accent-foreground disabled:opacity-50"
      >
        {guardando ? "Guardando…" : "Guardar marca"}
      </button>
    </form>
  );
}

function Campo({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-[var(--text-2)]">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        className="h-9 rounded-[9px] border border-[var(--input)] bg-[var(--surface)] px-2 text-[13px] text-foreground"
      />
    </label>
  );
}
