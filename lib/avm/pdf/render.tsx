import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { registrarFuentesPdf } from "./fonts";
import { InformePdfDocument } from "./InformePdf";
import { modeloInformePdf, nombreDescargaPdf, type InformePdfModel } from "./model";

export async function renderInformePdf(
  input: Parameters<typeof modeloInformePdf>[0],
): Promise<{ buffer: Buffer; model: InformePdfModel; filename: string }> {
  registrarFuentesPdf();
  const model = modeloInformePdf(input);
  const buffer = await renderToBuffer(<InformePdfDocument model={model} />);
  const calle = [input.twin.address.route, input.twin.address.streetNumber].filter(Boolean).join(" ");
  return {
    buffer,
    model,
    filename: nombreDescargaPdf(calle || model.address, input.createdAt),
  };
}
