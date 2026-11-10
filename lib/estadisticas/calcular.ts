export type PeriodoEstadisticas = "semana" | "mes" | "trimestre" | "anio" | "todo";

export type CategoriaRanking = "xp" | "captaciones" | "visitas" | "cierres" | "prospeccion";

export type MedallaPodio = "oro" | "plata" | "bronce";

export type InsigniaId =
  | "rey_exclusiva"
  | "iman_cartera"
  | "todo_terreno_visitas"
  | "closer"
  | "francotirador"
  | "racha_activa";

export type InsigniaDef = {
  id: InsigniaId;
  titulo: string;
  descripcion: string;
};

export const INSIGNIAS_CATALOGO: Record<InsigniaId, InsigniaDef> = {
  rey_exclusiva: {
    id: "rey_exclusiva",
    titulo: "Rey de la Exclusiva",
    descripcion: "Líder en hojas de encargo en exclusiva cerradas en el periodo.",
  },
  iman_cartera: {
    id: "iman_cartera",
    titulo: "Imán de Cartera",
    descripcion: "Mayor número de inmuebles captados para la cartera.",
  },
  todo_terreno_visitas: {
    id: "todo_terreno_visitas",
    titulo: "Todo Terreno",
    descripcion: "Líder en partes de visita firmados con clientes.",
  },
  closer: {
    id: "closer",
    titulo: "Closer",
    descripcion: "Líder en operaciones cerradas (ventas, alquileres y arras).",
  },
  francotirador: {
    id: "francotirador",
    titulo: "Francotirador",
    descripcion: "Mejor conversión de visitas a cierre comercial.",
  },
  racha_activa: {
    id: "racha_activa",
    titulo: "Racha Activa",
    descripcion: "Tareas al día y actividad constante de seguimiento.",
  },
};

export const PUNTOS_XP = {
  cierreOperacion: 100,
  reservaInmueble: 50,
  exclusivaCerrada: 40,
  inmuebleCaptado: 25,
  honorariosCerrados: 25,
  parteVisitaFirmado: 15,
  parteVisitaAbierto: 5,
  valoracionGenerada: 10,
  fincaTrabajada: 5,
  citaCompletada: 5,
  llamadaNota: 2,
  tareaCompletada: 2,
} as const;

export type UsuarioPerfilInput = {
  id: string;
  nombre: string;
  email: string | null;
  role: string;
  color: string;
  fotoUrl?: string | null;
};

