# Catastro — modelo de dominio

Capa aislada para descubrir fincas a partir de servicios **oficiales** del Catastro (WCF callejero JSON) e INSPIRE AD (WFS). No clasifica por IA, recuento de inmuebles ni `lcons`.

**Catastro Explorer** es el módulo de producto que envuelve este motor. Frontera, puertos del host y modelo de búsquedas: [`explorer/ARCHITECTURE.md`](./explorer/ARCHITECTURE.md). `CatastroFinca` es `FincaDescubierta`; no hay un segundo modelo. El núcleo no importa Leads, Propiedades ni Visitas.

```text
HTTP
    ↓
commercial-search
    ↓
candidates → discovery → Catastro
    ↓
Portal oficial
    ↓  Consulta_DNPLOC
RC 20 (inmueble / cargo)  ·  `lourb.dp` → `direccion.codigoPostal`
    ↓  getFincaReference
Finca 14
    ↓  [si hay postalCode] prefiltro seguro por CP de propiedades
    ↓  ¿suelo/no construido oficial? → NOT_APPLICABLE
    ↓  si aplica: finca.ltp  (DNPLOC detalle o, si falta, una Consulta_DNPRC)
horizontalDivision  (YES | NO | UNKNOWN | NOT_APPLICABLE)
    ↓  [si hay postalCode] filtro CP final (`postalCodes.includes`)
candidato SIN división horizontal  (solo status === "NO")
```

### Pipeline de código postal

**Sin CP** (búsqueda por calle): DNPLOC → agrupar finca → ¿suelo oficial? → si aplica, resolver ltp → clasificar DH.

**Con CP** (calle o zona): DNPLOC → prefiltro seguro por CP de propiedades → agrupar fincas supervivientes → ¿suelo oficial? → si aplica, resolver ltp → clasificar DH → filtro CP final.

El prefiltro **no sustituye** al filtro final ni infiere `ltp`. Puede producir falsos positivos (se procesa de más); **nunca** falsos negativos: si el CP de una RC falta o coincide, la finca se evalúa. Solo se evita DNPRC cuando **todas** las RC de la finca tienen CP y ninguno coincide. La finca que entra conserva todas sus RC oficiales.

## Búsqueda comercial

`buscarFincasComerciales` (dominio) y `GET /api/catastro/search` (adaptador HTTP).

Contrato público: `search`, `results`, `pagination` (`hasNextPage`, `nextCursor`), `coverage` (`complete`, `completeCandidates`, `possibleCut`, `portalsFound`, `portalsProcessed`).

- `horizontalDivision=NO|YES|UNKNOWN|NOT_APPLICABLE|ALL` es filtro de salida. `NO` y `UNKNOWN` siguen siendo exclusivos; `NOT_APPLICABLE` no entra en ninguno de los dos. `UNKNOWN` incluye todos los motivos (`reasonCode`); no hay filtro público por motivo.
- Sin número: INSPIRE + páginas. Con número: una sola consulta, sin paginación.
- Sin candidatos: HTTP 200 y `results: []`. Vía inexistente: 404.
- Orden: numeración oficial (numérica si ambos son número; si no, `localeCompare`).
- Identidad: `getFincaReference`. Una finca por respuesta; los portales se acumulan.

## Identidad

Una sola función: `getFincaReference(rc)`.

| Entrada | Resultado |
|---|---|
| RC de 20 caracteres | primeros 14 |
| RC de 14 caracteres | ella misma |
| cualquier otra longitud | `null` (se descarta, no se “arregla”) |

`propertyReferences` son siempre RC de 20. No mezclar atributos de un cargo con los de la finca.

## Clasificación (`finca.ltp`)

Única fuente: el literal oficial `finca.ltp`.

