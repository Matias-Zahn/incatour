import { db } from "../../../config/postgresDatabase";
import { CustomError } from "../../../error/CustomError";

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
      // RES-05: Validar atómicamente dentro de la transacción que la solicitud sigue PENDIENTE y la reserva no está CANCELADA
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

      // 1. Actualizar la Solicitud
      const sol = await tx.solicitud.update({
        where: { idsolicitud: solicitudId },
        data: { 
          estado: "CONFIRMADA",
          gestiones: {
            create: {
              idservicio: servicioId,
              resultado: "Aceptada"
            }
          }
        }
      });

      // 2. Actualizar la Reserva: RES-01 actualiza estadoAlojamiento, NO estado
      await tx.reserva.update({
        where: { idreserva: reservaId },
        data: {
          estadoAlojamiento: "CONFIRMADO"
        }
      });

      return sol;
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

      // 1. Marcar la solicitud actual como Rechazada
      const solAnterior = await tx.solicitud.update({
        where: { idsolicitud: solicitudId },
        data: {
          estado: "RECHAZADA",
          gestiones: {
            create: {
              idservicio: servicioId,
              resultado: "Rechazada",
              motivoRechazo: motivo
            }
          }
        }
      });

      // RES-09: La solicitud -R copia los criterios de alojamiento
      const criterios = solActual.criterios ?? (
        solActual.reserva?.salida?.paquete
          ? `Localidad: ${solActual.reserva.salida.paquete.localidadGarantizada ?? "-"} | ` +
            `Categoría: ${solActual.reserva.salida.paquete.categoriaGarantizada ?? "-"} | ` +
            `Habitación: ${solActual.reserva.salida.paquete.tipoHabitacionGarantizada ?? "-"}`
          : null
      );

      // 2. Crear una NUEVA solicitud Pendiente (Patrón Creator)
      const nuevaSol = await tx.solicitud.create({
        data: {
          idreserva: reservaId,
          nroSolicitud: `${solAnterior.nroSolicitud}-R`, // Sufijo para indicar que es reintento
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
