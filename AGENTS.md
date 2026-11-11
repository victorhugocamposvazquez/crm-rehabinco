# AGENTS.md — Guía Universal para Agentes de Código (CRM Inmobiliario)

Este archivo es el mapa maestro del repositorio para **cualquier modelo o agente de IA** (Cursor Local, Cursor Cloud Agents, Grok, Composer, Claude Code, Codex, Devin u otros motores futuros). Léelo antes de explorar el código: te ahorrará el 80 % de búsquedas y evitará regresiones en producción.

---

## 1. Resumen del Stack y Arquitectura

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS (`min-[820px]:` separa móvil de escritorio).
- **Base de datos y Auth:** Supabase (`@supabase/ssr` + Postgres con RLS estricta + Storage público/privado).
  - Cliente navegador: `lib/supabase/client.ts`
  - Cliente RSC / Route Handlers con sesión: `lib/supabase/server.ts`
  - Cliente privilegiado (Service Role, **solo servidor**): `lib/supabase/admin.ts`
- **Multi-host en `middleware.ts` + `lib/web/dominio.ts`:**
  - `crm.rehabinco.es`, `localhost` y `*.vercel.app` sirven el CRM (`app/(dashboard)/**`, protegido por `lib/auth/Protected.tsx` + `components/layout/AppShell.tsx`).
  - El dominio público configurado en BD reescribe `/`, `/inmuebles/**` y páginas legales hacia `app/web/**` marcando la cabecera `x-rehabinco-sitio: publico`.
- **Portabilidad multi-agencia:** El repositorio está preparado para clonarse en otras agencias inmobiliarias activando/apagando zonas desde `lib/auth/permisos.ts` y `role_permisos`.

---

## 2. Comandos Rápidos de Verificación (Usa el más específico para ahorrar tiempo y tokens)

- **Test quirúrgico de un módulo CRM (0.5 s, recomendado al arreglar un ticket):**
  ```bash
  CATASTRO_SKIP_LIVE=1 npx tsx --test lib/<modulo>/<archivo>.test.ts
  ```
- **Tests de Valoraciones / AVM (Vitest):**
  ```bash
  npx vitest run lib/avm
  ```
- **Suite completa del CRM (node:test + vitest AVM):**
  ```bash
  npm test
  ```
- **Linter focalizado en las carpetas tocadas:**
  ```bash
  npx next lint --dir components/<modulo> --dir lib/<modulo>
  ```

> **Nota sobre tests:** Los tests del CRM usan `node:test` (`import { describe, it } from "node:test"` + `node:assert/strict`), **no** Jest ni Vitest (salvo `lib/avm/**` y `crawler/**`). Si creas un test en una carpeta nueva de `lib/`, asegúrate de que su patrón esté incluido en `scripts/run-crm-tests.mjs`.

---

## 3. Mapa Rápido de Dónde Vive Cada Cosa

Para ir al archivo exacto en el primer turno, consulta **`docs/SUPPORT-ATLAS.md`** (o `lib/support/codebase-atlas.ts`). Resumen ejecutivo:

