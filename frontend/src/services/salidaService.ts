import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { solicitarApi, ErrorApi } from "./clienteApi";

// ==========================================
// Tipos TypeScript: Backend real (SalidaApi)
// ==========================================

export type CircuitoSalidaApi = {
    idcircuito: number;
    nombreCircuito: string;
    duracionDias: number;
    _count: {
        etapas: number;
    };
};

export type PaqueteSalidaApi = {
    nroPaquete: string;
    nombrePaquete: string;
    circuito: CircuitoSalidaApi;
};

export type PersonalAsignadoSalidaApi = {
    idsalida: number;
    idpersonal: number;
    personal: {
        nombreCompleto: string;
        rol: string;
    };
};

export type ServicioSalidaApi = {
    idsalida: number;
    idservicio: number;
    tipo: string;
    comprobanteReserva: string | null;
    servicio: {
        nombreServicio: string;
    };
};

export type AlertaSalida = "SOLICITUD_PENDIENTE" | "PERMISOS_SIN_CONFIRMAR" | string;

/**
 * Estructura real de una salida devuelta por GET /api/salidas en el backend.
 * Refleja los campos escalares de Salida más los includes de paquete (con circuito),
 * personal asignado, servicios y los nuevos cálculos de RF-50 y RF-61.
 */
export type SalidaApi = {
    idsalida: number;
    idpaquete: number;
    nroSalida: string;
    idbloqueo: string | null;
    stockLocal: number;
    stockLocalAlojamiento: number | null;
    tamanoMaximo: number;
    fechaInicio: string;
    fechaFin: string;
    estado: string;
    lugaresPorLiberar: number;
    ultimaEtapaAlcanzada: number | null;
    paquete: PaqueteSalidaApi;
    personalAsignado: PersonalAsignadoSalidaApi[];
    servicios: ServicioSalidaApi[];
    // Campos incorporados por RF-50 y RF-61:
    pasajerosConfirmados: number;
    cantidadPersonal: number;
    guias: string[];
    permisosFaltantes: number;
    etapaEsperada: number | null;
    etapaInformada: number | null;
    etapaDesfasada: boolean;
    alertas: AlertaSalida[];
};

// ==========================================
// Tipos TypeScript: Entidad normalizada (Salida)
// ==========================================

/**
 * Representación normalizada para la interfaz (compatible con Tabla, que requiere id).
 */
export type Salida = SalidaApi & {
    id: number;
};

// ==========================================
// Tipos TypeScript: Filtros
// ==========================================

/**
 * Filtros admitidos por GET /api/salidas (ConsultarSalidasDto en backend).
 */
export type FiltrosSalidas = {
    idpaquete?: number;
    estado?: string;
    desde?: string;
    hasta?: string;
    idguia?: number;
    idcircuito?: number;
};

type RespuestaSalidasApi = {
    data: SalidaApi[];
};

// ==========================================
// Tipos TypeScript: CU-36 Crear Salida
// ==========================================

export type DotacionOpciones = {
    guias: number;
    porteadores: number;
};

export type CupoAutoridadOpciones = {
    lugaresDisponibles: number;
    alcanza: boolean;
};

export type AlojamientoOpcion = {
    idservicio: number;
    nombreServicio: string;
    localidad: string;
    categoria?: string | null;
    capacidadDisponible?: number | null;
    alcanza: boolean;
};

export type OpcionesSalidaDto = {
    paquete: {
        idpaquete: number;
        nombrePaquete: string;
    };
    tamanoMaximo: number;
    dotacion: DotacionOpciones;
    totalLugares: number;
    cupoAutoridad: CupoAutoridadOpciones | null;
    alojamientos: AlojamientoOpcion[];
};

export type ParametrosConsultaOpciones = {
    idpaquete: number;
    fechaInicio: string; // "YYYY-MM-DD"
    tamanoMaximo: number;
};

export type DatosCrearSalida = {
    idpaquete: number;
    fechaInicio: string; // "YYYY-MM-DD"
    tamanoMaximo: number;
    idalojamiento?: number;
};

type RespuestaOpcionesSalidaApi = {
    data: OpcionesSalidaDto;
};

type RespuestaCrearSalidaApi = {
    mensaje: string;
    data: {
        salida: SalidaApi;
        dotacion: DotacionOpciones;
        totalLugares: number;
    };
};

export type ResultadoCrearSalida = {
    salida: Salida;
    dotacion: DotacionOpciones;
    totalLugares: number;
    mensaje: string;
    numeroSalida?: string;
};

// ==========================================
// Tipos TypeScript: CU-40 Asignar Recursos
// ==========================================

export type SalidaAsignacionInfo = {
    idsalida: number;
    nroSalida: string;
    fechaInicio: string;
    fechaFin: string;
};

export type DotacionRequerida = {
    guias: number;
    porteadores: number;
};

export type PersonalDisponibleItem = {
    idpersonal: number;
    nombreCompleto: string;
    rol: string;
};

export type TransporteDisponibleItem = {
    idservicio: number;
    nombreServicio: string;
    capacidadVehiculo?: number;
};

