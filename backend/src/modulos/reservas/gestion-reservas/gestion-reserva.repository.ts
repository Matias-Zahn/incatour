import { Prisma } from "@prisma/client";
import { db } from "../../../config/postgresDatabase";
import { ESTADO_PERMISO, ESTADO_RESERVA, ESTADO_SALIDA, ESTADO_SOLICITUD, TIPO_SERVICIO } from "../../../shared/constantes";
import { FiltrosMisReservasDto, FiltrosReservaDto } from "./gestion-reserva.dto";

const INCLUDE_RESUMEN = {
  salida: {
    select: {
      idsalida: true,
      nroSalida: true,
      estado: true,
      fechaInicio: true,
      fechaFin: true,
      paquete: { select: { idpaquete: true, nombrePaquete: true } },
    },
  },
  pagos: true,
  reembolsos: true,
  cliente: {
    select: { idcliente: true, usuario: { select: { nombre: true, apellido: true, email: true } } },
  },
} as const;

export class GestionReservaRepository {
  async findClientePorUsuario(idusuario: number) {
    return db.cliente.findUnique({ where: { idusuario } });
  }

  // CU-31 (cliente)
  async findMisReservas(idcliente: number, filtros: FiltrosMisReservasDto) {
    return db.reserva.findMany({
      where: { idcliente, ...(filtros.estado && { estado: filtros.estado }) },
      include: INCLUDE_RESUMEN,
      orderBy: { fechaRealizacion: "desc" },
    });
  }

  // CU-31 (administrador): una página y el total, para que el listado no corte en silencio
  async findConFiltros(f: FiltrosReservaDto) {
    const where = {
        ...(f.estado && { estado: f.estado }),
        ...(f.titular && {
          cliente: {
            usuario: {
              OR: [
                { nombre: { contains: f.titular, mode: "insensitive" } },
                { apellido: { contains: f.titular, mode: "insensitive" } },
                { email: { contains: f.titular, mode: "insensitive" } },
              ],
            },
          },
        }),
        ...(f.pasajero && {
          pasajeros: {
            some: {
              pasajero: {
                OR: [
                  { nombreCompleto: { contains: f.pasajero, mode: "insensitive" } },
                  { nroPasaporte: { contains: f.pasajero, mode: "insensitive" } },
                ],
              },
            },
          },
        }),
        ...((f.idpaquete || f.fechaDesde || f.fechaHasta) && {
          salida: {
            ...(f.idpaquete && { idpaquete: f.idpaquete }),
            ...((f.fechaDesde || f.fechaHasta) && {
              fechaInicio: { ...(f.fechaDesde && { gte: f.fechaDesde }), ...(f.fechaHasta && { lte: f.fechaHasta }) },
            }),
          },
        }),
    } satisfies Prisma.ReservaWhereInput;

    const [reservas, total] = await Promise.all([
      db.reserva.findMany({
        where,
        include: INCLUDE_RESUMEN,
        orderBy: { fechaRealizacion: "desc" },
        skip: (f.pagina - 1) * f.limite,
        take: f.limite,
      }),
      db.reserva.count({ where }),
    ]);
    return { reservas, total };
  }

  // CU-31: detalle con itinerario, pasajeros y situación de pago
  async findDetalle(idreserva: number) {
    return db.reserva.findUnique({
      where: { idreserva },
      include: {
        cliente: { select: { idcliente: true, idusuario: true, usuario: { select: { nombre: true, apellido: true, email: true } } } },
        salida: {
          include: {
            paquete: {
              select: {
                idpaquete: true,
                nombrePaquete: true,
                tarifas: { include: { temporada: true } },
                circuito: {
                  select: {
                    nombreCircuito: true,
                    duracionDias: true,
                    etapas: { orderBy: { numeroOrden: "asc" }, select: { numeroOrden: true, puntoInicio: true, puntoFin: true, campamentoPrevisto: true } },
                  },
                },
              },
            },
          },
        },
        pasajeros: { include: { pasajero: { select: { idpasajero: true, nombreCompleto: true, nroPasaporte: true, nacionalidad: true } } } },
        pagos: { orderBy: { fechahora: "asc" } },
        reembolsos: true,
        solicitudes: { select: { nroSolicitud: true, estado: true, cantidadPlazas: true } },
        permisos: { select: { idpasajero: true, nroPermiso: true, estadoTramite: true, fechaEmision: true } },
      },
    });
  }

