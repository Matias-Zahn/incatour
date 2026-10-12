import { CustomError } from "../../../error/CustomError";
import { INotificador } from "../../../integraciones/notificador/notificador.interface";
import { NotificadorMock } from "../../../integraciones/notificador/notificador.mock";
import { ESTADO_PERMISO, ESTADO_SALIDA, SALIDAS_NO_INICIADAS, redondear2 } from "../../../shared/constantes";
import { UsuarioAutenticado } from "../../reservas/gestion-reservas/gestion-reserva.service";
import { obtenerAutoridad } from "../autoridad.wiring";
import { CancelarSalidaDto } from "./cancelacion-salida.dto";
import { CancelacionSalidaRepository } from "./cancelacion-salida.repository";

type SalidaParaCancelar = NonNullable<Awaited<ReturnType<CancelacionSalidaRepository["findParaCancelar"]>>>;

export class CancelacionSalidaService {
  private repository: CancelacionSalidaRepository;
  private notificador: INotificador;

  constructor() {
    this.repository = new CancelacionSalidaRepository();
    this.notificador = new NotificadorMock();
  }

  // Impacto de la cancelación, antes de confirmar (formulario del paso 2)
  async solicitarCancelacion(idsalida: number) {
    const salida = await this.buscarCancelableOFallar(idsalida);

    const permisosPasajeros = salida.reservas.flatMap((r) => r.permisos);
    const permisosEmitidos =
      [...salida.permisos, ...permisosPasajeros].filter((p) => p.estadoTramite === ESTADO_PERMISO.EMITIDO).length;

    return {
      idsalida: salida.idsalida,
      nroSalida: salida.nroSalida,
      paquete: salida.paquete.nombrePaquete,
      fechaInicio: salida.fechaInicio,
      reservasAfectadas: salida.reservas.length,
      totalAReembolsar: this.totalAbonado(salida),
      permisosQuePasanAPerdido: permisosEmitidos,
      recursosQueSeLiberan: {
        personal: salida.personalAsignado.length,
        equipamiento: salida.equipamientos.length,
        servicios: salida.servicios.length,
      },
      notificaAClientes: salida.reservas.length > 0,
    };
  }

  // DCD confirmarCancelacionSalida (CU-37, pasos 3 a 12)
  async confirmarCancelacion(idsalida: number, dto: CancelarSalidaDto, usuario: UsuarioAutenticado) {
    const salida = await this.buscarCancelableOFallar(idsalida);

    // Paso 3: liberar la totalidad de los cupos ante la autoridad ANTES de tocar nada.
    // Flujo alternativo 1: si no responde, la salida NO se cancela.
    if (salida.idbloqueo) {
      try {
        await obtenerAutoridad().liberarTotalidadCupos(salida.idbloqueo);
      } catch (error) {
        console.error(`[CU-37] La autoridad no liberó el bloqueo ${salida.idbloqueo}:`, error);
        throw CustomError.internalServerError(
          "No fue posible liberar los cupos ante la autoridad competente. Reintentá más tarde."
        );
      }
    }

    // Pasos 4 a 11 en una sola transacción
    const resultado = await this.repository.ejecutarCancelacion({
      idsalida,
      idusuario: usuario.idusuario,
      emailUsuario: usuario.email,
      motivo: dto.motivo,
      estadoAnterior: salida.estado,
    });
    if (!resultado) {
      throw CustomError.badRequest("La salida ya fue cancelada o su recorrido comenzó mientras se procesaba la operación.");
    }

    // Paso 10 (omitido si no hay reservas: flujo alternativo 2): aviso a los titulares con salidas alternativas
    let enviadas = 0;
    let fallidas = 0;
    let cantidadAlternativas = 0;

    if (resultado.reservas.length > 0) {
      const alternativas = (await this.repository.findAlternativas(salida.idpaquete, idsalida)).map((a) => ({
        idsalida: a.idsalida,
        nombrePaquete: a.paquete.nombrePaquete,
        fechaInicio: a.fechaInicio,
        lugaresDisponibles: a.stockLocal,
      }));
      cantidadAlternativas = alternativas.length;

      const envios = await Promise.allSettled(
        resultado.reservas.map((r) =>
          this.notificador.enviarEmailCancelacionSalida(
            r.email,
            salida.nroSalida,
            dto.motivo,
            r.montoReembolsado,
            alternativas.filter((a) => a.lugaresDisponibles >= r.cantidadPasajeros)
          )
        )
      );
      enviadas = envios.filter((e) => e.status === "fulfilled").length;
      fallidas = envios.length - enviadas;
    }

    return {
      idsalida,
      nroSalida: salida.nroSalida,
      estado: ESTADO_SALIDA.CANCELADA,
      reservasCanceladas: resultado.reservas.length,
      reembolsoTotal: resultado.reembolsoTotal,
      notificaciones: { enviadas, fallidas, salidasAlternativasOfrecidas: cantidadAlternativas },
      nota: "El reembolso se registra al 100% de lo abonado; la acreditación se ejecuta por fuera del sistema.",
    };
  }

  // ---- helpers ----
  private async buscarCancelableOFallar(idsalida: number): Promise<SalidaParaCancelar> {
    const salida = await this.repository.findParaCancelar(idsalida);
    if (!salida) throw CustomError.notFound(`No se encontró la salida con ID ${idsalida}.`);

    if (salida.estado === ESTADO_SALIDA.CANCELADA) {
      throw CustomError.badRequest("La salida ya se encuentra cancelada.");
    }
    // Regla de negocio 1: solo si el recorrido no ha comenzado
    if (!SALIDAS_NO_INICIADAS.includes(salida.estado) || salida.fechaInicio <= new Date()) {
      throw CustomError.badRequest("Una salida solo puede cancelarse si su recorrido no ha comenzado.");
    }
    return salida;
  }

  private totalAbonado(salida: SalidaParaCancelar) {
    return redondear2(salida.reservas.reduce((acc, r) => acc + r.pagos.reduce((a, p) => a + p.monto, 0), 0));
  }
}