import { Prisma } from "@prisma/client";
import { db } from "../../../config/postgresDatabase";
import { CustomError } from "../../../error/CustomError";
import {
  ESTADO,
  ESTADO_PERMISO,
  ESTADO_RESERVA,
  SALIDAS_ACTIVAS,
  TIPO_SERVICIO,
} from "../../../shared/constantes";
import { PermisoEmitido } from "../../../integraciones/autoridad/autoridad.interface";
import { LogisticaRepository } from "../logistica/logistica.repository";
import { ItemCamping } from "./asignacion.dto";

export const ESTADOS_ASIGNABLES = ["PUBLICADA", "CERRADA"];

export type SalidaParaAsignar = NonNullable<Awaited<ReturnType<AsignacionRepository["buscarSalida"]>>>;

export class AsignacionRepository {
  async buscarSalida(idsalida: number) {
    return db.salida.findUnique({
      where: { idsalida },
      include: {
        paquete: { include: { circuito: true } },
        personalAsignado: true,
        servicios: true,
        reservas: {
          where: { estado: ESTADO_RESERVA.CONFIRMADA },
          include: { pasajeros: { include: { pasajero: true } } },
        },
      },
    });
  }

  // Personal ACTIVO sin otra salida activa que se superponga con estas fechas (FA1)
  async personalLibre(salida: { idsalida: number; fechaInicio: Date; fechaFin: Date }, ids?: number[], cliente: Prisma.TransactionClient = db) {
    return cliente.personal.findMany({
      where: {
        ...(ids && { idpersonal: { in: ids } }),
        estado: ESTADO.ACTIVO,
        NOT: {
          asignaciones: {
            some: {
              salida: {
                idsalida: { not: salida.idsalida },
                estado: { in: SALIDAS_ACTIVAS },
                fechaInicio: { lte: salida.fechaFin },
                fechaFin: { gte: salida.fechaInicio },
              },
            },
          },
        },
      },
      include: { guia: true },
      orderBy: { nombreCompleto: "asc" },
    });
  }

  // Lock de las filas de Personal: dos asignaciones/reemplazos con la misma persona se serializan (RF-54)
  async personalOcupado(tx: Prisma.TransactionClient, salida: { idsalida: number; fechaInicio: Date; fechaFin: Date }, ids: number[]) {
    if (!ids.length) return [];
    await tx.$queryRaw`SELECT idpersonal FROM public."Personal" WHERE idpersonal IN (${Prisma.join(ids)}) ORDER BY idpersonal FOR UPDATE`;
    const libres = new Set((await this.personalLibre(salida, ids, tx)).map((p) => p.idpersonal));
    return ids.filter((id) => !libres.has(id));
  }

  async buscarPersonal(ids: number[]) {
    return db.personal.findMany({ where: { idpersonal: { in: ids } }, include: { guia: true } });
  }

