import { CustomError } from "../../../error/CustomError";
import { INotificador } from "../../../integraciones/notificador/notificador.interface";
import { NotificadorMock } from "../../../integraciones/notificador/notificador.mock";
import {
  ESTADO_ALOJAMIENTO,
  ESTADO_PERMISO,
  ESTADO_RESERVA,
  ESTADO_SOLICITUD,
  redondear2,
} from "../../../shared/constantes";
import { CancelarReservaDto, FiltrosMisReservasDto, FiltrosReservaDto } from "./gestion-reserva.dto";
import { GestionReservaRepository } from "./gestion-reserva.repository";

export interface UsuarioAutenticado {
  idusuario: number;
  email: string;
  rol: string; // "ADMIN" | "CLIENTE"
}

type ReservaResumen = Awaited<ReturnType<GestionReservaRepository["findMisReservas"]>>[number];
type ReservaDetalle = NonNullable<Awaited<ReturnType<GestionReservaRepository["findDetalle"]>>>;

const sumar = (valores: number[]) => redondear2(valores.reduce((a, b) => a + b, 0));

export class GestionReservaService {
  private repository: GestionReservaRepository;
  private notificador: INotificador;

  constructor() {
    this.repository = new GestionReservaRepository();
    this.notificador = new NotificadorMock();
  }

  // ===================== CU-31: Consultar reservas =====================

  // Cliente: sus propias reservas
  async consultarMisReservas(usuario: UsuarioAutenticado, filtros: FiltrosMisReservasDto) {
    const cliente = await this.repository.findClientePorUsuario(usuario.idusuario);
    if (!cliente) throw CustomError.forbidden("El usuario no tiene un perfil de cliente.");

    const reservas = await this.repository.findMisReservas(cliente.idcliente, filtros);
    return reservas.map((r) => this.resumir(r));
  }

  // Administrador: todas, con filtros
  async consultarReservas(filtros: FiltrosReservaDto) {
    const reservas = await this.repository.findConFiltros(filtros);
    return reservas.map((r) => ({ ...this.resumir(r), titular: r.cliente.usuario }));
  }

  async obtenerReserva(idreserva: number, usuario: UsuarioAutenticado) {
    const reserva = await this.buscarDetalleOFallar(idreserva);
    this.verificarAcceso(reserva.cliente.idusuario, usuario);
    return this.detallar(reserva);
  }

  // "Descarga el resumen y los comprobantes": JSON listo para adjuntar a un PDF desde el front
  async obtenerComprobante(idreserva: number, usuario: UsuarioAutenticado) {
    const reserva = await this.buscarDetalleOFallar(idreserva);
    this.verificarAcceso(reserva.cliente.idusuario, usuario);

    return {
      nroReserva: reserva.nroReserva,
      fechaRealizacion: reserva.fechaRealizacion,
      estado: reserva.estado,
      titular: reserva.cliente.usuario,
      paquete: reserva.salida.paquete.nombrePaquete,
      salida: { nroSalida: reserva.salida.nroSalida, fechaInicio: reserva.salida.fechaInicio, fechaFin: reserva.salida.fechaFin },
      pasajeros: reserva.pasajeros.map((p) => p.pasajero.nombreCompleto),
      precioCongelado: reserva.precioCongelado,
      ...this.calcularDesglose(reserva),
      condicionesComerciales: reserva.condicionesComerciales,
      pagos: reserva.pagos.map((p) => ({
        nroTransaccion: p.nrotransaccion,
        monto: p.monto,
        medioPago: p.medioPago,
        fechahora: p.fechahora,
      })),
      totalPagado: sumar(reserva.pagos.map((p) => p.monto)),
      reintegro: reserva.reembolsos.length > 0 ? sumar(reserva.reembolsos.map((r) => r.montoReembolsado)) : null,
    };
  }

  // ===================== CU-32: Cancelar reserva =====================

  // DCD solicitarCancelacion: resumen de liquidación antes de confirmar (pasos 2 a 4)
  async solicitarCancelacion(idreserva: number, usuario: UsuarioAutenticado) {
    const ev = await this.evaluarCancelacion(idreserva, usuario);
    return {
      idreserva,
      nroReserva: ev.reserva.nroReserva,
      importeAbonado: ev.importeAbonado,
      montoAReintegrar: ev.montoAReintegrar,
      permisosEmitidos: ev.permisosEmitidos,
      lugaresVuelvenALaVenta: !ev.permisosEmitidos,
      advertencia: ev.permisosEmitidos
        ? "Los permisos ya fueron emitidos ante la autoridad (son nominales e intransferibles). El reintegro es de $0 y los lugares no vuelven a la venta."
        : null,
    };
  }