| Status | Significado |
|---|---|
| **NO** | `ltp` contiene *sin división horizontal*. Candidato comercial. |
| **YES** | `ltp` contiene *división horizontal* y no *sin*. |
| **UNKNOWN** | `ltp` ausente, desconocido, parcela urbano-rústica o error de consulta. **Nunca** se convierte en NO. El campo `reasonCode` solo describe el motivo (`MIXED_URBAN_RURAL`, `LTP_MISSING`, `LTP_UNRECOGNIZED`, `QUERY_ERROR`; `OTHER` es un fallback temporal). No cambia el status ni la candidatura. |
| **NOT_APPLICABLE** | Suelo / no construido oficial (`debi.luso` o `ldt`). La pregunta de DH no aplica. **Nunca** es candidato ni se convierte en NO. |

`completeCandidates` solo trata como pendientes los UNKNOWN aplicables, páginas abiertas, `possibleCut` y errores de portal. `NOT_APPLICABLE` no impide la exhaustividad.

Causas reales (ver `unknown-reason.ts`; no cambian la clasificación): parcela con inmuebles de distinta clase urbano/rústico (`MIXED_URBAN_RURAL`), `ltp` ausente (`LTP_MISSING`), `ltp` presente no reconocido (`LTP_UNRECOGNIZED`) o error de consulta (`QUERY_ERROR`). Si aparece otra causa, queda `OTHER` hasta documentarla. El filtro `UNKNOWN` sigue devolviendo todos los UNKNOWN. Un TTL de sesión incompleto no marca fincas UNKNOWN: deja de devolverlas.

`completeCandidates === true` solo si: todos los portales necesarios procesados, no hay `possibleCut`, no quedan páginas, no hay errores de portal y no queda ninguna finca UNKNOWN.

`possibleCut === true` cuando el WFS AD puede estar cortado (5000 features / 4 km² / `numberMatched > numberReturned`). Impide afirmar que la calle está completa.

## Datos oficiales vs derivados

**Oficiales (Catastro / INSPIRE, solo si vienen en la respuesta):**

- dirección: provincia, municipio, sigla, vía, `pnp`/`snp` (número y sufijo), `ldt`
- código(s) postal(es) `lourb.dp`
- RC 20, `ltp`, `finca.dff.ss` (superficie de solar)
- por inmueble: superficie, año, uso, planta, puerta, `lcons`

**Derivados (aplicación):**

- `fincaReference` (14)
- `horizontalDivision`
- `complete` / `completeCandidates` / agrupaciones / estadísticas de log (`unknown`, `unknownMixedUrbanRural`, `unknownLtpMissing`, `unknownLtpUnrecognized`, `unknownQueryError`)

No hay coordenadas en el modelo: el WFS AD puede traer geometría, pero no se persiste (evitar llamadas o campos estéticos). El `urlGrafico` de finca tampoco se expone.

## Llamadas necesarias

| Caso | Consultas |
|---|---|
| Número concreto | 1× DNPLOC. DNPRC **solo** si ese detalle no trae `finca.ltp`. |
| Calle pequeña (N portales) | 1× municipios + 1× callejero + 1× WFS AD. N× DNPLOC. M× DNPRC (una por finca **nueva** sin `ltp`). |
| Calle grande paginada | WFS **una vez** (sesión). DNPLOC = portales de la página. DNPRC = fincas nuevas sin `ltp` en la cache del cliente (WeakMap + cache HTTP). |

Si `ltp` ya está en DNPLOC (p. ej. Godelleta) → **0 DNPRC**.
Si la misma finca aparece en varios portales o en otra sesión del mismo cliente → **una** resolución `ltp`.

El código postal **no** se envía a Catastro. Con CP, un prefiltro seguro descarta trabajo (DNPRC/ltp) de fincas cuya evidencia DNPLOC demuestra que no pertenecen; el filtro final (`postalCodes.includes`) se mantiene. Sin CP el flujo no cambia. Una finca puede acumular varios CP oficiales; basta que **alguna** RC coincida (o no tenga CP) para procesarla.

## Filtro de salida

`GET /api/catastro/search?...&horizontalDivision=NO|YES|UNKNOWN|ALL`

No altera las consultas. `ALL` (u omitir el parámetro) es el comportamiento histórico.

## Catálogo de ubicaciones

`GET /api/catastro/provinces|municipalities|streets` → `lib/catastro/catalog.ts` → `ObtenerProvincias` / `ObtenerMunicipios` / `ObtenerCallejero`.

