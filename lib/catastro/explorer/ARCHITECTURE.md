# Catastro Explorer — arquitectura

Módulo desacoplado y portable. Hoy vive dentro del CRM Rehabinco; su núcleo no depende de Leads, Propiedades, Visitas ni Supabase.

## Frontera

```text
Host (CRM / otra web / otro SaaS)
        ↓  adaptadores (auth, HTTP, UI kit, persistencia)
Catastro Explorer
        ↓
lib/catastro          ← motor (DNPLOC, DNPRC, INSPIRE, DH)
        ↓
Catastro / INSPIRE
```

| Capa | Dónde | ¿Puede importar el CRM? |
|---|---|---|
| Motor catastral | `lib/catastro/*` (excepto `explorer/`) | No |
| Producto Explorer | `lib/catastro/explorer/` | No |
| UI Explorer | `components/catastro/` | Solo kit visual del host (`ui`, `layout`) |
| Adaptadores HTTP | `app/api/catastro/*` | Auth del host |
| Host CRM | `app/(dashboard)/catastro`, `app/(dashboard)/buscar`, `lib/auth/roles` | Sí (ruta, rol) |

Prohibido:

```text
lib/catastro → Lead | Property | Visit | supabase
```

El host inyecta identidad y, más adelante, almacenamiento. Explorer no conoce esas tablas.

## Qué pertenece al módulo

Cliente Catastro, INSPIRE, discovery, finca, inmueble, DH (`YES`/`NO`/`UNKNOWN`/`NOT_APPLICABLE` + `reasonCode`), búsqueda por calle y por CP, paginación, cobertura, selección, revisión comercial, CSV, catálogos oficiales.

CSV es una función secundaria. No es el almacén.

## Entidad canónica: finca

No hay un segundo modelo. `CatastroFinca` **es** `FincaDescubierta`.

- Identidad de finca: 14 caracteres (`getFincaReference`).
- Identidad de inmueble: RC de 20 (`InmuebleDeFinca.reference`).
- Dirección: solo campos oficiales (sigla, vía, número, número2, literal, municipio, provincia, `postalCodes`). No geocodificación, no Google, no literales inventados.
- `firstSeenAt` / `lastSeenAt` viven en `CatastroFincaRecord` (vista persistible). Discovery no los exige.

## Búsqueda

`CatastroExplorerSearch` tiene modo `STREET` o `POSTAL_CODE`. El CP **nunca** es criterio de Catastro: se recorre el callejero oficial y se filtra `postalCodes`.

Una finca global + N `CatastroExplorerSearchResult`. Misma RC 14 en dos calles, dos portales o dos búsquedas → una finca, dos resultados.

## Estado catastral vs comercial

| Catastral (`horizontalDivision.status`) | Comercial (`EstadoRevision`) |
|---|---|
| YES / NO / UNKNOWN / NOT_APPLICABLE | NONE / REVIEW (ampliable) |

`UNKNOWN + REVIEW` no es `NO` ni candidato.

## Persistencia

Desplegada en el proyecto Supabase `rehabinco-crm` (`ohwcnfigexzgqpmwmbib`).

```text
Catastro Explorer
      ↓
ExplorerStore
      ↓
SupabaseExplorerStore
      ↓
Supabase
```

Migraciones aplicadas:

- `20260912200544_catastro_explorer_persistencia`
- `20260912200755_catastro_fincas_upsert_search_path`

Tablas: `catastro_fincas`, `catastro_explorer_searches`, `catastro_explorer_search_results`, `catastro_explorer_reviews`.

El dominio (`lib/catastro`, `lib/catastro/explorer`) no importa `supabase.from` ni tablas del CRM. El adaptador vive en `lib/catastro-host`.

- `CatastroFinca`: snapshot actual, identidad 14 caracteres, compartida.
- `CatastroExplorerSearch`: privada por `ownerId` / `user_id`.
- `CatastroExplorerSearchResult`: contexto histórico (búsqueda → finca). No clona la finca.
- `CatastroExplorerReview`: `userId + fincaReference` → NONE/REVIEW.

La selección temporal de Fase 14 sigue en React state. Los cursores de discovery no se persisten.
Si falla Supabase, Catastro sigue respondiendo; la persistencia se registra y no se convierte en error de Catastro.

## Experiencia en el CRM

Rutas profundas del módulo (no son entidades globales del CRM):

```text
/catastro
/catastro/searches/:id
/catastro/finca/:fincaReference
/buscar
```

`/buscar` es Nueva búsqueda. `/catastro/searches` es el historial paginado del usuario.

Los históricos leen `ExplorerStore` (`limit`/`offset`); no reejecutan Catastro ni meten cursores de discovery en la URL.

Eliminar una búsqueda borra `CatastroExplorerSearch` y sus `SearchResults`. No borra `CatastroFinca` ni `CatastroExplorerReview`. Solo el propietario; un id ajeno responde 404.

## Cómo extraerlo

1. Copiar `lib/catastro` (incluye `explorer/`).
2. Copiar `components/catastro` y sustituir `@/components/ui` y `PageHeader` por el kit del nuevo host.
3. Implementar los puertos (`ExplorerAuth`, `ExplorerStore`, `ExplorerClock`).
4. Exponer las mismas rutas HTTP o llamar a `buscarFincasComerciales` / `prepararZona` desde el host.

El motor no se reescribe.