export type PropiedadInput = {
  id: string;
  userId: string;
  comercialId: string | null;
  captadoPor: string | null;
  captadoConjunto: boolean;
  captadoresIds: string[];
  estado: string;
  tipoOperacion: string;
  precioVenta: number | null;
  precioAlquiler: number | null;
  publicado: boolean;
  publicarWeb: boolean;
  publicarIdealista: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ParteVisitaInput = {
  id: string;
  userId: string;
  comercialId: string | null;
  estado: string;
  fechaVisita: string | null;
  createdAt: string;
};

export type CitaInput = {
  id: string;
  comercialId: string;
  tipo: string;
  estado: string;
  empieza: string;
};

export type OperacionDocumentoInput = {
  id: string;
  userId: string;
  comercialId: string | null;
  propiedadId: string | null;
  estado: string;
  importe: number | null;
  fecha: string | null;
  createdAt: string;
};

export type HojaEncargoInput = {
  id: string;
  userId: string;
  comercialId: string | null;
  tipo: "exclusiva" | "honorarios";
  estado: string;
  precio: number | null;
  fecha: string | null;
  createdAt: string;
};

export type ProspeccionFincaInput = {
  fincaReference: string;
  comercialId: string;
  estado: string;
  conPropiedad: boolean;
  assignedAt: string;
  updatedAt: string | null;
};

export type EncargoCalleInput = {
  id: string;
  asignadoA: string;
  estado: string;
  fincaReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DemandaInput = {
  id: string;
  comercialId: string;
  estado: string;
  crucesCount: number;
  createdAt: string;
};

export type NotaClienteInput = {
  id: string;
  actorId: string | null;
  tipo: string;
  createdAt: string;
};

export type TareaInput = {
  id: string;
  comercialId: string;
  estado: string;
  vence: string | null;
  createdAt: string;
};

export type ValoracionInput = {
  id: string;
  actorId: string | null;
  createdAt: string;
};

export type EstadisticasRawInput = {
  usuarios: UsuarioPerfilInput[];
  propiedades: PropiedadInput[];
  partesVisita: ParteVisitaInput[];
  citas: CitaInput[];
  arras: OperacionDocumentoInput[];
  pagoAplazado: OperacionDocumentoInput[];
  arrendamientos: OperacionDocumentoInput[];
  hojasEncargo: HojaEncargoInput[];
  fincas: ProspeccionFincaInput[];
  encargosCalle: EncargoCalleInput[];
  demandas: DemandaInput[];
  notasClientes: NotaClienteInput[];
  tareas: TareaInput[];
  valoraciones: ValoracionInput[];
};

export type EstadisticaUsuario = {
  userId: string;
  nombre: string;
  email: string | null;
  role: string;
  color: string;
  fotoUrl: string | null;
  puntosXp: number;
  desgloseXp: {
    captacion: number;
    visitas: number;
    cierres: number;
    prospeccion: number;
    seguimiento: number;
  };
  captaciones: {
    total: number;
    individuales: number;
    compartidas: number;
    puntosPonderados: number;
    exclusivasCerradas: number;
    honorariosCerrados: number;
    carteraActiva: number;
    publicadasPortales: number;
    valorCarteraEur: number;
  };
  prospeccion: {
    fincasAsignadas: number;
    fincasTrabajadas: number;
    fincasConvertidas: number;
    conversionFincaPct: number;
    encargosCalle: number;
    encargosTrabajados: number;
    valoracionesAvm: number;
  };
  visitas: {
    partesTotales: number;
    partesFirmados: number;
    ratioFirmaPct: number;
    citasRealizadas: number;
  };
  cierres: {
    propiedadesVendidas: number;
    propiedadesAlquiladas: number;
    propiedadesReservadas: number;
    arrasCerradas: number;
    contratosCerrados: number;
    totalOperacionesCerradas: number;
    volumenCerradoEur: number;
    visitasPorCierre: number | null;
    conversionVisitaACierrePct: number;
  };
  actividad: {
    demandasActivas: number;
    crucesGenerados: number;
    llamadasRegistradas: number;
    notasRegistradas: number;
    tareasCompletadas: number;
    tareasPendientes: number;
    tareasVencidas: number;
  };
  insignias: InsigniaDef[];
};

export type ItemPodio = {
  puesto: 1 | 2 | 3;
  medalla: MedallaPodio;
  userId: string;
  nombre: string;
  color: string;
  fotoUrl: string | null;
  valorPrincipal: number;
  etiquetaValor: string;
  puntosXp: number;
  subtitulo: string;
  insignias: InsigniaDef[];
};

export type ResumenEquipoEstadisticas = {
  totalPuntosXp: number;
  captacionesTotales: number;
  exclusivasTotales: number;
  visitasTotales: number;
  visitasFirmadas: number;
  operacionesCerradas: number;
  reservasActivas: number;
  volumenIntermediadoEur: number;
  valorCarteraActivaEur: number;
  fincasTrabajadas: number;
  demandasActivas: number;
  llamadasYNotas: number;
  valoracionesTotales: number;
  conversionGlobalVisitasPct: number;
};

export type ResultadoEstadisticas = {
  periodo: PeriodoEstadisticas;
  desde: string | null;
  hasta: string;
  resumen: ResumenEquipoEstadisticas;
  usuarios: EstadisticaUsuario[];
  podios: Record<CategoriaRanking, ItemPodio[]>;
};

export function rangoFechasPeriodo(
  periodo: PeriodoEstadisticas,
  ahora: Date = new Date()
): { desde: string | null; hasta: string } {
  const hoyIso = ahora.toISOString().slice(0, 10);
  if (periodo === "todo") {
    return { desde: null, hasta: hoyIso };
  }
  if (periodo === "semana") {
    const copia = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
    const diaSemana = copia.getUTCDay(); // 0 domingo, 1 lunes...
    const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
    copia.setUTCDate(copia.getUTCDate() + diffLunes);
    return { desde: copia.toISOString().slice(0, 10), hasta: hoyIso };
  }
  if (periodo === "mes") {
    const inicioMes = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), 1));
    return { desde: inicioMes.toISOString().slice(0, 10), hasta: hoyIso };
  }
  if (periodo === "trimestre") {
    const mesInicioTrimestre = Math.floor(ahora.getMonth() / 3) * 3;
    const inicioTrim = new Date(Date.UTC(ahora.getFullYear(), mesInicioTrimestre, 1));
    return { desde: inicioTrim.toISOString().slice(0, 10), hasta: hoyIso };
  }
  const inicioAnio = new Date(Date.UTC(ahora.getFullYear(), 0, 1));
  return { desde: inicioAnio.toISOString().slice(0, 10), hasta: hoyIso };
}

