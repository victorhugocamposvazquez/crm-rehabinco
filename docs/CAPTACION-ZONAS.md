# Zonas de captación

La pasada diaria de Idealista solo lee las zonas con la casilla marcada en Ajustes → Captación. El número de al lado es un estimado: no elige la zona. Si pasa de 1.500, Idealista corta el listado y hay que partirla.

## Qué hay en el catálogo

El catálogo vive en `lib/captacion/brightdata/zonas.ts` (`ZONAS_IDEALISTA`). No sale de la base de datos.

Una URL por municipio, sin distritos. Ninguna ciudad pasa de 1.500 (24 sep 2026): A Coruña `a-coruna-a-coruna` (968), Santiago `santiago-de-compostela-a-coruna` (502), Ferrol `ferrol-a-coruna` (655). El resto sigue `{slug}-a-coruna`.

Marcados de salida: esas tres ciudades más Oleiros, Arteixo, Culleredo, Sada, Bergondo, Cambre, Carral, Abegondo, Narón, Ribeira y Boiro.

La pasada añade una sola URL de provincia a 48 h (`provincia-48h`), fuera de retirados.

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
  → urlsDeZonas()  sin /con-particulares/
  → filtroDiario() añade la franja de 48 h en venta
```

`idsZonasActivas` lee `id, activa`. Se queda con las filas activas cuyo id sigue en el catálogo (`esZonaIdealista`). Si la tabla falla o está vacía, usa solo `zonasPorDefecto()`.

`guardarZonasActivas` hace upsert de **todo** el catálogo: `activa` según la casilla, `estimado` el número escrito o, si no hay, la cifra del catálogo.

`estimadosZonas` parte de la cifra del catálogo y la sustituye solo donde la tabla tiene un `estimado` numérico. Ese valor sirve para el aviso de 1.500. No cambia la URL.

Los ids de distrito (`a-coruna-…`, `santiago-…`, `ferrol-…`) ya no están en el catálogo. La migración `20260924190000` los pasa al municipio (`a-coruna`, `santiago-de-compostela`, `ferrol`). `desconocida` sigue fuera de retirados.

Cada fila del catálogo y de `captacion_brightdata_zonas` tiene `operacion`. Hoy solo está activa la venta. Si una fila pasa a `alquiler`, la URL cambia `venta-viviendas` por `alquiler-viviendas` y el filtro diario es el de 24 h.

## Distritos, por si una ciudad pasa de 1.500

Comprobados en la web el 24 sep 2026. No se usan mientras el municipio quepa en un listado.

A Coruña, `/a-coruna/{d}/`: agra-del-orzan-ventorrillo, ciudad-vieja-centro, cuatro-caminos-plaza-de-la-cubela, eiris, elvina-a-zapateira, ensanche-juan-florez, los-castros-castrillon, los-rosales, mesoiro, monte-alto-zalaeta-atocha, os-mallos, riazor-visma, sagrada-familia, someso-matogrande, viono.

Santiago, `/santiago-de-compostela/{d}/`: arins, campus-norte-scaetano, campus-sur-santa-marta, casco-historico, castineirino-cruceiro-do-sar, concheiros-fontinas, conxo, ensanche-sar, marrozos-eixo, san-lazaro-meixonfrio.

Ferrol, `/ferrol/{d}/`: a-malata-serantes-viladoniga, brion-san-felipe-la-grana, canido, caranza, catabois-santa-marina, centro, doninos-esmelle-san-jorge, esteiro, fajardo, ferrol-vello-puerto, la-cabana-valon, pazos-mandia, plaza-de-espana, porta-nova, san-juan, zona-ultramar.