| Recurso | Campos | Fuente oficial |
|---|---|---|
| Provincia | `code` = `cpine`, `name` = `np` | ObtenerProvincias |
| Municipio | `code` = `locat.cmc`, `name` = `nm` | ObtenerMunicipios (toda la provincia, sin filtro fuzzy) |
| Calle | `code` = `dir.cv`, `sigla` = `dir.tv`, `name` = `dir.nv` | ObtenerCallejero (todo el municipio, sin `NomVia`) |

Cache en memoria, TTL 12 h. Lista vacía → HTTP 200 `{ items: [] }`. Provincia o municipio no oficiales → 400, sin consultar Catastro. No se expone XML ni el raw.

### Cache en navegador (`catalog-client-cache.ts`)

Segunda capa, solo cliente. Sin dependencias.

```
Navegador → memoria → IndexedDB → /api/catastro/* → cache servidor (12 h) → Catastro
```

- Entrada: `{ version, fetchedAt, expiresAt, items }`. Si `version` no coincide o la estructura no valida, se borra y se descarga de nuevo.
- Claves por códigos oficiales: `provinces`, `municipalities:<cpine>`, `streets:<cpine>:<cmc>`. Nunca un catálogo nacional; máximo 20 callejeros (se podan los más antiguos).
- TTL de frescura 24 h (`CATALOG_CLIENT_TTL_MS`). Fresca → 0 peticiones. Caducada → se muestra al instante y se revalida detrás («Actualizando calles...»). Si la revalidación falla → se mantienen los datos y aparece «Usando datos guardados temporalmente…».
- Sin cache y API caída → error normal; no hay nada que servir.
- `crearSelectorCatalogo` serializa las selecciones de un combobox: una emisión de una clave antigua nunca pisa la activa, venga de red o de cache.
- Descargas de la misma clave en vuelo se comparten (`inflight`).
- Métricas solo fuera de producción (`console.debug("[catastro:catalog] …")`): `catalogCacheHit`, `catalogCacheMiss`, `catalogRevalidated`, `catalogFallback`, `catalogLoadMs`.
- Sin IndexedDB (o si falla) degrada a memoria de la pestaña.

## Frontend (`/buscar`)

La pantalla consume `provinces`, `municipalities`, `streets` y `search`. No llama a Catastro desde el cliente.

- Provincia → municipio → calle oficiales. La sigla sale de la calle seleccionada, no se reconstruye.
- Carga perezosa: municipios solo al elegir provincia; calles solo al elegir municipio. Textos «Cargando calles de Madrid...» sin cache; con cache el combobox aparece al instante.
- Criterios en la URL (`provincia`, `municipio`, `sigla`, `via`, `numero`, `postalCode`, `horizontalDivision`). Sin códigos internos ni cursor.
- Al abrir una URL se hidrata el formulario; **no** se lanza la búsqueda sola.
- Filtro por defecto: `horizontalDivision=NO`.
- Mensajes de cobertura: `completeCandidates` → «Búsqueda completa» (nunca si `complete=false`); `hasNextPage` / `possibleCut` con avisos explícitos.
- `numero2` (`snp`) `"0"` significa «sin segundo número» y se muestra vacío (`numeroSecundarioOficial`). El parser no se toca.

### Selección y exportación (`selection-export.ts`)

Todo en el navegador, con los datos ya presentes en cada `Finca`. Sin peticiones, sin backend, sin base de datos.