export function enRangoFecha(
  fechaIso: string | null | undefined,
  desde: string | null,
  hasta: string
): boolean {
  if (!fechaIso) return false;
  const dia = fechaIso.slice(0, 10);
  if (dia.length < 10) return false;
  if (desde && dia < desde) return false;
  if (hasta && dia > hasta) return false;
  return true;
}

function crearEstadisticaVacia(u: UsuarioPerfilInput): EstadisticaUsuario {
  return {
    userId: u.id,
    nombre: u.nombre,
    email: u.email,
    role: u.role,
    color: u.color || "#111111",
    fotoUrl: u.fotoUrl ?? null,
    puntosXp: 0,
    desgloseXp: {
      captacion: 0,
      visitas: 0,
      cierres: 0,
      prospeccion: 0,
      seguimiento: 0,
    },
    captaciones: {
      total: 0,
      individuales: 0,
      compartidas: 0,
      puntosPonderados: 0,
      exclusivasCerradas: 0,
      honorariosCerrados: 0,
      carteraActiva: 0,
      publicadasPortales: 0,
      valorCarteraEur: 0,
    },
    prospeccion: {
      fincasAsignadas: 0,
      fincasTrabajadas: 0,
      fincasConvertidas: 0,
      conversionFincaPct: 0,
      encargosCalle: 0,
      encargosTrabajados: 0,
      valoracionesAvm: 0,
    },
    visitas: {
      partesTotales: 0,
      partesFirmados: 0,
      ratioFirmaPct: 0,
      citasRealizadas: 0,
    },
    cierres: {
      propiedadesVendidas: 0,
      propiedadesAlquiladas: 0,
      propiedadesReservadas: 0,
      arrasCerradas: 0,
      contratosCerrados: 0,
      totalOperacionesCerradas: 0,
      volumenCerradoEur: 0,
      visitasPorCierre: null,
      conversionVisitaACierrePct: 0,
    },
    actividad: {
      demandasActivas: 0,
      crucesGenerados: 0,
      llamadasRegistradas: 0,
      notasRegistradas: 0,
      tareasCompletadas: 0,
      tareasPendientes: 0,
      tareasVencidas: 0,
    },
    insignias: [],
  };
}

function captadoresDePropiedad(prop: PropiedadInput): string[] {
  if (prop.captadoresIds.length > 0) {
    return [...new Set(prop.captadoresIds)];
  }
  const idDirecto = prop.captadoPor ?? prop.comercialId ?? prop.userId;
  return idDirecto ? [idDirecto] : [];
}

function valorEconomicoPropiedad(prop: PropiedadInput): number {
  if (prop.tipoOperacion === "alquiler") {
    return Number(prop.precioAlquiler ?? 0);
  }
  return Number(prop.precioVenta ?? prop.precioAlquiler ?? 0);
}

