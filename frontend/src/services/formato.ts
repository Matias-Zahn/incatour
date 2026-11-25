// Formatos de fecha y moneda de toda la app, en un solo lugar.
// Fechas sin hora (inicio y fin de una salida, temporadas) van en UTC para que no corran de día por el huso horario;
// los instantes (pagos, envíos, avances) van en hora local.

const SIN_FECHA = "--/--/----";

function aFecha(iso?: string | null): Date | null {
    if (!iso) return null;
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** "15 nov 2026" de una fecha sin hora */
export function formatearFechaUtcCorta(iso?: string | null): string {
    const fecha = aFecha(iso);
    if (!fecha) return iso || SIN_FECHA;
    return fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "15 nov 2026" de un instante, en hora local */
export function formatearFechaLocalCorta(iso?: string | null): string {
    const fecha = aFecha(iso);
    if (!fecha) return iso || SIN_FECHA;
    return fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatearRangoFechasUtc(inicio?: string | null, fin?: string | null): string {
    const fInicio = aFecha(inicio);
    const fFin = aFecha(fin);
    if (!fInicio || !fFin) {
        return `${formatearFechaUtcCorta(inicio)} – ${formatearFechaUtcCorta(fin)}`;
    }
    const mismoAnio = fInicio.getUTCFullYear() === fFin.getUTCFullYear();
    const mismoMes = mismoAnio && fInicio.getUTCMonth() === fFin.getUTCMonth();
    const mismoDia = mismoMes && fInicio.getUTCDate() === fFin.getUTCDate();
    if (mismoDia) return formatearFechaUtcCorta(inicio);
    if (mismoMes) {
        const diaInicio = String(fInicio.getUTCDate()).padStart(2, "0");
        return `${diaInicio}–${formatearFechaUtcCorta(fin)}`;
    }
    if (mismoAnio) {
        const inicioCorto = fInicio.toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
            timeZone: "UTC",
        });
        return `${inicioCorto} – ${formatearFechaUtcCorta(fin)}`;
    }
    return `${formatearFechaUtcCorta(inicio)} – ${formatearFechaUtcCorta(fin)}`;
}

/** "15/11/2026" de una fecha sin hora, para listados */
export function formatearFechaSalida(iso?: string | null): string {
    const fecha = aFecha(iso);
    if (!fecha) return iso || SIN_FECHA;
    return fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

/** "15/11/2026, 14:30" de un instante, en hora local */
export function formatearFechaHora(iso?: string | null): string {
    const fecha = aFecha(iso);
    if (!fecha) return iso || SIN_FECHA;
    return fecha.toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

/** "USD 1.250,00": la moneda es la de la tarifa (USD por defecto) */
export function formatearMonto(monto?: number | null, moneda?: string | null): string {
    const n = Number(monto ?? 0);
    return `${moneda || "USD"} ${(Number.isNaN(n) ? 0 : n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const formatearMontoUsd = (monto?: number | null) => formatearMonto(monto);

// Etiquetas legibles para valores de sistema (B11: sin MAYÚSCULAS crudas en pantalla)
const ESTADOS_REGISTRO: Record<string, string> = {
    ACTIVO: "Activo",
    INACTIVO: "Inactivo",
};

const TIPOS_SERVICIO_ETIQUETA: Record<string, string> = {
    ALOJAMIENTO: "Alojamiento",
    TRANSPORTE: "Transporte",
    TREN: "Tren",
    EQUIPAMIENTO: "Equipamiento",
};

const MODALIDADES_ETIQUETA: Record<string, string> = {
    BLOQUEO_PLAZAS: "Bloqueo de plazas",
    A_SOLICITUD: "A solicitud",
};

const GRAVEDADES_ETIQUETA: Record<string, string> = {
    CRITICO: "Crítico",
    ALTO: "Alto",
    MEDIO: "Medio",
    MODERADO: "Moderado",
    BAJO: "Bajo",
};

const HABILITACIONES_ETIQUETA: Record<string, string> = {
    VIGENTE: "Vigente",
    VENCIDA: "Vencida",
    SIN_DATOS: "Sin datos",
};

const ESTADOS_SOLICITUD_ETIQUETA: Record<string, string> = {
    PENDIENTE: "Pendiente",
    CONFIRMADA: "Confirmada",
    CANCELADA: "Cancelada",
    RECHAZADA: "Rechazada",
};

// Estado de la reserva (CONFIRMADA, CANCELADA) y de su alojamiento (CONFIRMADO, PENDIENTE)
const ESTADOS_RESERVA_ETIQUETA: Record<string, string> = {
    ...ESTADOS_SOLICITUD_ETIQUETA,
    CONFIRMADO: "Confirmado",
};

function buscarEtiqueta(mapa: Record<string, string>, valor?: string | null): string {
    if (!valor) return "—";
    return mapa[valor.toUpperCase()] ?? valor;
}

export const etiquetaEstadoRegistro = (estado?: string | null) =>
    buscarEtiqueta(ESTADOS_REGISTRO, estado);

export const etiquetaTipoServicio = (tipo?: string | null) =>
    buscarEtiqueta(TIPOS_SERVICIO_ETIQUETA, tipo);

export const etiquetaModalidad = (modalidad?: string | null) =>
    buscarEtiqueta(MODALIDADES_ETIQUETA, modalidad);

export const etiquetaGravedad = (nivel?: string | null) =>
    buscarEtiqueta(GRAVEDADES_ETIQUETA, nivel);

export const etiquetaHabilitacion = (situacion?: string | null) =>
    buscarEtiqueta(HABILITACIONES_ETIQUETA, situacion);

export const etiquetaEstadoReserva = (estado?: string | null) =>
    buscarEtiqueta(ESTADOS_RESERVA_ETIQUETA, estado);

export const etiquetaEstadoSolicitud = (estado?: string | null) =>
    buscarEtiqueta(ESTADOS_SOLICITUD_ETIQUETA, estado);
