# Fotocasa

Transporte: **http** con respaldo **unblocker** declarado. Datos en `<script id="__initial_props__">` → `initialSearch.result.realEstates[]`.

Ritmo: 10–15 s, concurrencia 1 (DataDome).

## URL de listado

Patrón (segmentos **variables** en negrita):

```
https://www.fotocasa.es/es/{comprar|alquilar}/viviendas/{provincia_slug}[/{municipio_slug}]/todas-las-zonas/l[/{pagina}]?filter=particulares
```

| Segmento | Variable | Ejemplo A Coruña |
|----------|----------|------------------|
| `/es/` | fijo | `/es/` |
| `{comprar\|alquilar}` | operación | `comprar` |
| `/viviendas/` | fijo (tipo) | `/viviendas/` |
| `{provincia_slug}` | **provincia** | `a-coruna` |
| `/{municipio_slug}` | **municipio** (opcional) | omitido = toda la provincia |
| `/todas-las-zonas/l` | fijo (listado) | `/todas-las-zonas/l` |
| `/{pagina}` | **paginación** (≥2) | `/2` |
| `?filter=particulares` | filtro particular | query obligatoria salvo `solo_particulares: false` |

Ejemplo A Coruña provincia:
`https://www.fotocasa.es/es/comprar/viviendas/a-coruna/todas-las-zonas/l?filter=particulares`

Paginación: contadores `initialSearch.result.counters.realEstates` vs tamaño de página.

## Tipo de anunciante

JSON trae `clientType: professional` en muchos ítems con `filter=particulares`. Se marca **particular** porque lo garantiza el filtro de URL.

## Campos por anuncio (`realEstates[]`)

| Campo JSON | Uso CRM |
|------------|---------|
| `id` | **Sí** → `externo_id` |
| `detail['es-ES']` | **Sí** → `url` |
| `description` + ubicación | **Sí** → `titulo` (generado), `descripcion` |
| `rawPrice` | **Sí** → `precio` |
| `features[]` | **Sí** → superficie, habitaciones, baños, planta |
| `address` / `coordinates` | **Sí** → municipio, zona, CP, lat/lng |
| `multimedia[]` | **Sí** → `fotos` |
| `phone` | **Sí** → `contacto_telefono` | En listado particulares |
| `clientAlias` | **Sí** → `contacto_nombre` |
| `date.timestamp` | **Sí** → `publicado_en` |

## Teléfono

Viene en listado → `detalleNecesario: nunca`.

## Bloqueo

`detectarBloqueo`: challenge DataDome (página interstitial / 403), no reCAPTCHA embebido.

## Fixtures

- `undici-1789646835844.html` — sondeo `.../girona-capital/todas-las-zonas/l?filter=particulares` (31)
