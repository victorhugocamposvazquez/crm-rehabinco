# Zonas de captación

La pasada diaria de Idealista solo lee las zonas con la casilla marcada en Ajustes → Captación. El número de al lado es un estimado: no elige la zona. Si pasa de 1.500, Idealista corta el listado y hay que partirla.

## Qué hay en el catálogo

El catálogo vive en `lib/captacion/brightdata/zonas.ts` (`ZONAS_IDEALISTA`). No sale de la base de datos.

| Grupo | Cómo se parte | Al entrar |
| --- | --- | --- |
| A Coruña | Distritos (`a-coruna/{slug}/`) | Desmarcado |
| Santiago | Distritos (`a-coruna/santiago/{slug}/`) | Desmarcado |
| Ferrol | Distritos (`ferrol-a-coruna/{slug}/`) | Desmarcado |
| Resto de la provincia | Un municipio (`{slug}-a-coruna/`) | Desmarcado, salvo los que ya se usaban |

Marcados de salida (`porDefecto: true`): Oleiros, Arteixo, Culleredo, Sada, Bergondo, Cambre, Carral, Abegondo, Narón, Ribeira y Boiro.

Cada URL de listado lleva `/con-particulares/` (`urlParticularesIdealista`). La pasada diaria añade además el filtro de fecha: `publicado_ultimas-48-horas` en venta.

## Pantalla

`components/settings/ZonasIdealistaCard.tsx`, en `/settings/portales` (solo superadmin).

1. Al abrir, `GET /api/captacion/brightdata/zonas`.
2. La casilla usa `activas`. El número usa `estimados`. Si el estimado es mayor que `CORTE_IDEALISTA` (1.500), sale el aviso de partir la zona.
3. Marcar o cambiar el número no toca la pasada. Hace falta «Guardar zonas».
4. El guardado es `PUT` con `{ activas, estimados }`. Tiene que quedar al menos una zona, y el id tiene que existir en el catálogo.

La suma que muestra la tarjeta («las marcadas suman…») sale de `anunciosDeZonas`: la cifra fija del catálogo, no el número editado.

## De la casilla a la pasada

```
ZonasIdealistaCard
  → GET/PUT  app/api/captacion/brightdata/zonas/route.ts
  → idsZonasActivas / guardarZonasActivas   lib/captacion/brightdata/zonas-guardadas.ts
  → tabla captacion_brightdata_zonas

Pasada (cron o disparo)
  → urlsZonasActivas()
  → urlsDeZonas()  añade /con-particulares/
  → filtroDiario() añade la franja de 48 h en venta
```

`idsZonasActivas` lee `id, activa`. Se queda con las filas activas cuyo id sigue en el catálogo (`esZonaIdealista`). Si la tabla falla o está vacía, usa solo `zonasPorDefecto()` (los once municipios de arriba, sin distritos).

`guardarZonasActivas` hace upsert de **todo** el catálogo: `activa` según la casilla, `estimado` el número escrito o, si no hay, la cifra del catálogo.

`estimadosZonas` parte de la cifra del catálogo y la sustituye solo donde la tabla tiene un `estimado` numérico. Ese valor sirve para el aviso de 1.500. No cambia la URL.

Los ids viejos `coruna`, `santiago` y `ferrol` ya no están en el catálogo. Si siguen en la tabla de zonas, se ignoran. En los anuncios, la zona para retirados es `zona_id`: la del listado en el que se vio por última vez. Esos tres ids se parten al distrito más cercano por coordenadas; sin coordenadas quedan en `desconocida` y no se retiran hasta que una recogida nueva los vea.

Cada fila del catálogo y de `captacion_brightdata_zonas` tiene `operacion`. Hoy solo está activa la venta. Si una fila pasa a `alquiler`, la URL cambia `venta-viviendas` por `alquiler-viviendas` y el filtro diario es el de 24 h.

## De dónde salen los slugs

Nombres de los distritos de A Coruña: el listado en vivo `idealista.com/venta-viviendas/a-coruna-a-coruna/` el 24 sep 2026. El slug es ese nombre en minúsculas, sin tildes y con guiones. El único path contrastado en una URL indexada es `/venta-viviendas/a-coruna/ensanche-juan-florez/` (barrio Juan Flórez-San Pablo). El resto de distritos de A Coruña usa el mismo patrón y no se contrastó enlace a enlace. Santiago y Ferrol: nombres habituales y el mismo slug; no aparecieron en URLs indexadas. Los centros usados para partir `coruna`/`santiago`/`ferrol` son puntos aproximados, no polígonos de Idealista.
