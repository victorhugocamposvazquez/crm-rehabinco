"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { AccionNuevaBusqueda } from "@/components/catastro/AccionNuevaBusqueda";
import { BusquedasRecientes } from "@/components/catastro/BusquedasRecientes";
import { CatastroSubnav } from "@/components/catastro/CatastroSubnav";
import { RUTA_EXPLORER } from "@/lib/catastro/explorer/history-ui";

export default function CatastroExplorerPage() {
  return (
    <div>
      <CatastroSubnav />
      <PageHeader
        breadcrumb={[{ label: "Catastro Explorer", href: RUTA_EXPLORER }]}
        title="Catastro Explorer"
        description="Encuentra y analiza fincas utilizando información oficial de Catastro."
        actions={<AccionNuevaBusqueda />}
      />
      <BusquedasRecientes />
    </div>
  );
}