- Identidad de selección: `fincaReference` (finca completa, nunca RC ni índice). `SeleccionFincas = { claveBusqueda, fincas[] }`; la clave es `claveCriterios` de la búsqueda ejecutada. Cambiar cualquier criterio vacía la selección; repetir la misma búsqueda la conserva. Sobrevive a la paginación porque no depende de `results[]`.
- Revisión comercial local (`revision-comercial.ts`): `NONE | REVIEW`. Solo un UNKNOWN puede marcarse `REVIEW`. No cambia `horizontalDivision` ni crea candidatos. Misma identidad y clave de búsqueda que la selección; se limpia al cambiar de criterios. Filtro local: Todos / Candidatos confirmados / Para revisar.
- Barra flotante con «N fincas seleccionadas» (y «N para revisar» si hay), «Exportar CSV», «Exportar para revisar» y «Limpiar selección»; en móvil queda encima de la navegación inferior.
- **CSV** (`;`, UTF-8 con BOM, `\r\n`, comillas/separadores/saltos escapados, decimales con coma). Columnas: Referencia finca, Provincia, Municipio, Tipo vía, Vía, Número, Número secundario, Literal, Código postal, Códigos postales, Superficie solar, División horizontal, Motivo, Estado comercial, Portales, Número de inmuebles, Referencias de inmuebles, Datos inmuebles. `Motivo` solo se rellena en UNKNOWN (Parcela urbano-rústica / LTP no informado / LTP no reconocido / Error de consulta). `Estado comercial`: Candidato confirmado / Para revisar / Sin marcar. El CSV de `horizontalDivision=NO` sigue exportando solo fincas NO como «SIN DIVISIÓN HORIZONTAL». «Exportar para revisar» reutiliza el mismo generador y solo incluye REVIEW. Las listas dentro de una celda van con ` | `; cada inmueble se resume como `RC · m² · Año · Uso · Bl/Es/Pl/Pt · CP`. Nada técnico (cursor, discoveryId, ltp, estadísticas, URLs).
- Nombre: `fincas_sin_division_horizontal_<Municipio>_<Vía>[_<Número>]_<AAAA-MM-DD>.csv` (prefijo según filtro; saneado de `\ / : * ? " < > |`).
- Advertencias antes de exportar: `possibleCut` → «Catastro indica que esta zona puede contener más resultados…»; si no, `completeCandidates=false` (o última página con `hasNextPage`) → «La búsqueda todavía no está completa…». Nunca bloquean.
- «Ver detalles» (todo lo que trae la finca), «Copiar referencia» y «Copiar dirección» (`sigla via numero numero2`, o `ldt` si no hay campos estructurados).
- **XLSX pendiente**: no hay librería Excel en el proyecto y no se añade ninguna en esta fase.

## Búsqueda por zona (`zone-search.ts`)

Catastro no acepta el código postal como criterio. La zona recorre las **calles oficiales** del municipio y conserva las fincas cuyo `postalCodes[]` contiene el CP. Es una modalidad adicional en `/buscar` («Buscar por: Calle / Código postal»); la búsqueda por calle no cambia.

```text
HTTP (/api/catastro/zone/*)
    ↓
search-zone (adaptador, límites)
    ↓
zone-search  ──  obtenerCallejeroOficial (catalog, misma cache que /streets)
    ↓  por cada calle oficial (pool propio: 2 calles a la vez, máx. 5)
buscarFincasComerciales(sigla, via, postalCode, horizontalDivision=ALL, pageSize=20, cursor)
    ↓  discovery → DNPLOC → prefiltro CP → ltp → clasificación → filtro CP final
fincas únicas por fincaReference (fusionarFincas: portales acumulados entre calles)
    ↓  filtro horizontalDivision (defecto NO) al construir el snapshot
```

