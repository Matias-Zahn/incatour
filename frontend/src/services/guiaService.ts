import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { solicitarApi } from "./clienteApi";

// ==========================================
// Tipos de CU-48: Salida asignada del guía
// ==========================================

export type SalidaGuiaResumen = {
    idsalida: number;
    nroSalida: string;
    paquete: string;
    circuito: string;
    fechaInicio: string;
    fechaFin: string;
    estado: string;
    pasajeros: number;
};

// ==========================================
// Formateadores y utilidades de presentación
// ==========================================

export const etiquetasEstadoSalida: Record<string, string> = {
    PUBLICADA: "Publicada",
    EN_CURSO: "En curso",
    FINALIZADA: "Finalizada",
    CANCELADA: "Cancelada",
    CERRADA: "Cerrada",
    PROGRAMADA: "Programada",
    ABIERTA: "Abierta",
};

export function formatearEstadoSalida(estado?: string | null): string {
    if (!estado) return "Sin estado";
    const normalizado = estado.trim().toUpperCase();
    return etiquetasEstadoSalida[normalizado] ?? estado;
}

export function estilosEstadoSalida(estado?: string | null): string {
    switch (estado?.trim().toUpperCase()) {
        case "EN_CURSO":
            return "bg-emerald-100 text-emerald-800";
        case "PUBLICADA":
            return "bg-blue-100 text-blue-800";
        case "CERRADA":
        case "PROGRAMADA":
            return "bg-amber-100 text-amber-800";
        case "FINALIZADA":
            return "bg-slate-100 text-slate-700";
        case "CANCELADA":
            return "bg-rose-100 text-rose-800";
        default:
            return "bg-slate-100 text-slate-800";
    }
}

/** Formatea fechas que vienen en UTC desde el backend evitando desfases por huso horario local */
export function formatearFechaSalida(fechaIso?: string | null): string {
    if (!fechaIso) return "--/--/----";
    try {
        const f = new Date(fechaIso);
        if (isNaN(f.getTime())) return fechaIso;
        return f.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "UTC",
        });
    } catch {
        return fechaIso;
    }
}

/** Fecha de hoy en hora LOCAL (YYYY-MM-DD); toISOString() daría la fecha UTC */
export function fechaLocalHoy(): string {
    const h = new Date();
    const mm = String(h.getMonth() + 1).padStart(2, "0");
    const dd = String(h.getDate()).padStart(2, "0");
    return `${h.getFullYear()}-${mm}-${dd}`;
}

export type ItinerarioEtapa = {
    numeroOrden: number;
    puntoInicio: string;
    puntoFin: string;
    campamentoPrevisto: string | null;
    estadoTramo: "COMPLETADO" | "DEMORADO" | null;
    fechaHoraLlegada: string | null;
};

export type PasajeroGuia = {
    idpasajero: number;
    nombreCompleto: string;
    nroPasaporte: string;
    nacionalidad?: string;
    nroReserva?: string;
    contacto?: {
        titular: string;
        email: string;
    };
};

export type PersonalSalida = {
    idpersonal: number;
    nombreCompleto: string;
    rol: string;
};

export type ServicioSalida = {
    tipo: string;
    nombreServicio: string;
};

export type EquipamientoSalida = {
    nombreServicio: string;
    tipoEquipamiento: string | null;
    cantidad: number;
};

export type DetalleSalidaGuia = {
    salida: {
        idsalida: number;
        nroSalida: string;
        paquete?: string;
        circuito: string;
        duracionDias: number;
        fechaInicio?: string;
        fechaFin?: string;
        estado: string;
    };
    itinerario: ItinerarioEtapa[];
    nomina: PasajeroGuia[];
    personal: PersonalSalida[];
    servicios: ServicioSalida[];
    equipamiento: EquipamientoSalida[];
};

// ==========================================
// Tipos y Esquemas de CU-49: Registrar avance
// ==========================================

export const estadosTramo = ["COMPLETADO", "DEMORADO"] as const;
export type EstadoTramo = (typeof estadosTramo)[number];

export const esquemaAvance = z.object({
    numeroOrden: z
        .number({ message: "Selecciona una etapa válida." })
        .int("Debe ser un número entero.")
        .positive("Selecciona una etapa válida."),
    estadoTramo: z.enum(estadosTramo, {
        message: "Selecciona el estado del tramo.",
    }),
    fechaLlegada: z.string().min(1, "La fecha de llegada es obligatoria."),
    horaLlegada: z.string().min(1, "La hora de llegada es obligatoria."),
});

export type DatosAvanceForm = z.infer<typeof esquemaAvance>;

export type RegistrarAvancePayload = {
    numeroOrden: number;
    estadoTramo: EstadoTramo;
    fechaHoraLlegada: string;
};