  // CU-32: todo lo necesario para decidir y ejecutar la cancelación
  async findParaCancelacion(idreserva: number) {
    return db.reserva.findUnique({
      where: { idreserva },
      include: {
        cliente: { select: { idcliente: true, idusuario: true, usuario: { select: { email: true } } } },
        salida: { select: { idsalida: true, nroSalida: true, estado: true, fechaInicio: true } },
        pagos: true,
        permisos: { select: { idpermisopasajero: true, estadoTramite: true } },
        solicitudes: { select: { idsolicitud: true, estado: true } },
      },
    });
  }

  /**
   * CU-32: cancelación atómica. Devuelve null si otra petición ya la canceló (guarda por estado).
   *  - Reserva -> Cancelada y se asienta el REEMBOLSO (usuario, motivo, importe; puede ser $0).
   *  - Permisos emitidos -> Perdido (y el stock local NO se repone).
   *  - Sin permisos emitidos: el stock local recupera los lugares.
   *  - Alojamiento: se liberan las plazas bloqueadas o se cancela la solicitud vinculada.
   *  - Salida CERRADA (RES-13): no se vende más, así que el stock local no se toca y las plazas vuelven al hotel.
   *  - RES-14: bloquea la salida (mismo orden que CU-40) y devuelve "CAMBIO" si los permisos o el estado de la
   *    salida ya no son los que se usaron para calcular el reintegro; el servicio recalcula y reintenta.
   */
  async cancelarReserva(p: {
    idreserva: number;
    idsalida: number;
    idusuario: number;
    motivo: string;
    montoReembolsado: number;
    condicionAplicada: string;
    cantidadPasajeros: number;
    permisosEmitidos: boolean;
    alojamientoPorStock: boolean;
    salidaEnVenta: boolean;
  }) {
    return db.$transaction(async (tx) => {
      const [salida] = await tx.$queryRaw<{ estado: string }[]>`
        SELECT estado FROM public."Salida" WHERE idsalida = ${p.idsalida} FOR UPDATE`;
      const emitidos = await tx.permisoPasajero.count({
        where: { idreserva: p.idreserva, estadoTramite: ESTADO_PERMISO.EMITIDO },
      });
      if (emitidos > 0 !== p.permisosEmitidos || (salida?.estado === ESTADO_SALIDA.PUBLICADA) !== p.salidaEnVenta) {
        return "CAMBIO" as const;
      }

      const guarda = await tx.reserva.updateMany({
        where: { idreserva: p.idreserva, estado: ESTADO_RESERVA.CONFIRMADA },
        data: { estado: ESTADO_RESERVA.CANCELADA },
      });
      if (guarda.count === 0) return null;

      const reembolso = await tx.reembolso.create({
        data: {
          idreserva: p.idreserva,
          idusuario: p.idusuario,
          montoReembolsado: p.montoReembolsado,
          motivo: p.motivo,
          condicionAplicada: p.condicionAplicada,
        },
      });

      if (p.permisosEmitidos) {
        await tx.permisoPasajero.updateMany({
          where: { idreserva: p.idreserva, estadoTramite: ESTADO_PERMISO.EMITIDO },
          data: { estadoTramite: ESTADO_PERMISO.PERDIDO },
        });
      }

      await tx.solicitud.updateMany({
        where: { idreserva: p.idreserva, estado: { in: [ESTADO_SOLICITUD.PENDIENTE, ESTADO_SOLICITUD.CONFIRMADA] } },
        data: { estado: ESTADO_SOLICITUD.CANCELADA },
      });

      const reponerLugares = !p.permisosEmitidos && p.salidaEnVenta;
      const reponerPlazas = p.alojamientoPorStock && p.salidaEnVenta;
      if (reponerLugares || reponerPlazas) {
        await tx.salida.update({
          where: { idsalida: p.idsalida },
          data: {
            ...(reponerLugares && { stockLocal: { increment: p.cantidadPasajeros } }),
            ...(reponerPlazas && { stockLocalAlojamiento: { increment: p.cantidadPasajeros } }),
          },
        });
      }
      if (p.alojamientoPorStock && !p.salidaEnVenta) {
        const hotel = await tx.salidaServicio.findFirst({
          where: { idsalida: p.idsalida, tipo: TIPO_SERVICIO.ALOJAMIENTO },
          select: { idservicio: true },
        });
        if (hotel) {
          await tx.servicioAlojamiento.update({
            where: { idservicio: hotel.idservicio },
            data: { capacidadDisponible: { increment: p.cantidadPasajeros } },
          });
        }
      }

      return reembolso;
    });
  }
}