- Criterios: `{ provincia, municipio, postalCode (5 dígitos), horizontalDivision? }`. Calle o número → 400.
- **Preparar** (`POST /zone/prepare`) solo lista las calles (`streetsFound`) y crea la sesión; no consulta ningún portal. La misma zona del mismo usuario se **reutiliza** con su progreso (y sus resultados) en vez de recorrerse otra vez. Cambiar el filtro de división no rehace nada: se aplica a la salida.
- **Paso** (`POST /zone/step`, `budgetMs` ≤ 25 s, `concurrency` ≤ 5): trabaja hasta agotar el presupuesto y devuelve el snapshot completo (`progress`, `coverage`, `results`, `errors`, `nextAction`). El cliente encadena pasos; la UI nunca espera una promesa monolítica y cada petición HTTP queda acotada. Una calle a medias guarda su `cursor` de paginación y continúa en el paso siguiente. Un solo paso a la vez por sesión (409).
- **Cancelar** (`/zone/cancel`): deja de programar calles y páginas; las peticiones en vuelo terminan solas (el cliente HTTP no expone abort). **Reanudar** (`/zone/resume`, opcional `retryErrors=true`) continúa por las calles pendientes sin reprocesar las completadas. `GET /zone?zoneSearchId=` devuelve el estado.
- Vía oficial sin direcciones INSPIRE: el WFS responde `302 → /OVCError.aspx` (HTTP 404). `descubrirNumerosOficiales` lo trata como **0 portales** (no error); verificado en Godelleta (`DS DISEMINADO P 1`, `UR EL BOSQUE 1`). Un 5xx o un fallo de red siguen siendo error externo.
- Cobertura: `{ streetsFound, streetsProcessed, streetsWithErrors, complete, completeCandidates, possibleCut }`. `complete` exige todas las calles procesadas, ninguna con error y ningún `possibleCut`; `completeCandidates` además exige que ninguna calle deje fincas UNKNOWN. Una calle con 0 portales o `not_found` no es error. Errores individuales: `{ street, error }` (máx. 50 en el snapshot); no detienen la zona.
- Protección: tras `ZONE_MAX_CONSECUTIVE_FAILURES` (6) fallos de servicio seguidos, sin ningún éxito entre medias, la sesión pasa a `upstream_paused` en vez de seguir llamando; no hay reintentos automáticos. Un `HTTP 4xx` de una calle concreta (INSPIRE o una RC que Catastro no sirve) queda como error de esa calle y no cuenta para la pausa. Límites: 2 zonas activas por usuario (429), 20 sesiones en memoria, TTL 1 h deslizante.
- Orden: municipio → vía oficial → número oficial (`ordenarFincasComerciales` por vía). Nada inventado para numeraciones complejas.
- Cache: callejero (12 h), HTTP (30 min), ltp por cliente y sesiones de discovery se reutilizan; repetir una zona en la ventana de cache apenas hace peticiones nuevas.
- Métricas internas de prefiltro (sesión/snapshot de dominio, no van al frontend): `propertiesSeen`, `propertiesRejectedByPostalCode`, `fincasPotentiallyMatchingPostalCode`, `dnprcAvoidedByPostalCode`.
- Frontend: `zone-ui.ts` (estado, textos, bucle de pasos, fetchers), `useBusquedaZona`, `BuscarPorZona` (progreso con barra, contadores, errores plegados, Cancelar/Reanudar/Reintentar/Nueva búsqueda) y `FincaResultadoCard` para los resultados. La selección/exportación es la de la Fase 14 (`useSeleccionFincas`); el nombre del archivo lleva `CP<cp>` en lugar de la vía y la advertencia de incompletitud sale de `coberturaExportacionZona`.

## Limitaciones

- País Vasco y Navarra quedan fuera del DGC.
- Búsqueda por zona: la sesión vive en memoria del servidor (TTL 1 h) y en la pestaña (`zoneSearchId`); si expira, los resultados ya recibidos siguen en pantalla pero hay que preparar de nuevo. El coste sigue siendo proporcional a los portales (DNPLOC + INSPIRE). El prefiltro evita DNPRC de fincas cuyo CP DNPLOC demuestra que no coincide; si el CP no viene en DNPLOC, se resuelve `ltp` como antes. Un CP minoritario sigue pagando todos los DNPLOC del municipio.
- INSPIRE AD puede cortar calles grandes (`possibleCut`).
- Sesiones de paginación en memoria (TTL 15 min). En una zona, una calle paginada cuyo cursor caduca (p. ej. tras cancelar y reanudar más de 15 min después, o si el equipo se suspende) se repite desde su primera página hasta 2 veces; si vuelve a caducar queda como `{ street, error: "La sesión de discovery ha expirado." }` y se recupera con «Reintentar calles con error».
- Lista DNPLOC no incluye `finca.ltp` ni `lcons`; hay que resolver el detalle de **una** RC de 20.
- El autocomplete de calles filtra en local una lista ya descargada. No se envía el texto escrito a Catastro.
- La cache del navegador es por dispositivo/perfil; la primera descarga de un municipio grande (Madrid, ~9.600 calles) sigue tardando lo que tarde Catastro (~20 s).