| Dominio | Páginas UI (`app/(dashboard)/...`) | Componentes (`components/...`) | Lógica y API (`lib/...` / `app/api/...`) |
|---|---|---|---|
| **Hoy / Resumen** | `page.tsx` (`/`) | `captacion/HoyCaptacion.tsx` | `lib/tareas/tareas.ts`, `lib/citas/citas.ts` |
| **Inmuebles (Stock)** | `propiedades/**` | `inmuebles/PanelInmueble.tsx`, `NuevoInmueblePanel.tsx`, `InmuebleForm.tsx` | `lib/inmuebles/**`, `lib/actions/propiedades-papelera.ts` |
| **Publicación Idealista** | `settings/publicacion/page.tsx` | `inmuebles/PublicacionInmueble.tsx` | `lib/inmuebles/idealista-publicacion/**`, `app/api/inmuebles/idealista/**` |
| **Contactos (Agenda)** | `clientes/**` | `clientes/NuevoClientePanel.tsx`, `EditarClientePanel.tsx`, `ClienteQuickSheet.tsx` | `lib/clientes/**`, `lib/ui/busqueda.ts`, `lib/ui/alta-persona.ts` |
| **Demandas y Cruce** | `demandas/**` | `demandas/NuevaDemandaPanel.tsx`, `demandas/cruce/DemandaCruce.tsx` | `lib/demandas/**`, `lib/actions/demandas.ts` |
| **Calendario y Citas** | `calendario/page.tsx` | `citas/NuevaEntradaCalendario.tsx`, `CalendarioSemana.tsx`, `CalendarioMes.tsx` | `lib/citas/citas.ts`, `lib/tareas/sync-cita.ts` |
| **Tareas** | `tareas/page.tsx` | `tareas/TareasBoard.tsx`, `TareaPanel.tsx` | `lib/tareas/tareas.ts`, `lib/tareas/menciones.ts` |
| **Seguimiento (Kanban)** | `seguimiento/page.tsx` | `ui/kanban.tsx`, `inmuebles/PanelInmueble.tsx` | `lib/captacion/estados.ts`, `lib/actions/demandas.ts` |
| **Catastro y Fincas** | `catastro/**`, `buscar/page.tsx` | `catastro/**`, `captacion/PipelineFinca.tsx`, `EncargosPagina.tsx` | `lib/catastro/**` (puro), `lib/catastro-host/**` (BD), `app/api/catastro/**` |
| **Captación Portales** | `captacion/page.tsx`, `settings/portales/page.tsx` | `captacion/portales/CaptacionPortales.tsx`, `settings/CaptacionSaludCard.tsx` | `lib/captacion/brightdata/**`, `app/api/captacion/**` |
| **Valoraciones (AVM)** | `valoraciones/**` | `avm/**` | `lib/avm/**`, `app/api/avm/**` |
| **Herramientas Legales** | `herramientas/page.tsx`, `partes-visita/**`, `contratos-*/**`, `hojas-encargo-*/**` | `documentos/PdfFrameEditable.tsx`, `partes-visita/**` | `lib/documentos-pdf.ts`, `lib/contrato-*.ts`, `lib/hoja-encargo-*.ts` |
| **Presupuestos y Obra** | `presupuestos/**` | `presupuestos/PresupuestoWizard.tsx`, `PresupuestoCopiloto.tsx` | `lib/presupuesto-*.ts`, `lib/ai/presupuesto-copiloto.ts` |
| **Facturas** | `facturas/**` | `facturas/FacturaWizard.tsx` | `lib/factura-pdf.ts`, `lib/facturacion-numeracion.ts` |
| **Fichaje y Jornada** | `fichaje/page.tsx`, `equipo/jornada/page.tsx` | `time/**` | `lib/time/**`, `app/api/time/**` |
| **Estadísticas** | `informes/page.tsx` | (en la propia página) | `lib/estadisticas/calcular.ts`, `app/api/estadisticas/route.ts` |
| **Web Pública** | `web/gestionar/page.tsx` y `app/web/**` | `web/corporativa/**`, `web/EditorWeb.tsx` | `lib/web/**`, `lib/actions/web-sitio.ts` |
| **Soporte** | `soporte/page.tsx`, `settings/soporte/page.tsx` | `support/SupportDrawer.tsx`, `SupportTrigger.tsx` | `lib/support/**`, `app/api/support/**` |

---

## 4. Las 12 Reglas e Invariantes Críticas (Trampas Históricas)

1. **Permisos reales vs legacy:** Quien corta el acceso a rutas hoy es **`lib/auth/permisos.ts` (`rutaPermitida` + tabla `role_permisos`)**, NO las listas `*_BLOCKED_PREFIXES` de `lib/auth/roles.ts`. `superadmin` siempre entra a todo; `/settings/roles`, `/settings/papelera` y `/settings/soporte` son exclusivas de `superadmin`.
2. **Semántica de funciones RLS en SQL:**
   - `public.is_agente()` es **solo** `comercial`/`agente` (**NO incluye `admin` ni `superadmin`**).
   - `public.is_equipo()` incluye `superadmin`, `admin`, `comercial`, `agente` (**NO incluye `editor` ni `catastro_user`**).
   - `public.is_equipo_o_catastro_user()` añade `catastro_user` (usado en contactos, citas y tareas propias).
   - Nunca hagas `SELECT` directo a `profiles` dentro de una política RLS de `profiles` (recursión infinita): usa las funciones `SECURITY DEFINER`.
