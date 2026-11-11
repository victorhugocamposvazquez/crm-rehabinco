# Atlas de Soporte y Diagnóstico Rápido del CRM

Documento generado tras la auditoría completa del código con Grok 4.7 para que cualquier persona o modelo de IA diagnostique y resuelva tickets de soporte en segundos, distinguiendo **cuándo NO hay que tocar código** (dudas o comportamientos esperados) de **exactamente qué 3 archivos abrir** cuando sí hay un bug.

---

## 1. Árbol de Decisión Antes de Tocar Código (Falsos Bugs Comunes)

Antes de modificar una sola línea, comprueba si el síntoma del ticket encaja en uno de estos casos habituales del CRM:

1. **«Ha desaparecido un inmueble»**
   - El listado `/propiedades` filtra `.is("deleted_at", null)`. Comprueba la sección **Papelera** al final de `/propiedades` (`components/inmuebles/PapeleraInmuebles.tsx`).
2. **«Ha desaparecido una cita del calendario»**
   - Las citas con `estado = 'cancelada'` no se pintan nunca, y las `hecha` solo si el filtro las muestra (`app/(dashboard)/calendario/page.tsx`).
3. **«Aparecen tareas solas que nadie ha creado»**
   - Cada cita del calendario sincroniza su tarea espejo mediante `lib/tareas/sync-cita.ts` (`backfillTareasDesdeCalendario`). Al completar o anular la cita se marca hecha la tarea.
4. **«No me deja pulsar Crear demanda / Crear cita / Crear inmueble con cliente»**
   - En `AltaPersona` (`components/ui/alta-form.tsx` + `lib/ui/alta-persona.ts`), escribir texto en el buscador **no selecciona** la ficha: hay que pulsar la coincidencia de la agenda o pulsar «Nuevo».
5. **«Un inmueble marcado no sale en la web pública o en Idealista»**
   - Para la web (`aptoParaWeb` en `lib/web/modelo.ts`): exige `publicar_web = true`, `referencia`, `titulo`, `localidad`, `descripcion`, precio según operación y `estado != 'baja'`.
   - Para Idealista (`lib/inmuebles/publicacion.ts`): exige además fotos y datos energéticos en vivienda/local/oficina.
6. **«He cambiado un bloque en Diseño Web (`/web/gestionar`) y la home pública no cambia»**
   - `app/web/**` sirve la web corporativa (`components/web/corporativa/*` + `lib/web/corporativa/contenido.ts`), no los bloques de `SitioPublico`. Comparten dominio, `publicado` y el stock con `publicar_web = true`.
7. **«CatastroUser o un comercial no ve ciertas tareas o pantallas»**
   - Revisa primero la matriz en `/settings/roles` (`role_permisos`). Sin `tareas_equipo`, tanto la UI como la política RLS `tarea_visible_para_mi(comercial_id)` limitan a `comercial_id = auth.uid()`.
8. **«A medianoche las tareas/citas de hoy salen como de ayer»**
   - Varios cortes usan `new Date().toISOString().slice(0, 10)` (UTC). Entre 00:00 y 01:00/02:00 en `Europe/Madrid`, UTC sigue en el día anterior (ver `lib/alertas/madrid.ts` para fecha local de España).

---

## 2. Atlas Quirúrgico por Módulo

### `hoy` — Inicio del día (`/`)
- **UI:** `app/(dashboard)/page.tsx`, `components/captacion/HoyCaptacion.tsx`
- **Lógica / API:** `app/api/catastro/mine/route.ts`, `lib/tareas/tareas.ts`, `lib/citas/citas.ts`, `lib/ui/filtro-comercial.tsx`
- **Tablas:** `tareas`, `citas`, `partes_visita`, `demandas`, `facturas` (solo admin), `catastro_explorer_assignments`
- **Test directo:** `npx tsx --test lib/tareas/tareas.test.ts lib/citas/citas.test.ts`