export function calcularEstadisticasEquipo(
  raw: EstadisticasRawInput,
  opciones: { periodo: PeriodoEstadisticas; ahora?: Date }
): ResultadoEstadisticas {
  const ahora = opciones.ahora ?? new Date();
  const { desde, hasta } = rangoFechasPeriodo(opciones.periodo, ahora);
  const hoyIso = ahora.toISOString().slice(0, 10);

  const mapa = new Map<string, EstadisticaUsuario>();
  for (const u of raw.usuarios) {
    mapa.set(u.id, crearEstadisticaVacia(u));
  }

  const obtenerUsuario = (id: string | null | undefined): EstadisticaUsuario | null => {
    if (!id) return null;
    return mapa.get(id) ?? null;
  };

  let captacionesPeriodoUnicas = 0;
  let valorCarteraActivaGlobal = 0;

  // 1. Propiedades (Captaciones, Cartera y Cierres en ficha de inmueble)
  const propiedadesCerradasContabilizadas = new Set<string>();

  for (const prop of raw.propiedades) {
    const captadores = captadoresDePropiedad(prop);
    const esCompartida = captadores.length > 1 || prop.captadoConjunto;
    const peso = captadores.length > 1 ? Number((1 / captadores.length).toFixed(2)) : 1;
    const creadaEnPeriodo = enRangoFecha(prop.createdAt, desde, hasta);
    const actualizadaEnPeriodo = enRangoFecha(prop.updatedAt || prop.createdAt, desde, hasta);
    const valorEur = valorEconomicoPropiedad(prop);

    if (creadaEnPeriodo && captadores.some((id) => mapa.has(id))) {
      captacionesPeriodoUnicas += 1;
    }

    if (prop.estado === "disponible") {
      valorCarteraActivaGlobal += valorEur;
    }

    for (const capId of captadores) {
      const stat = obtenerUsuario(capId);
      if (!stat) continue;

      if (prop.estado === "disponible") {
        stat.captaciones.carteraActiva += 1;
        stat.captaciones.valorCarteraEur += Math.round(valorEur * peso);
        if (prop.publicado || prop.publicarWeb || prop.publicarIdealista) {
          stat.captaciones.publicadasPortales += 1;
        }
      }

      if (creadaEnPeriodo) {
        stat.captaciones.total += 1;
        if (esCompartida) {
          stat.captaciones.compartidas += 1;
        } else {
          stat.captaciones.individuales += 1;
        }
        stat.captaciones.puntosPonderados = Number(
          (stat.captaciones.puntosPonderados + peso).toFixed(2)
        );
      }
    }

    // Responsable comercial de cierre/reserva de la propiedad
    const responsableCierreId = prop.comercialId ?? prop.captadoPor ?? captadores[0] ?? prop.userId;
    const statResp = obtenerUsuario(responsableCierreId);
    if (statResp && actualizadaEnPeriodo) {
      if (prop.estado === "vendida") {
        statResp.cierres.propiedadesVendidas += 1;
        statResp.cierres.volumenCerradoEur += valorEur;
        propiedadesCerradasContabilizadas.add(prop.id);
      } else if (prop.estado === "alquilada") {
        statResp.cierres.propiedadesAlquiladas += 1;
        statResp.cierres.volumenCerradoEur += valorEur;
        propiedadesCerradasContabilizadas.add(prop.id);
      } else if (prop.estado === "reservada") {
        statResp.cierres.propiedadesReservadas += 1;
      }
    }
  }

  // 2. Hojas de encargo (Exclusiva y Honorarios)
  for (const hoja of raw.hojasEncargo) {
    const fechaRef = hoja.fecha || hoja.createdAt;
    if (!enRangoFecha(fechaRef, desde, hasta)) continue;
    if (hoja.estado !== "cerrado") continue;
    const stat = obtenerUsuario(hoja.comercialId ?? hoja.userId);
    if (!stat) continue;
    if (hoja.tipo === "exclusiva") {
      stat.captaciones.exclusivasCerradas += 1;
    } else {
      stat.captaciones.honorariosCerrados += 1;
    }
  }

  // 3. Partes de visita
  for (const parte of raw.partesVisita) {
    const fechaRef = parte.fechaVisita || parte.createdAt;
    if (!enRangoFecha(fechaRef, desde, hasta)) continue;
    const stat = obtenerUsuario(parte.comercialId ?? parte.userId);
    if (!stat) continue;
    stat.visitas.partesTotales += 1;
    if (parte.estado === "firmado") {
      stat.visitas.partesFirmados += 1;
    }
  }

  // 4. Citas de agenda
  for (const cita of raw.citas) {
    if (!enRangoFecha(cita.empieza, desde, hasta)) continue;
    if (cita.estado === "anulada" || cita.estado === "cancelada") continue;
    const stat = obtenerUsuario(cita.comercialId);
    if (!stat) continue;
    stat.visitas.citasRealizadas += 1;
  }

  // 5. Contratos de Arras, Pago Aplazado y Arrendamiento
  for (const arras of raw.arras) {
    const fechaRef = arras.fecha || arras.createdAt;
    if (!enRangoFecha(fechaRef, desde, hasta)) continue;
    if (arras.estado !== "cerrado") continue;
    const stat = obtenerUsuario(arras.comercialId ?? arras.userId);
    if (!stat) continue;
    stat.cierres.arrasCerradas += 1;
    if (!arras.propiedadId || !propiedadesCerradasContabilizadas.has(arras.propiedadId)) {
      stat.cierres.volumenCerradoEur += Number(arras.importe ?? 0);
      if (arras.propiedadId) propiedadesCerradasContabilizadas.add(arras.propiedadId);
    }
  }

  for (const doc of [...raw.pagoAplazado, ...raw.arrendamientos]) {
    const fechaRef = doc.fecha || doc.createdAt;
    if (!enRangoFecha(fechaRef, desde, hasta)) continue;
    if (doc.estado !== "cerrado") continue;
    const stat = obtenerUsuario(doc.comercialId ?? doc.userId);
    if (!stat) continue;
    stat.cierres.contratosCerrados += 1;
    if (!doc.propiedadId || !propiedadesCerradasContabilizadas.has(doc.propiedadId)) {
      stat.cierres.volumenCerradoEur += Number(doc.importe ?? 0);
      if (doc.propiedadId) propiedadesCerradasContabilizadas.add(doc.propiedadId);
    }
  }

  // 6. Prospección: Fincas de Catastro y Encargos de Calle y Valoraciones AVM
  for (const finca of raw.fincas) {
    const fechaRef = finca.updatedAt || finca.assignedAt;
    if (!enRangoFecha(fechaRef, desde, hasta)) continue;
    const stat = obtenerUsuario(finca.comercialId);
    if (!stat) continue;
    stat.prospeccion.fincasAsignadas += 1;
    if (finca.estado && finca.estado !== "nueva") {
      stat.prospeccion.fincasTrabajadas += 1;
    }
    if (finca.conPropiedad) {
      stat.prospeccion.fincasConvertidas += 1;
    }
  }

  for (const encargo of raw.encargosCalle) {
    const fechaRef = encargo.updatedAt || encargo.createdAt;
    if (!enRangoFecha(fechaRef, desde, hasta)) continue;
    const stat = obtenerUsuario(encargo.asignadoA);
    if (!stat) continue;
    stat.prospeccion.encargosCalle += 1;
    if (encargo.estado && encargo.estado !== "nuevo" && encargo.estado !== "pendiente") {
      stat.prospeccion.encargosTrabajados += 1;
    }
  }

  for (const val of raw.valoraciones) {
    if (!enRangoFecha(val.createdAt, desde, hasta)) continue;
    const stat = obtenerUsuario(val.actorId);
    if (!stat) continue;
    stat.prospeccion.valoracionesAvm += 1;
  }

  // 7. Demandas, Notas/Llamadas de Clientes y Tareas
  for (const dem of raw.demandas) {
    const stat = obtenerUsuario(dem.comercialId);
    if (!stat) continue;
    if (dem.estado === "activa") {
      stat.actividad.demandasActivas += 1;
    }
    if (enRangoFecha(dem.createdAt, desde, hasta)) {
      stat.actividad.crucesGenerados += dem.crucesCount;
    }
  }

  for (const nota of raw.notasClientes) {
    if (!enRangoFecha(nota.createdAt, desde, hasta)) continue;
    const stat = obtenerUsuario(nota.actorId);
    if (!stat) continue;
    if (nota.tipo === "llamada") {
      stat.actividad.llamadasRegistradas += 1;
    } else {
      stat.actividad.notasRegistradas += 1;
    }
  }

  for (const tarea of raw.tareas) {
    const stat = obtenerUsuario(tarea.comercialId);
    if (!stat) continue;
    const completada = tarea.estado === "hecha" || tarea.estado === "completada";
    if (completada) {
      if (enRangoFecha(tarea.vence || tarea.createdAt, desde, hasta)) {
        stat.actividad.tareasCompletadas += 1;
      }
    } else {
      stat.actividad.tareasPendientes += 1;
      if (tarea.vence && tarea.vence.slice(0, 10) < hoyIso) {
        stat.actividad.tareasVencidas += 1;
      }
    }
  }

  // 8. Calcular derivados, ratios y Puntos XP por usuario
  for (const stat of mapa.values()) {
    // Ratio firma visitas
    stat.visitas.ratioFirmaPct =
      stat.visitas.partesTotales === 0
        ? 0
        : Math.round((stat.visitas.partesFirmados / stat.visitas.partesTotales) * 100);

    // Ratio conversión fincas
    stat.prospeccion.conversionFincaPct =
      stat.prospeccion.fincasAsignadas === 0
        ? 0
        : Math.round((stat.prospeccion.fincasConvertidas / stat.prospeccion.fincasAsignadas) * 100);

    // Total operaciones cerradas
    stat.cierres.totalOperacionesCerradas =
      stat.cierres.propiedadesVendidas +
      stat.cierres.propiedadesAlquiladas +
      stat.cierres.arrasCerradas +
      stat.cierres.contratosCerrados;

    const baseVisitas = Math.max(stat.visitas.partesTotales, stat.visitas.citasRealizadas);
    if (stat.cierres.totalOperacionesCerradas > 0 && baseVisitas > 0) {
      stat.cierres.visitasPorCierre = Number(
        (baseVisitas / stat.cierres.totalOperacionesCerradas).toFixed(1)
      );
      stat.cierres.conversionVisitaACierrePct = Math.min(
        100,
        Math.round((stat.cierres.totalOperacionesCerradas / baseVisitas) * 100)
      );
    } else {
      stat.cierres.visitasPorCierre = null;
      stat.cierres.conversionVisitaACierrePct = 0;
    }

    // Cálculo XP
    const xpCaptacion = Math.round(
      stat.captaciones.puntosPonderados * PUNTOS_XP.inmuebleCaptado +
        stat.captaciones.exclusivasCerradas * PUNTOS_XP.exclusivaCerrada +
        stat.captaciones.honorariosCerrados * PUNTOS_XP.honorariosCerrados
    );

    const partesAbiertos = Math.max(0, stat.visitas.partesTotales - stat.visitas.partesFirmados);
    const xpVisitas =
      stat.visitas.partesFirmados * PUNTOS_XP.parteVisitaFirmado +
      partesAbiertos * PUNTOS_XP.parteVisitaAbierto +
      stat.visitas.citasRealizadas * PUNTOS_XP.citaCompletada;

    const xpCierres =
      stat.cierres.totalOperacionesCerradas * PUNTOS_XP.cierreOperacion +
      stat.cierres.propiedadesReservadas * PUNTOS_XP.reservaInmueble;

    const xpProspeccion =
      (stat.prospeccion.fincasTrabajadas + stat.prospeccion.encargosTrabajados) *
        PUNTOS_XP.fincaTrabajada +
      stat.prospeccion.valoracionesAvm * PUNTOS_XP.valoracionGenerada;

    const xpSeguimiento =
      (stat.actividad.llamadasRegistradas + stat.actividad.notasRegistradas) *
        PUNTOS_XP.llamadaNota +
      stat.actividad.tareasCompletadas * PUNTOS_XP.tareaCompletada;

    stat.desgloseXp = {
      captacion: xpCaptacion,
      visitas: xpVisitas,
      cierres: xpCierres,
      prospeccion: xpProspeccion,
      seguimiento: xpSeguimiento,
    };

    stat.puntosXp = xpCaptacion + xpVisitas + xpCierres + xpProspeccion + xpSeguimiento;
  }

  const listaUsuarios = [...mapa.values()];

  // 9. Asignación de Insignias (Badges)
  asignarInsignias(listaUsuarios);

  // Ordenar por puntos XP descendente (y empate por cierres, luego captaciones, luego nombre)
  listaUsuarios.sort((a, b) => {
    if (b.puntosXp !== a.puntosXp) return b.puntosXp - a.puntosXp;
    if (b.cierres.totalOperacionesCerradas !== a.cierres.totalOperacionesCerradas) {
      return b.cierres.totalOperacionesCerradas - a.cierres.totalOperacionesCerradas;
    }
    if (b.captaciones.total !== a.captaciones.total) {
      return b.captaciones.total - a.captaciones.total;
    }
    return a.nombre.localeCompare(b.nombre, "es");
  });

  // 10. Construir Podios (Oro, Plata, Bronce) por categoría
  const podios: Record<CategoriaRanking, ItemPodio[]> = {
    xp: construirPodio(listaUsuarios, "xp"),
    captaciones: construirPodio(listaUsuarios, "captaciones"),
    visitas: construirPodio(listaUsuarios, "visitas"),
    cierres: construirPodio(listaUsuarios, "cierres"),
    prospeccion: construirPodio(listaUsuarios, "prospeccion"),
  };

  // 11. Resumen global del equipo
  const visitasTotales = listaUsuarios.reduce((acc, u) => acc + u.visitas.partesTotales, 0);
  const visitasFirmadas = listaUsuarios.reduce((acc, u) => acc + u.visitas.partesFirmados, 0);
  const operacionesCerradas = listaUsuarios.reduce(
    (acc, u) => acc + u.cierres.totalOperacionesCerradas,
    0
  );

  const resumen: ResumenEquipoEstadisticas = {
    totalPuntosXp: listaUsuarios.reduce((acc, u) => acc + u.puntosXp, 0),
    captacionesTotales: captacionesPeriodoUnicas,
    exclusivasTotales: listaUsuarios.reduce((acc, u) => acc + u.captaciones.exclusivasCerradas, 0),
    visitasTotales,
    visitasFirmadas,
    operacionesCerradas,
    reservasActivas: listaUsuarios.reduce((acc, u) => acc + u.cierres.propiedadesReservadas, 0),
    volumenIntermediadoEur: listaUsuarios.reduce((acc, u) => acc + u.cierres.volumenCerradoEur, 0),
    valorCarteraActivaEur: valorCarteraActivaGlobal,
    fincasTrabajadas: listaUsuarios.reduce(
      (acc, u) => acc + u.prospeccion.fincasTrabajadas + u.prospeccion.encargosTrabajados,
      0
    ),
    demandasActivas: listaUsuarios.reduce((acc, u) => acc + u.actividad.demandasActivas, 0),
    llamadasYNotas: listaUsuarios.reduce(
      (acc, u) => acc + u.actividad.llamadasRegistradas + u.actividad.notasRegistradas,
      0
    ),
    valoracionesTotales: listaUsuarios.reduce((acc, u) => acc + u.prospeccion.valoracionesAvm, 0),
    conversionGlobalVisitasPct:
      visitasTotales === 0 ? 0 : Math.min(100, Math.round((operacionesCerradas / visitasTotales) * 100)),
  };

  return {
    periodo: opciones.periodo,
    desde,
    hasta,
    resumen,
    usuarios: listaUsuarios,
    podios,
  };
}