export type ItemStockCamping = {
    idservicio: number;
    nombreServicio: string;
    tipoEquipamiento?: string;
    cantidadDisponible?: number;
};

export type DatosPanelAsignacion = {
    salida: SalidaAsignacionInfo;
    pasajerosConfirmados: number;
    dotacionRequerida: DotacionRequerida;
    bloqueoInicial: number;
    lugaresSobrantes: number;
    personalDisponible: PersonalDisponibleItem[];
    transportesDisponibles: TransporteDisponibleItem[];
    stockCamping: ItemStockCamping[];
};

type RespuestaPanelAsignacionApi = {
    data: DatosPanelAsignacion;
};

export type ItemCampingSeleccionado = {
    idservicio: number;
    cantidad: number;
};

export type PayloadConfirmarAsignacion = {
    personalIds: number[];
    idtransporte: number;
    itemsCamping: ItemCampingSeleccionado[];
};

export type ParametrosConfirmarAsignacion = {
    idsalida: number;
    datos: PayloadConfirmarAsignacion;
};

/** Titular que se quedó sin permiso: lo rechazó la autoridad o tiene el pasaporte vencido (RF-47). */
export type PermisoRechazadoAsignacion = {
    tipo: "PASAJERO" | "PERSONAL";
    id: number;
    nombreCompleto: string;
    motivo: string;
};

export type DatosResultadoConfirmarAsignacion = {
    salida: SalidaApi;
    permisosEmitidos: number;
    rechazados: PermisoRechazadoAsignacion[];
    lugaresLiberados: number;
    advertencia?: string;
};

type RespuestaConfirmarAsignacionApi = {
    mensaje: string;
    data: DatosResultadoConfirmarAsignacion;
};

export type ResultadoConfirmarAsignacion = {
    salida: Salida;
    permisosEmitidos: number;
    rechazados: PermisoRechazadoAsignacion[];
    lugaresLiberados: number;
    mensaje: string;
    advertencia?: string;
};

export type ResultadoLiberarSobrantes = {
    lugaresLiberados: number;
};

type RespuestaLiberarSobrantesApi = {
    data: ResultadoLiberarSobrantes;
};

// ==========================================
// Tipos TypeScript: CU-38 Reemplazar Personal
// ==========================================

export type PersonalSalidaItem = {
    idpersonal: number;
    nombreCompleto: string;
    rol: string;
    permiso: string | null;
};

export type ServicioSalidaItem = {
    tipo: string;
    nombreServicio: string;
};

export type EquipamientoSalidaItem = {
    nombreServicio: string;
    cantidad: number;
};

export type SalidaPersonalCabecera = {
    idsalida: number;
    nroSalida: string;
    fechaInicio: string;
    fechaFin: string;
    estado: string;
};

export type DatosPersonalSalida = {
    salida: SalidaPersonalCabecera;
    personal: PersonalSalidaItem[];
    servicios: ServicioSalidaItem[];
    equipamiento: EquipamientoSalidaItem[];
};

type RespuestaPersonalSalidaApi = {
    data: DatosPersonalSalida;
};

export type ReemplazanteDisponible = {
    idpersonal: number;
    nombreCompleto: string;
    rol: string;
};

type RespuestaReemplazantesApi = {
    data: ReemplazanteDisponible[];
};

export type PayloadConfirmarReemplazo = {
    idoriginal: number;
    idreemplazante: number;
    motivo: string;
};

export type ParametrosConfirmarReemplazo = {
    idsalida: number;
    datos: PayloadConfirmarReemplazo;
};

export type PersonaInvolucradaReemplazo = {
    idpersonal: number;
    nombreCompleto: string;
};

export type DatosResultadoReemplazo = {
    sale: PersonaInvolucradaReemplazo;
    entra: PersonaInvolucradaReemplazo;
    permisoDadoDeBaja: string | null;
    permisoNuevo: string | null;
};

type RespuestaConfirmarReemplazoApi = {
    mensaje: string;
    data: DatosResultadoReemplazo;
};

export type ResultadoConfirmarReemplazo = DatosResultadoReemplazo & {
    mensaje: string;
};

// ==========================================
// Tipos TypeScript: CU-39 Modificar Logística
// ==========================================

export type ProveedorLogistica = {
    idproveedor: number;
    razonSocial: string;
};

export type EquipamientoLogisticaItem = {
    idservicio: number;
    nombreServicio: string;
    tipoEquipamiento: string | null;
    cantidad: number;
    proveedor: ProveedorLogistica;
};

export type TransporteLogisticaItem = {
    idservicio: number;
    nombreServicio: string;
    comprobanteReserva: string | null;
    proveedor: ProveedorLogistica;
};

export type PanelLogistica = {
    idsalida: number;
    nroSalida: string;
    estado: string;
    fechaInicio: string;
    fechaFin: string;
    equipamiento: EquipamientoLogisticaItem[];
    transporte: TransporteLogisticaItem | null;
    requerimientosSinAsignar: string[];
};

type RespuestaPanelLogisticaApi = {
    data: PanelLogistica;
};

export type RecursoDisponibleEquipamiento = {
    idservicio: number;
    nombreServicio: string;
    localidad: string;
    costoBase: number;
    proveedor: ProveedorLogistica;
    disponibilidad: {
        tipoEquipamiento: string | null;
        cantidadDisponible: number;
    };
};