### `inmuebles` — Cartera de propiedades (`/propiedades`)
- **UI:** `app/(dashboard)/propiedades/page.tsx`, `app/(dashboard)/propiedades/[id]/page.tsx`, `app/(dashboard)/propiedades/[id]/editar/page.tsx`
- **Componentes:** `components/inmuebles/PanelInmueble.tsx`, `NuevoInmueblePanel.tsx`, `InmuebleForm.tsx`, `InmuebleGaleria.tsx`, `InmuebleDocumentos.tsx`, `PublicacionInmueble.tsx`, `CaptadoPorInmueble.tsx`, `PapeleraInmuebles.tsx`
- **Lógica:** `lib/inmuebles/panel.ts`, `catalogo.ts`, `portada.ts`, `publicacion.ts`, `subir-media.ts`, `marca-agua.ts`, `lib/actions/propiedades-papelera.ts`
- **Tablas y Triggers:** `propiedades`, `inmueble_media` (bucket público `inmuebles`), `inmueble_documentos` (bucket privado `inmueble-docs` con signed URLs), `propiedad_captadores`. Triggers: `propiedades_asignar_referencia()`, `propiedades_guardar_captador()`, `marcar_cliente_vinculado()`.
- **Test directo:** `npx tsx --test "lib/inmuebles/**/*.test.ts"`

### `idealista` — Publicación FTP / API (`/settings/publicacion`)
- **UI:** `app/(dashboard)/settings/publicacion/page.tsx`, `components/settings/IdealistaPublicacionCard.tsx`
- **Lógica / API:** `lib/inmuebles/idealista-publicacion/{plan,api,ejecutar,sincronizar,cargar,config}.ts`, `lib/inmuebles/idealista-feed/build.ts`, `app/api/inmuebles/idealista/**`
- **Invariante:** `customerCode` cumple `/^ilc[a-f0-9]{40}$/i`. No mezclar jamás este módulo OAuth/FTP con `lib/captacion/brightdata` (que es scraping entrante).
- **Test directo:** `npx tsx --test lib/inmuebles/idealista-publicacion/plan.test.ts lib/inmuebles/idealista-feed/build.test.ts lib/inmuebles/idealista.test.ts`

### `contactos` — Agenda de clientes (`/clientes`)
- **UI:** `app/(dashboard)/clientes/page.tsx`, `app/(dashboard)/clientes/[id]/page.tsx`, `app/(dashboard)/clientes/[id]/editar/page.tsx`
- **Componentes:** `components/clientes/NuevoClientePanel.tsx`, `EditarClientePanel.tsx`, `ClienteQuickSheet.tsx`, `ClienteHistorial.tsx`, `ClienteNotas.tsx`
- **Lógica:** `lib/clientes/historial.ts`, `lib/clientes/eliminar-contacto.ts`, `lib/ui/busqueda.ts` (`coincideTelefonoBusqueda`), `lib/ui/alta-persona.ts`
- **Tablas:** `clientes`, `clientes_notas`. RLS: `is_equipo_o_catastro_user()` (editor solo SELECT).
- **Test directo:** `npx tsx --test lib/ui/busqueda.test.ts lib/ui/alta-persona.test.ts lib/clientes/historial.test.ts`

### `demandas` — Búsquedas y Cruce (`/demandas`)
- **UI:** `app/(dashboard)/demandas/page.tsx`, `app/(dashboard)/demandas/[id]/page.tsx`
- **Componentes:** `components/demandas/NuevaDemandaPanel.tsx`, `FiltrosDemandas.tsx`, `components/demandas/cruce/DemandaCruce.tsx`
- **Lógica:** `lib/demandas/{matching,cruce,filtros,nueva,proponer-stock,zonas-coruna}.ts`, `lib/actions/demandas.ts`
- **Invariantes:** Demanda `compra` cruza con propiedad `venta`. Barrios detallados solo en `DISTRITOS_A_CORUNA`; resto cruza por municipio.
- **Test directo:** `npx tsx --test "lib/demandas/**/*.test.ts"`

### `calendario` — Agenda y Visitas (`/calendario`)
- **UI:** `app/(dashboard)/calendario/page.tsx`
- **Componentes:** `components/citas/NuevaEntradaCalendario.tsx`, `CalendarioSemana.tsx`, `CalendarioMes.tsx`, `CalendarioMovil.tsx`, `CitaAcciones.tsx`, `DialogoAnularCita.tsx`
- **Lógica:** `lib/citas/citas.ts`, `lib/tareas/sync-cita.ts`
- **Tablas:** `citas` (`clientes_extra_ids uuid[]`, `motivo_anulacion`). RLS: `cita_visible_para_mi(tipo, comercial_id)`.
- **Test directo:** `npx tsx --test "lib/citas/**/*.test.ts"`

