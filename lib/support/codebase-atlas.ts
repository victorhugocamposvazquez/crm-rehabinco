import { inferirModuloPorRuta } from "./project-manifest";

export type ModuloAtlasEntry = {
  id: string;
  titulo: string;
  archivosClave: string[];
  tablasYPermisos: string[];
  falsosBugsComunes: string[];
  invariantesCriticas: string[];
  comandoTestDirecto: string;
};

const ATLAS_POR_MODULO: Record<string, ModuloAtlasEntry> = {
  hoy: {
    id: "hoy",
    titulo: "Hoy / Resumen diario (/)",
    archivosClave: [
      "app/(dashboard)/page.tsx",
      "components/captacion/HoyCaptacion.tsx",
      "app/api/catastro/mine/route.ts",
      "lib/tareas/tareas.ts",
      "lib/citas/citas.ts",
    ],
    tablasYPermisos: [
      "Tablas: tareas, citas, partes_visita, demandas, facturas (solo admin), catastro_explorer_assignments.",
      "Sin permiso tareas_equipo solo carga tareas propias (comercial_id = user.id).",
    ],
    falsosBugsComunes: [
      "Entre las 00:00 y 02:00 hora España, el corte UTC (toISOString().slice(0,10)) aún marca el día anterior.",
      "El gráfico de facturación solo aparece para admin/superadmin y cuenta facturas en estado 'pagada'.",
    ],
    invariantesCriticas: [
      "Respetar el filtro comercial compartido (useFiltroComercial) y no exponer facturación a perfiles no admin.",
    ],
    comandoTestDirecto: 'npx tsx --test "lib/tareas/**/*.test.ts" "lib/citas/**/*.test.ts"',
  },

  inmuebles: {
    id: "inmuebles",
    titulo: "Cartera de Inmuebles (/propiedades)",
    archivosClave: [
      "app/(dashboard)/propiedades/page.tsx",
      "app/(dashboard)/propiedades/[id]/page.tsx",
      "app/(dashboard)/propiedades/[id]/editar/page.tsx",
      "components/inmuebles/PanelInmueble.tsx",
      "components/inmuebles/NuevoInmueblePanel.tsx",
      "components/inmuebles/InmuebleForm.tsx",
      "lib/inmuebles/panel.ts",
      "lib/inmuebles/publicacion.ts",
      "lib/actions/propiedades-papelera.ts",
    ],
    tablasYPermisos: [
      "Tablas: propiedades, inmueble_media (bucket público 'inmuebles'), inmueble_documentos (bucket privado 'inmueble-docs'), propiedad_captadores.",
      "RLS: is_equipo() gestiona stock; CatastroUser y Editor no entran. Triggers: propiedades_asignar_referencia(), propiedades_guardar_captador().",
    ],
    falsosBugsComunes: [
      "Si un inmueble 'ha desaparecido', revisar Papelera al final de /propiedades (el listado filtra deleted_at is null).",
      "Para salir en la web pública necesita publicar_web=true, referencia, título, localidad, descripción, precio y estado != 'baja' (aptoParaWeb).",
      "Idealista exige fotos y certificado energético en vivienda/local/oficina antes de sincronizar.",
    ],
    invariantesCriticas: [
      "El borrado normal es soft-delete (deleted_at); solo superadmin vacía definitivamente.",
      "No romper la coherencia entre captado_conjunto y captado_por (constraint propiedades_captado_coherente).",
    ],
    comandoTestDirecto: 'npx tsx --test "lib/inmuebles/**/*.test.ts"',
  },

  contactos: {
    id: "contactos",
    titulo: "Contactos / Agenda de clientes (/clientes)",
    archivosClave: [
      "app/(dashboard)/clientes/page.tsx",
      "app/(dashboard)/clientes/[id]/page.tsx",
      "components/clientes/NuevoClientePanel.tsx",
      "components/clientes/EditarClientePanel.tsx",
      "components/clientes/ClienteQuickSheet.tsx",
      "components/ui/alta-form.tsx",
      "lib/ui/alta-persona.ts",
      "lib/ui/busqueda.ts",
    ],
    tablasYPermisos: [
      "Tablas: clientes, clientes_notas.",
      "RLS: is_equipo_o_catastro_user() CRUD completo; editor solo SELECT para presupuestos.",
    ],
    falsosBugsComunes: [
      "En selectores AltaPersona, escribir el nombre sin pulsar la fila de sugerencias NO selecciona el contacto.",
      "Desactivar un contacto (activo=false) lo oculta de selectores rápidos sin borrarlo.",
    ],
    invariantesCriticas: [
      "Eliminar un contacto es DELETE real con cascada sobre propiedades que ofrece y demandas: no automatizar borrados.",
      "Usar coincideTelefonoBusqueda para buscar teléfonos con o sin espacios/prefijos.",
    ],
    comandoTestDirecto: "npx tsx --test lib/ui/busqueda.test.ts lib/ui/alta-persona.test.ts",
  },

  demandas: {
    id: "demandas",
    titulo: "Demandas y Cruce (/demandas)",
    archivosClave: [
      "app/(dashboard)/demandas/page.tsx",
      "app/(dashboard)/demandas/[id]/page.tsx",
      "components/demandas/NuevaDemandaPanel.tsx",
      "components/demandas/cruce/DemandaCruce.tsx",
      "lib/demandas/matching.ts",
      "lib/demandas/cruce.ts",
      "lib/actions/demandas.ts",
    ],
    tablasYPermisos: [
      "Tablas: demandas, demanda_inmuebles. Trigger: marcar_cliente_vinculado().",
      "RLS: todo el equipo (is_admin o is_agente) puede leer y actualizar demandas.",
    ],
    falsosBugsComunes: [
      "El cliente es obligatorio al crear demanda: hay que elegirlo de la lista o crearlo con 'Nuevo', no solo dejar texto escrito.",
      "El cruce detallado de inmuebles está en /demandas/[id], no en el FichaPeek rápido.",
      "Los barrios finos solo aplican en DISTRITOS_A_CORUNA; en otros municipios cruza por localidad.",
    ],
    invariantesCriticas: [
      "Operación 'compra' de demanda cruza con 'venta' de inmueble (o 'ambos'). Superficie usa útil y si falta, construida.",
    ],
    comandoTestDirecto: 'npx tsx --test "lib/demandas/**/*.test.ts"',
  },

  calendario: {
    id: "calendario",
    titulo: "Calendario y Citas (/calendario)",
    archivosClave: [
      "app/(dashboard)/calendario/page.tsx",
      "components/citas/NuevaEntradaCalendario.tsx",
      "components/citas/CalendarioSemana.tsx",
      "components/citas/CitaAcciones.tsx",
      "lib/citas/citas.ts",
      "lib/tareas/sync-cita.ts",
    ],
    tablasYPermisos: [
      "Tabla: citas (clientes_extra_ids uuid[], motivo_anulacion, tarea_id).",
      "RLS: cita_visible_para_mi(tipo, comercial_id).",
    ],
    falsosBugsComunes: [
      "Las citas anuladas (estado='cancelada') no se pintan en la rejilla y las 'hecha' solo si se activan.",
      "Cada cita genera/actualiza automáticamente una tarea vinculada en el tablero de Tareas.",
    ],
    invariantesCriticas: [
      "Mantener sincronización con tareas en lib/tareas/sync-cita.ts al crear, reprogramar, completar o anular citas.",
    ],
    comandoTestDirecto: 'npx tsx --test "lib/citas/**/*.test.ts"',
  },

  tareas: {
    id: "tareas",
    titulo: "Tablero de Tareas (/tareas)",
    archivosClave: [
      "app/(dashboard)/tareas/page.tsx",
      "components/tareas/TareasBoard.tsx",
      "components/tareas/TareaPanel.tsx",
      "lib/tareas/tareas.ts",
      "lib/tareas/menciones.ts",
    ],
    tablasYPermisos: [
      "Tablas: tareas, tareas_actividad.",
      "RLS: is_equipo_o_catastro_user() AND tarea_visible_para_mi(comercial_id).",
    ],
    falsosBugsComunes: [
      "Las tareas completadas hace más de 7 días dejan de mostrarse en la columna 'Hechas' para no saturar.",
      "CatastroUser por defecto no tiene tareas_equipo, por lo que solo ve sus propias tareas.",
    ],
    invariantesCriticas: [
      "Pasar relaciones anidadas de PostgREST por relacionUno() porque pueden venir como objeto o array.",
    ],
    comandoTestDirecto: 'npx tsx --test "lib/tareas/**/*.test.ts"',
  },

  seguimiento: {
    id: "seguimiento",
    titulo: "Embudo de Seguimiento Kanban (/seguimiento)",
    archivosClave: [
      "app/(dashboard)/seguimiento/page.tsx",
      "components/ui/kanban.tsx",
      "components/inmuebles/PanelInmueble.tsx",
      "lib/captacion/estados.ts",
      "lib/actions/demandas.ts",
    ],
    tablasYPermisos: [
      "Combina 3 tableros independientes: Fincas (catastro_explorer_pipeline), Demandas (demandas) e Inmuebles (propiedades).",
    ],
    falsosBugsComunes: [
      "Mover una finca a 'en_stock' en el tablero de Fincas NO crea ni publica un inmueble en /propiedades.",
    ],
    invariantesCriticas: [
      "Respetar los estados válidos de cada entidad (ESTADOS_CAPTACION vs ESTADOS_DEMANDA vs ESTADOS_INMUEBLE).",
    ],
    comandoTestDirecto: 'npx tsx --test "lib/captacion/**/*.test.ts" "lib/demandas/**/*.test.ts"',
  },

  catastro: {
    id: "catastro",
    titulo: "Catastro, Fincas y Encargos (/catastro/**, /buscar)",
    archivosClave: [
      "components/catastro/FincaPersistida.tsx",
      "components/catastro/FincaDetallePanel.tsx",
      "components/catastro/CatastroPropertyVinculo.tsx",
      "components/captacion/PipelineFinca.tsx",
      "components/captacion/EncargosPagina.tsx",
      "lib/catastro/horizontal-division.ts",
      "lib/catastro/explorer/history-ui.ts",
      "lib/catastro-host/finca-assignment.ts",
      "lib/captacion/encargos-db.ts",
    ],
    tablasYPermisos: [
      "Tablas: catastro_fincas, catastro_zone_sessions, catastro_property_links, catastro_explorer_assignments, catastro_explorer_pipeline (con cliente_id), catastro_explorer_actividad, captacion_encargos.",
      "RPC: crear_propiedad_desde_catastro. Gestores: admin, superadmin y catastro_user (is_catastro_gestor()).",
    ],
    falsosBugsComunes: [
      "Comerciales ven solo fincas asignadas (/catastro); el rastreador global (/buscar, /catastro/searches, /cobertura) requiere permiso catastro_equipo.",
      "El barrido de zonas en Vercel Hobby corre una vez al día (08:00 UTC) más pasos encadenados.",
    ],
    invariantesCriticas: [
      "PROHIBIDO importar Supabase en lib/catastro/** (motor puro); toda persistencia va en lib/catastro-host/**.",
      "La División Horizontal (YES/NO/UNKNOWN) SOLO se decide con el literal oficial finca.ltp, jamás por nº de inmuebles.",
      "En sesiones de zona, permiteEscribirSesionZona impide pisar una sesión más avanzada.",
    ],
    comandoTestDirecto:
      'CATASTRO_SKIP_LIVE=1 npx tsx --test "lib/catastro/**/*.test.ts" "lib/catastro-host/**/*.test.ts"',
  },

  captacion: {
    id: "captacion",
    titulo: "Captación de Portales / Bright Data (/captacion, /settings/portales)",
    archivosClave: [
      "components/captacion/portales/CaptacionPortales.tsx",
      "components/captacion/portales/AccionesContactoAnuncio.tsx",
      "components/captacion/portales/TelefonoAnuncio.tsx",
      "components/settings/CaptacionSaludCard.tsx",
      "lib/captacion/brightdata/rafagas.ts",
      "lib/captacion/brightdata/barrido-retirados.ts",
      "lib/captacion/brightdata/zonas.ts",
    ],
    tablasYPermisos: [
      "Tablas: captacion_anuncios, captacion_recogidas, captacion_paginas_pendientes, captacion_brightdata_zonas, captacion_rafagas, captacion_locks.",
      "Configuración de claves/zonas en /settings/portales requiere permiso 'portales' (por defecto solo superadmin).",
    ],
    falsosBugsComunes: [
      "Guardar zonas en /settings/portales no dispara una recogida inmediata hasta el siguiente ciclo o pulsar 'Abrir recogida'.",
      "Si una ráfaga ya está en curso, lanzar otra manual devuelve 409 por lock activo.",
    ],
    invariantesCriticas: [
      "NUNCA retirar anuncios desde el sondeo rápido de 15m, ni desde provincia-48h, ni en primera recogida, ni si la zona tocó página 60.",
      "Mantener early-exit cuando no hay cola ni recogidas abiertas para no consumir CPU ni locks.",
    ],
    comandoTestDirecto: "npm run test:captacion",
  },

  valoraciones: {
    id: "valoraciones",
    titulo: "Valoraciones AVM e Informes PDF (/valoraciones/**)",
    archivosClave: [
      "app/(dashboard)/valoraciones/page.tsx",
      "app/(dashboard)/valoraciones/nueva/page.tsx",
      "app/(dashboard)/valoraciones/[id]/page.tsx",
      "lib/avm/valuate.ts",
      "lib/avm/valuate-service.ts",
      "lib/avm/comparables.ts",
      "lib/avm/pdf/InformePdf.tsx",
      "app/api/avm/valuations/[id]/pdf/route.ts",
    ],
    tablasYPermisos: [
      "Tablas: avm_valuations (soft-delete con deleted_at), avm_properties, market_listings, market_zones, agency_branding.",
    ],
    falsosBugsComunes: [
      "Una valoración enviada a papelera (deleted_at) devuelve 410 al intentar generar su PDF.",
      "Las capas de entorno suman puntos a favor/en contra pero no alteran el precio medio calculado en esta versión.",
    ],
    invariantesCriticas: [
      "Los tests de AVM usan Vitest (no node:test). No inventar precios si falta una fuente: registrar estado en sourcesUsed.",
    ],
    comandoTestDirecto: "npx vitest run lib/avm",
  },

  herramientas: {
    id: "herramientas",
    titulo: "Herramientas Legales y Partes de Visita (/herramientas, /partes-visita, /contratos-*)",
    archivosClave: [
      "app/(dashboard)/herramientas/page.tsx",
      "components/partes-visita/ParteVisitaEditor.tsx",
      "components/documentos/PdfFrameEditable.tsx",
      "lib/documentos-pdf.ts",
      "lib/documentos-paginacion.ts",
      "lib/partes-visita.ts",
      "lib/contrato-arras.ts",
      "lib/actions/papelera.ts",
    ],
    tablasYPermisos: [
      "Tablas: partes_visita, contratos_arras, hojas_encargo_honorarios, hojas_encargo_exclusiva, contratos_pago_aplazado, contratos_arrendamiento, papelera_items.",
      "RLS: creador (user_id = auth.uid() AND is_agente()) o dirección (is_admin()).",
    ],
    falsosBugsComunes: [
      "Un comercial solo ve/edita sus propios documentos legales; dirección (admin/superadmin) ve todos.",
      "Eliminar un documento lo manda a papelera_items para confirmación de superadmin.",
    ],
    invariantesCriticas: [
      "El PDF legal se pagina en A4 (794x1123 px) con lib/documentos-pdf.ts. Respetar trigger trg_omitir_clausulas_conchado.",
    ],
    comandoTestDirecto:
      "npx tsx --test lib/partes-visita.test.ts lib/documentos-rehabinco.test.ts lib/documentos-paginacion.test.ts lib/contrato-arras-preview.test.ts",
  },

  presupuestos: {
    id: "presupuestos",
    titulo: "Presupuestos, Ampliaciones y Copiloto (/presupuestos/**)",
    archivosClave: [
      "app/(dashboard)/presupuestos/page.tsx",
      "components/presupuestos/PresupuestoWizard.tsx",
      "components/presupuestos/PresupuestoCopiloto.tsx",
      "components/presupuestos/GaralPartidasEditor.tsx",
      "lib/presupuesto-propuesta.ts",
      "lib/presupuesto-totales.ts",
      "lib/presupuesto-pdf.ts",
      "lib/ai/presupuesto-copiloto.ts",
    ],
    tablasYPermisos: [
      "Tablas: presupuestos, presupuesto_lineas, emisores_presupuesto.",
      "El rol 'editor' fuerza siempre el emisor Garal mediante trigger force_emisor_garal_for_editor().",
    ],
    falsosBugsComunes: [
      "El perfil Editor Garal tiene acceso exclusivo a presupuestos y lectura de clientes, sin resto del CRM.",
    ],
    invariantesCriticas: [
      "Consultar .cursor/skills/presupuestos-rehabinco/SKILL.md: jamás combinar ajuste_comercial y porcentaje_descuento a la vez.",
    ],
    comandoTestDirecto: "npx tsx --test lib/documentos-paginacion.test.ts",
  },

  facturas: {
    id: "facturas",
    titulo: "Facturación y Cobros (/facturas/**)",
    archivosClave: [
      "app/(dashboard)/facturas/page.tsx",
      "components/facturas/FacturaWizard.tsx",
      "lib/factura-pdf.ts",
      "lib/facturacion-numeracion.ts",
      "lib/empresa-facturacion.ts",
    ],
    tablasYPermisos: [
      "Tablas: facturas, factura_lineas, pagos, empresa_facturacion.",
    ],
    falsosBugsComunes: [
      "La numeración sigue correlativo anual (N/AAAA o FR-N/AAAA en rectificativas) tomando max + 1 sin rellenar huecos.",
    ],
    invariantesCriticas: [
      "Módulo crítico protegido por Candado 1: cualquier cambio de código exige revisión humana antes de mergear.",
    ],
    comandoTestDirecto: "npx tsx --test lib/facturacion-numeracion.test.ts",
  },

  fichaje: {
    id: "fichaje",
    titulo: "Fichaje y Registro de Jornada (/fichaje, /equipo/jornada)",
    archivosClave: [
      "app/(dashboard)/fichaje/page.tsx",
      "app/(dashboard)/equipo/jornada/page.tsx",
      "lib/time/replay.ts",
      "lib/time/geo.ts",
      "lib/time/server.ts",
      "app/api/time/punch/route.ts",
      "app/api/time/corrections/route.ts",
    ],
    tablasYPermisos: [
      "Tablas: fichaje_punches, fichaje_corrections, fichaje_centros, fichaje_monthly_summaries, fichaje_audit_log.",
    ],
    falsosBugsComunes: [
      "Si el navegador no concede GPS, se conserva la última modalidad o se asume oficina sin bloquear el fichaje.",
    ],
    invariantesCriticas: [
      "PROHIBIDO mutar o borrar filas de fichaje_punches o fichaje_audit_log (triggers legales de inmutabilidad); usar correcciones.",
    ],
    comandoTestDirecto: 'npx tsx --test "lib/time/**/*.test.ts"',
  },

  web: {
    id: "web",
    titulo: "Web Pública y Diseño Web (/web/gestionar, app/web/**)",
    archivosClave: [
      "middleware.ts",
      "lib/web/dominio.ts",
      "lib/web/modelo.ts",
      "app/web/page.tsx",
      "components/web/corporativa/HomeCorporativa.tsx",
      "lib/web/corporativa/contenido.ts",
      "app/(dashboard)/web/gestionar/page.tsx",
      "components/web/EditorWeb.tsx",
    ],
    tablasYPermisos: [
      "Tablas: web_sitio, web_bloques. RPCs públicas: web_dominio(), web_publica(), web_escaparate().",
    ],
    falsosBugsComunes: [
      "IMPORTANTE: app/web/** pinta la web corporativa (components/web/corporativa/*), NO los bloques de EditorWeb (/web/gestionar). Comparten dominio, publicado e inmuebles con publicar_web=true.",
    ],
    invariantesCriticas: [
      "No romper la resolución multi-host de middleware.ts ni exponer inmuebles con publicar_web=false.",
    ],
    comandoTestDirecto: 'npx tsx --test "lib/web/**/*.test.ts"',
  },

  informes: {
    id: "informes",
    titulo: "Estadísticas y Ranking (/informes)",
    archivosClave: [
      "app/(dashboard)/informes/page.tsx",
      "app/api/estadisticas/route.ts",
      "lib/estadisticas/calcular.ts",
    ],
    tablasYPermisos: [
      "Exige permisoDeSesion('informes') en servidor y agrega métricas con createAdminClient.",
    ],
    falsosBugsComunes: [
      "Las cifras y puntos XP no se calculan en el navegador, sino en lib/estadisticas/calcular.ts según el periodo elegido.",
    ],
    invariantesCriticas: [
      "Mantener validación de sesión y permiso antes de consultar con service role.",
    ],
    comandoTestDirecto: 'npx tsx --test "lib/estadisticas/**/*.test.ts"',
  },

  ajustes: {
    id: "ajustes",
    titulo: "Ajustes, Permisos y Avisos (/settings/**)",
    archivosClave: [
      "app/(dashboard)/settings/page.tsx",
      "app/(dashboard)/settings/roles/page.tsx",
      "app/(dashboard)/settings/avisos/page.tsx",
      "components/settings/SettingsAdminNav.tsx",
      "lib/auth/permisos.ts",
      "lib/auth/roles.ts",
      "lib/alertas/prefs.ts",
      "lib/alertas/publicar.ts",
    ],
    tablasYPermisos: [
      "Tablas: profiles, role_permisos, crm_avisos, crm_aviso_prefs, crm_push_subs, papelera_items.",
    ],
    falsosBugsComunes: [
      "Cuando un admin crea o da de baja un usuario, queda pendiente en /settings/papelera hasta que el superadmin lo aprueba.",
      "/settings/roles, /settings/papelera y /settings/soporte son visibles únicamente para superadmin.",
    ],
    invariantesCriticas: [
      "Rutas de autenticación y permisos están protegidas por Candado 1: nunca auto-fusionar sin revisión humana.",
    ],
    comandoTestDirecto: 'npx tsx --test "lib/auth/**/*.test.ts" "lib/alertas/**/*.test.ts"',
  },
};

