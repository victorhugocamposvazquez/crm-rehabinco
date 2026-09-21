import { NextRequest, NextResponse } from "next/server";
import { contactoARedireccion, parsearTextoContacto, parsearVCard } from "@/lib/contacts/contact-picker";

async function datosDesdeFormulario(formData: FormData) {
  const title = formData.get("title")?.toString() ?? "";
  const text = formData.get("text")?.toString() ?? "";
  const url = formData.get("url")?.toString() ?? "";

  for (const key of ["contact", "media", "files"]) {
    const file = formData.get(key);
    if (file instanceof File && file.size > 0) {
      const vcard = await file.text();
      const desdeVcard = parsearVCard(vcard);
      if (desdeVcard) return desdeVcard;
    }
  }

  return parsearTextoContacto([title, text, url].filter(Boolean).join("\n"));
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const datos = await datosDesdeFormulario(formData);
  const params = datos ? contactoARedireccion(datos) : new URLSearchParams({ nueva: "1" });
  return NextResponse.redirect(new URL(`/clientes?${params.toString()}`, req.url));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") ?? "";
  const text = searchParams.get("text") ?? "";
  const url = searchParams.get("url") ?? "";
  const datos = parsearTextoContacto([title, text, url].filter(Boolean).join("\n"));
  const params = datos ? contactoARedireccion(datos) : new URLSearchParams({ nueva: "1" });
  return NextResponse.redirect(new URL(`/clientes?${params.toString()}`, req.url));
}
