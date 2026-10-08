import { db } from "../../../config/postgresDatabase";

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
            cliente: true
          }
        },
        gestiones: true // Para ver el historial de rechazos
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

  // CU-34: Registrar Aceptación
  async resolverComoAceptada(solicitudId: number, reservaId: number, servicioId: number) {
    return db.$transaction(async (tx) => {
      // 1. Actualizar la Solicitud
      const sol = await tx.solicitud.update({
        where: { idsolicitud: solicitudId },
        data: { 
          estado: "CONFIRMADA",
          idservicio: servicioId,
          gestiones: {
            create: {
              idservicio: servicioId,
              resultado: "Aceptada"
            }
          }
        }
      });

      // 2. Actualizar la Reserva (Simulado: Cambiar un estadoAlojamiento si existiera el campo)
      // Como el esquema de Prisma no tiene un campo 'estadoAlojamiento' explícito en la Reserva, 
      // lo deducimos de la solicitud, pero registramos auditoria o actualizamos el estado si aplica.
      await tx.reserva.update({
        where: { idreserva: reservaId },
        data: {
          estado: "CONFIRMADA" // Asumiendo que se reafirma su estado.
        }
      });

      return sol;
    });
  }

  // CU-34: Registrar Rechazo
  async resolverComoRechazada(solicitudId: number, reservaId: number, servicioId: number, motivo: string, cantPlazas: number) {
    return db.$transaction(async (tx) => {
      // 1. Marcar la solicitud actual como Rechazada
      const solAnterior = await tx.solicitud.update({
        where: { idsolicitud: solicitudId },
        data: {
          estado: "RECHAZADA",
          gestiones: {
            create: {
              idservicio: servicioId,
              resultado: "Rechazada",
              observaciones: motivo
            }
          }
        }
      });

      // 2. Crear una NUEVA solicitud Pendiente (Patrón Creator)
      const nuevaSol = await tx.solicitud.create({
        data: {
          idreserva: reservaId,
          idservicio: servicioId, // Set to old service temporarily to satisfy Prisma constraint
          nroSolicitud: `${solAnterior.nroSolicitud}-R`, // Sufijo para indicar que es reintento
          estado: "PENDIENTE",
          cantidadPlazas: cantPlazas
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
}