export type AvanceRegistrado = {
    idavance?: number;
    numeroOrden: number;
    estadoTramo: EstadoTramo;
    fechaHoraLlegada: string;
    fechaHoraReporte: string;
};

export type RespuestaAvance = {
    mensaje?: string;
    data: {
        avance: AvanceRegistrado;
        salida: {
            idsalida: number;
            estado: string;
            ultimaEtapaAlcanzada: number;
        };
    };
};

export type AvanceOffline = {
    idLocal: string;
    idsalida: number;
    numeroOrden: number;
    etapaNombre: string;
    estadoTramo: EstadoTramo;
    fechaHoraLlegada: string;
    fechaHoraReporte: string;
    sincronizado: boolean;
};

// ==========================================
// Tipos y Esquemas de CU-50: Notificar incidente
// ==========================================

export const tiposIncidente = [
    "ACCIDENTE",
    "SALUD",
    "CLIMA",
    "EQUIPAMIENTO",
    "RETRASO",
    "OTRO",
] as const;
export type TipoIncidente = (typeof tiposIncidente)[number];

export const nivelesGravedad = ["BAJO", "MEDIO", "CRITICO"] as const;
export type NivelGravedad = (typeof nivelesGravedad)[number];

export const etiquetasTipoIncidente: Record<TipoIncidente, string> = {
    ACCIDENTE: "Accidente",
    SALUD: "Problema de salud",
    CLIMA: "Condición climática",
    EQUIPAMIENTO: "Equipamiento",
    RETRASO: "Retraso",
    OTRO: "Otro",
};

export const etiquetasNivelGravedad: Record<NivelGravedad, string> = {
    BAJO: "Bajo",
    MEDIO: "Medio",
    CRITICO: "Crítico",
};

export const esquemaIncidente = z.object({
    tipoIncidente: z.enum(tiposIncidente, {
        message: "Selecciona un tipo de incidente válido.",
    }),
    descripcion: z
        .string()
        .trim()
        .min(5, "La descripción debe tener entre 5 y 1000 caracteres.")
        .max(1000, "La descripción no puede superar los 1000 caracteres."),
    nivelGravedad: z.enum(nivelesGravedad, {
        message: "Selecciona el nivel de gravedad.",
    }),
    fechaOcurrencia: z.string().min(1, "La fecha del incidente es obligatoria."),
    horaOcurrencia: z.string().min(1, "La hora del incidente es obligatoria."),
    pasajerosAfectados: z.array(z.number()).optional(),
});

export type DatosIncidenteForm = z.infer<typeof esquemaIncidente>;

export type RegistrarIncidentePayload = {
    tipoIncidente: TipoIncidente;
    descripcion: string;
    nivelGravedad: NivelGravedad;
    fechaHoraOcurrencia: string;
    pasajerosAfectados?: number[];
};

export type PasajeroAfectable = {
    idpasajero: number;
    nombreCompleto: string;
    nroPasaporte: string;
};

export type IncidenteItem = {
    idincidente?: number;
    tipoIncidente: TipoIncidente;
    descripcion: string;
    nivelGravedad: NivelGravedad;
    fechaHoraOcurrencia: string;
    fechaHoraReporte?: string;
    pasajerosAfectados?: number[];
};

type RespuestaDatos<T> = {
    mensaje?: string;
    data: T;
};

function extraerDatos<T>(respuesta: RespuestaDatos<T>): T {
    return respuesta.data;
}

// ==========================================
// Claves de consulta para TanStack Query
// ==========================================

export const clavesGuia = {
    salidas: ["guia", "salidas"] as const,
    detalleSalida: (idsalida: number) => ["guia", "salidas", idsalida] as const,
    pasajerosSalida: (idsalida: number) =>
        ["guia", "salidas", idsalida, "pasajeros"] as const,
};

// ==========================================
// Llamadas a la API
// ==========================================

/** CU-48: Mis salidas asignadas */
export function listarSalidasGuia(): Promise<SalidaGuiaResumen[]> {
    return solicitarApi<RespuestaDatos<SalidaGuiaResumen[]>>("/guia/salidas").then(
        extraerDatos,
    );
}

/** CU-48: Información de la salida asignada */
export function obtenerDetalleSalidaGuia(idsalida: number): Promise<DetalleSalidaGuia> {
    return solicitarApi<RespuestaDatos<DetalleSalidaGuia>>(
        `/guia/salidas/${idsalida}`,
    ).then(extraerDatos);
}

/** CU-50 FA1: Pasajeros de la salida para selección */
export function listarPasajerosSalida(idsalida: number): Promise<PasajeroAfectable[]> {
    return solicitarApi<RespuestaDatos<PasajeroAfectable[]>>(
        `/guia/salidas/${idsalida}/pasajeros`,
    ).then(extraerDatos);
}