export type RecursoDisponibleTransporte = {
    idservicio: number;
    nombreServicio: string;
    localidad: string;
    costoBase: number;
    proveedor: ProveedorLogistica;
    disponibilidad: {
        capacidadVehiculo: number;
        pasajerosConfirmados: number;
    };
};

export type RecursoDisponibleLogistica =
    | RecursoDisponibleEquipamiento
    | RecursoDisponibleTransporte;

type RespuestaDisponiblesLogisticaApi<T = RecursoDisponibleLogistica> = {
    data: T[];
};

export type ItemDesasignarLogistica = {
    tipo: "EQUIPAMIENTO" | "TRANSPORTE";
    idservicio: number;
};

export type ItemNuevoLogistica = {
    tipo: "EQUIPAMIENTO" | "TRANSPORTE";
    idservicio: number;
    cantidad?: number;
    comprobanteReserva?: string;
};

export type PayloadModificarLogistica = {
    itemsDesasignar: ItemDesasignarLogistica[];
    itemsNuevos: ItemNuevoLogistica[];
    motivo?: string | null;
};

export type ParametrosModificarLogistica = {
    idsalida: number;
    datos: PayloadModificarLogistica;
};

export type DatosResultadoModificarLogistica = {
    panel: PanelLogistica;
    advertencias: string[];
};

type RespuestaModificarLogisticaApi = {
    mensaje: string;
    data: DatosResultadoModificarLogistica;
};

export type ResultadoModificarLogistica = DatosResultadoModificarLogistica & {
    mensaje: string;
};

// ==========================================
// Tipos TypeScript: CU-37 Cancelar Salida
// ==========================================

export type RecursosLiberadosCancelacion = {
    personal: number;
    equipamiento: number;
    servicios: number;
};

export type ImpactoCancelacionSalida = {
    idsalida: number;
    nroSalida: string;
    paquete: string;
    fechaInicio: string;
    reservasAfectadas: number;
    totalAReembolsar: number;
    permisosQuePasanAPerdido: number;
    recursosQueSeLiberan: RecursosLiberadosCancelacion;
    notificaAClientes: boolean;
};

type RespuestaImpactoCancelacionApi = {
    data: ImpactoCancelacionSalida;
};

export type DatosCancelarSalida = {
    motivo: string;
};

export type NotificacionesCancelacion = {
    enviadas: number;
    fallidas: number;
    salidasAlternativasOfrecidas: number;
};

export type ResultadoCancelarSalida = {
    idsalida: number;
    nroSalida: string;
    estado: string;
    reservasCanceladas?: number;
    reembolsoTotal?: number;
    notificaciones?: NotificacionesCancelacion;
    nota?: string;
};

type RespuestaCancelarSalidaApi = {
    mensaje: string;
    data: ResultadoCancelarSalida;
};

// ==========================================
// Tipos TypeScript: CU-41 Devolución de Equipamiento
// ==========================================

export type ItemEquipamientoAsignado = {
    idservicio: number;
    nombreServicio: string;
    tipoEquipamiento: string;
    proveedor: string;
    cantidadAsignada: number;
    stockActualDisponible: number;
};

export type EquipamientoAsignadoSalida = {
    idsalida: number;
    nroSalida: string;
    estado: string;
    fechaFin: string;
    equipamientos: ItemEquipamientoAsignado[];
};

type RespuestaEquipamientoAsignadoApi = {
    data: EquipamientoAsignadoSalida;
};

export type ItemDevolucionPayload = {
    idservicio: number;
    cantidadBuenEstado: number;
    cantidadDaniada?: number;
    observaciones?: string;
};

export type PayloadDevolucionEquipamiento = {
    observacionesGenerales?: string | null;
    items: ItemDevolucionPayload[];
};

export type ParametrosRegistrarDevolucion = {
    idsalida: number;
    datos: PayloadDevolucionEquipamiento;
};

export type DetalleItemDevuelto = {
    idservicio: number;
    cantidadReintegradaAlStock: number;
    cantidadDaniadaOExtraviada: number;
    observaciones: string | null;
};

export type ResultadoDevolucionEquipamiento = {
    mensaje: string;
    idsalida: number;
    auditoriaId: number;
    detalle: DetalleItemDevuelto[];
};

type RespuestaDevolucionEquipamientoApi = {
    mensaje: string;
    data: {
        idsalida: number;
        auditoriaId: number;
        detalle: DetalleItemDevuelto[];
    };
};

// ==========================================
// Normalización y construcción de Query
// ==========================================

export function normalizarSalida(salida: SalidaApi): Salida {
    return {
        ...salida,
        id: salida.idsalida,
    };
}

