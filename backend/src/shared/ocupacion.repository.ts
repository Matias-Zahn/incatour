/**
 * A1: acceso común a Ocupacion. Cuentan las ocupaciones de las salidas no canceladas, hasta su `hasta`: una salida
 * finalizada sigue ocupando sus noches posteriores de hotel y el reacondicionamiento del equipo. Las de canceladas se borran.
 * Concurrencia: quien va a ocupar bloquea antes el ServicioBase (orden Salida → Personal → ServicioBase).
 */
import { Prisma } from "@prisma/client";
import { ESTADO_RESERVA, ESTADO_SALIDA, TIPO_SERVICIO } from "./constantes";
import { DefinicionPaquete } from "./definicionPaquete";
import { demandaProyectada, necesidad, reglasEquipo } from "./equipo";
import { disponibleEnRango, Rango, totalDe } from "./ocupacion";

type Cliente = Prisma.TransactionClient;
type ServicioConTotal = Parameters<typeof totalDe>[0] & { idservicio: number };

export async function bloquearServicio(tx: Cliente, idservicio: number) {
  await tx.$queryRaw`SELECT 1 FROM public."ServicioBase" WHERE idservicio = ${idservicio} FOR UPDATE`;
}

export function ocupacionesDe(tx: Cliente, idservicios: number[], desde: Date, hasta: Date, excluirIdsalida?: number) {
  return tx.ocupacion.findMany({
    where: {
      idservicio: { in: idservicios },
      desde: { lte: hasta },
      hasta: { gte: desde },
      salida: { estado: { not: ESTADO_SALIDA.CANCELADA }, ...(excluirIdsalida && { idsalida: { not: excluirIdsalida } }) },
    },
  });
}

/** Lo disponible de cada servicio en todos los rangos (el menor). Sin rangos, el total. No bloquea: es para listar. */
export async function disponibles(tx: Cliente, servicios: ServicioConTotal[], rangos: Rango[], excluirIdsalida?: number) {
  const resultado = new Map(servicios.map((s) => [s.idservicio, totalDe(s)]));
  if (!servicios.length || !rangos.length) return resultado;
  const desde = new Date(Math.min(...rangos.map((r) => r.desde.getTime())));
  const hasta = new Date(Math.max(...rangos.map((r) => r.hasta.getTime())));
  const todas = await ocupacionesDe(tx, servicios.map((s) => s.idservicio), desde, hasta, excluirIdsalida);
  for (const s of servicios) {
    const propias = todas.filter((o) => o.idservicio === s.idservicio);
    resultado.set(s.idservicio, Math.min(...rangos.map((r) => disponibleEnRango(totalDe(s), propias, r.desde, r.hasta))));
  }
  return resultado;
}

/** Bloquea el servicio y después calcula lo disponible: dos operaciones que se disputan las mismas unidades se serializan. */
export async function disponible(tx: Cliente, idservicio: number, rangos: Rango[], excluirIdsalida?: number) {
  await bloquearServicio(tx, idservicio);
  const servicio = await tx.servicioBase.findUnique({ where: { idservicio }, include: { alojamiento: true, equipamiento: true, transporte: true } });
  if (!servicio) return 0;
  return (await disponibles(tx, [servicio], rangos, excluirIdsalida)).get(idservicio)!;
}

export function ocupar(
  tx: Cliente,
  o: {
    idservicio: number; idsalida: number; tipo: string; rangos: Rango[]; cantidad: number; comprobante?: string | undefined;
    plazasLibres?: number | null; // B10: solo el hotel con bloqueo
  }
) {
  return tx.ocupacion.createMany({
    data: o.rangos.map((r) => ({
      idservicio: o.idservicio,
      idsalida: o.idsalida,
      tipo: o.tipo,
      desde: r.desde,
      hasta: r.hasta,
      cantidad: o.cantidad,
      comprobanteReserva: o.comprobante ?? null,
      plazasLibres: o.plazasLibres ?? null,
    })),
  });
}

/** B10 y 12.2: las plazas de una reserva vuelven a su hotel en la salida (solo los de bloqueo llevan plazasLibres). */
export function devolverPlazas(tx: Cliente, idsalida: number, idservicio: number, cantidad: number) {
  return tx.ocupacion.updateMany({
    where: { idsalida, idservicio, tipo: TIPO_SERVICIO.ALOJAMIENTO, plazasLibres: { not: null } },
    data: { plazasLibres: { increment: cantidad } },
  });
}

/** Borra la ocupación de la salida (de un servicio o de todos). Devuelve cuántas filas borró. */
export async function liberar(tx: Cliente, idsalida: number, idservicio?: number) {
  return (await tx.ocupacion.deleteMany({ where: { idsalida, ...(idservicio && { idservicio }) } })).count;
}

/** A2b: las ocupaciones de equipo que tocan el rango, con la demanda proyectada de cada salida, y el total de cada equipo. */
export async function cargarEquipo(tx: Cliente, idservicios: number[], desde: Date, hasta: Date) {
  if (!idservicios.length) return { totales: new Map<number, number>(), filas: [] };
  const [servicios, filas] = await Promise.all([
    tx.servicioEquipamiento.findMany({ where: { idservicio: { in: idservicios } }, select: { idservicio: true, cantidadTotal: true } }),
    tx.ocupacion.findMany({
      where: {
        idservicio: { in: idservicios },
        tipo: TIPO_SERVICIO.EQUIPAMIENTO,
        desde: { lte: hasta },
        hasta: { gte: desde },
        salida: { estado: { not: ESTADO_SALIDA.CANCELADA } },
      },
      include: { salida: { select: { estado: true, tamanoMaximo: true, definicionPaquete: true } } },
    }),
  ]);
  return {
    totales: new Map(servicios.map((s) => [s.idservicio, s.cantidadTotal])),
    filas: filas.map((o) => ({ ...o, proyectada: demandaProyectada(o) })),
  };
}

/**
 * B4 y 12.1: la ocupación de cada equipo de la copia del paquete pasa a ceil(vendidos / cadaPasajeros) × cantidad.
 * Se guarda el valor (no se suma ni se resta), aunque supere el stock: la venta no se frena y la salida muestra FALTA_RECURSO.
 * Va dentro de la transacción de la compra o de la cancelación, con la Salida ya bloqueada (FOR UPDATE).
 * Solo toca las filas que creó el alta (CU-36): si CU-39 sacó un equipo, la compra no lo vuelve a poner.
 */
export async function recalcularEquipo(tx: Cliente, idsalida: number) {
  const salida = await tx.salida.findUnique({ where: { idsalida }, select: { definicionPaquete: true } });
  const reglas = reglasEquipo(salida?.definicionPaquete as DefinicionPaquete | null);
  if (!reglas.length) return;
  const vendidos = await tx.reservaPasajero.count({ where: { reserva: { idsalida, estado: ESTADO_RESERVA.CONFIRMADA } } });
  for (const r of reglas) {
    await tx.ocupacion.updateMany({
      where: { idsalida, idservicio: r.idservicio, tipo: TIPO_SERVICIO.EQUIPAMIENTO },
      data: { cantidad: necesidad(vendidos, r) },
    });
  }
}