  /**
   * CU-40 pasos 7 a 11 y 14, en una transacción: asignar personal, transporte y equipamiento,
   * registrar los permisos emitidos, devolver al hotel las plazas que no se vendieron y cerrar la venta.
   * Los permisos ya los emitió la autoridad antes de entrar acá.
   */
  async confirmar(p: {
    salida: SalidaParaAsignar;
    personalIds: number[];
    idtransporte: number;
    itemsCamping: ItemCamping[];
    permisos: PermisoEmitido[];
    reservaDePasajero: Map<number, number>;
    lugaresPorLiberar: number;
  }) {
    const { idsalida } = p.salida;
    return db.$transaction(async (tx) => {
      // Lock de la salida: una compra que confirma en paralelo espera (o ya cerró la salida) y se detecta acá
      // ponytail: la compra en curso al cerrar se cobra y cae en el camino "pago aprobado sin reserva" (la rama fix/martin-externos lo convierte en reembolso)
      const [fila] = await tx.$queryRaw<{ estado: string; stockLocalAlojamiento: number | null }[]>`
        SELECT estado, "stockLocalAlojamiento" FROM public."Salida" WHERE idsalida = ${idsalida} FOR UPDATE`;
      const vendidos = p.salida.reservas.reduce((t, r) => t + r.pasajeros.length, 0);
      const confirmados = await tx.reservaPasajero.count({ where: { reserva: { idsalida, estado: ESTADO_RESERVA.CONFIRMADA } } });
      if (!fila || !ESTADOS_ASIGNABLES.includes(fila.estado) || confirmados !== vendidos) {
        throw CustomError.conflict("La salida cambió mientras se asignaba (se confirmó una compra o ya se asignó). Volvé a cargar el panel");
      }

      if ((await this.personalOcupado(tx, p.salida, p.personalIds)).length) {
        throw CustomError.conflict("Parte del personal elegido se asignó a otra salida en esas fechas. Volvé a cargar el panel");
      }
      const motivo = await new LogisticaRepository().motivoTransporteNoDisponible(tx, p.idtransporte, p.salida, vendidos);
      if (motivo) throw CustomError.conflict(motivo);

      await tx.asignacionPersonal.createMany({
        data: p.personalIds.map((idpersonal) => ({ idsalida, idpersonal })),
      });

      await tx.salidaServicio.create({
        data: { idsalida, idservicio: p.idtransporte, tipo: TIPO_SERVICIO.TRANSPORTE },
      });

      for (const item of p.itemsCamping) {
        // Descuento condicional: si otra salida se llevó el stock en el medio, no descuenta nada (FA2)
        const stock = await tx.servicioEquipamiento.updateMany({
          where: { idservicio: item.idservicio, cantidadDisponible: { gte: item.cantidad } },
          data: { cantidadDisponible: { decrement: item.cantidad } },
        });
        if (stock.count === 0) {
          throw CustomError.badRequest(`No hay stock suficiente del artículo ${item.idservicio}`);
        }
        await tx.salidaEquipamiento.create({
          data: { idsalida, idservicio: item.idservicio, cantidad: item.cantidad },
        });
      }

      for (const permiso of p.permisos) {
        const datos = { nroPermiso: permiso.nroPermiso, fechaEmision: permiso.fechaEmision, estadoTramite: ESTADO_PERMISO.EMITIDO };
        if (permiso.titular.tipo === "PASAJERO") {
          await tx.permisoPasajero.create({
            data: { ...datos, idpasajero: permiso.titular.id, idreserva: p.reservaDePasajero.get(permiso.titular.id)! },
          });
        } else {
          await tx.permisoPersonal.create({ data: { ...datos, idsalida, idpersonal: permiso.titular.id } });
        }
      }

      // Las plazas de hotel bloqueadas que no se vendieron vuelven al proveedor (regla 7 del CU-36)
      const hotel = p.salida.servicios.find((s) => s.tipo === TIPO_SERVICIO.ALOJAMIENTO);
      const plazasSobrantes = fila.stockLocalAlojamiento ?? 0;
      if (hotel && plazasSobrantes > 0) {
        await tx.servicioAlojamiento.update({
          where: { idservicio: hotel.idservicio },
          data: { capacidadDisponible: { increment: plazasSobrantes } },
        });
      }

      // Con el personal asignado y los permisos emitidos, la venta queda cerrada
      return tx.salida.update({
        where: { idsalida },
        data: { estado: "CERRADA", stockLocal: 0, stockLocalAlojamiento: 0, lugaresPorLiberar: p.lugaresPorLiberar },
        include: {
          personalAsignado: { include: { personal: { select: { nombreCompleto: true, rol: true } } } },
          servicios: { include: { servicio: { select: { nombreServicio: true } } } },
          equipamientos: true,
        },
      });
    });
  }

  // SAL-09: se "toma" la cantidad pendiente antes de llamar a la autoridad; dos reintentos en paralelo nunca liberan dos veces
  async tomarSobrantes(idsalida: number, n: number) {
    const { count } = await db.salida.updateMany({ where: { idsalida, lugaresPorLiberar: n }, data: { lugaresPorLiberar: 0 } });
    return count === 1;
  }

  // Si la autoridad falló, la cantidad vuelve a quedar pendiente para el próximo reintento
  async devolverSobrantes(idsalida: number, n: number) {
    await db.salida.updateMany({ where: { idsalida, lugaresPorLiberar: 0 }, data: { lugaresPorLiberar: n } });
  }
}
