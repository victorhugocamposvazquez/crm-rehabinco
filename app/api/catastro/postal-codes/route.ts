import { createClient } from "@/lib/supabase/server";
import {
  codigosPostalesDeMunicipio,
  municipiosDeCodigoPostal,
} from "@/lib/catastro/explorer/postal-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const province = params.get("province") ?? params.get("provincia") ?? "";
  const municipality = params.get("municipality") ?? params.get("municipio") ?? "";
  const postalCode = (params.get("postalCode") ?? params.get("codigoPostal") ?? "").replace(/\s+/g, "");

  return Response.json({
    ok: true,
    municipality: codigosPostalesDeMunicipio(province, municipality),
    owners: /^\d{5}$/.test(postalCode) ? municipiosDeCodigoPostal(postalCode) : [],
  });
}