export function construirQuerySalidas(filtros: FiltrosSalidas = {}): string {
    const parametros = new URLSearchParams();

    if (filtros.idpaquete !== undefined && filtros.idpaquete !== null) {
        const idpaquete = Number(filtros.idpaquete);
        if (Number.isInteger(idpaquete) && idpaquete > 0) {
            parametros.set("idpaquete", String(idpaquete));
        }
    }

    if (filtros.idcircuito !== undefined && filtros.idcircuito !== null) {
        const idcircuito = Number(filtros.idcircuito);
        if (Number.isInteger(idcircuito) && idcircuito > 0) {
            parametros.set("idcircuito", String(idcircuito));
        }
    }

    if (filtros.estado && filtros.estado.trim() !== "") {
        parametros.set("estado", filtros.estado.trim());
    }

    if (filtros.desde && filtros.desde.trim() !== "") {
        parametros.set("desde", filtros.desde.trim());
    }

    if (filtros.hasta && filtros.hasta.trim() !== "") {
        parametros.set("hasta", filtros.hasta.trim());
    }

    if (filtros.idguia !== undefined && filtros.idguia !== null) {
        const idguia = Number(filtros.idguia);
        if (Number.isInteger(idguia) && idguia > 0) {
            parametros.set("idguia", String(idguia));
        }
    }

    const query = parametros.toString();
    return query ? `?${query}` : "";
}

export function construirQueryOpcionesSalida(
    parametros: ParametrosConsultaOpciones,
): string {
    const searchParams = new URLSearchParams();
    if (parametros.idpaquete !== undefined && parametros.idpaquete !== null) {
        searchParams.set("idpaquete", String(parametros.idpaquete));
    }
    if (parametros.fechaInicio && parametros.fechaInicio.trim() !== "") {
        searchParams.set("fechaInicio", parametros.fechaInicio.trim());
    }
    if (parametros.tamanoMaximo !== undefined && parametros.tamanoMaximo !== null) {
        searchParams.set("tamanoMaximo", String(parametros.tamanoMaximo));
    }
    const query = searchParams.toString();
    return query ? `?${query}` : "";
}

// ==========================================
// Consultas HTTP
// ==========================================

/**
 * Consulta las salidas en el backend (GET /api/salidas) con los filtros dados.
 */
export async function consultarSalidas(filtros: FiltrosSalidas = {}): Promise<Salida[]> {
    const query = construirQuerySalidas(filtros);
    const respuesta = await solicitarApi<RespuestaSalidasApi>(`/salidas${query}`);
    return (respuesta.data ?? []).map(normalizarSalida);
}

export const listarSalidas = consultarSalidas;

/**
 * Consulta las opciones de dotación, cupo y alojamientos para crear una salida (CU-36, GET /api/salidas/opciones).
 */
export async function consultarOpcionesSalida(
    parametros: ParametrosConsultaOpciones,
): Promise<OpcionesSalidaDto> {
    const query = construirQueryOpcionesSalida(parametros);
    const respuesta = await solicitarApi<RespuestaOpcionesSalidaApi>(
        `/salidas/opciones${query}`,
    );
    return respuesta.data;
}

/**
 * Confirma y registra una nueva salida planificada (CU-36, POST /api/salidas).
 */
export async function crearSalida(
    datos: DatosCrearSalida,
): Promise<ResultadoCrearSalida> {
    const cuerpo: Record<string, unknown> = {
        idpaquete: datos.idpaquete,
        fechaInicio: datos.fechaInicio,
        tamanoMaximo: datos.tamanoMaximo,
    };
    if (datos.idalojamiento !== undefined && datos.idalojamiento !== null) {
        cuerpo.idalojamiento = datos.idalojamiento;
    }

    const respuesta = await solicitarApi<RespuestaCrearSalidaApi>("/salidas", {
        method: "POST",
        body: JSON.stringify(cuerpo),
    });

    return {
        ...respuesta.data,
        salida: normalizarSalida(respuesta.data.salida),
        mensaje: respuesta.mensaje,
        numeroSalida: respuesta.data.salida.nroSalida,
    };
}

/**
 * Consulta la dotación definitiva y recursos disponibles para una salida (CU-40, GET /api/salidas/:idsalida/asignacion).
 */
export async function obtenerPanelAsignacion(
    idsalida: number,
): Promise<DatosPanelAsignacion> {
    const respuesta = await solicitarApi<RespuestaPanelAsignacionApi>(
        `/salidas/${idsalida}/asignacion`,
    );
    return respuesta.data;
}

/**
 * Confirma la asignación de recursos, emite permisos y cierra la venta (CU-40, POST /api/salidas/:idsalida/asignacion).
 * Si la autoridad no pudo liberar los lugares sobrantes, devuelve `advertencia` sin fallar la asignación.
 */
export async function confirmarAsignacion(
    idsalida: number,
    payload: PayloadConfirmarAsignacion,
): Promise<ResultadoConfirmarAsignacion> {
    const respuesta = await solicitarApi<RespuestaConfirmarAsignacionApi>(
        `/salidas/${idsalida}/asignacion`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
    );

    return {
        salida: normalizarSalida(respuesta.data.salida),
        permisosEmitidos: respuesta.data.permisosEmitidos,
        rechazados: respuesta.data.rechazados ?? [],
        lugaresLiberados: respuesta.data.lugaresLiberados,
        mensaje: respuesta.mensaje,
        advertencia: respuesta.data.advertencia,
    };
}