function asignarInsignias(usuarios: EstadisticaUsuario[]): void {
  if (usuarios.length === 0) return;

  const maxExclusivas = Math.max(...usuarios.map((u) => u.captaciones.exclusivasCerradas));
  const maxCaptaciones = Math.max(...usuarios.map((u) => u.captaciones.puntosPonderados));
  const maxVisitasFirmadas = Math.max(...usuarios.map((u) => u.visitas.partesFirmados));
  const maxCierres = Math.max(...usuarios.map((u) => u.cierres.totalOperacionesCerradas));
  const maxConversion = Math.max(
    ...usuarios
      .filter((u) => u.cierres.totalOperacionesCerradas > 0)
      .map((u) => u.cierres.conversionVisitaACierrePct),
    0
  );

  for (const u of usuarios) {
    const insignias: InsigniaDef[] = [];

    if (maxExclusivas > 0 && u.captaciones.exclusivasCerradas === maxExclusivas) {
      insignias.push(INSIGNIAS_CATALOGO.rey_exclusiva);
    }
    if (maxCaptaciones > 0 && u.captaciones.puntosPonderados === maxCaptaciones) {
      insignias.push(INSIGNIAS_CATALOGO.iman_cartera);
    }
    if (maxVisitasFirmadas > 0 && u.visitas.partesFirmados === maxVisitasFirmadas) {
      insignias.push(INSIGNIAS_CATALOGO.todo_terreno_visitas);
    }
    if (maxCierres > 0 && u.cierres.totalOperacionesCerradas === maxCierres) {
      insignias.push(INSIGNIAS_CATALOGO.closer);
    }
    if (
      maxConversion > 0 &&
      u.cierres.totalOperacionesCerradas > 0 &&
      u.cierres.conversionVisitaACierrePct === maxConversion
    ) {
      insignias.push(INSIGNIAS_CATALOGO.francotirador);
    }
    if (
      u.actividad.tareasVencidas === 0 &&
      u.actividad.tareasCompletadas +
        u.actividad.llamadasRegistradas +
        u.actividad.notasRegistradas >=
        3
    ) {
      insignias.push(INSIGNIAS_CATALOGO.racha_activa);
    }

    u.insignias = insignias;
  }
}