const ALIAS_MODULO: Record<string, string> = {
  jornada: "fichaje",
  idealista: "inmuebles",
  portales: "captacion",
  propiedades: "inmuebles",
  clientes: "contactos",
  citas: "calendario",
  visitas: "herramientas",
};

export function obtenerFichaModuloAtlas(
  pathname?: string | null,
  moduloExplicito?: string | null
): ModuloAtlasEntry | null {
  const ruta = (pathname || "").trim();

  // Detecciones finas por subruta antes del módulo genérico
  if (ruta.startsWith("/settings/publicacion")) return ATLAS_POR_MODULO.inmuebles ?? null;
  if (ruta.startsWith("/settings/portales")) return ATLAS_POR_MODULO.captacion ?? null;
  if (ruta.startsWith("/equipo/jornada")) return ATLAS_POR_MODULO.fichaje ?? null;

  const candidatoRaw = (moduloExplicito || inferirModuloPorRuta(ruta) || "").trim().toLowerCase();
  const clave = ALIAS_MODULO[candidatoRaw] || candidatoRaw;
  return ATLAS_POR_MODULO[clave] ?? null;
}

export function formatearContextoAtlasParaTriaje(
  pathname?: string | null,
  modulo?: string | null
): string {
  const ficha = obtenerFichaModuloAtlas(pathname, modulo);
  if (!ficha) return "";

  return [
    `Mapa verificado de la pantalla «${ficha.titulo}»:`,
    `- Permisos y datos: ${ficha.tablasYPermisos.join(" ")}`,
    `- Comportamientos esperados / falsos bugs frecuentes (si encaja, es DUDA funcional con riesgo="cero", NO bug de código):`,
    ...ficha.falsosBugsComunes.map((f) => `  * ${f}`),
  ].join("\n");
}

export function formatearContextoAtlasParaAgente(
  pathname?: string | null,
  modulo?: string | null
): string {
  const ficha = obtenerFichaModuloAtlas(pathname, modulo);
  if (!ficha) {
    return "Consulta primero AGENTS.md y docs/SUPPORT-ATLAS.md para ir directo a los archivos del módulo sin explorar todo el repositorio.";
  }

  return [
    `ATALAYA DE CÓDIGO VERIFICADA PARA «${ficha.titulo}» (evita búsquedas globales innecesarias):`,
    `- Empieza leyendo directamente estos archivos clave:`,
    ...ficha.archivosClave.map((a) => `  * ${a}`),
    `- Tablas y seguridad implicadas:`,
    ...ficha.tablasYPermisos.map((t) => `  * ${t}`),
    `- Invariantes que NO debes romper:`,
    ...ficha.invariantesCriticas.map((i) => `  * ${i}`),
    `- Comando de test rápido específico de este módulo (ejecútalo primero antes de suites largas):`,
    `  ${ficha.comandoTestDirecto}`,
    `- Si necesitas contexto transversal de otros módulos, lee AGENTS.md o docs/SUPPORT-ATLAS.md.`,
  ].join("\n");
}
