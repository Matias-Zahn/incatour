import { useQuery } from "@tanstack/react-query";
import { solicitarApi } from "./clienteApi";

// ==========================================
// Tipos TypeScript: Backend real (SalidaApi)
// ==========================================

export type PaqueteSalidaApi = {
    nroPaquete: string;
    nombrePaquete: string;
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

/**
 * Estructura real de una salida devuelta por GET /api/salidas en el backend.
 * Refleja los campos escalares de Salida más los includes de paquete, personal y servicios.
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
    ultimaEtapaAlcanzada: number | null;
    paquete: PaqueteSalidaApi;
    personalAsignado: PersonalAsignadoSalidaApi[];
    servicios: ServicioSalidaApi[];
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
 * Nota: idcircuito no es soportado por el backend y se excluye intencionalmente.
 */
export type FiltrosSalidas = {
    idpaquete?: number;
    estado?: string;
    desde?: string;
    hasta?: string;
    idguia?: number;
};

type RespuestaSalidasApi = {
    data: SalidaApi[];
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

// ==========================================
// Claves y hooks de TanStack Query
// ==========================================

export const clavesSalidas = {
    todas: ["salidas"] as const,
    todos: ["salidas"] as const,
    lista: (filtros?: FiltrosSalidas) => ["salidas", "lista", filtros ?? {}] as const,
};

export function useSalidas(filtros?: FiltrosSalidas) {
    return useQuery({
        queryKey: clavesSalidas.lista(filtros),
        queryFn: () => consultarSalidas(filtros),
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
 */
export function nombresGuiasDeSalida(
    salida: Pick<SalidaApi, "personalAsignado">,
): string[] {
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
