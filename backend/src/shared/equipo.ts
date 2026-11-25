/**
 * B3, B4 y A2b: el equipo de una salida sale de la regla de cada equipo en la copia del paquete ("1 carpa cada 2").
 * - Al crear la salida se controla contra el stock proyectado y no se ocupa (la fila queda en 0).
 * - Cada compra y cada cancelación recalculan la ocupación sobre el total vendido (12.1), aunque falte stock.
 * Funciones puras: las filas las carga ocupacion.repository (cargarEquipo).
 */
import { COBERTURA_MINIMA_STOCK, ESTADO_SALIDA, TIPO_SERVICIO } from "./constantes";
import { DefinicionPaquete } from "./definicionPaquete";
import { claveDia, OcupacionDias, ocupadoPorDia, rangosDe } from "./ocupacion";

/** cadaPasajeros null = cantidad fija por salida, sin importar cuántos viajen. */
export type ReglaEquipo = { idservicio: number; nombreServicio: string; cantidad: number; cadaPasajeros: number | null };

/** Los equipos con regla de la copia del paquete (las fotos anteriores a B2 no tienen). */
export const reglasEquipo = (d: Pick<DefinicionPaquete, "servicios"> | null | undefined): ReglaEquipo[] =>
  (d?.servicios ?? []).flatMap((s) =>
    s.tipo === TIPO_SERVICIO.EQUIPAMIENTO && s.cantidad
      ? [{ idservicio: s.idservicio, nombreServicio: s.nombreServicio, cantidad: s.cantidad, cadaPasajeros: s.cadaPasajeros ?? null }]
      : []
  );

/** ceil(pasajeros / cadaPasajeros) × cantidad; la fija por salida, la cantidad apenas hay un pasajero. */
export const necesidad = (pasajeros: number, r: Pick<ReglaEquipo, "cantidad" | "cadaPasajeros">) =>
  r.cadaPasajeros ? Math.ceil(pasajeros / r.cadaPasajeros) * r.cantidad : pasajeros > 0 ? r.cantidad : 0;

/** El mayor tamaño con el que lo libre cubre la salida completa (para sugerirlo en el 409). */
export const tamanoQueAlcanza = (libre: number, r: Pick<ReglaEquipo, "cantidad" | "cadaPasajeros">) =>
  r.cadaPasajeros ? Math.max(0, Math.floor(libre / r.cantidad) * r.cadaPasajeros) : libre >= r.cantidad ? Infinity : 0;

type FilaSalida = { idservicio: number; cantidad: number; salida: { estado: string; tamanoMaximo: number; definicionPaquete: unknown } };

/** A2b: una salida que todavía no se confirmó puede llegar a necesitar lo de vendida completa. */
export function demandaProyectada(o: FilaSalida) {
  if (o.salida.estado !== ESTADO_SALIDA.PUBLICADA) return o.cantidad;
  const regla = reglasEquipo(o.salida.definicionPaquete as DefinicionPaquete | null).find((r) => r.idservicio === o.idservicio);
  return regla ? Math.max(o.cantidad, necesidad(o.salida.tamanoMaximo, regla)) : o.cantidad;
}

/** El día con menos libre del rango. */
export function peorDia(total: number, ocupaciones: OcupacionDias[], desde: Date, hasta: Date) {
  let peor = { libre: Infinity, fecha: claveDia(desde) };
  for (const [fecha, ocupado] of ocupadoPorDia(ocupaciones, desde, hasta)) {
    if (total - ocupado < peor.libre) peor = { libre: total - ocupado, fecha };
  }
  return peor;
}

export type FilaEquipo = OcupacionDias & { idsalida: number; idservicio: number; proyectada: number };

/**
 * Cómo está un equipo para una salida (la salida puede no existir todavía: idsalida undefined).
 * - libre y fechaCritica: total − demanda proyectada de las OTRAS salidas, el peor día (A2b).
 * - falta: lo que la ocupación real de todas supera al total el peor día, hasta lo que ocupa ésta (FALTA_RECURSO).
 */
export function controlEquipo(
  regla: ReglaEquipo,
  total: number,
  filas: FilaEquipo[],
  salida: { idsalida?: number; fechaInicio: Date; fechaFin: Date; tamanoMaximo: number },
  vendidos: number
) {
  const { desde, hasta } = rangosDe(TIPO_SERVICIO.EQUIPAMIENTO, salida)[0]!;
  const delServicio = filas.filter((f) => f.idservicio === regla.idservicio);
  const propias = delServicio.filter((f) => f.idsalida === salida.idsalida);
  const otras = delServicio.filter((f) => f.idsalida !== salida.idsalida).map((f) => ({ ...f, cantidad: f.proyectada }));

  const necesitaCompleta = necesidad(salida.tamanoMaximo, regla);
  const proyectado = peorDia(total, otras, desde, hasta);
  const libre = Math.max(0, proyectado.libre);
  const ocupado = propias.reduce((t, f) => t + f.cantidad, 0);
  const real = peorDia(total, delServicio, desde, hasta);
  const necesita = necesidad(vendidos, regla);
  return {
    ...regla,
    necesitaCompleta,
    libre,
    fechaCritica: proyectado.fecha,
    nivel: libre >= necesitaCompleta ? "OK" : libre >= necesitaCompleta * COBERTURA_MINIMA_STOCK ? "RIESGO" : "NO_ALCANZA",
    necesita,
    ocupado,
    // lo que no está ocupado de la necesidad, o lo ocupado que el stock no cubre
    falta: Math.max(necesita - ocupado, Math.min(ocupado, Math.max(0, -real.libre))),
    fechaFalta: real.fecha,
  } as const;
}