  // DCD confirmarCancelacion (pasos 5 a 10)
  async confirmarCancelacion(idreserva: number, dto: CancelarReservaDto, usuario: UsuarioAutenticado) {
    const ev = await this.evaluarCancelacion(idreserva, usuario);

    const reembolso = await this.repository.cancelarReserva({
      idreserva,
      idsalida: ev.reserva.salida.idsalida,
      idusuario: usuario.idusuario,
      motivo: dto.motivo ?? "Sin motivo informado",
      montoReembolsado: ev.montoAReintegrar,
      cantidadPasajeros: ev.reserva.cantidadPasajeros,
      permisosEmitidos: ev.permisosEmitidos,
      alojamientoPorStock: ev.alojamientoPorStock,
    });
    if (!reembolso) throw CustomError.badRequest("La reserva ya había sido cancelada.");

    // Constancia al titular: si el mail falla, la cancelación ya está registrada
    this.notificador
      .enviarEmailCancelacionReserva(ev.reserva.cliente.usuario.email, ev.reserva.nroReserva, ev.montoAReintegrar, dto.motivo)
      .catch((e) => console.error("[CU-32] No se pudo enviar la constancia de cancelación:", e));

    return {
      idreserva,
      nroReserva: ev.reserva.nroReserva,
      estado: ESTADO_RESERVA.CANCELADA,
      reembolso: {
        idreembolso: reembolso.idreembolso,
        montoReembolsado: reembolso.montoReembolsado,
        motivo: reembolso.motivo,
        fechaReembolso: reembolso.fechaReembolso,
        nota: "La acreditación del dinero se ejecuta por fuera del sistema.",
      },
      lugaresVuelvenALaVenta: !ev.permisosEmitidos,
    };
  }

  // ===================== helpers =====================

  private async evaluarCancelacion(idreserva: number, usuario: UsuarioAutenticado) {
    const reserva = await this.repository.findParaCancelacion(idreserva);
    if (!reserva) throw CustomError.notFound(`No se encontró la reserva con ID ${idreserva}.`);
    this.verificarAcceso(reserva.cliente.idusuario, usuario);

    // Precondición: la reserva debe estar Confirmada
    if (reserva.estado !== ESTADO_RESERVA.CONFIRMADA) {
      throw CustomError.badRequest("Solo se pueden cancelar reservas en estado Confirmada.");
    }

    // Paso 2 / flujo alternativo 1: no se cancela una vez iniciado el recorrido
    const salidaIniciada =
      reserva.salida.fechaInicio <= new Date() || ["EN_CURSO", "FINALIZADA", "CANCELADA"].includes(reserva.salida.estado);
    if (salidaIniciada) {
      throw CustomError.badRequest("Las salidas en curso o finalizadas no admiten cancelaciones.");
    }

    // Paso 3: "No emitido" = no hay fila de permiso; si alguno está Emitido rige el flujo alternativo 2
    const permisosEmitidos = reserva.permisos.some((p) => p.estadoTramite === ESTADO_PERMISO.EMITIDO);

    // Se reintegra el 100% de lo abonado, salvo permisos emitidos ($0)
    const importeAbonado = sumar(reserva.pagos.map((p) => p.monto));
    const montoAReintegrar = permisosEmitidos ? 0 : importeAbonado;

    // El alojamiento salió del stock bloqueado de la salida solo si está Confirmado SIN solicitud confirmada
    const alojamientoPorStock =
      reserva.estadoAlojamiento === ESTADO_ALOJAMIENTO.CONFIRMADO &&
      !reserva.solicitudes.some((s) => s.estado === ESTADO_SOLICITUD.CONFIRMADA);

    return { reserva, permisosEmitidos, importeAbonado, montoAReintegrar, alojamientoPorStock };
  }

  // Un cliente solo accede a SUS reservas; el administrador, a todas
  private verificarAcceso(idusuarioTitular: number, usuario: UsuarioAutenticado) {
    if (usuario.rol === "ADMIN") return;
    if (usuario.rol === "CLIENTE" && idusuarioTitular === usuario.idusuario) return;
    throw CustomError.forbidden("No tenés permiso para acceder a esta reserva.");
  }

