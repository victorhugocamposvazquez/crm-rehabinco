import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { MODELO_COPILOTO_FALLBACK } from "@/lib/ai/presupuesto-copiloto";
import { exigirEquipoArchivo } from "@/lib/inmuebles/archivo-servidor";
import { buildCaptionPrompt, captionFallback, type CaptionRequest } from "@/lib/estudio/caption";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const anthropic = createAnthropic();

export async function POST(req: Request) {
  const acceso = await exigirEquipoArchivo();
  if (acceso.error || !acceso.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as CaptionRequest | null;
  if (!body?.inmueble || !body.canal || !body.tono) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }
  try {
    const result = await generateText({
      model: anthropic(MODELO_COPILOTO_FALLBACK),
      prompt: buildCaptionPrompt(body),
      maxOutputTokens: 500,
      abortSignal: AbortSignal.timeout(25_000),
    });
    const text = result.text.trim();
    if (!text) throw new Error("vacío");
    return NextResponse.json({ text, source: "ia" });
  } catch {
    return NextResponse.json({ text: captionFallback(body), source: "plantilla" });
  }
}
