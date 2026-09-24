import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PASOS = [
  {
    kicker: "Cada día",
    titulo: "Una pasada a las 04:30 UTC",
    texto: "A las 04:30 UTC se abre la recogida. Cada 5 minutos el CRM pide las páginas al Web Unlocker.",
    nota: "Scraper Studio no interviene. La provincia a 48 h solo sirve para la fecha.",
  },
  {
    kicker: "Listado",
    titulo: "Qué se guarda",
    texto: "Precio, metros, fotos, zona y si es particular o agencia. El teléfono no entra.",
    nota: "Si Idealista no manda fecha, la ficha dice «Detectado el…»: el día en que el CRM lo vio por primera vez.",
  },
  {
    kicker: "Teléfono",
    titulo: "Lo guarda la extensión",
    texto: "Quien lo revela en Idealista, con la extensión de Chrome y el token de Ajustes → Perfil, lo deja en el anuncio. Un teléfono válido no se sustituye.",
    nota: "En la ficha se lee «teléfono: falta» o «capturado por… el día…».",
  },
  {
    kicker: "Zonas",
    titulo: "La provincia, partida",
    texto: "Una URL por municipio. A Coruña, Santiago y Ferrol entran enteras: ninguna pasa de 1.500. Solo se leen las zonas marcadas.",
    nota: "Si el estimado pasa de 1.500, Idealista corta el listado y hay que partir esa zona.",
  },
  {
    kicker: "Retirados",
    titulo: "Hacen falta dos pasadas",
    texto: "Un anuncio se marca retirado cuando no salió en dos pasadas completas de su zona.",
    nota: "Si la última página venía llena y aún había siguiente, esa pasada queda incompleta y no retira nada.",
  },
];

export function ComoFuncionaCaptacion() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cómo funciona</CardTitle>
        <CardDescription>El listado entra por Bright Data. El teléfono, por la extensión.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ol>
          {PASOS.map((paso) => (
            <li
              key={paso.kicker}
              className="grid gap-1 border-t border-[var(--border-soft)] px-4 py-3.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-6"
            >
              <p className="pt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-dark)]">{paso.kicker}</p>
              <div className="min-w-0">
                <h3 className="text-[14px] font-semibold leading-snug text-neutral-900">{paso.titulo}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-neutral-800">{paso.texto}</p>
                <p className="mt-1.5 border-l-2 border-[#9ecfc4] pl-2.5 text-[13px] leading-relaxed text-[var(--text-2)]">{paso.nota}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