### `tareas` — Tablero de tareas (`/tareas`)
- **UI:** `app/(dashboard)/tareas/page.tsx`, `components/tareas/TareasBoard.tsx`, `TareaPanel.tsx`, `CampoComentario.tsx`
- **Lógica:** `lib/tareas/tareas.ts`, `lib/tareas/menciones.ts`, `lib/tareas/sync-cita.ts`
- **Tablas:** `tareas`, `tareas_actividad`. RLS: `tarea_visible_para_mi(comercial_id)`.
- **Test directo:** `npx tsx --test "lib/tareas/**/*.test.ts"`

### `seguimiento` — Embudo Kanban (`/seguimiento`)
- **UI:** `app/(dashboard)/seguimiento/page.tsx`, `components/ui/kanban.tsx`
- **Lógica:** `lib/captacion/estados.ts` (tablero fincas), `lib/actions/demandas.ts` (tablero demandas), `lib/inmuebles/catalogo.ts` (tablero inmuebles).

### `catastro` — Explorador, Zonas, Fincas y Encargos (`/catastro/**`, `/buscar`)
- **UI:** `app/(dashboard)/catastro/**`, `components/catastro/{FincaPersistida,FincaDetallePanel,CatastroPropertyVinculo,ListaFincasCatastro}.tsx`, `components/captacion/{PipelineFinca,EncargosPagina,EncargoDetalle}.tsx`
- **Lógica pura (sin Supabase):** `lib/catastro/{client,search,discovery,horizontal-division,zone-search,zone-archive}.ts`, `lib/catastro/explorer/**`
- **Host BD y API:** `lib/catastro-host/**`, `lib/captacion/encargos-db.ts`, `app/api/catastro/**`, `app/api/captacion/encargos/**`
- **Tablas y RPC:** `catastro_fincas`, `catastro_zone_sessions`, `catastro_property_links`, `catastro_explorer_assignments`, `catastro_explorer_pipeline` (incluye `cliente_id`), `catastro_explorer_actividad`, `captacion_encargos`, RPC `crear_propiedad_desde_catastro`.
- **Invariantes:** Clasificación DH solo desde `finca.ltp`. No meter llamadas a Supabase dentro de `lib/catastro/**`. Cron en Vercel Hobby es `0 8 * * *`.
- **Test directo:** `CATASTRO_SKIP_LIVE=1 npx tsx --test "lib/catastro/**/*.test.ts" "lib/catastro-host/**/*.test.ts" lib/captacion/importar-excel.test.ts`

### `captacion` — Portales y Bright Data (`/captacion`, `/settings/portales`)
- **UI:** `components/captacion/portales/CaptacionPortales.tsx`, `AccionesContactoAnuncio.tsx`, `TelefonoAnuncio.tsx`, `components/settings/{CaptacionSaludCard,ZonasIdealistaCard}.tsx`
- **Lógica / API:** `lib/captacion/brightdata/**`, `lib/captacion/portales/**`, `app/api/captacion/**`
- **Tablas:** `captacion_anuncios`, `captacion_recogidas`, `captacion_paginas_pendientes`, `captacion_brightdata_zonas`, `captacion_rafagas`, `captacion_locks`, `captacion_telefono_diario`.
- **Invariantes:** `provincia-48h`, sondeo 15m, primera recogida y zonas en página 60 **nunca** retiran anuncios.
- **Test directo:** `npm run test:captacion`

### `valoraciones` — Motor AVM e Informes PDF (`/valoraciones/**`)
- **UI:** `app/(dashboard)/valoraciones/**`, `components/avm/**`
- **Lógica / API:** `lib/avm/{valuate,valuate-service,comparables,estimate,environment}.ts`, `lib/avm/pdf/{render,InformePdf,fonts}.tsx`, `app/api/avm/**`
- **Tablas:** `avm_valuations`, `avm_properties`, `market_listings`, `market_zones`, `agency_branding`, `tenants`.
- **Test directo:** `npx vitest run lib/avm`

