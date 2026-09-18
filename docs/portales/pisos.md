# pisos.com

Transporte: **http** (undici). Datos en `<script type="application/ld+json">` (`SingleFamilyResidence` / `Apartment`) completados con metadatos HTML (`ad-preview__price`, `ad-preview__title`, `data-lnk-href`).

## URL de listado

```
https://www.pisos.com/{venta|alquiler}/{tipo}-{municipio_slug}/particulares/
https://www.pisos.com/{venta|alquiler}/{tipo}-{municipio_slug}/particulares/{pagina}/
```

Slugs en `captacion_alertas.portal_params`: `municipio_slug` (ej. `a_coruna`), `tipo_slug` (default `piso`), opcional `solo_particulares` (default true).

Ejemplo A Coruña venta particulares:
`https://www.pisos.com/venta/piso-a_coruna/particulares/`

Paginación: sufijo `/{pagina}/` tras `/particulares/`. Total en texto «N resultados».

## Campos por anuncio

| Fuente | Uso CRM | Notas |
|--------|---------|-------|
| JSON-LD `@id` | **Sí** → `externo_id` | Punto → guion bajo en DB |
| HTML `data-lnk-href` | **Sí** → `url` | Prefijo `https://www.pisos.com` |
| HTML `ad-preview__title` | **Sí** → `titulo` | |
| HTML `ad-preview__price` | **Sí** → `precio` | Sin separador de miles |
| JSON-LD `description` / HTML desc | **Sí** → `descripcion` | |
| JSON-LD `address.addressLocality` | **Sí** → `municipio` | |
| JSON-LD `geo` | **Sí** → `lat`/`lng` | |
| JSON-LD `image` | **Sí** → `fotos` | |
| Filtro URL `/particulares/` | **Sí** → `anunciante` | Siempre particular (JSON no distingue) |

## Teléfono

No viene en listado → `detalleNecesario: sin_telefono`.

**Ficha (sin petición extra):** el HTML de detalle incluye `#vtmExtraVars` con `"telefono":"604 054005"` (alternativas: `.owner-info__phone[data-number]`, `.callBtn[data-number]`, `href="tel:…"`). `parseDetail` normaliza a E.164 (`+34604054005`).

Si la ficha no expone teléfono en HTML (p. ej. solo botón «Llamar» sin `data-number`), el anuncio queda sin teléfono y se agrupa por nombre+municipio.

## Fixtures

- `undici-1789646703718.html` — sondeo `.../venta/piso-girona_capital/particulares/` (31)
- `detalle-62531857453_106900.html` — detalle A Coruña con `vtmExtraVars.telefono`
