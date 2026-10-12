import { db } from "../../../config/postgresDatabase";
import {
  ESTADO_PERMISO,
  ESTADO_RESERVA,
  ESTADO_SALIDA,
  ESTADO_SOLICITUD,
  SALIDAS_NO_INICIADAS,
  redondear2,
} from "../../../shared/constantes";

export class CancelacionSalidaRepository {
  // Todo lo necesario para validar, mostrar el impacto y decidir
  async findParaCancelar(idsalida: number) {
    return db.salida.findUnique({
      where: { idsalida },
      select: {
        idsalida: true,
        nroSalida: true,
        estado: true,
        fechaInicio: true,
        idbloqueo: true,
        idpaquete: true,
        paquete: { select: { nombrePaquete: true } },
        reservas: {
          where: { estado: ESTADO_RESERVA.CONFIRMADA },
          select: {
            idreserva: true,
            pagos: { select: { monto: true } },
            permisos: { select: { estadoTramite: true } },
          },
        },
        permisos: { select: { estadoTramite: true } },
        personalAsignado: { select: { idpersonal: true } },
        equipamientos: { select: { cantidad: true } },
        servicios: { select: { tipo: true } },
      },
    });
  }

  /**
   * CU-37: cancelación en una única transacción. Devuelve null si otra petición ya la canceló
   * o si el recorrido empezó mientras tanto.
   *
   * Las filas de asignación de personal, transporte, alojamiento y equipamiento se CONSERVAN como
   * historial; los recursos quedan libres porque toda consulta de disponibilidad considera solo las
   * salidas activas (la salida pasa a CANCELADA). El stock de equipamiento sí se reintegra.
   */
  async ejecutarCancelacion(p: {
    idsalida: number;
    idusuario: number;
    emailUsuario: string;
    motivo: string;
    estadoAnterior: string;
  }) {
    return db.$transaction(
      async (tx) => {
        const guarda = await tx.salida.updateMany({
          where: { idsalida: p.idsalida, estado: { in: SALIDAS_NO_INICIADAS }, fechaInicio: { gt: new Date() } },
          data: { estado: ESTADO_SALIDA.CANCELADA },
        });
        if (guarda.count === 0) return null;

        // Permisos nominales emitidos -> Perdido (control y auditoría)
        await tx.permisoPersonal.updateMany({
          where: { idsalida: p.idsalida, estadoTramite: ESTADO_PERMISO.EMITIDO },
          data: { estadoTramite: ESTADO_PERMISO.PERDIDO },
        });
        await tx.permisoPasajero.updateMany({
          where: { estadoTramite: ESTADO_PERMISO.EMITIDO, reserva: { idsalida: p.idsalida } },
          data: { estadoTramite: ESTADO_PERMISO.PERDIDO },
        });

        // Equipamiento: se reintegra al stock interno del proveedor
        const equipos = await tx.salidaEquipamiento.findMany({ where: { idsalida: p.idsalida } });
        for (const e of equipos) {
          await tx.servicioEquipamiento.update({
            where: { idservicio: e.idservicio },
            data: { cantidadDisponible: { increment: e.cantidad } },
          });
        }

        // Reservas confirmadas (se leen dentro de la transacción: son las que se cancelan)
        const reservas = await tx.reserva.findMany({
          where: { idsalida: p.idsalida, estado: ESTADO_RESERVA.CONFIRMADA },
          select: {
            idreserva: true,
            nroReserva: true,
            cantidadPasajeros: true,
            pagos: { select: { monto: true } },
            cliente: { select: { usuario: { select: { email: true } } } },
          },
        });
        const afectadas = reservas.map((r) => ({
          idreserva: r.idreserva,
          nroReserva: r.nroReserva,
          cantidadPasajeros: r.cantidadPasajeros,
          email: r.cliente.usuario.email,
          montoReembolsado: redondear2(r.pagos.reduce((acc, pago) => acc + pago.monto, 0)),
        }));

        // Se dan de baja las solicitudes de alojamiento pendientes
        await tx.solicitud.updateMany({
          where: { estado: ESTADO_SOLICITUD.PENDIENTE, reserva: { idsalida: p.idsalida } },
          data: { estado: ESTADO_SOLICITUD.CANCELADA },
        });

        // Reservas -> Cancelada, con el reembolso del 100% del importe abonado
        await tx.reserva.updateMany({
          where: { idsalida: p.idsalida, estado: ESTADO_RESERVA.CONFIRMADA },
          data: { estado: ESTADO_RESERVA.CANCELADA },
        });
        if (afectadas.length > 0) {
          await tx.reembolso.createMany({
            data: afectadas.map((r) => ({
              idreserva: r.idreserva,
              idusuario: p.idusuario,
              montoReembolsado: r.montoReembolsado,
              motivo: p.motivo,
            })),
          });
        }

        const reembolsoTotal = redondear2(afectadas.reduce((acc, r) => acc + r.montoReembolsado, 0));
        await tx.registroAuditoria.create({
          data: {
            idsalida: p.idsalida,
            usuario: p.emailUsuario,
            motivo: p.motivo,
            cambios: {
              accion: "CANCELAR_SALIDA",
              antes: { estado: p.estadoAnterior },
              despues: { estado: ESTADO_SALIDA.CANCELADA },
              reservasCanceladas: afectadas.map((r) => r.idreserva),
              reembolsoTotal,
            },
          },
        });

        return { reservas: afectadas, reembolsoTotal };
      },
      { timeout: 20000 }
    );
  }

  // DCD buscarSalidasAlternativas: otras salidas publicadas del mismo paquete con lugares
  async findAlternativas(idpaquete: number, idsalidaExcluida: number) {
    return db.salida.findMany({
      where: {
        idpaquete,
        idsalida: { not: idsalidaExcluida },
        estado: ESTADO_SALIDA.PUBLICADA,
        stockLocal: { gt: 0 },
        fechaInicio: { gt: new Date() },
      },
      orderBy: { fechaInicio: "asc" },
      take: 5,
      select: { idsalida: true, stockLocal: true, fechaInicio: true, paquete: { select: { nombrePaquete: true } } },
    });
  }
}