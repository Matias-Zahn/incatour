import { db } from "../../../config/postgresDatabase";
import { definicionEfectiva } from "../../../shared/definicionPaquete";
import { CustomError } from "../../../error/CustomError";
import { ESTADO_ALOJAMIENTO, ESTADO_RESERVA, ESTADO_SOLICITUD } from "../../../shared/constantes";

export class SolicitudRepository {
  
  // CU-33 Consultar solicitudes
  async findAllPendientes() {
    return db.solicitud.findMany({
      where: { estado: "PENDIENTE" },
      include: {
        reserva: {
          include: {
            cliente: true,
            salida: {
              include: {
                paquete: true
              }
            }
          }
        }
      }
    });
  }

  // CU-34 Buscar Solicitud Completa
  async buscarPorId(id: number) {
    return db.solicitud.findUnique({
      where: { idsolicitud: id },
      include: {
        reserva: {
          include: {
            salida: {
              include: {
                paquete: true
              }
            },
            cliente: { include: { usuario: { select: { email: true } } } },
            // Historial de toda la reserva: un reintento (-R) es otra solicitud y no trae los rechazos anteriores
            solicitudes: { select: { gestiones: true } }
          }
        }
      }
    });
  }

  // Buscar servicios compatibles excluyendo los rechazados
  async buscarServiciosCompatiblesExcluyendoRechazados(
    tipoHabitacion: string, 
    categoria: string, 
    localidad: string, 
    serviciosRechazadosIds: number[]
  ) {
    return db.servicioBase.findMany({
      where: {
        estado: "ACTIVO",
        localidad: localidad,
        idservicio: {
          notIn: serviciosRechazadosIds
        },
        alojamiento: {
          tipoHabitacion: tipoHabitacion,
          categoria: categoria
        }
      },
      include: {
        alojamiento: true,
        proveedor: true
      }
    });
  }

  // CU-34: Registrar Aceptación (RES-01, RES-05)
  async resolverComoAceptada(solicitudId: number, reservaId: number, servicioId: number) {
    return db.$transaction(async (tx) => {
      // RES-05: Validar dentro de la transacción que la solicitud existe
      const solActual = await tx.solicitud.findUnique({
        where: { idsolicitud: solicitudId },
        include: { reserva: true },
      });

      if (!solActual) {
        throw CustomError.notFound("Solicitud no encontrada.");
      }
      if (solActual.estado !== "PENDIENTE") {
        throw CustomError.badRequest("La solicitud ya no está pendiente.");
      }
      if (solActual.reserva.estado === "CANCELADA") {
        throw CustomError.badRequest("No se puede resolver una solicitud de una reserva cancelada.");
      }

      // RES-05: se bloquea primero la reserva y después la solicitud, en el mismo orden que la
      // cancelación (CU-32). Con el orden inverso, una aceptación y una cancelación simultáneas
      // se bloquean mutuamente (deadlock) y una de las dos termina en 500.

      // 1. RES-01 y RES-05: actualizar la reserva solo si NO está CANCELADA (estadoAlojamiento, no estado)
      const resActualizada = await tx.reserva.updateMany({
        where: { idreserva: reservaId, estado: { not: ESTADO_RESERVA.CANCELADA } },
        data: { estadoAlojamiento: ESTADO_ALOJAMIENTO.CONFIRMADO }
      });
      if (resActualizada.count === 0) {
        throw CustomError.badRequest("No se puede resolver una solicitud de una reserva cancelada.");
      }

      // 2. RES-05: actualizar la solicitud solo si sigue PENDIENTE
      const solActualizada = await tx.solicitud.updateMany({
        where: { idsolicitud: solicitudId, estado: ESTADO_SOLICITUD.PENDIENTE },
        data: { estado: ESTADO_SOLICITUD.CONFIRMADA }
      });
      if (solActualizada.count === 0) {
        throw CustomError.badRequest("La solicitud ya no está pendiente.");
      }

      // 3. Registrar la gestión de aceptación
      await tx.gestionSolicitud.create({
        data: {
          idsolicitud: solicitudId,
          idservicio: servicioId,
          resultado: "Aceptada"
        }
      });

      return { ...solActual, estado: "CONFIRMADA" };
    });
  }