### `herramientas` — Partes de visita, Arras, Encargos y Contratos (`/herramientas`, `/partes-visita`, `/contratos-*`, `/hojas-encargo-*`)
- **UI:** `app/(dashboard)/herramientas/page.tsx`, `app/(dashboard)/partes-visita/**`, `contratos-arras/**`, `hojas-encargo-honorarios/**`, `hojas-encargo-exclusiva/**`, `contratos-pago-aplazado/**`, `contratos-arrendamiento/**`, `app/firmar/[token]/page.tsx`
- **Lógica / PDF:** `lib/documentos-pdf.ts`, `lib/documentos-paginacion.ts`, `lib/partes-visita.ts`, `lib/contrato-*.ts`, `lib/hoja-encargo-*.ts`, `lib/actions/papelera.ts`
- **Invariante:** Trigger `trg_omitir_clausulas_conchado` limpia menciones a Conchado Puente / `B70101449`. Las bajas van a `papelera_items`.
- **Test directo:** `npx tsx --test lib/partes-visita.test.ts lib/documentos-rehabinco.test.ts lib/documentos-paginacion.test.ts lib/contrato-arras-preview.test.ts`

### `presupuestos` — Presupuestos, Ampliaciones y Copiloto IA (`/presupuestos/**`)
- **UI:** `app/(dashboard)/presupuestos/**`, `components/presupuestos/{PresupuestoWizard,PresupuestoCopiloto,GaralPartidasEditor}.tsx`
- **Lógica:** `lib/presupuesto-propuesta.ts`, `lib/presupuesto-totales.ts`, `lib/presupuesto-pdf.ts`, `lib/ai/presupuesto-copiloto.ts`, `app/api/presupuestos/copiloto/route.ts`
- **Skill de dominio:** leer `.cursor/skills/presupuestos-rehabinco/SKILL.md` antes de tocar cálculos o propuesta JSON.

### `facturas` — Facturación y Cobros (`/facturas/**`)
- **UI:** `app/(dashboard)/facturas/**`, `components/facturas/FacturaWizard.tsx`
- **Lógica:** `lib/factura-pdf.ts`, `lib/facturacion-numeracion.ts`, `lib/empresa-facturacion.ts`
- **Invariantes:** Numeración `N/AAAA` y rectificativas `FR-N/AAAA` sin rellenar huecos. Ruta protegida contra auto-merge en soporte (requiere revisión humana en 1 clic).
- **Test directo:** `npx tsx --test lib/facturacion-numeracion.test.ts`

### `fichaje` y `jornada` — Control horario (`/fichaje`, `/equipo/jornada`)
- **UI:** `app/(dashboard)/fichaje/page.tsx`, `app/(dashboard)/equipo/jornada/page.tsx`
- **Lógica / API:** `lib/time/{replay,geo,server,export,offline-queue}.ts`, `app/api/time/**`, `app/api/cron/fichajes/route.ts`
- **Invariantes:** Máquina de estados estricta en `replay.ts`; prohibido mutar `fichaje_punches` o `fichaje_audit_log`; toda corrección deja fila de auditoría.
- **Test directo:** `npx tsx --test "lib/time/**/*.test.ts"`

### `informes` — Estadísticas y Ranking (`/informes`)
- **UI / API:** `app/(dashboard)/informes/page.tsx`, `app/api/estadisticas/route.ts`, `lib/estadisticas/calcular.ts`
- **Test directo:** `npx tsx --test "lib/estadisticas/**/*.test.ts"`

### `web` — Escaparate Público y Editor (`/web/gestionar`, `app/web/**`)
- **UI:** `app/web/**`, `components/web/corporativa/**`, `app/(dashboard)/web/gestionar/page.tsx`, `components/web/EditorWeb.tsx`
- **Lógica:** `lib/web/{dominio,modelo,cargar,en-dominio}.ts`, `lib/web/corporativa/**`, `middleware.ts`
- **Test directo:** `npx tsx --test "lib/web/**/*.test.ts"`

### `ajustes` y `soporte` — Permisos, Avisos y Tickets (`/settings/**`, `/soporte`)
- **UI:** `app/(dashboard)/settings/**`, `app/(dashboard)/soporte/page.tsx`, `components/support/**`, `components/pwa/AvisosPwa.tsx`
- **Lógica:** `lib/auth/{permisos,roles,Protected}.ts*`, `lib/alertas/**`, `lib/support/**`, `app/api/support/**`
- **Test directo:** `npx tsx --test "lib/auth/**/*.test.ts" "lib/alertas/**/*.test.ts" "lib/support/**/*.test.ts"`