export function valorCategoriaUsuario(
  u: EstadisticaUsuario,
  categoria: CategoriaRanking
): { valor: number; etiqueta: string; subtitulo: string } {
  switch (categoria) {
    case "captaciones": {
      const total = u.captaciones.total + u.captaciones.exclusivasCerradas;
      return {
        valor: total,
        etiqueta: `${u.captaciones.total} capt. · ${u.captaciones.exclusivasCerradas} excl.`,
        subtitulo: `${u.captaciones.carteraActiva} en cartera activa`,
      };
    }
    case "visitas": {
      const total = u.visitas.partesFirmados + u.visitas.citasRealizadas;
      return {
        valor: total,
        etiqueta: `${u.visitas.partesFirmados} partes firmados`,
        subtitulo: `${u.visitas.partesTotales} partes · ${u.visitas.citasRealizadas} citas`,
      };
    }
    case "cierres": {
      const total = u.cierres.totalOperacionesCerradas;
      return {
        valor: total,
        etiqueta: `${total} ${total === 1 ? "cierre" : "cierres"}`,
        subtitulo: `${u.cierres.propiedadesReservadas} reservas · ${formatoEurosCorto(u.cierres.volumenCerradoEur)}`,
      };
    }
    case "prospeccion": {
      const total =
        u.prospeccion.fincasTrabajadas +
        u.prospeccion.encargosTrabajados +
        u.prospeccion.valoracionesAvm +
        u.actividad.llamadasRegistradas;
      return {
        valor: total,
        etiqueta: `${total} acciones`,
        subtitulo: `${u.prospeccion.fincasTrabajadas} fincas · ${u.prospeccion.valoracionesAvm} val. · ${u.actividad.llamadasRegistradas} llam.`,
      };
    }
    case "xp":
    default:
      return {
        valor: u.puntosXp,
        etiqueta: `${u.puntosXp.toLocaleString("es-ES")} XP`,
        subtitulo: `${u.captaciones.total} capt. · ${u.visitas.partesFirmados} vis. · ${u.cierres.totalOperacionesCerradas} cierres`,
      };
  }
}

