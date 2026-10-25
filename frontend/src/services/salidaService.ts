import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { solicitarApi } from "./clienteApi";

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

export type DatosResultadoConfirmarAsignacion = {
    salida: SalidaApi;
    permisosEmitidos: number;
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
