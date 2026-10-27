import { CustomError } from "../../../error/CustomError";
import { definicionEfectiva } from "../../../shared/definicionPaquete";
import { INotificador } from "../../../integraciones/notificador/notificador.interface";
import { NotificadorMock } from "../../../integraciones/notificador/notificador.mock";
import { SolicitudRepository } from "./solicitud.repository";
import { ResolverSolicitudDto } from "./solicitud.dto";

export class SolicitudService {
  private repository = new SolicitudRepository();
  private notificador: INotificador = new NotificadorMock();

  // CU-33
  async consultarPendientes() {
    // RES-19: la garantía que se muestra es la vendida (foto de la salida, CAT-05), no la del paquete de hoy
    return (await this.repository.findAllPendientes()).map((s) => {
      const def = definicionEfectiva(s.reserva.salida);
      return {
        ...s,
        garantia: {
          tipoGarantia: def.tipoGarantia,
          localidad: def.localidadGarantizada,
          categoria: def.categoriaGarantizada,
          tipoHabitacion: def.tipoHabitacionGarantizada,
          establecimiento: def.establecimiento?.nombreServicio ?? null,
        },
      };
    });
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

    // CAT-05: los criterios son los de la definición de la salida
    const paquete = definicionEfectiva(solicitud.reserva.salida);
    
    // Regla de negocio: excluir los que ya rechazaron (mirando la tabla de gestiones)
    const rechazadosIds = solicitud.reserva.solicitudes
      .flatMap(s => s.gestiones)
      .filter(g => g.resultado === "Rechazada")
      .map(g => g.idservicio);

    // RES-04: garantía por establecimiento (sin localidad/categoría): la única opción es ese hotel
    const est = paquete.establecimiento;
    if (est) {
      const hotel = rechazadosIds.includes(est.idservicio) ? null : await this.repository.buscarServicio(est.idservicio);
      return {
        solicitudId: solicitud.idsolicitud,
        reserva: solicitud.reserva.nroReserva,
        cliente: solicitud.reserva.cliente.nroCliente,
        criteriosGarantizados: { localidad: est.localidad, categoria: est.categoria, tipoHabitacion: paquete.tipoHabitacionGarantizada },
        opcionesContacto: hotel ? [this.opcionContacto(hotel)] : []
      };
    }

    // Obtenemos los criterios garantizados del paquete
    const categoria = paquete.categoriaGarantizada;
    const localidad = paquete.localidadGarantizada;
    const tipoHabitacion = paquete.tipoHabitacionGarantizada;

    if (!categoria || !localidad || !tipoHabitacion) {
      throw CustomError.badRequest("El paquete no garantiza categoría/localidad. No se requiere buscar opciones genéricas.");
    }

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
      opcionesContacto: serviciosCompatibles.map(s => this.opcionContacto(s))
    };
  }

  private opcionContacto(s: { idservicio: number; nombreServicio: string; proveedor: { razonSocial: string; canalComunicacion: string | null; datosContacto: string | null } }) {
    return {
      servicioId: s.idservicio,
      hotel: s.nombreServicio,
      proveedor: s.proveedor.razonSocial,
      canalContacto: s.proveedor.canalComunicacion || s.proveedor.datosContacto || "Por fuera del sistema"
    };
  }

  // CU-34 Fase 2: Resolver Solicitud (Aceptar o Rechazar)
  async procesarResolucion(solicitudId: number, dto: ResolverSolicitudDto) {
    const solicitud = await this.repository.buscarPorId(solicitudId);
    // RES-10: 404 si no existe
    if (!solicitud) {
      throw CustomError.notFound("Solicitud no encontrada");
    }
    if (solicitud.estado !== "PENDIENTE") {
      throw CustomError.badRequest("La solicitud no está PENDIENTE");
    }

    // RES-04: Validar servicio a resolver (existencia, activo, alojamiento, criterios de paquete, no rechazado previamente)
    const servicio = await this.repository.buscarServicio(dto.servicioId);
    if (!servicio || servicio.estado !== "ACTIVO" || !servicio.alojamiento) {
      throw CustomError.badRequest("El servicio no existe, no está activo o no es un servicio de alojamiento.");
    }

    const paquete = definicionEfectiva(solicitud.reserva.salida);
    // Garantía por establecimiento: tiene que ser ese hotel; por categoría/localidad, se comparan los criterios
    const cumple = paquete.establecimiento
      ? servicio.idservicio === paquete.establecimiento.idservicio
      : servicio.localidad === paquete.localidadGarantizada &&
        servicio.alojamiento.categoria === paquete.categoriaGarantizada &&
        servicio.alojamiento.tipoHabitacion === paquete.tipoHabitacionGarantizada;
    if (!cumple) {
      throw CustomError.badRequest(
        "El servicio no cumple con los criterios de localidad, categoría o tipo de habitación garantizados."
      );
    }

    if (dto.resolucion === "ACEPTADA") {
      const rechazadosIds = solicitud.reserva.solicitudes
        .flatMap((s) => s.gestiones)
        .filter((g) => g.resultado === "Rechazada")
        .map((g) => g.idservicio);
      if (rechazadosIds.includes(dto.servicioId)) {
        throw CustomError.badRequest("El servicio ya fue rechazado anteriormente para esta reserva.");
      }
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

      // CU-34 paso 9: informar al titular el establecimiento asignado. Si falla, la aceptación sigue firme
      this.repository
        .buscarServicio(dto.servicioId)
        .then((s) =>
          this.notificador.enviarEmailAlojamientoConfirmado(
            solicitud.reserva.cliente.usuario.email,
            solicitud.reserva.nroReserva,
            s?.nombreServicio ?? `Servicio ${dto.servicioId}`,
            s?.localidad ?? ""
          )
        )
        .catch((e) => console.error("[CU-34] Fallo al avisar el alojamiento asignado:", e));

      // Contar pendientes de la misma salida para avisar al admin si la salida ya se puede consolidar
      const pendientes = await this.repository.contarPendientesPorSalida(solicitud.reserva.idsalida);

      return {
        mensaje: "Solicitud Confirmada exitosamente.",
        solicitudesPendientesRestantesEnSalida: pendientes
      };
    }
  }
}
