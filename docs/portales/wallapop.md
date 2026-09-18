# Wallapop

Transporte: **http** contra la API JSON (no HTML). `detalleNecesario: nunca`.

## API de búsqueda

```
GET https://api.wallapop.com/api/v3/search
  ?source=search_box
  &keywords=piso
  &category_id=200
  &latitude=43.3623
  &longitude=-8.4115
  &distance_in_km=15
  &order_by=most_relevance
  &start=0
```

- Inmobiliaria: `category_id=200`
- Coordenadas/radio en `portal_params`: `lat`, `lng`, `radio_km`, opcional `keywords`, `category_id`
- Paginación: `start` de 40 en 40

Respuesta: `data.section.payload.items[]` (legacy: `search_objects[]`).

## Cabeceras mínimas

Sin `Origin` + `Referer` + `X-DeviceOS` + `x-appversion` + `x-deviceid` la API responde **403**. `/api/v3/general/search` también exige `Origin`.

## Contacto

Sin teléfono en listado. `contacto_tipo_portal: desconocido` salvo señales de profesional (`is_top_profile.flag`, `user.is_business`, etc.).

## Fixtures

- `search.json` — búsqueda piso A Coruña (40 items)
- `request.curl.txt` — cURL capturado desde DevTools