3. **Altas en Sheet lateral + Borradores Locales:** Las altas de inmueble, cliente y demanda no usan páginas `/nueva`: redirigen al listado con `?nueva=1` abriendo `AltaShell` (`components/ui/alta-form.tsx`) y guardan borrador en `localStorage` (`crm.alta.{tipo}.{ambito}`). En `AltaPersona`, escribir el nombre sin pulsar la fila no selecciona el cliente (`lib/ui/alta-persona.ts`).
4. **Vista rápida (`FichaPeek`) vs Ficha completa:** `FichaLink` (`components/crm/FichaPeek.tsx`) abre un panel lateral apilado. El cruce completo de una demanda solo vive en `/demandas/[id]`, no en el peek.
5. **Dos mecanismos distintos de Papelera:**
   - `propiedades` y `avm_valuations` usan **soft-delete directo** (`deleted_at is null` en listados).
   - Documentos legales (`partes_visita`, `contratos_*`, `hojas_encargo_*`) y bajas/altas de usuarios por `admin` pasan por la cola **`papelera_items`** para aprobación de `superadmin` (`lib/actions/papelera.ts`).
   - Borrar en `clientes` es **DELETE real** (`lib/clientes/eliminar-contacto.ts`).
6. **Tres motores de PDF distintos (no mezclar):**
   - Documentos legales inmobiliarios: HTML paginado A4 (794×1123 px) en `lib/documentos-pdf.ts`.
   - Presupuestos y Facturas: `lib/presupuesto-pdf.ts` y `lib/factura-pdf.ts` (en presupuestos no mezclar nunca `ajuste_comercial` con `porcentaje_descuento`).
   - Informes de Valoración AVM: `@react-pdf/renderer` en `lib/avm/pdf/**`.
7. **Dos superficies en Web Pública:** `app/web/**` renderiza la **web corporativa** (`components/web/corporativa/*` + RPC `web_publica`/`web_escaparate` sobre `propiedades.publicar_web = true`). `/web/gestionar` edita `web_bloques` (`SitioPublico`), que comparte dominio y flag `publicado`, pero **no** cambia los textos fijos de `lib/web/corporativa/contenido.ts`.
8. **Catastro puro y División Horizontal (DH):** `lib/catastro/**` no debe importar nunca Supabase (eso vive en `lib/catastro-host/**`). La clasificación DH (`lib/catastro/horizontal-division.ts`) depende **únicamente** del literal oficial `finca.ltp` de Catastro; prohibido inferirla por número de inmuebles o superficies.
9. **Captación Bright Data — Retirados:** El sondeo rápido cada 15 min, la zona `provincia-48h`, la primera recogida completa y cualquier zona incompleta (tope página 60) **jamás** deben marcar anuncios como retirados (`lib/captacion/brightdata/barrido-retirados.ts`).
10. **Sincronización Citas ↔ Tareas y Fechas UTC:** Crear/cerrar una cita en `calendario` sincroniza una fila en `tareas` (`lib/tareas/sync-cita.ts`). Ojo con `toISOString().slice(0, 10)` entre las 00:00 y las 02:00 hora de Madrid (UTC va un día por detrás).
11. **Inmutabilidad legal en Fichaje:** `fichaje_punches` y `fichaje_audit_log` bloquean `UPDATE`/`DELETE` por trigger legal; cualquier rectificación se hace mediante `fichaje_corrections` y `superseded_by` respetando la máquina de estados de `lib/time/replay.ts`.
12. **PostgREST joins:** Una relación FK en Supabase puede llegar como objeto o como array de 1 elemento; pásala siempre por `relacionUno(...)` (`lib/citas/citas.ts`).
