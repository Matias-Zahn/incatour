import { CustomError } from "../../../error/CustomError";
import { SolicitudRepository } from "./solicitud.repository";
import { ResolverSolicitudDto } from "./solicitud.dto";

export class SolicitudService {
  private repository = new SolicitudRepository();

  // CU-33
  async consultarPendientes() {
    return this.repository.findAllPendientes();
  }

  // CU-34 Fase 1: Obtener opciones
  async buscarServiciosCompatibles(solicitudId: number) {
    const solicitud = await this.repository.buscarPorId(solicitudId);
    if (!solicitud) {
      throw CustomError.notFound("Solicitud no encontrada");
    }
    if (solicitud.estado !== "PENDIENTE") {
      throw CustomError.badRequest("La solicitud no está PENDIENTE");
    }

    const paquete = solicitud.reserva.salida.paquete;
    
    // Obtenemos los criterios garantizados del paquete
    const categoria = paquete.categoriaGarantizada;
    const localidad = paquete.localidadGarantizada;
    const tipoHabitacion = paquete.tipoHabitacionGarantizada;

    if (!categoria || !localidad || !tipoHabitacion) {
      throw CustomError.badRequest("El paquete no garantiza categoría/localidad. No se requiere buscar opciones genéricas.");
    }

    // Regla de negocio: excluir los que ya rechazaron (mirando la tabla de gestiones)
    const rechazadosIds = solicitud.gestiones
      .filter(g => g.resultado === "Rechazada" && g.idservicio)
      .map(g => g.idservicio as number);

    // Búsqueda en repositorio
    const serviciosCompatibles = await this.repository.buscarServiciosCompatiblesExcluyendoRechazados(
      tipoHabitacion,
      categoria,
      localidad,
      rechazadosIds
    );

    // Regla FA2: No hay opciones
    if (serviciosCompatibles.length === 0) {
      throw CustomError.badRequest("La salida no podrá consolidarse. Gestione un proveedor por fuera del sistema.");
    }

    return {
      solicitudId: solicitud.idsolicitud,
      reserva: solicitud.reserva.nroReserva,
      cliente: solicitud.reserva.cliente.nroCliente,
      criteriosGarantizados: { localidad, categoria, tipoHabitacion },
      opcionesContacto: serviciosCompatibles.map(s => ({
        servicioId: s.idservicio,
        hotel: s.nombreServicio,
        proveedor: s.proveedor.razonSocial,
        canalContacto: "Por fuera del sistema" // Hardcodeado según DSD
      }))
    };
  }

  // CU-34 Fase 2: Resolver Solicitud (Aceptar o Rechazar)
  async procesarResolucion(solicitudId: number, dto: ResolverSolicitudDto) {
    const solicitud = await this.repository.buscarPorId(solicitudId);
    if (!solicitud || solicitud.estado !== "PENDIENTE") {
      throw CustomError.badRequest("Solicitud inválida o ya resuelta");
    }

    const reservaId = solicitud.idreserva;

    if (dto.resolucion === "RECHAZADA") {
      // Flujo Alternativo 1: El proveedor rechaza
      const nuevaSol = await this.repository.resolverComoRechazada(
        solicitudId,
        reservaId,
        dto.servicioId,
        dto.motivo!,
        solicitud.cantidadPlazas
      );

      return {
        mensaje: "Rechazo registrado. Se generó una solicitud nueva en estado Pendiente.",
        nuevaSolicitudId: nuevaSol.idsolicitud
      };
    } else {
      // Flujo Normal: El proveedor acepta
      await this.repository.resolverComoAceptada(
        solicitudId,
        reservaId,
        dto.servicioId
      );

      // Simular notificación al cliente
      console.log(`[NOTIFICADOR] -> Titular de reserva ${reservaId}: Alojamiento confirmado en hotel ID ${dto.servicioId}`);

      // Contar pendientes de la misma salida para avisar al admin si la salida ya se puede consolidar
      const pendientes = await this.repository.contarPendientesPorSalida(solicitud.reserva.idsalida);

      return {
        mensaje: "Solicitud Confirmada exitosamente.",
        solicitudesPendientesRestantesEnSalida: pendientes
      };
    }
  }
}