/**
 * Reintenta la liberación de lugares sobrantes pendientes ante la autoridad (CU-40 paso 12, POST /api/salidas/:idsalida/asignacion/liberar-sobrantes).
 */
export async function liberarSobrantes(
    idsalida: number,
): Promise<ResultadoLiberarSobrantes> {
    const respuesta = await solicitarApi<RespuestaLiberarSobrantesApi>(
        `/salidas/${idsalida}/asignacion/liberar-sobrantes`,
        {
            method: "POST",
        },
    );
    return respuesta.data;
}

/**
 * Consulta el personal asignado a la salida y su logística (CU-38, GET /api/salidas/:idsalida/personal).
 */
export async function obtenerPersonalSalida(
    idsalida: number,
): Promise<DatosPersonalSalida> {
    const respuesta = await solicitarApi<RespuestaPersonalSalidaApi>(
        `/salidas/${idsalida}/personal`,
    );
    return respuesta.data;
}

/**
 * Consulta los reemplazantes disponibles para un integrante asignado (CU-38, GET /api/salidas/:idsalida/personal/:idpersonal/reemplazantes).
 */
export async function obtenerReemplazantesDisponibles(
    idsalida: number,
    idpersonal: number,
): Promise<ReemplazanteDisponible[]> {
    const respuesta = await solicitarApi<RespuestaReemplazantesApi>(
        `/salidas/${idsalida}/personal/${idpersonal}/reemplazantes`,
    );
    return respuesta.data;
}

/**
 * Confirma el reemplazo de personal en una salida (CU-38, POST /api/salidas/:idsalida/reemplazos).
 */
export async function confirmarReemplazo(
    idsalida: number,
    datos: PayloadConfirmarReemplazo,
): Promise<ResultadoConfirmarReemplazo> {
    const respuesta = await solicitarApi<RespuestaConfirmarReemplazoApi>(
        `/salidas/${idsalida}/reemplazos`,
        {
            method: "POST",
            body: JSON.stringify(datos),
        },
    );
    return {
        ...respuesta.data,
        mensaje: respuesta.mensaje,
    };
}

/**
 * Consulta el panel de logística de una salida (CU-39, GET /api/salidas/:idsalida/logistica).
 */
export async function obtenerPanelLogistica(
    idsalida: number,
): Promise<PanelLogistica> {
    const respuesta = await solicitarApi<RespuestaPanelLogisticaApi>(
        `/salidas/${idsalida}/logistica`,
    );
    return respuesta.data;
}

/**
 * Consulta proveedores disponibles para reasignar logística (CU-39, GET /api/salidas/:idsalida/logistica/disponibles?tipo=...).
 */
export async function consultarDisponiblesLogistica(
    idsalida: number,
    tipo: "EQUIPAMIENTO" | "TRANSPORTE",
): Promise<RecursoDisponibleLogistica[]> {
    const respuesta = await solicitarApi<RespuestaDisponiblesLogisticaApi>(
        `/salidas/${idsalida}/logistica/disponibles?tipo=${tipo}`,
    );
    return respuesta.data;
}

/**
 * Confirma las modificaciones de logística de una salida (CU-39, PUT /api/salidas/:idsalida/logistica).
 */
export async function modificarLogistica(
    idsalida: number,
    datos: PayloadModificarLogistica,
): Promise<ResultadoModificarLogistica> {
    const respuesta = await solicitarApi<RespuestaModificarLogisticaApi>(
        `/salidas/${idsalida}/logistica`,
        {
            method: "PUT",
            body: JSON.stringify(datos),
        },
    );
    return {
        ...respuesta.data,
        mensaje: respuesta.mensaje,
    };
}

/**
 * Consulta el resumen de impacto de la cancelación de una salida (CU-37, GET /api/salidas/:idsalida/cancelacion).
 */
export async function obtenerImpactoCancelacion(
    idsalida: number,
): Promise<ImpactoCancelacionSalida> {
    const respuesta = await solicitarApi<RespuestaImpactoCancelacionApi>(
        `/salidas/${idsalida}/cancelacion`,
    );
    return respuesta.data;
}

/**
 * Cancela una salida turística en el backend (CU-37, POST /api/salidas/:idsalida/cancelar).
 */
export async function cancelarSalida(
    idsalida: number,
    datos: DatosCancelarSalida,
): Promise<ResultadoCancelarSalida> {
    const respuesta = await solicitarApi<RespuestaCancelarSalidaApi>(
        `/salidas/${idsalida}/cancelar`,
        {
            method: "POST",
            body: JSON.stringify(datos),
        },
    );
    return respuesta.data;
}

/**
 * Consulta el equipamiento asignado a la salida para inspección y devolución (CU-41, GET /api/salidas/:idsalida/equipamiento-asignado).
 */
export async function obtenerEquipamientoAsignado(
    idsalida: number,
): Promise<EquipamientoAsignadoSalida> {
    const respuesta = await solicitarApi<RespuestaEquipamientoAsignadoApi>(
        `/salidas/${idsalida}/equipamiento-asignado`,
    );
    return respuesta.data;
}

/**
 * Registra la devolución de equipamiento y reintegra el stock en buen estado (CU-41, POST /api/salidas/:idsalida/devolucion-equipamiento).
 */
