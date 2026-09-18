# Habitaclia

Transporte: **http** (undici). Datos en `window.__INITIAL_PROPS__` → `JSON.parse(...)`.

## URL de listado

```
https://www.habitaclia.com/{comprar|alquilar}/viviendas/{provincia-slug}/{municipio-slug}/particulares/s
https://www.habitaclia.com/{comprar|alquilar}/viviendas/{provincia-slug}/{municipio-slug}/particulares/s/{pagina}
```

Slugs en `captacion_alertas.portal_params`: `provincia_slug`, `municipio_slug`, opcional `solo_particulares` (default true).

Ejemplo A Coruña venta particulares:
`https://www.habitaclia.com/comprar/viviendas/a-coruna-provincia/a-coruna/particulares/s`

Paginación (JSON `results.pagination`): `page`, `pageSize`, `totalCount`, `totalPages`. Página 2 → sufijo `/s/2`.

## Campos por anuncio (`results.items[]`)

| Campo JSON | Uso CRM | Notas |
|------------|---------|-------|
| `legacyNumericId` | **Sí** → `externo_id` | ID estable |
| `id` (UUID) | No | Interno Fotocasa |
| `navigationUrl` | **Sí** → `url` | Prefijo `https://www.habitaclia.com` |
| `kind` | No | `secondHand`, etc. |
| `transaction.type` | **Sí** → `operacion` | `buy`→venta, `rent`→alquiler |
| `transaction.price.amount` | **Sí** → `precio` | Omitido si `price.hidden` |
| `transaction.price.hidden` | No | Filtro |
| `property.propertyType` | **Sí** → `tipo` | flat→piso, house→casa, land→terreno… |
| `property.propertySubtype` | **Sí** (refino) | penthouse→ático, duplex→dúplex |
| `property.builtSurface` | **Sí** → `superficie` | m² construidos |
| `property.landArea` | No | Solo suelo |
| `property.rooms` | **Sí** → `habitaciones` | |
| `property.bathrooms` | **Sí** → `banos` | |
| `property.floor` | **Sí** → `planta` | A veces null |
| `property.features` | No | Lista amenities |
| `property.heating` | No | |
| `property.energyEfficiencyCertificate` | No | |
| `summary.title` | **Sí** → `titulo` | |
| `summary.description` | **Sí** → `descripcion` | |
| `summary.location.municipality` | **Sí** → `municipio` | |
| `summary.location.district` | **Sí** → `zona` | |
| `summary.location.province` | No | Ya en zona |
| `summary.location.displayAddressLine` | **Sí** → `direccion` | |
| `summary.location.displayZoneLine` | No | Fallback zona |
| `summary.location.coordinates.latitude` | **Sí** → `lat` | |
| `summary.location.coordinates.longitude` | **Sí** → `lng` | |
| `summary.location.visibility` | **Sí** → `geo_aproximada` | `EXACT`→false, resto→true |
| `summary.location.address` | No | Calle/número sueltos |
| `summary.location.layers` | No | Jerarquía geo |
| `summary.multimedia.images[].url` | **Sí** → `fotos` | |
| `summary.multimedia.counts.images` | **Sí** → `n_fotos` | |
| `summary.publisher.name` | **Sí** → `contacto_nombre` | Razón social si agencia |
| `summary.publisher.tradeName` | **Sí** → `nombre_comercial` | Marca inmobiliaria |
| `summary.publisher.isAgent` | **Sí** → `contacto_tipo_portal` | Con `legacyPublisherId` |
| `summary.publisher.legacyPublisherId` | **Sí** → profesional | No null = agencia |
| `summary.publisher.navigationUrl` | **Sí** → profesional | `/inmobiliaria/...` |
| `summary.publisher.logo/website/id` | No | |
| `summary.updatedAt` | **Sí** → `publicado_en` | Última actualización |
| `summary.products` | No | Premium, etc. |
| `contact.phone` | **Sí** → `contacto_telefono` | En listado particulares suele venir |
| `contact.email` | No | No persistimos email portal |

## Detalle

Ficha legacy (`/i{legacyNumericId}.htm`): teléfono tras botón «Ver teléfono»; parseDetail pendiente de fixture de detalle.

Sondeo detalle sugerido:
`https://www.habitaclia.com/i500006042448.htm?from=list`

## Fixtures

- `undici-1789637963665.html` — sondeo directo, URL `.../girona-capital/particulares/s` (25)
- `worker-72785d913e61856f.html` — misma URL vía worker; JSON en `window.__INITIAL_PROPS__` (sesión distinta, misma estructura)
- `undici-1789637792967.html` — listado sin filtro particulares (profesionales)

Worker y sondeo piden la misma URL; el HTML difiere solo en tokens de sesión/analytics dentro del JSON embebido.
