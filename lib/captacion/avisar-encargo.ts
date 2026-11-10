import { publicarAviso } from "@/lib/alertas/publicar";

export type EncargoAvisable = {
  id: string;
  calle: string;
  numero: string;
};

function donde(encargo: EncargoAvisable): string {
  return [encargo.calle, encargo.numero].filter(Boolean).join(" ").trim();
}

/** Un encargo, un aviso. Un lote (Excel o varias fincas), un solo aviso y un solo push. */
export async function avisarEncargosNuevos(input: {
  asignadoA: string;
  actorId: string | null;
  encargos: EncargoAvisable[];
}): Promise<void> {
  if (!input.asignadoA || input.asignadoA === input.actorId) return;
  const encargos = input.encargos.filter((encargo) => encargo.id);
  if (encargos.length === 0) return;

  if (encargos.length === 1) {
    const encargo = encargos[0];
    await publicarAviso({
      userId: input.asignadoA,
      canal: "encargos",
      clave: `encargo:${encargo.id}`,
      titulo: "Nuevo encargo",
      cuerpo: donde(encargo) || "Tienes un portal nuevo para trabajar.",
      url: `/catastro/encargos/${encargo.id}`,
    });
    return;
  }

  await publicarAviso({
    userId: input.asignadoA,
    canal: "encargos",
    clave: `encargos:${encargos[0].id}`,
    titulo: "Nuevos encargos",
    cuerpo: `Te han encargado ${encargos.length} portales para captar.`,
    url: "/catastro/encargos",
  });
}