export async function registrarDevolucionEquipamiento(
    idsalida: number,
    payload: PayloadDevolucionEquipamiento,
): Promise<ResultadoDevolucionEquipamiento> {
    const respuesta = await solicitarApi<RespuestaDevolucionEquipamientoApi>(
        `/salidas/${idsalida}/devolucion-equipamiento`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
    );
    return {
        mensaje: respuesta.mensaje,
        idsalida: respuesta.data.idsalida,
        auditoriaId: respuesta.data.auditoriaId,
        detalle: respuesta.data.detalle,
    };
}

// ==========================================
// Claves y hooks de TanStack Query
// ==========================================

export const clavesSalidas = {
    todas: ["salidas"] as const,
    todos: ["salidas"] as const,
    lista: (filtros?: FiltrosSalidas) => ["salidas", "lista", filtros ?? {}] as const,
    opciones: (params?: ParametrosConsultaOpciones | null) =>
        ["salidas", "opciones", params ?? {}] as const,
    asignacion: (idsalida?: number | null) =>
        ["salidas", "asignacion", idsalida ?? null] as const,
    personal: (idsalida?: number | null) =>
        ["salidas", "personal", idsalida ?? null] as const,
    reemplazantes: (idsalida?: number | null, idpersonal?: number | null) =>
        ["salidas", "reemplazantes", idsalida ?? null, idpersonal ?? null] as const,
    logistica: (idsalida?: number | null) =>
        ["salidas", "logistica", idsalida ?? null] as const,
    logisticaDisponibles: (idsalida?: number | null, tipo?: string | null) =>
        ["salidas", "logistica", "disponibles", idsalida ?? null, tipo ?? null] as const,
    cancelacion: (idsalida?: number | null) =>
        ["salidas", "cancelacion", idsalida ?? null] as const,
    equipamientoAsignado: (idsalida?: number | null) =>
        ["salidas", "equipamientoAsignado", idsalida ?? null] as const,
};

export function useSalidas(filtros?: FiltrosSalidas) {
    return useQuery({
        queryKey: clavesSalidas.lista(filtros),
        queryFn: () => consultarSalidas(filtros),
    });
}

export function useOpcionesSalida(
    parametros: ParametrosConsultaOpciones | null,
    opcionesQuery?: { enabled?: boolean },
) {
    const habilitado =
        (opcionesQuery?.enabled ?? true) &&
        Boolean(
            parametros &&
                parametros.idpaquete > 0 &&
                parametros.fechaInicio &&
                parametros.tamanoMaximo > 0,
        );

    return useQuery({
        queryKey: clavesSalidas.opciones(parametros),
        queryFn: () => consultarOpcionesSalida(parametros!),
        enabled: habilitado,
    });
}

export function useCrearSalida() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (datos: DatosCrearSalida) => crearSalida(datos),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: clavesSalidas.todas });
        },
    });
}

/**
 * Hook para consultar el panel de asignación de una salida (CU-40).
 * Evita ejecutar la consulta sin un idsalida válido (entero positivo).
 */
export function usePanelAsignacion(
    idsalida: number | null | undefined,
    opcionesQuery?: { enabled?: boolean },
) {
    const idValido =
        typeof idsalida === "number" && Number.isInteger(idsalida) && idsalida > 0;
    const habilitado = (opcionesQuery?.enabled ?? true) && idValido;

    return useQuery({
        queryKey: clavesSalidas.asignacion(idsalida),
        queryFn: () => obtenerPanelAsignacion(idsalida!),
        enabled: habilitado,
    });
}

/**
 * Hook para confirmar la asignación de recursos y emisión de nómina (CU-40).
 * Invalida las consultas de salidas para reflejar el nuevo estado CERRADA y personal asignado.
 */
export function useConfirmarAsignacion() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ idsalida, datos }: ParametrosConfirmarAsignacion) =>
            confirmarAsignacion(idsalida, datos),
        onSuccess: (_resultado, variables) => {
            queryClient.invalidateQueries({ queryKey: clavesSalidas.todas });
            queryClient.invalidateQueries({
                queryKey: clavesSalidas.asignacion(variables.idsalida),
            });
        },
    });
}

/**
 * Hook para reintentar la liberación de lugares sobrantes ante la autoridad (CU-40 paso 12).
 * Invalida las consultas de salidas tras el éxito.
 */
export function useLiberarSobrantes() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (idsalida: number) => liberarSobrantes(idsalida),
        onSuccess: (_resultado, idsalida) => {
            queryClient.invalidateQueries({ queryKey: clavesSalidas.todas });
            queryClient.invalidateQueries({
                queryKey: clavesSalidas.asignacion(idsalida),
            });
        },
    });
}

/**
 * Hook para consultar el personal asignado a una salida y sus permisos vigentes (CU-38).
 */
export function usePersonalSalida(
    idsalida: number | null | undefined,
    opcionesQuery?: { enabled?: boolean },
) {
    const idValido =
        typeof idsalida === "number" && Number.isInteger(idsalida) && idsalida > 0;
    const habilitado = (opcionesQuery?.enabled ?? true) && idValido;

    return useQuery({
        queryKey: clavesSalidas.personal(idsalida),
        queryFn: () => obtenerPersonalSalida(idsalida!),
        enabled: habilitado,
    });
}

