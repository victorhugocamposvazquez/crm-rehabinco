# Milanuncios

Transporte: **http** con respaldo **unblocker** declarado (`transportRespaldo: unblocker`). Datos en `window.__INITIAL_PROPS__` → `adListPagination.adList.ads[]`.

Ritmo: 10–15 s, concurrencia 1 (DataDome).

## URL de listado

```
https://www.milanuncios.com/{venta-de-pisos|alquiler-de-pisos}-en-{municipio_slug}/particulares/
https://www.milanuncios.com/{venta-de-pisos|alquiler-de-pisos}-en-{municipio_slug}/particulares/{pagina}/
```

Slugs en `portal_params`: `municipio_slug` (ej. `a-coruna`).

Ejemplo A Coruña venta particulares:
`https://www.milanuncios.com/venta-de-pisos-en-a-coruna/particulares/`

Paginación: `pagination.page`, `pagination.totalPages` en JSON.

## Tipo de anunciante

JSON trae `sellerType: professional` incluso en URL `/particulares/`. Se marca **particular** porque lo garantiza el filtro de URL (documentado).

## Campos por anuncio (`ads[]`)

| Campo JSON | Uso CRM |
|------------|---------|
| `id` | **Sí** → `externo_id` |
| `url` | **Sí** → `url` |
| `title` | **Sí** → `titulo` |
| `description` | **Sí** → `descripcion` |
| `price.cashPrice.value` | **Sí** → `precio` |
| `city.name` / `location` | **Sí** → `municipio`, `zona` |
| `province.name` | **Sí** → `provincia` |
| `images[]` | **Sí** → `fotos` |
| `publishDate` / `updateDate` | **Sí** → `publicado_en` |
| `tags[]` (`dormitorios`, `baños`, `metros cuadrados`) | **Sí** → `habitaciones`, `banos`, `superficie` | En listado |
| `attributes[]` (detalle) | **Sí** → `habitaciones`, `banos`, `superficie`, `planta` | `bedrooms`, `bathrooms`, `squareMeters`, `floor` |
| `location.geolocation` (detalle) | **Sí** → `lat`/`lng` | Solo ficha |
| `isPhoneAvailable` | No | Indica teléfono en ficha, no el número |

## Teléfono

No en listado → `detalleNecesario: sin_telefono`.

**Ficha (sin petición extra):** `window.__INITIAL_PROPS__` incluye `phone1` (ej. `"616046375"`). `parseDetail` normaliza a E.164 (`+34616046375`).

Si `isPhoneAvailable` es true pero no hay `phone1` en el JSON embebido, haría falta la API de contacto del portal (no implementada); el anuncio queda sin teléfono y se agrupa por nombre+municipio.

## Bloqueo

`detectarBloqueo`: challenge DataDome / captcha interstitial (no reCAPTCHA embebido en listado).

## Fixtures

- `undici-1789646773188.html` — sondeo `.../venta-de-pisos-en-girona/particulares/` (41)
- `detalle-605931425.html` — detalle con `phone1` en `__INITIAL_PROPS__`
