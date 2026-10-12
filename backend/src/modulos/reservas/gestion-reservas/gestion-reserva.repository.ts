import { db } from "../../../config/postgresDatabase";
import { ESTADO_PERMISO, ESTADO_RESERVA, ESTADO_SOLICITUD } from "../../../shared/constantes";
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

  // CU-31 (administrador)
  async findConFiltros(f: FiltrosReservaDto) {
    return db.reserva.findMany({
      where: {
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
      },
      include: INCLUDE_RESUMEN,
      orderBy: { fechaRealizacion: "desc" },
      take: f.limite,
    });
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
   */
  async cancelarReserva(p: {
    idreserva: number;
    idsalida: number;
    idusuario: number;
    motivo: string;
    montoReembolsado: number;
    cantidadPasajeros: number;
    permisosEmitidos: boolean;
    alojamientoPorStock: boolean;
  }) {
    return db.$transaction(async (tx) => {
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

      const reponerLugares = !p.permisosEmitidos;
      if (reponerLugares || p.alojamientoPorStock) {
        await tx.salida.update({
          where: { idsalida: p.idsalida },
          data: {
            ...(reponerLugares && { stockLocal: { increment: p.cantidadPasajeros } }),
            ...(p.alojamientoPorStock && { stockLocalAlojamiento: { increment: p.cantidadPasajeros } }),
          },
        });
      }

      return reembolso;
    });
  }
}