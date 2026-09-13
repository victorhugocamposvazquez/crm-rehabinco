type ClienteNotas = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: { comercial_id?: string } | null }>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<unknown>;
    };
  };
};

export async function aplicarAsignacionAPropiedad(
  supabase: ClienteNotas,
  fincaReference: string,
  propertyId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("catastro_explorer_assignments")
    .select("comercial_id")
    .eq("finca_reference", fincaReference)
    .maybeSingle();
  const comercialId = data?.comercial_id ?? null;
  if (!comercialId) return null;
  await supabase.from("propiedades").update({ comercial_id: comercialId }).eq("id", propertyId);
  return comercialId;
}
