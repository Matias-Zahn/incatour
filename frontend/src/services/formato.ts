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
