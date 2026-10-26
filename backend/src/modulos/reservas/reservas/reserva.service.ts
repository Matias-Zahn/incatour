import { hoyUTC } from "../../../shared/fechas";
import crypto from "crypto";
import { CustomError } from "../../../error/CustomError";
import { IPasarelaPagos } from "../../../integraciones/pasarela/pasarela.interface";
import { PasarelaMock } from "../../../integraciones/pasarela/pasarela.mock";
import { INotificador } from "../../../integraciones/notificador/notificador.interface";
import { NotificadorMock } from "../../../integraciones/notificador/notificador.mock";
import { DefinicionPaquete, definicionEfectiva } from "../../../shared/definicionPaquete";
import { CrearReservaDto } from "./reserva.dto";
import { ReservaRepository } from "./reserva.repository";

// Tipo derivado del repositorio: el servicio no importa Prisma
type SalidaCompra = NonNullable<Awaited<ReturnType<ReservaRepository["obtenerSalidaParaCompra"]>>>;

const redondear2 = (n: number) => Math.round(n * 100) / 100;

export class ReservaService {
  private repository = new ReservaRepository();
  private pasarela: IPasarelaPagos = new PasarelaMock();
  private notificador: INotificador = new NotificadorMock();

  // CU-30 Comprar un paquete completo
  async crearReserva(dto: CrearReservaDto, idusuario: number) {
    // 1. Quién compra: sale del token, nunca del body
    const cliente = await this.repository.obtenerClientePorUsuario(idusuario);
    if (!cliente || cliente.estado !== "ACTIVO") {
      throw CustomError.forbidden("Solo un cliente activo puede realizar reservas.");
    }

    // 2. Salida comprable
    const salida = await this.repository.obtenerSalidaParaCompra(dto.idsalida);
    if (!salida) throw CustomError.notFound("La salida no existe.");
    if (salida.estado !== "PUBLICADA") {
      throw CustomError.badRequest("La salida no está disponible para la venta.");
    }
    if (salida.fechaInicio <= hoyUTC()) {
      throw CustomError.badRequest("La salida ya comenzó o está por comenzar.");
    }

    const cantidad = dto.pasajeros.length;
    if (cantidad > salida.stockLocal) {
      throw CustomError.badRequest(`Solo quedan ${salida.stockLocal} lugares en esta salida.`);
    }

    // 3. Pasajeros: sin pasaportes repetidos y vigentes hasta el final del recorrido
    const pasaportes = new Set(dto.pasajeros.map((p) => p.nroPasaporte));
    if (pasaportes.size !== cantidad) {
      throw CustomError.badRequest("Hay pasajeros con el mismo número de pasaporte.");
    }
    // RES-03: No permitir que el mismo pasaporte ocupe dos lugares en la misma salida
    const reservasPrevias = (salida as any).reservas ?? [];
    const pasaportesExistentes = new Set<string>();
    for (const r of reservasPrevias) {
      for (const pj of r.pasajeros ?? []) {
        if (pj.pasajero?.nroPasaporte) {
          pasaportesExistentes.add(pj.pasajero.nroPasaporte);
        }
      }
    }

    for (const p of dto.pasajeros) {
      if (pasaportesExistentes.has(p.nroPasaporte)) {
        throw CustomError.badRequest(
          `El pasaporte ${p.nroPasaporte} ya se encuentra registrado en esta salida.`
        );
      }
      if (new Date(p.fechaVencimientoPasaporte) <= salida.fechaFin) {
        throw CustomError.badRequest(
          `El pasaporte de ${p.nombreCompleto} vence antes de finalizar el recorrido.`
        );
      }
    }

    // RES-15: un pasaporte ya registrado se usa tal como está; con otro nombre es de otra persona
    const normalizar = (nombre: string) => nombre.trim().toLowerCase();
    for (const registrado of await this.repository.buscarPasajerosPorPasaporte([...pasaportes])) {
      const enviado = dto.pasajeros.find((p) => p.nroPasaporte === registrado.nroPasaporte);
      if (enviado && normalizar(enviado.nombreCompleto) !== normalizar(registrado.nombreCompleto)) {
        throw CustomError.conflict(`El pasaporte ${registrado.nroPasaporte} ya está registrado a nombre de otra persona.`);
      }
    }

    // CAT-05: lo que se vendió es la definición de la salida (foto), no el paquete como esté hoy
    const definicion = definicionEfectiva(salida);

    // 4. El precio lo calcula el servidor
    const precio = this.calcularPrecio(salida, definicion, dto);
    const nroReserva = `RES-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    // 5. Reservar cupos (atómico). Si no alcanzan, se corta sin cobrar.
    const cupos = await this.repository.reservarCupos(dto.idsalida, cantidad);
    if (!cupos) {
      throw CustomError.badRequest("No hay lugares suficientes en la salida.");
    }
    const { alojamientoReservado } = cupos;

    // 6. Cobrar. La pasarela se llama FUERA de la transacción de base de datos.
    let pago;
    try {
      pago = await this.pasarela.procesarPago({
        monto: precio.total,
        moneda: precio.moneda,
        tarjeta: dto.tarjeta,
        referenciaReserva: nroReserva,
      });
    } catch (error) {
      await this.liberarSinFallar(dto.idsalida, cantidad, alojamientoReservado);
      throw CustomError.serviceUnavailable("No se pudo contactar a la pasarela de pagos. Reintentá más tarde.");
    }

    if (!pago.aprobado) {
      await this.liberarSinFallar(dto.idsalida, cantidad, alojamientoReservado);
      this.notificador
        .enviarEmailRechazo(cliente.usuario.email, pago.mensaje)
        .catch((e) => console.error("Fallo al notificar el rechazo:", e));
      throw CustomError.badRequest(`Pago rechazado: ${pago.mensaje}`);
    }

    // 7. Pago aprobado: registrar la reserva completa en una sola transacción
    let reserva;
    try {
      reserva = await this.repository.confirmarReserva({
        idcliente: cliente.idcliente,
        idsalida: dto.idsalida,
        nroReserva,
        precioCongelado: precio.total,
        temporadaAplicada: precio.temporadaAplicada,
        precioPaquetePorPersona: precio.precioPaquetePorPersona,
        adicionalesEquipaje: precio.adicionalesEquipaje,
        moneda: precio.moneda,
        diasMinimosReintegro: definicion.diasMinimosReintegro,
        condicionesComerciales: definicion.condiciones ?? "",
        medioPago: dto.medioPago,
        pasajeros: dto.pasajeros,
        estadoAlojamiento: alojamientoReservado ? "CONFIRMADO" : "PENDIENTE",
        solicitud: alojamientoReservado
          ? undefined
          : {
              nroSolicitud: `SOL-${nroReserva}`,
              criterios:
                `Localidad: ${definicion.localidadGarantizada ?? "-"} | ` +
                `Categoría: ${definicion.categoriaGarantizada ?? "-"} | ` +
                `Habitación: ${definicion.tipoHabitacionGarantizada ?? "-"}`,
            },
      });
    } catch (error) {
      // Cobramos pero no pudimos registrar: se devuelven los cupos y se anula el cobro
      await this.liberarSinFallar(dto.idsalida, cantidad, alojamientoReservado);
      console.error(
        `[CU-30] Pago aprobado (${pago.transaccionId}) sin reserva registrada para ${nroReserva}:`,
        error
      );
      const reembolsado = await this.reembolsarSinFallar(
        pago.transaccionId!, precio.total, dto.idsalida, nroReserva, cliente.usuario.email, error
      );
      throw CustomError.internalServerError(
        reembolsado
          ? `No pudimos registrar la reserva. El cobro ${pago.transaccionId} fue anulado; podés reintentar la compra.`
          : `El pago fue aprobado pero no pudimos registrar la reserva. Contactanos con el código ${pago.transaccionId}.`
      );
    }

    // 8. Confirmación por email: si falla, la reserva sigue siendo válida
    this.notificador
      .enviarEmailConfirmacion(cliente.usuario.email, reserva.idreserva, reserva.precioCongelado)
      .catch((e) => console.error("Fallo al notificar la confirmación:", e));

    return {
      idreserva: reserva.idreserva,
      nroReserva: reserva.nroReserva,
      estado: reserva.estado,
      estadoAlojamiento: reserva.estadoAlojamiento,
      cantidadPasajeros: reserva.cantidadPasajeros,
      precioCongelado: reserva.precioCongelado,
      moneda: precio.moneda,
      transaccionPasarela: pago.transaccionId,
    };
  }

  // Tarifa de la temporada vigente en la fecha de inicio + exceso de equipaje
  private calcularPrecio(salida: SalidaCompra, definicion: DefinicionPaquete, dto: CrearReservaDto) {
    const tarifa = salida.paquete.tarifas.find(
      (t) =>
        t.temporada.estado === "ACTIVO" &&
        t.temporada.fechaInicio <= salida.fechaInicio &&
        salida.fechaInicio <= t.temporada.fechaFin
    );
    if (!tarifa) {
      throw CustomError.badRequest("El paquete no tiene una tarifa vigente para la fecha de la salida.");
    }

    // Transporte de la salida; si todavía no se asignó, el incluido en el paquete
    const transporte =
      salida.servicios.map((s) => s.servicio.transporte).find((t) => t !== null) ??
      definicion.servicios.map((s) => s.transporte).find((t) => t !== null);

    let extra = 0;
    if (transporte) {
      for (const e of dto.equipaje) {
        const exceso = e.pesoDeclarado - transporte.pesoEquipajeIncluido;
        if (exceso > 0) extra += exceso * transporte.costoPorKgExcedente;
      }
    }

    // RES-07: se devuelve el desglose para congelarlo en la reserva
    return {
      total: redondear2(tarifa.monto * dto.pasajeros.length + extra),
      moneda: tarifa.moneda,
      temporadaAplicada: tarifa.temporada.nombre,
      precioPaquetePorPersona: tarifa.monto,
      adicionalesEquipaje: redondear2(extra),
    };
  }

  // La compensación nunca debe tapar el error original
  private async liberarSinFallar(idsalida: number, cantidad: number, alojamientoReservado: boolean) {
    try {
      await this.repository.liberarCupos(idsalida, cantidad, alojamientoReservado);
    } catch (e) {
      console.error(`[CU-30] No se pudieron liberar los cupos de la salida ${idsalida}:`, e);
    }
  }

  // Compensación del cobro: si el reembolso no sale, queda registrado para reintentarlo a mano
  private async reembolsarSinFallar(
    transaccionId: string, monto: number, idsalida: number, nroReserva: string, email: string, causa: unknown
  ) {
    try {
      const r = await this.pasarela.reembolsar(transaccionId, monto);
      if (r.aprobado) return true;
      throw new Error(r.mensaje);
    } catch (e) {
      console.error(`[CU-30] Reembolso pendiente de ${transaccionId} (${nroReserva}):`, e);
      await this.repository
        .registrarReembolsoPendiente({ idsalida, email, transaccionId, monto, nroReserva, causa: String(causa), error: String(e) })
        .catch((e2) => console.error(`[CU-30] No se pudo registrar el reembolso pendiente de ${transaccionId}:`, e2));
      return false;
    }
  }
}