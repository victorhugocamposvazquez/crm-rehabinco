import { Button } from "@/components/ui/button";
import { textoVacioResultados } from "@/lib/catastro/search-ui";

export function VacioResultados({
  filtro,
  onVerTodas,
}: {
  filtro: string;
  onVerTodas: () => void;
}) {
  const vacio = textoVacioResultados(filtro);
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-10 text-center">
      <p className="text-neutral-600">{vacio.mensaje}</p>
      {vacio.accion ? (
        <Button type="button" className="mt-4" onClick={onVerTodas}>
          {vacio.accion.label}
        </Button>
      ) : null}
    </div>
  );
}
