# Diseño "Aire"

Diseño nuevo del CRM, opcional por navegador (menú de perfil → Diseño → Aire).
Se activa con `data-diseno="aire"` en `<html>` (`lib/ui/diseno.ts`) y redefine
las mismas variables CSS del clásico, así cada pantalla cambia sin tocarla.

Referencia de producto: medimos en noviembre de 2026 una app inmobiliaria del
sector que el equipo considera más cómoda (espaciado, jerarquía, flujo). Lo que
se toma son **medidas y patrones genéricos** (escala de grises tipo Tailwind
slate, Inter, controles de 40 px, radios 6/8 px). Código, textos, iconos, logo e
imágenes son de Rehabinco.

## Medidas

| Elemento | Valor |
| --- | --- |
| Tipografía | Inter, 16/24 base; 14/20 en controles; 12/16–18 en etiquetas |
| Texto | `#334155` principal, `#64748b` secundario, `#94a3b8` terciario |
| Fondo de página | `#f8fafc`; superficies blancas |
| Bordes | `#e2e8f0` (1 px) |
| Barra superior | 56 px, marca a la izquierda, acciones redondas de 36 px a la derecha |
| Barra de página | título 24/32 peso 500 + búsqueda + filtros + acción principal a la derecha; 40 px de alto los controles |
| Botón principal | fondo `--accent` (pizarra casi negra, color de marca), radio 6 px, 14 px, padding 8×12 |
| Botón secundario / filtro | blanco, borde `#e2e8f0`, radio 8 px, 40 px |
| Panel | blanco, radio 8 px, sombra `0 1px 3px rgb(0 0 0/.1), 0 1px 2px -1px rgb(0 0 0/.1)`; cabecera 18/28 con padding 16×24 y borde inferior |
| Tarjeta de lista | borde 1 px, radio 8 px, sombra media al pasar el ratón |
| Etiqueta de estado | radio 6 px, padding 2×6, 14 px; gris `#e2e8f0` o ámbar claro |
| Chips | `#f1f5f9`, totalmente redondos, padding 4×8 |
| Rejilla | 12 columnas, separación 24 px, padding de página 32 px |
| Lanzador | tarjetas de 120 px de alto, icono en círculo de 40 px, título 16/600, frase 12/18 |

## Piezas

- `components/layout/BarraAire.tsx`: barra superior (sustituye al menú lateral).
- `app/(dashboard)/inicio`: lanzador de módulos.
- `components/layout/BarraPagina.tsx`: `BarraPagina`, `BotonBarra`, `BotonPrincipal`.
- Clases `.aire-panel`, `.aire-panel-cabecera`, `.aire-tarjeta` en `app/globals.css`.
- `.solo-clasico` / `.solo-aire`: piezas que solo existen en uno de los dos diseños.

## Migración

Pantalla a pantalla: sustituir la cabecera propia por `BarraPagina` y las
tarjetas por `.aire-panel` / `.aire-tarjeta`. Cuando todas estén migradas, Aire
pasa a ser el diseño por defecto y se retira el clásico.
