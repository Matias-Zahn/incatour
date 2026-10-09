// src/modulos/reservas/reservas/reserva.service.ts
import { CustomError } from "../../../error/CustomError";
import { ReservaRepository } from "./reserva.repository";
import { CrearReservaDto } from "./reserva.dto";

export class ReservaService {
  private repository = new ReservaRepository();

  async procesarCompraDePaquete(dto: CrearReservaDto) {
    // 1. Validar la existencia de la salida planificada
    const salida = await this.repository.obtenerDetalleSalidaYPaquete(dto.idsalida);
    if (!salida) throw CustomError.notFound("La salida planificada especificada no existe.");
    if (salida.estado === "CANCELADA") throw CustomError.badRequest("No es posible reservar en una salida cancelada.");

    // 2. Convalidar vigencia técnica de pasaportes (Flujo Alternativo 2 del RUP)
    const fechaInicioSalida = new Date(salida.fechaInicio);
    for (const p of dto.pasajeros) {
      const vencimiento = new Date(p.fechaVencimientoPasaporte);
      if (vencimiento <= fechaInicioSalida) {
        throw CustomError.badRequest(`El pasaporte de ${p.nombreCompleto} expira antes de la ejecución del circuito.`);
      }
    }

    // 3. Evaluar disponibilidad de alojamiento precargado local (Flujo Alternativo 4)
    const tieneAlojamientosBloqueados = (salida.stockLocalAlojamiento !== null && salida.stockLocalAlojamiento >= dto.pasajeros.length);
    
    // Generación del identificador comercial unificado
    const nroReserva = `RES-${Date.now().toString().slice(-6)}`;

    try {
      return await this.repository.procesarCompraAtomica({
        dto,
        nroReserva,
        precioTotal: dto.montoTransaccion,
        estadoAlojamiento: tieneAlojamientosBloqueados ? "CONFIRMADO" : "PENDIENTE",
        crearSolicitud: !tieneAlojamientosBloqueados
      });
    } catch (error: any) {
      throw CustomError.badRequest(error.message || "Error al procesar la reserva transaccional.");
    }
  }
}
