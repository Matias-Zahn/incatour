import { Prisma } from "@prisma/client";
import { db } from "../../../config/postgresDatabase";
import { CustomError } from "../../../error/CustomError";
import { ESTADO, ESTADO_PERMISO, ESTADO_RESERVA, ESTADO_SALIDA, SALIDAS_ACTIVAS, TIPO_SERVICIO } from "../../../shared/constantes";
import { PermisoEmitido, PermisoRechazado } from "../../../integraciones/autoridad/autoridad.interface";

export type SalidaParaAsignar = NonNullable<Awaited<ReturnType<AsignacionRepository["buscarSalida"]>>>;

export class AsignacionRepository {
  async buscarSalida(idsalida: number) {
    return db.salida.findUnique({
      where: { idsalida },
      include: {
        paquete: { include: { circuito: true } },
        // 12.3: la aptitud se vuelve a controlar al confirmar, y el personal va a la nómina
        personalAsignado: { include: { personal: { include: { guia: { include: { usuario: { select: { estado: true } } } } } } } },
        reservas: {
          where: { estado: ESTADO_RESERVA.CONFIRMADA },
          include: { pasajeros: { include: { pasajero: true } } },
        },
        ocupaciones: {
          include: {
            servicio: {
              select: {
                idproveedor: true,
                nombreServicio: true,
                proveedor: { select: { razonSocial: true } },
                transporte: { select: { capacidadVehiculo: true } },
                alojamiento: { select: { modalidadConfirmacion: true } },
                equipamiento: { select: { tipoEquipamiento: true } },
              },
            },
          },
          orderBy: { idocupacion: "asc" },
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
        // FIX CTA-18: Si es un guía, debe poseer una cuenta de usuario vinculada y ACTIVA
        OR: [
          { guia: { is: null } }, // Personal no guía (ej: porteadores)
          { guia: { is: { usuario: { is: { estado: ESTADO.ACTIVO } } } } },
        ],
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
      include: { guia: { include: { usuario: true } } },
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

  /** Cuántas salidas no canceladas tiene cada persona que empiezan en el mes de `fecha` (el mismo criterio que CU-36). */
  async salidasEnElMes(ids: number[], fecha: Date) {
    const inicioMes = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
    const finMes = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 1));
    const delMes = await db.asignacionPersonal.groupBy({
      by: ["idpersonal"],
      where: { idpersonal: { in: ids }, salida: { estado: { not: ESTADO_SALIDA.CANCELADA }, fechaInicio: { gte: inicioMes, lt: finMes } } },
      _count: true,
    });
    return new Map(delMes.map((g) => [g.idpersonal, g._count]));
  }

  async buscarPersonal(ids: number[]) {
    return db.personal.findMany({ where: { idpersonal: { in: ids } }, include: { guia: { include: { usuario: true } } } });
  }

  /** CU-40 de una salida anterior a la etapa 3: le asigna el personal, si sigue sin personal y la gente está libre en esas fechas. */
  async asignarPersonal(salida: { idsalida: number; fechaInicio: Date; fechaFin: Date }, ids: number[]) {
    const { idsalida } = salida;
    await db.$transaction(async (tx) => {
      // Orden de bloqueos: Salida → Personal, el de CU-38 y CU-40
      const [fila] = await tx.$queryRaw<{ estado: string }[]>`SELECT estado FROM public."Salida" WHERE idsalida = ${idsalida} FOR UPDATE`;
      if (fila?.estado !== ESTADO_SALIDA.PUBLICADA || (await tx.asignacionPersonal.count({ where: { idsalida } })) > 0) {
        throw CustomError.conflict("La salida cambió mientras se confirmaba. Volvé a cargar el panel");
      }
      if ((await this.personalOcupado(tx, salida, ids)).length) {
        throw CustomError.conflict("Parte del personal elegido se asignó a otra salida en esas fechas. Volvé a cargar las opciones");
      }
      await tx.asignacionPersonal.createMany({ data: ids.map((idpersonal) => ({ idsalida, idpersonal })) });
    });
  }

  /**
   * CU-40 pasos 11 y 14, en una transacción: registrar los permisos emitidos y los rechazados (RF-47), devolver al hotel
   * las plazas que no se vendieron y pasar la salida a CERRADA. Los permisos ya los emitió la autoridad antes de entrar acá.
   */
  async confirmar(p: {
    salida: SalidaParaAsignar;
    permisos: PermisoEmitido[];
    rechazados: PermisoRechazado[];
    reservaDePasajero: Map<number, number>;
    lugaresPorLiberar: number;
    porteadoresQuitados?: number[];
  }) {
    const { idsalida } = p.salida;
    return db.$transaction(async (tx) => {
      // Lock de la salida (mismo orden que la compra, CU-32 y CU-39): una compra o un reemplazo en paralelo se detecta acá
      const [fila] = await tx.$queryRaw<{ estado: string }[]>`
        SELECT estado FROM public."Salida" WHERE idsalida = ${idsalida} FOR UPDATE`;
      const vendidos = p.salida.reservas.reduce((t, r) => t + r.pasajeros.length, 0);
      const confirmados = await tx.reservaPasajero.count({ where: { reserva: { idsalida, estado: ESTADO_RESERVA.CONFIRMADA } } });
      const personal = await tx.asignacionPersonal.findMany({ where: { idsalida }, select: { idpersonal: true } });
      const mismoPersonal =
        personal.length === p.salida.personalAsignado.length &&
        personal.every((a) => p.salida.personalAsignado.some((b) => b.idpersonal === a.idpersonal));
      if (fila?.estado !== ESTADO_SALIDA.PUBLICADA || confirmados !== vendidos || !mismoPersonal) {
        throw CustomError.conflict("La salida cambió mientras se confirmaba. Volvé a cargar el panel");
      }

      // Decisión 5: los porteadores que sobran para lo vendido quedan libres para otras salidas
      if (p.porteadoresQuitados?.length) {
        await tx.asignacionPersonal.deleteMany({ where: { idsalida, idpersonal: { in: p.porteadoresQuitados } } });
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

      // RF-47: quien quedó sin permiso se registra como Rechazado, sin número, y no afecta a los demás
      const sinNumero = { nroPermiso: null, fechaEmision: new Date(), estadoTramite: ESTADO_PERMISO.RECHAZADO };
      for (const { titular } of p.rechazados) {
        if (titular.tipo === "PASAJERO") {
          await tx.permisoPasajero.create({
            data: { ...sinNumero, idpasajero: titular.id, idreserva: p.reservaDePasajero.get(titular.id)! },
          });
        } else {
          await tx.permisoPersonal.create({ data: { ...sinNumero, idsalida, idpersonal: titular.id } });
        }
      }

      // Las plazas de hotel bloqueadas que no se vendieron vuelven al proveedor (regla 7 del CU-36): baja la ocupación
      // de cada hotel lo que le quedó libre (B10)
      await tx.$executeRaw`
        UPDATE public."Ocupacion" SET cantidad = cantidad - "plazasLibres", "plazasLibres" = 0
        WHERE idsalida = ${idsalida} AND tipo = ${TIPO_SERVICIO.ALOJAMIENTO} AND "plazasLibres" > 0`;

      // Confirmada (decisión 1): ya no se vende
      return tx.salida.update({
        where: { idsalida },
        data: { estado: ESTADO_SALIDA.CERRADA, stockLocal: 0, stockLocalAlojamiento: 0, lugaresPorLiberar: p.lugaresPorLiberar },
        select: { idsalida: true, nroSalida: true, estado: true },
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