/**
 * Hook para consultar los reemplazantes disponibles para una persona asignada (CU-38).
 */
export function useReemplazantesDisponibles(
    idsalida: number | null | undefined,
    idpersonal: number | null | undefined,
    opcionesQuery?: { enabled?: boolean },
) {
    const idsValidos =
        typeof idsalida === "number" &&
        Number.isInteger(idsalida) &&
        idsalida > 0 &&
        typeof idpersonal === "number" &&
        Number.isInteger(idpersonal) &&
        idpersonal > 0;
    const habilitado = (opcionesQuery?.enabled ?? true) && idsValidos;

    return useQuery({
        queryKey: clavesSalidas.reemplazantes(idsalida, idpersonal),
        queryFn: () => obtenerReemplazantesDisponibles(idsalida!, idpersonal!),
        enabled: habilitado,
    });
}

/**
 * Hook para ejecutar el reemplazo de personal asignado (CU-38).
 * Invalida las salidas y el personal asignado tras el éxito.
 */
export function useConfirmarReemplazo() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ idsalida, datos }: ParametrosConfirmarReemplazo) =>
            confirmarReemplazo(idsalida, datos),
        onSuccess: (_resultado, variables) => {
            queryClient.invalidateQueries({ queryKey: clavesSalidas.todas });
            queryClient.invalidateQueries({
                queryKey: clavesSalidas.personal(variables.idsalida),
            });
            queryClient.invalidateQueries({
                queryKey: clavesSalidas.asignacion(variables.idsalida),
            });
        },
    });
}

/**
 * Hook para consultar el panel de logística de una salida (CU-39).
 */
export function usePanelLogistica(
    idsalida: number | null | undefined,
    opcionesQuery?: { enabled?: boolean },
) {
    const idValido =
        typeof idsalida === "number" && Number.isInteger(idsalida) && idsalida > 0;
    const habilitado = (opcionesQuery?.enabled ?? true) && idValido;

    return useQuery({
        queryKey: clavesSalidas.logistica(idsalida),
        queryFn: () => obtenerPanelLogistica(idsalida!),
        enabled: habilitado,
    });
}

/**
 * Hook para consultar los recursos disponibles (transporte o equipamiento) para reasignar (CU-39).
 */
export function useRecursosDisponiblesLogistica(
    idsalida: number | null | undefined,
    tipo: "EQUIPAMIENTO" | "TRANSPORTE" | null,
    opcionesQuery?: { enabled?: boolean },
) {
    const idValido =
        typeof idsalida === "number" &&
        Number.isInteger(idsalida) &&
        idsalida > 0 &&
        (tipo === "EQUIPAMIENTO" || tipo === "TRANSPORTE");
    const habilitado = (opcionesQuery?.enabled ?? true) && idValido;

    return useQuery({
        queryKey: clavesSalidas.logisticaDisponibles(idsalida, tipo),
        queryFn: () => consultarDisponiblesLogistica(idsalida!, tipo!),
        enabled: habilitado,
    });
}

/**
 * Hook para confirmar la modificación de la logística de una salida (CU-39).
 * Invalida salidas y logística tras el éxito.
 */
export function useModificarLogistica() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ idsalida, datos }: ParametrosModificarLogistica) =>
            modificarLogistica(idsalida, datos),
        onSuccess: (_resultado, variables) => {
            queryClient.invalidateQueries({ queryKey: clavesSalidas.todas });
            queryClient.invalidateQueries({
                queryKey: clavesSalidas.logistica(variables.idsalida),
            });
            queryClient.invalidateQueries({
                queryKey: clavesSalidas.logisticaDisponibles(variables.idsalida, null),
            });
        },
    });
}

/**
 * Hook para consultar el impacto de cancelar una salida (CU-37).
 */
export function useImpactoCancelacion(
    idsalida: number | null | undefined,
    opcionesQuery?: { enabled?: boolean },
) {
    const idValido =
        typeof idsalida === "number" && Number.isInteger(idsalida) && idsalida > 0;
    const habilitado = (opcionesQuery?.enabled ?? true) && idValido;

    return useQuery({
        queryKey: clavesSalidas.cancelacion(idsalida),
        queryFn: () => obtenerImpactoCancelacion(idsalida!),
        enabled: habilitado,
    });
}

/**
 * Hook para cancelar una salida turística (CU-37).
 * Invalida las consultas de salidas tras el éxito o cuando la salida queda cancelada (incluso con 503).
 */
export function useCancelarSalida() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ idsalida, datos }: { idsalida: number; datos: DatosCancelarSalida }) =>
            cancelarSalida(idsalida, datos),
        onSuccess: (_resultado, variables) => {
            queryClient.invalidateQueries({ queryKey: clavesSalidas.todas });
            queryClient.invalidateQueries({
                queryKey: clavesSalidas.cancelacion(variables.idsalida),
            });
            // FE-44: cancelar la salida también cancela sus solicitudes de alojamiento
            queryClient.invalidateQueries({ queryKey: ["solicitudes"] });
        },
        onError: (error) => {
            // Si el error es 503, la salida ya quedó CANCELADA en base de datos aunque la autoridad no haya respondido.
            // FE-44: no se recarga el impacto: respondería "ya cancelada" junto al botón de reintentar
            if (error instanceof ErrorApi && error.estado === 503) {
                queryClient.invalidateQueries({ queryKey: clavesSalidas.todas });
                queryClient.invalidateQueries({ queryKey: ["solicitudes"] });
            }
        },
    });
}