/** CU-49: Registrar avance del recorrido */
export async function registrarAvance(
    idsalida: number,
    payload: RegistrarAvancePayload,
): Promise<RespuestaAvance> {
    return solicitarApi<RespuestaAvance>(`/guia/salidas/${idsalida}/avances`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/** CU-50: Notificar incidente */
export async function registrarIncidente(
    idsalida: number,
    payload: RegistrarIncidentePayload,
): Promise<{ mensaje: string; data?: unknown }> {
    return solicitarApi<{ mensaje: string; data?: unknown }>(
        `/guia/salidas/${idsalida}/incidentes`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
    );
}

// ==========================================
// Hooks de TanStack Query
// ==========================================

export function useSalidasGuia() {
    return useQuery({
        queryKey: clavesGuia.salidas,
        queryFn: listarSalidasGuia,
    });
}

export function useDetalleSalidaGuia(idsalida: number) {
    return useQuery({
        queryKey: clavesGuia.detalleSalida(idsalida),
        queryFn: () => obtenerDetalleSalidaGuia(idsalida),
        enabled: Number.isInteger(idsalida) && idsalida > 0,
    });
}

export function usePasajerosSalida(idsalida: number) {
    return useQuery({
        queryKey: clavesGuia.pasajerosSalida(idsalida),
        queryFn: () => listarPasajerosSalida(idsalida),
        enabled: Number.isInteger(idsalida) && idsalida > 0,
    });
}

export function useRegistrarAvance() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: ({
            idsalida,
            payload,
        }: {
            idsalida: number;
            payload: RegistrarAvancePayload;
        }) => registrarAvance(idsalida, payload),
        onSuccess: (_data, variables) => {
            clienteConsultas.invalidateQueries({
                queryKey: clavesGuia.detalleSalida(variables.idsalida),
            });
            clienteConsultas.invalidateQueries({
                queryKey: clavesGuia.salidas,
            });
        },
    });
}

export function useRegistrarIncidente() {
    const clienteConsultas = useQueryClient();
    return useMutation({
        mutationFn: ({
            idsalida,
            payload,
        }: {
            idsalida: number;
            payload: RegistrarIncidentePayload;
        }) => registrarIncidente(idsalida, payload),
        onSuccess: (_data, variables) => {
            clienteConsultas.invalidateQueries({
                queryKey: clavesGuia.detalleSalida(variables.idsalida),
            });
        },
    });
}

// =======================================================
// Persistencia Local para CU-49 (Modo Sin Conexión / Resiliente)
// =======================================================

const CLAVE_BORRADOR_AVANCE = "incatour.guia.borrador_avance";
const CLAVE_AVANCES_OFFLINE = "incatour.guia.avances_offline";
const CLAVE_HISTORIAL_LOCAL_AVANCES = "incatour.guia.historial_avances";
const CLAVE_HISTORIAL_LOCAL_INCIDENTES = "incatour.guia.historial_incidentes";

export function obtenerBorradorAvance(
    idsalida: number,
): Partial<DatosAvanceForm> | null {
    if (!Number.isInteger(idsalida) || idsalida <= 0) return null;
    try {
        const guardado = localStorage.getItem(`${CLAVE_BORRADOR_AVANCE}_${idsalida}`);
        return guardado ? (JSON.parse(guardado) as Partial<DatosAvanceForm>) : null;
    } catch {
        return null;
    }
}

export function guardarBorradorAvance(
    idsalida: number,
    datos: Partial<DatosAvanceForm>,
): void {
    try {
        localStorage.setItem(
            `${CLAVE_BORRADOR_AVANCE}_${idsalida}`,
            JSON.stringify(datos),
        );
    } catch (e) {
        console.warn("No se pudo guardar el borrador en localStorage", e);
    }
}

export function limpiarBorradorAvance(idsalida: number): void {
    try {
        localStorage.removeItem(`${CLAVE_BORRADOR_AVANCE}_${idsalida}`);
    } catch (e) {
        console.warn("No se pudo limpiar el borrador", e);
    }
}

export function obtenerAvancesOffline(idsalida: number): AvanceOffline[] {
    if (!Number.isInteger(idsalida) || idsalida <= 0) return [];
    try {
        const guardado = localStorage.getItem(`${CLAVE_AVANCES_OFFLINE}_${idsalida}`);
        return guardado ? (JSON.parse(guardado) as AvanceOffline[]) : [];
    } catch {
        return [];
    }
}