  private async buscarDetalleOFallar(idreserva: number) {
    const reserva = await this.repository.findDetalle(idreserva);
    if (!reserva) throw CustomError.notFound(`No se encontró la reserva con ID ${idreserva}.`);
    return reserva;
  }

  private resumir(r: ReservaResumen) {
    const { paquete, ...salida } = r.salida;
    return {
      idreserva: r.idreserva,
      nroReserva: r.nroReserva,
      estado: r.estado,
      estadoAlojamiento: r.estadoAlojamiento,
      fechaRealizacion: r.fechaRealizacion,
      cantidadPasajeros: r.cantidadPasajeros,
      precioCongelado: r.precioCongelado,
      pagado: sumar(r.pagos.map((p) => p.monto)),
      reintegro: r.reembolsos.length > 0 ? sumar(r.reembolsos.map((x) => x.montoReembolsado)) : null,
      salida,
      paquete,
    };
  }

  private calcularDesglose(r: ReservaDetalle) {
    // RES-07: las reservas nuevas traen el desglose congelado al comprar
    if (r.precioPaquetePorPersona != null && r.adicionalesEquipaje != null) {
      return {
        temporadaAplicada: r.temporadaAplicada,
        temporada: r.temporadaAplicada ? { nombre: r.temporadaAplicada } : null,
        precioUnitario: r.precioPaquetePorPersona,
        precioPaquete: redondear2(r.precioPaquetePorPersona * r.cantidadPasajeros),
        adicionales: r.adicionalesEquipaje,
        adicionalesEquipaje: r.adicionalesEquipaje,
      };
    }

    // Reservas anteriores: se reconstruye con las tarifas vivas (solo temporadas activas)
    const tarifas = (r.salida.paquete as any)?.tarifas ?? [];
    const fechaSalida = new Date(r.salida.fechaInicio);
    const tarifaAplicada = tarifas.find((t: any) => {
      if (t.temporada.estado !== "ACTIVO") return false;
      const inicio = new Date(t.temporada.fechaInicio);
      const fin = new Date(t.temporada.fechaFin);
      return fechaSalida >= inicio && fechaSalida <= fin;
    });

    const temporadaNombre = tarifaAplicada?.temporada?.nombre ?? null;
    const precioUnitario = tarifaAplicada?.monto != null
      ? Number(tarifaAplicada.monto)
      : (r.cantidadPasajeros > 0 ? redondear2(r.precioCongelado / r.cantidadPasajeros) : 0);
    const precioPaquete = redondear2(precioUnitario * r.cantidadPasajeros);
    const adicionalesEquipaje = redondear2(Math.max(0, r.precioCongelado - precioPaquete));

    return {
      temporadaAplicada: temporadaNombre,
      temporada: tarifaAplicada?.temporada ?? (temporadaNombre ? { nombre: temporadaNombre } : null),
      precioUnitario,
      precioPaquete,
      adicionales: adicionalesEquipaje,
      adicionalesEquipaje,
    };
  }

  private detallar(r: ReservaDetalle) {
    const desglose = this.calcularDesglose(r);
    const { circuito, tarifas: _tarifas, ...paquete } = r.salida.paquete as any;
    const { paquete: _omitido, ...salida } = r.salida;
    return {
      idreserva: r.idreserva,
      nroReserva: r.nroReserva,
      estado: r.estado,
      estadoAlojamiento: r.estadoAlojamiento,
      fechaRealizacion: r.fechaRealizacion,
      cantidadPasajeros: r.cantidadPasajeros,
      precioCongelado: r.precioCongelado,
      temporadaAplicada: desglose.temporadaAplicada,
      temporada: desglose.temporada,
      precioUnitario: desglose.precioUnitario,
      precioPaquete: desglose.precioPaquete,
      adicionales: desglose.adicionales,
      adicionalesEquipaje: desglose.adicionalesEquipaje,
      condicionesComerciales: r.condicionesComerciales,
      pagado: sumar(r.pagos.map((p) => p.monto)),
      titular: r.cliente.usuario,
      salida,
      paquete,
      itinerario: circuito,
      pasajeros: r.pasajeros.map((p) => p.pasajero),
      pagos: r.pagos,
      reembolsos: r.reembolsos,
      solicitudesAlojamiento: r.solicitudes,
      permisos: r.permisos,
    };
  }
}