  // CU-34: Registrar Rechazo (RES-05, RES-09)
  async resolverComoRechazada(solicitudId: number, reservaId: number, servicioId: number, motivo: string, cantPlazas: number) {
    return db.$transaction(async (tx) => {
      const solActual = await tx.solicitud.findUnique({
        where: { idsolicitud: solicitudId },
        include: { reserva: { include: { salida: { include: { paquete: true } } } } },
      });

      if (!solActual) {
        throw CustomError.notFound("Solicitud no encontrada.");
      }
      if (solActual.estado !== "PENDIENTE") {
        throw CustomError.badRequest("La solicitud ya no está pendiente.");
      }
      if (solActual.reserva.estado === "CANCELADA") {
        throw CustomError.badRequest("No se puede resolver una solicitud de una reserva cancelada.");
      }

      // 1. RES-05: bloquear la reserva (mismo orden que la cancelación). Un count no bloquea la fila:
      // la cancelación podía confirmarse después y dejar viva la solicitud -R creada acá.
      const resBloqueada = await tx.reserva.updateMany({
        where: { idreserva: reservaId, estado: { not: ESTADO_RESERVA.CANCELADA } },
        data: { estadoAlojamiento: ESTADO_ALOJAMIENTO.PENDIENTE }
      });
      if (resBloqueada.count === 0) {
        throw CustomError.badRequest("No se puede resolver una solicitud de una reserva cancelada.");
      }

      // 2. RES-05: marcar la solicitud como Rechazada solo si sigue PENDIENTE
      const solActualizada = await tx.solicitud.updateMany({
        where: { idsolicitud: solicitudId, estado: ESTADO_SOLICITUD.PENDIENTE },
        data: { estado: "RECHAZADA" }
      });
      if (solActualizada.count === 0) {
        throw CustomError.badRequest("La solicitud ya no está pendiente.");
      }

      // 3. Registrar la gestión de rechazo
      await tx.gestionSolicitud.create({
        data: {
          idsolicitud: solicitudId,
          idservicio: servicioId,
          resultado: "Rechazada",
          motivoRechazo: motivo
        }
      });

      // RES-09: La solicitud -R copia los criterios de alojamiento
      const def = solActual.reserva?.salida?.paquete ? definicionEfectiva(solActual.reserva.salida) : null;
      const criterios = solActual.criterios ?? (
        def
          ? `Localidad: ${def.localidadGarantizada ?? "-"} | ` +
            `Categoría: ${def.categoriaGarantizada ?? "-"} | ` +
            `Habitación: ${def.tipoHabitacionGarantizada ?? "-"}`
          : null
      );

      // 4. Crear una NUEVA solicitud Pendiente (Patrón Creator)
      const nuevaSol = await tx.solicitud.create({
        data: {
          idreserva: reservaId,
          nroSolicitud: `${solActual.nroSolicitud}-R`, // Sufijo para indicar que es reintento
          estado: "PENDIENTE",
          cantidadPlazas: cantPlazas,
          criterios,
        }
      });

      return nuevaSol;
    });
  }

  // Contar pendientes de la misma salida
  async contarPendientesPorSalida(idsalida: number) {
    return db.solicitud.count({
      where: {
        estado: "PENDIENTE",
        reserva: {
          idsalida: idsalida
        }
      }
    });
  }

  // CU-34 paso 9: datos del establecimiento asignado para avisar al titular
  async buscarServicio(idservicio: number) {
    return db.servicioBase.findUnique({
      where: { idservicio },
      include: { alojamiento: true, proveedor: true },
    });
  }
}