export function guardarAvanceOffline(
    idsalida: number,
    avance: Omit<AvanceOffline, "idLocal" | "sincronizado">,
): AvanceOffline {
    const existentes = obtenerAvancesOffline(idsalida);
    const nuevo: AvanceOffline = {
        ...avance,
        idLocal: `off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sincronizado: false,
    };
    const actualizados = [...existentes, nuevo]; // FIFO: el back exige las etapas en orden de llegada
    try {
        localStorage.setItem(
            `${CLAVE_AVANCES_OFFLINE}_${idsalida}`,
            JSON.stringify(actualizados),
        );
    } catch (e) {
        console.warn("No se pudo guardar avance offline", e);
    }
    return nuevo;
}

export function eliminarAvanceOffline(idsalida: number, idLocal: string): void {
    try {
        const existentes = obtenerAvancesOffline(idsalida);
        const filtrados = existentes.filter((a) => a.idLocal !== idLocal);
        localStorage.setItem(
            `${CLAVE_AVANCES_OFFLINE}_${idsalida}`,
            JSON.stringify(filtrados),
        );
    } catch (e) {
        console.warn("No se pudo eliminar avance offline", e);
    }
}

export type RegistroHistorialAvance = {
    id: string;
    etapa: string;
    estadoTramo: EstadoTramo;
    fechaHora: string;
    offline?: boolean;
};

export function obtenerHistorialLocalAvances(
    idsalida: number,
): RegistroHistorialAvance[] {
    if (!Number.isInteger(idsalida) || idsalida <= 0) return [];
    try {
        const guardado = localStorage.getItem(
            `${CLAVE_HISTORIAL_LOCAL_AVANCES}_${idsalida}`,
        );
        return guardado ? (JSON.parse(guardado) as RegistroHistorialAvance[]) : [];
    } catch {
        return [];
    }
}

export function agregarHistorialLocalAvance(
    idsalida: number,
    item: RegistroHistorialAvance,
): void {
    try {
        const actuales = obtenerHistorialLocalAvances(idsalida);
        const actualizados = [
            item,
            ...actuales.filter((x) => x.id !== item.id),
        ].slice(0, 50);
        localStorage.setItem(
            `${CLAVE_HISTORIAL_LOCAL_AVANCES}_${idsalida}`,
            JSON.stringify(actualizados),
        );
    } catch (e) {
        console.warn("No se pudo actualizar historial local de avances", e);
    }
}

export type RegistroHistorialIncidente = {
    id: string;
    tipoIncidente: TipoIncidente;
    nivelGravedad: NivelGravedad;
    descripcion: string;
    fechaHora: string;
};

// Un avance que el servidor rechazó no se registró: se saca también del historial local
export function eliminarHistorialLocalAvance(idsalida: number, id: string): void {
    try {
        const filtrados = obtenerHistorialLocalAvances(idsalida).filter((x) => x.id !== id);
        localStorage.setItem(
            `${CLAVE_HISTORIAL_LOCAL_AVANCES}_${idsalida}`,
            JSON.stringify(filtrados),
        );
    } catch (e) {
        console.warn("No se pudo actualizar historial local de avances", e);
    }
}

export function obtenerHistorialLocalIncidentes(
    idsalida: number,
): RegistroHistorialIncidente[] {
    if (!Number.isInteger(idsalida) || idsalida <= 0) return [];
    try {
        const guardado = localStorage.getItem(
            `${CLAVE_HISTORIAL_LOCAL_INCIDENTES}_${idsalida}`,
        );
        return guardado
            ? (JSON.parse(guardado) as RegistroHistorialIncidente[])
            : [];
    } catch {
        return [];
    }
}

export function agregarHistorialLocalIncidente(
    idsalida: number,
    item: RegistroHistorialIncidente,
): void {
    try {
        const actuales = obtenerHistorialLocalIncidentes(idsalida);
        const actualizados = [
            item,
            ...actuales.filter((x) => x.id !== item.id),
        ].slice(0, 50);
        localStorage.setItem(
            `${CLAVE_HISTORIAL_LOCAL_INCIDENTES}_${idsalida}`,
            JSON.stringify(actualizados),
        );
    } catch (e) {
        console.warn("No se pudo actualizar historial local de incidentes", e);
    }
}

// CU-50: GET /api/incidentes (solo ADMIN), del más reciente al más viejo
export type IncidenteAdmin = {
    idincidente: number;
    idsalida: number;
    tipoIncidente: string;
    descripcion: string;
    nivelGravedad: "BAJO" | "MEDIO" | "CRITICO";
    fechaHoraOcurrencia: string;
    fechaHoraReporte: string;
    salida: { nroSalida: string };
    pasajeros: { pasajero: { nombreCompleto: string } }[];
};

export async function listarIncidentes(): Promise<IncidenteAdmin[]> {
    const res = await solicitarApi<{ data: IncidenteAdmin[] }>("/incidentes");
    return res.data;
}

export function useIncidentes() {
    return useQuery({ queryKey: ["incidentes"], queryFn: listarIncidentes });
}