function construirPodio(
  usuarios: EstadisticaUsuario[],
  categoria: CategoriaRanking
): ItemPodio[] {
  const medallas: MedallaPodio[] = ["oro", "plata", "bronce"];
  const ordenados = [...usuarios].sort((a, b) => {
    const va = valorCategoriaUsuario(a, categoria).valor;
    const vb = valorCategoriaUsuario(b, categoria).valor;
    if (vb !== va) return vb - va;
    if (b.puntosXp !== a.puntosXp) return b.puntosXp - a.puntosXp;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  return ordenados.slice(0, 3).map((u, idx) => {
    const info = valorCategoriaUsuario(u, categoria);
    const puesto = (idx + 1) as 1 | 2 | 3;
    return {
      puesto,
      medalla: medallas[idx] ?? "bronce",
      userId: u.userId,
      nombre: u.nombre,
      color: u.color,
      fotoUrl: u.fotoUrl,
      valorPrincipal: info.valor,
      etiquetaValor: info.etiqueta,
      puntosXp: u.puntosXp,
      subtitulo: info.subtitulo,
      insignias: u.insignias,
    };
  });
}

export function formatoEurosCorto(valor: number): string {
  if (!valor || valor <= 0) return "0 €";
  if (valor >= 1_000_000) {
    return `${(valor / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 2 })} M€`;
  }
  if (valor >= 10_000) {
    return `${Math.round(valor / 1_000).toLocaleString("es-ES")} mil €`;
  }
  return valor.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}