/**
 * Hook para consultar el equipamiento asignado a una salida concluida (CU-41).
 */
export function useEquipamientoAsignado(
    idsalida: number | null | undefined,
    opcionesQuery?: { enabled?: boolean },
) {
    const idValido =
        typeof idsalida === "number" && Number.isInteger(idsalida) && idsalida > 0;
    const habilitado = (opcionesQuery?.enabled ?? true) && idValido;

    return useQuery({
        queryKey: clavesSalidas.equipamientoAsignado(idsalida),
        queryFn: () => obtenerEquipamientoAsignado(idsalida!),
        enabled: habilitado,
    });
}

/**
 * Hook para registrar la devolución de equipamiento reintegrándolo al stock (CU-41).
 * Invalida consultas de salidas, equipamiento asignado y catálogo de servicios tras el éxito.
 */
/** FE-45: el modal de devolución la usa para no cerrarse mientras el registro está en curso. */
export const claveMutacionDevolucion = ["registrarDevolucion"];

export function useRegistrarDevolucion() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: claveMutacionDevolucion,
        mutationFn: ({ idsalida, datos }: ParametrosRegistrarDevolucion) =>
            registrarDevolucionEquipamiento(idsalida, datos),
        onSuccess: (_resultado, variables) => {
            queryClient.invalidateQueries({ queryKey: clavesSalidas.todas });
            queryClient.invalidateQueries({
                queryKey: clavesSalidas.equipamientoAsignado(variables.idsalida),
            });
            queryClient.invalidateQueries({ queryKey: ["servicios"] });
        },
    });
}

// ==========================================
// Funciones auxiliares puras
// ==========================================

export type DotacionSalida = {
    guias: number;
    porteadores: number;
    otros: number;
    total: number;
};

/**
 * Filtra los guías asignados a la salida.
 */
export function guiasDeSalida(
    salida: Pick<SalidaApi, "personalAsignado">,
): PersonalAsignadoSalidaApi[] {
    return (salida.personalAsignado ?? []).filter((asignacion) => {
        const rol = asignacion.personal?.rol?.trim().toLowerCase();
        return rol === "guía" || rol === "guia";
    });
}

/**
 * Devuelve la lista de nombres completos de los guías asignados a la salida.
 * Si el objeto cuenta con el campo oficial `guias` del backend, lo utiliza directamente;
 * de lo contrario, filtra y extrae los nombres desde `personalAsignado`.
 */
export function nombresGuiasDeSalida(
    salida: Pick<SalidaApi, "personalAsignado"> & Partial<Pick<SalidaApi, "guias">>,
): string[] {
    if (Array.isArray(salida.guias)) {
        return salida.guias;
    }
    return guiasDeSalida(salida).map((asignacion) => asignacion.personal.nombreCompleto);
}

/**
 * Calcula la dotación de personal asignado discriminando guías, porteadores y total.
 */
export function dotacionDeSalida(
    salida: Pick<SalidaApi, "personalAsignado">,
): DotacionSalida {
    let guias = 0;
    let porteadores = 0;
    let otros = 0;

    for (const asignacion of salida.personalAsignado ?? []) {
        const rol = asignacion.personal?.rol?.trim().toLowerCase();
        if (rol === "guía" || rol === "guia") {
            guias++;
        } else if (rol === "porteador" || rol === "porteadores") {
            porteadores++;
        } else {
            otros++;
        }
    }

    return {
        guias,
        porteadores,
        otros,
        total: guias + porteadores + otros,
    };
}

/**
 * Cuenta la cantidad de personal asignado agrupado por rol.
 */
export function contarPersonalPorRol(
    salida: Pick<SalidaApi, "personalAsignado">,
): Record<string, number> {
    const conteo: Record<string, number> = {};
    for (const asignacion of salida.personalAsignado ?? []) {
        const rol = asignacion.personal?.rol?.trim() || "Sin rol";
        conteo[rol] = (conteo[rol] ?? 0) + 1;
    }
    return conteo;
}

/**
 * Agrupa y cuenta las solicitudes de alojamiento en estado PENDIENTE por idsalida (RF-61).
 */
export function contarSolicitudesPendientesPorSalida(
    solicitudes: Array<{
        estado?: string;
        reserva?: {
            salida?: {
                idsalida?: number;
            };
        };
    }>,
): Map<number, number> {
    const mapa = new Map<number, number>();
    for (const sol of solicitudes) {
        if (sol.estado === "PENDIENTE") {
            const idsalida = sol.reserva?.salida?.idsalida;
            if (idsalida !== undefined && idsalida !== null) {
                mapa.set(idsalida, (mapa.get(idsalida) ?? 0) + 1);
            }
        }
    }
    return mapa;
}
