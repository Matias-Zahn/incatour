/**
 * A1: cálculo del stock por día. Funciones puras, sin base de datos.
 * Una ocupación toma `cantidad` unidades de un servicio cada día entre `desde` y `hasta` (inclusive, 00:00Z).
 * Lo disponible en un rango es el total menos el máximo ocupado en un mismo día, no la suma.
 */
import { DIAS_REACONDICIONAMIENTO, TIPO_SERVICIO } from "./constantes";

export type Rango = { desde: Date; hasta: Date };
export type OcupacionDias = Rango & { cantidad: number };

const DIA_MS = 24 * 60 * 60 * 1000;
export const sumarDias = (f: Date, n: number) => new Date(f.getTime() + n * DIA_MS);
export const claveDia = (f: Date) => f.toISOString().slice(0, 10);

/** Ocupado de cada día del rango (AAAA-MM-DD → unidades). */
export function ocupadoPorDia(ocupaciones: OcupacionDias[], desde: Date, hasta: Date): Map<string, number> {
  const dias = new Map<string, number>();
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
    const ocupado = ocupaciones.filter((o) => o.desde <= d && d <= o.hasta).reduce((t, o) => t + o.cantidad, 0);
    dias.set(claveDia(d), ocupado);
  }
  return dias;
}

export function disponibleEnRango(total: number, ocupaciones: OcupacionDias[], desde: Date, hasta: Date): number {
  return total - Math.max(0, ...ocupadoPorDia(ocupaciones, desde, hasta).values());
}

/**
 * Días que la salida ocupa cada tipo de recurso:
 * - alojamiento: las noches previas y las posteriores (durante el trekking el grupo acampa);
 * - transporte: del inicio al fin;
 * - equipamiento: del inicio al fin más el reacondicionamiento.
 */
export function rangosDe(
  tipo: string,
  salida: { fechaInicio: Date; fechaFin: Date },
  definicion = { nochesPrevias: 0, nochesPosteriores: 0 } // solo la usa el alojamiento
): Rango[] {
  const { fechaInicio: inicio, fechaFin: fin } = salida;
  if (tipo === TIPO_SERVICIO.ALOJAMIENTO) {
    const rangos: Rango[] = [];
    if (definicion.nochesPrevias > 0) rangos.push({ desde: sumarDias(inicio, -definicion.nochesPrevias), hasta: sumarDias(inicio, -1) });
    if (definicion.nochesPosteriores > 0) rangos.push({ desde: fin, hasta: sumarDias(fin, definicion.nochesPosteriores - 1) });
    return rangos;
  }
  if (tipo === TIPO_SERVICIO.EQUIPAMIENTO) return [{ desde: inicio, hasta: sumarDias(fin, DIAS_REACONDICIONAMIENTO) }];
  return [{ desde: inicio, hasta: fin }];
}

/** Una fila por servicio: el hotel puede ocupar dos tramos y se muestra una vez. */
export const unaPorServicio = <T extends { idservicio: number }>(ocupaciones: T[]) => [
  ...new Map(ocupaciones.map((o) => [o.idservicio, o])).values(),
];

/** Total del servicio: plazas del hotel, unidades del equipo o 1 vehículo. */
export const totalDe = (s: {
  alojamiento?: { plazasTotales: number | null } | null;
  equipamiento?: { cantidadTotal: number } | null;
  transporte?: unknown;
}) => s.alojamiento?.plazasTotales ?? s.equipamiento?.cantidadTotal ?? (s.transporte ? 1 : 0);
