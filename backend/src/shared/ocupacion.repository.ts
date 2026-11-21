/**
 * A1: acceso común a Ocupacion. Cuentan las ocupaciones de las salidas no canceladas, hasta su `hasta`: una salida
 * finalizada sigue ocupando sus noches posteriores de hotel y el reacondicionamiento del equipo. Las de canceladas se borran.
 * Concurrencia: quien va a ocupar bloquea antes el ServicioBase (orden Salida → Personal → ServicioBase).
 */
import { Prisma } from "@prisma/client";
import { ESTADO_SALIDA } from "./constantes";
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
  o: { idservicio: number; idsalida: number; tipo: string; rangos: Rango[]; cantidad: number; comprobante?: string | undefined }
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
    })),
  });
}

/** Borra la ocupación de la salida (de un servicio o de todos). Devuelve cuántas filas borró. */
export async function liberar(tx: Cliente, idsalida: number, idservicio?: number) {
  return (await tx.ocupacion.deleteMany({ where: { idsalida, ...(idservicio && { idservicio }) } })).count;
}
