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
import { ItemCamping } from "./asignacion.dto";

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
  async personalLibre(salida: { idsalida: number; fechaInicio: Date; fechaFin: Date }, ids?: number[]) {
    return db.personal.findMany({
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
  }) {
    const { idsalida } = p.salida;
    return db.$transaction(async (tx) => {
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
      const plazasSobrantes = p.salida.stockLocalAlojamiento ?? 0;
      if (hotel && plazasSobrantes > 0) {
        await tx.servicioAlojamiento.update({
          where: { idservicio: hotel.idservicio },
          data: { capacidadDisponible: { increment: plazasSobrantes } },
        });
      }

      // Con el personal asignado y los permisos emitidos, la venta queda cerrada
      return tx.salida.update({
        where: { idsalida },
        data: { estado: "CERRADA", stockLocal: 0, stockLocalAlojamiento: 0 },
        include: {
          personalAsignado: { include: { personal: { select: { nombreCompleto: true, rol: true } } } },
          servicios: { include: { servicio: { select: { nombreServicio: true } } } },
          equipamientos: true,
        },
      });
    });
  }
}
