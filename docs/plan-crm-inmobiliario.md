# Plan: CRM inmobiliario Rehabinco

Rehabinco opera dos negocios en el mismo CRM: **obra/reforma** (presupuestos Garal, facturas) e **intermediación inmobiliaria** (captación, demanda, visitas, cierre). Hoy el primero está hecho. El segundo es un esqueleto. Este plan reconstruye el segundo sin tocar el primero.

Fecha: 2026-09-11. Actualizado con referentes de mercado.

---

## 0. Referentes (qué copiamos)

No vamos a clonar un portal ni un generador de leads USA. El modelo es **Witei por dentro** (ficha, cruce, agenda, parte) + **Follow Up Boss en el día a día** (Hoy, tareas, color por comercial). Presupuestos/facturas ya son nuestra ventaja; ellos no las tienen.

| Referente | Por qué importa | Qué copiamos | Qué no |
|-----------|-----------------|--------------|--------|
| **Witei** (ES, ~4,1–4,5) | El CRM que usa la agencia española media | Ficha de inmueble completa, cruce demanda↔stock (favorito/descartado), calendario, parte de visita, ficha PDF, % de ficha rellena | Portales Idealista/Fotocasa, web pública, retoque de fotos, área de propietarios |
| **Inmovilla** (ES, líder por volumen) | Cartera grande y dato legal | Referencia, catastro, documentos, histórico de precio, robustez de stock | Interfaz vieja, 50 portales, MLS, alta curva de aprendizaje |
| **Follow Up Boss** (USA, #1 ZDNET 2026) | El estándar de “no se me olvida nadie” | Pantalla Hoy, planes de seguimiento (tarea a X días), color/accountability por comercial, actividad en la ficha | Leads Zillow, dialer, SMS masivo, 200 integraciones |
| **Lofty / BoldTrail** | Suites all-in-one | Nada en v1 | Web IDX, IA que escribe al cliente, anuncios de pago |

Patrón que se repite en los bien valorados y que Rehabinco debe tener:

1. **Una ficha de inmueble** de la que cuelga todo (fotos, demandas que encajan, visitas, tareas).
2. **Cruce automático** con pulgar arriba/abajo (Witei).
3. **Agenda del comercial**, no un Excel de partes.
4. **Hoy**: lo que hay que hacer antes de las 20:00.
5. **Actividad** en cada ficha (quién llamó, quién visitó, cuándo cambió el precio).

---

## 1. Qué se conserva y qué se rehace

### No se toca (salvo enlaces)

- Presupuestos, copiloto, PDF, emisores Rehabinco/Garal.
- Facturas, rectificativas, pagos, numeración.
- Rol `editor` (Garal): sigue viendo solo presupuestos.
- Login, PWA, settings de empresa.

### Se rehace o se sustituye

- `propiedades` → ficha completa de **inmueble** (referencia, media, datos técnicos).
- `partes_visita` → deja de ser texto suelto; se ata a inmueble, cliente y cita del calendario.
- Navegación: el comercial vive en **Hoy / Calendario / Inmuebles / Demandas**, no en un listado plano.

### Se crea de cero

- Perfil de **comercial** (color, zona, móvil, foto).
- **Demandas** (cliente que busca un tipo de inmueble).
- **Matching** oferta ↔ demanda.
- **Calendario** con color por comercial.
- **Tareas** del día (visitas, llamadas, follow-up).
- **Citas** (visita concertada) distintas del **parte** (acta firmada).
- Supabase **Storage** (fotos, vídeos, documentos del inmueble).

---

## 2. Idea de producto

Un comercial abre el CRM por la mañana y ve **su día**: visitas, llamadas, partes pendientes de firma. El admin ve el calendario de todo el equipo, cada uno con su color.

El inmueble es el objeto central del lado inmobiliario: referencia propia (p. ej. `RHB-2026-0142`), ficha, galería, vídeo, documentos, historial de visitas y demandas que encajan.

El cliente tiene dos caras, que ya existen a medias:

- **Ofertante** — dueño de uno o más inmuebles.
- **Demandante** — busca un tipo de inmueble (puede ser las dos cosas).

La demanda no es “un cliente con una nota”. Es una ficha con criterios (zona, tipo, presupuesto, m², habitaciones, operación) y un estado (activa / pausada / cubierta / cerrada).

---

## 3. Perfiles y permisos

Hoy: `admin` | `agente` | `editor`.

Cambio:

| Rol | Quién | Ve |
|-----|--------|----|
| `admin` | Dirección | Todo el equipo, todos los inmuebles, matching, informes |
| `comercial` | Agente de calle (renombrar `agente`) | Lo suyo + inmuebles/demandas que le asignen. Calendario propio. Tareas del día |
| `editor` | Garal | Sin cambio: solo presupuestos |

Migración: `profiles.role = 'agente'` → `'comercial'`. Alias en código durante un sprint.

### Perfil de comercial (`profiles` ampliado)

- `nombre_completo`, `telefono`, `foto_url`
- `color` (hex) — se pinta en calendario, tareas y chips
- `zona` (texto: “A Coruña centro”, “Arteixo”…)
- `activo`

El admin crea comerciales en Ajustes (ya crea usuarios). Ahí se rellena el perfil, no solo email/rol.

---

## 4. Modelo de datos

### 4.1 Inmueble (ampliar `propiedades`, no crear tabla paralela)

Campos nuevos encima de los actuales:

- `referencia` unique (generada: `RHB-AAAA-NNNN`)
- `tipo_inmueble`: piso, ático, bajo, chalet, adosado, local, oficina, nave, solar, garaje, trastero
- `tipologia` libre (2 hab reformar, dúplex…)
- `banos`, `aseos`, `planta`, `ascensor`, `anio_construccion`
- `superficie_util`, `superficie_construida`, `superficie_parcela`
- `referencia_catastral`
- `lat`, `lng` (opcional, para mapa más adelante)
- `descripcion` (texto de ficha, no solo notas internas)
- `comercial_id` → `profiles` (captador / responsable)
- `publicado` bool (listo para compartir / matching)

Media y documentos **no van en JSONB ni en dataUrl**. Van a Storage:

| Tabla | Qué |
|-------|-----|
| `inmueble_media` | foto / video / plano. `url`, `tipo`, `orden`, `portada` |
| `inmueble_documentos` | nota simple, certificado energético, cédula, escritura… |

Buckets Storage: `inmuebles` (público o signed URL), `inmueble-docs` (privado).

### 4.2 Demanda (nueva)

```
demandas
  cliente_id → clientes
  comercial_id → profiles
  tipo_operacion: compra | alquiler | ambos
  tipos_inmueble[]          -- piso, chalet…
  zonas[]                   -- textos o más adelante un catálogo
  presupuesto_min / max
  superficie_min / max
  habitaciones_min
  banos_min
  requisitos               -- texto: “con ascensor, no última planta”
  estado: activa | pausada | cubierta | cerrada
  origen                   -- web, llamada, Idealista, conocido
```

Un cliente puede tener **varias demandas** (compra piso + alquiler local).

### 4.3 Matching (nueva)

```
demanda_inmuebles
  demanda_id
  propiedad_id
  origen: automatico | manual
  puntuacion numeric       -- 0–100
  estado: propuesto | presentado | descartado | visitado | oferta
  notas
```

Regla automática (primera versión, sin IA):

- misma operación (venta/alquiler)
- tipo de inmueble ∈ tipos pedidos
- precio dentro de ±10 % del presupuesto
- m² y habitaciones ≥ mínimos
- localidad / zona coincide (texto, case-insensitive)

El comercial confirma o descarta. No se envía nada solo.

### 4.4 Calendario, tareas, visitas

Tres cosas distintas. Hoy están mezcladas en un parte con campos sueltos.

```
citas
  comercial_id → profiles
  tipo: visita | llamada | firma | otro
  titulo
  empieza / termina timestamptz
  propiedad_id? → propiedades
  cliente_id? → clientes
  demanda_id?
  estado: prevista | hecha | no_asistio | cancelada
  color se hereda del comercial (se puede override)

tareas
  comercial_id
  titulo
  vence date
  estado: pendiente | hecha
  cita_id? / propiedad_id? / cliente_id? / demanda_id?

partes_visita  (existente, se engancha)
  + propiedad_id
  + cliente_id          -- el visitante si ya es cliente
  + cita_id
  + comercial_id        -- deja de ser solo agente_nombre
  inmueble_direccion / referencia se rellenan desde la ficha
```

Flujo:

1. El comercial (o admin) crea una **cita de visita** en el calendario, atada a inmueble + demandante.
2. Ese día aparece en **Hoy**.
3. Desde la cita: “hacer parte” → abre el parte ya relleno → firma en el móvil (`/firmar/[token]`).
4. Al firmar, la cita pasa a `hecha` y el matching de esa pareja puede pasar a `visitado`.

---

## 5. Pantallas

### Hoy (`/` para comercial; admin ve el equipo)

- Bloque “Hoy”: visitas por hora, color del comercial.
- Tareas pendientes.
- Partes sin firmar.
- Demandas activas con inmuebles nuevos que encajan (contador).

Admin: selector de comercial o vista de todos.

### Calendario (`/calendario`)

- Semana / día / mes.
- Eventos con el **color del comercial**.
- Admin: filtro por comercial (chips de color).
- Clic → crear visita / tarea.
- Arrastrar hora (v1 puede ser solo crear/editar, sin drag).

### Inmuebles (`/inmuebles` — alias de `/propiedades`)

- Listado tipo stock: foto portada, referencia, precio, estado, comercial.
- Filtros: operación, tipo, zona, estado, comercial, precio.
- **Ficha**:
  - Portada + galería + vídeo
  - Referencia, catastro, datos técnicos
  - Propietario (ofertante)
  - Comercial responsable
  - Demandas que encajan
  - Historial de visitas / partes
  - Documentos

Alta en wizard: datos → media → publicación.

### Demandas (`/demandas`)

- Listado por estado y comercial.
- Ficha: criterios, cliente, matching (propuestos / presentados / visitados).
- Botón “buscar en stock” (recalcula matching).

### Clientes (se enriquece, no se rehace)

En la ficha del cliente:

- Inmuebles que ofrece.
- Demandas que tiene.
- Visitas hechas.
- Presupuestos/facturas (ya está).

Deja de ser verdad aquello de “la demanda se gestiona como clientes”.

### Visitas (`/visitas`)

Dos pestañas:

1. **Agenda** — citas tipo visita (atajo al calendario filtrado).
2. **Partes** — el flujo de firma que ya existe, ahora prellenado.

### Ajustes

- Comerciales: color, zona, foto, activo.
- Catálogo opcional de zonas (v2).

Editor Garal no ve ninguno de estos módulos.

---

## 6. Navegación propuesta

**Comercial / admin**

| Módulo | Ruta |
|--------|------|
| Hoy | `/` |
| Calendario | `/calendario` |
| Inmuebles | `/inmuebles` (redirect desde `/propiedades`) |
| Demandas | `/demandas` |
| Clientes | `/clientes` |
| Visitas | `/visitas` (partes + citas) |
| Presupuestos | `/presupuestos` |
| Facturas | `/facturas` (admin; comercial si le dais cobros) |
| Ajustes | `/settings` |

Móvil: Hoy, Calendario, Inmuebles, Demandas, Más.

---

## 7. Qué se rehace de lo existente (concreto)

| Pieza | Acción |
|-------|--------|
| Tabla `propiedades` | ALTER: referencia, tipología, catastro, comercial, superficies, baños… |
| UI propiedades | Nueva ficha + galería. El CRUD actual se sustituye |
| `partes_visita` | ALTER: FKs a propiedad, cliente, cita, comercial. Se mantienen token y firmas |
| Formulario de parte | Prefill desde cita/inmueble; `agente_nombre` se toma del perfil |
| `profiles` | ALTER: nombre, color, foto, teléfono, zona. Rol `agente` → `comercial` |
| Inicio | Deja de ser solo KPIs de facturación; el comercial ve su día |
| TopBar / MobileNav | Nuevos módulos; Visitas también en móvil |
| `direcciones` | Sigue sin UI; no es prioridad. La dirección vive en inmueble y en cliente |
| Types TS | Regenerar desde Supabase; hoy están desfasados |

No se reescribe el wizard de presupuestos ni el de facturas.

---

## 8. Fases

Cada fase es usable sola. No esperar a “todo el CRM”.

### Fase 0 — Cimientos (1 sprint)

- Storage buckets + políticas.
- Ampliar `profiles` (comercial, color).
- Renombrar rol `agente` → `comercial` en SQL + `lib/auth/roles.ts`.
- Generar `referencia` en inmuebles.
- Campos técnicos del inmueble (sin media aún).
- Enganchar `partes_visita` a `propiedad_id` y `comercial_id`.

### Fase 1 — Ficha de inmueble (1–2 sprints)

- Galería fotos + vídeo (upload a Storage, portada, orden).
- Ficha nueva (referencia, catastro, datos, propietario, comercial).
- Listado con foto y filtros.
- Documentos del inmueble (privado).

### Fase 2 — Demandas + matching (1–2 sprints)

- Tabla `demandas` + UI listado/ficha.
- Cliente: bloque “busca” / “ofrece”.
- Matching automático + lista de propuestos en ambas fichas.
- Estados del matching (presentado, visitado, descartado).

### Fase 3 — Calendario y Hoy (1–2 sprints)

- `citas` + `tareas`.
- Calendario semana/día, color por comercial.
- Inicio = día del comercial.
- Desde la cita: crear parte de visita prellenado.
- Parte firmado cierra la cita.

### Fase 4 — Pulido operativo

- Recordatorio visual de visitas de hoy (no hace falta email al inicio).
- Informes simples: visitas/semana, stock por comercial, demandas activas sin matching.
- Mapa de inmuebles (si hay lat/lng).
- Catálogo de zonas.
- Compartir ficha (PDF o enlace interno).

---

## 9. Decisiones ya tomadas

1. Un solo CRM, dos mundos. El comercial no entra en Garal; el editor no entra en inmuebles.
2. Inmueble = evolución de `propiedades`, no tabla nueva.
3. Media en Storage, nunca más dataUrl en JSON.
4. Cita ≠ parte. El parte es el acta; la cita es la agenda.
5. Matching determinista primero. IA después, si hace falta.
6. Color = comercial, no tipo de evento (el tipo se ve por icono: visita, llamada, firma).

---

## 10. Decisiones abiertas (cuando se empiece)

- ¿El comercial ve **todo el stock** o solo lo suyo? Recomendación: ve todo el stock; solo edita lo asignado. Si no, el matching entre comerciales no sirve.
- ¿Facturas las ve el comercial? Hoy el agente sí. Se puede dejar.
- ¿Referencia visible al cliente (cartel, ficha compartida) o solo interna?
- ¿Vídeo: upload a Storage (límite ~50 MB) o solo URL de YouTube/Vimeo en v1?
- ¿Zonas como texto libre o lista cerrada (A Coruña, Oleiros, Arteixo…)?

Recomendación v1: stock visible a todos los comerciales; vídeo = URL + foto galería; zonas = texto + localidad.

---

## 11. Criterio de “ya está”

Un comercial puede, en un día de trabajo real:

1. Dar de alta un inmueble con referencia, 10 fotos y un vídeo.
2. Registrar que María busca un piso de 3 hab en Oleiros hasta 280.000 €.
3. Ver que el inmueble encaja y marcar “presentado”.
4. Poner la visita el jueves a las 18:00; sale en el calendario en su color.
5. El jueves, desde Hoy, abrir el parte ya relleno y firmarlo en el portal.
6. El admin ve el mismo jueves el calendario de tres comerciales, cada uno de un color.
