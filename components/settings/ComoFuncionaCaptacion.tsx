import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BLOQUES = [
  {
    titulo: "Una pasada al día",
    texto:
      "Cada día, a las 04:30 UTC (06:30 en verano y 05:30 en invierno), Supabase llama al CRM y Bright Data lee el listado de las zonas marcadas. En el panel de Bright Data el schedule tiene que estar apagado: si no, la misma pasada se lanza dos veces.",
  },
  {
    titulo: "Qué entra del listado",
    texto:
      "Precio, metros, fotos del listado, zona y si es particular o agencia. No entra el teléfono ni, casi nunca, la fecha de publicación de Idealista. Si no hay fecha del portal, el anuncio dice «Detectado el…»: es el día en que el CRM lo vio por primera vez.",
  },
  {
    titulo: "El teléfono",
    texto:
      "No se pide a Bright Data. Quien revela el teléfono en Idealista, con la extensión de Chrome y el token de Ajustes, lo guarda en el anuncio. Si ya había un teléfono válido, no se sustituye. En la ficha se ve «teléfono: falta» o «capturado por… el día…».",
  },
  {
    titulo: "Zonas",
    texto:
      "Solo se leen las zonas marcadas, con el filtro de particulares. A Coruña, Santiago y Ferrol están partidos por distritos; el resto de la provincia, por municipio. Las zonas nuevas entran desmarcadas. El número de al lado es un estimado: si pasa de 1.500, Idealista corta el listado y hay que partir esa zona.",
  },
  {
    titulo: "Retirados",
    texto:
      "Un anuncio se marca retirado solo cuando hay dos pasadas completas de su zona y no salió en ninguna de las dos. Si la última página venía llena y aún había página siguiente, esa pasada queda incompleta y no retira nada.",
  },
];

export function ComoFuncionaCaptacion() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cómo funciona</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {BLOQUES.map((bloque) => (
          <section key={bloque.titulo}>
            <h3 className="text-[13.5px] font-semibold text-neutral-800">{bloque.titulo}</h3>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--text-2)]">{bloque.texto}</p>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
