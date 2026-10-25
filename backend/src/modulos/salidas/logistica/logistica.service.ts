import { hoyUTC } from "../../../shared/fechas";
import { CustomError } from "../../../error/CustomError";
import { SALIDAS_NO_INICIADAS, TIPO_SERVICIO } from "../../../shared/constantes";
import { UsuarioAutenticado } from "../../reservas/gestion-reservas/gestion-reserva.service";
import { ModificarLogisticaDto, TipoRecursoDto } from "./logistica.dto";
import { LogisticaRepository } from "./logistica.repository";

type Panel = NonNullable<Awaited<ReturnType<LogisticaRepository["obtenerPanel"]>>>;

export class LogisticaService {
  private repository: LogisticaRepository;

  constructor() {
    this.repository = new LogisticaRepository();
  }

  // DCD obtenerPanelLogistica (CU-39, paso 2)
  async obtenerPanelLogistica(idsalida: number) {
    const panel = await this.repository.obtenerPanel(idsalida);
    if (!panel) throw CustomError.notFound(`No se encontró la salida con ID ${idsalida}.`);
    return this.formatearPanel(panel);
  }

  // DCD consultarProveedoresDisponibles (CU-39, paso 5)
  async consultarDisponibles(idsalida: number, dto: TipoRecursoDto) {
    const salida = await this.buscarModificableOFallar(idsalida);

    if (dto.tipo === TIPO_SERVICIO.EQUIPAMIENTO) {
      const servicios = await this.repository.disponiblesEquipamiento();
      return servicios.map((s) => ({
        idservicio: s.idservicio,
        nombreServicio: s.nombreServicio,
        localidad: s.localidad,
        costoBase: s.costoBase,
        proveedor: s.proveedor,
        disponibilidad: {
          tipoEquipamiento: s.equipamiento?.tipoEquipamiento,
          cantidadDisponible: s.equipamiento?.cantidadDisponible,
        },
      }));
    }

    const pasajeros = await this.repository.pasajerosConfirmados(idsalida);
    const servicios = await this.repository.disponiblesTransporte(salida, pasajeros);
    return servicios.map((s) => ({
      idservicio: s.idservicio,
      nombreServicio: s.nombreServicio,
      localidad: s.localidad,
      costoBase: s.costoBase,
      proveedor: s.proveedor,
      disponibilidad: {
        capacidadVehiculo: s.transporte?.capacidadVehiculo,
        pasajerosConfirmados: pasajeros,
      },
    }));
  }

  // DCD confirmarModificacion (CU-39, pasos 8 a 14)
  async confirmarModificacion(idsalida: number, dto: ModificarLogisticaDto, usuario: UsuarioAutenticado) {
    const salida = await this.buscarModificableOFallar(idsalida);
    const pasajeros = await this.repository.pasajerosConfirmados(idsalida);

    const resultado = await this.repository.aplicarCambios({
      salida,
      pasajeros,
      itemsDesasignar: dto.itemsDesasignar,
      itemsNuevos: dto.itemsNuevos,
      motivo: dto.motivo,
      emailUsuario: usuario.email,
    });
    if (!resultado.ok) throw CustomError.badRequest(resultado.error);

    // Paso 13: vuelve a mostrar el panel actualizado, avisando lo que quedó sin asignar
    const panel = await this.obtenerPanelLogistica(idsalida);
    const advertencias = panel.requerimientosSinAsignar.map(
      (r) => `El requerimiento de ${r.toLowerCase()} quedó "Sin asignar": hay que cargar un proveedor antes de la salida.`
    );
    return { panel, advertencias };
  }

  // ---- helpers ----
  // Precondición: la salida tiene recursos ya asignados (CERRADA) y no empezó (CU-39 / SAL-07)
  private async buscarModificableOFallar(idsalida: number) {
    const salida = await this.repository.findSalida(idsalida);
    if (!salida) throw CustomError.notFound(`No se encontró la salida con ID ${idsalida}.`);
    if (salida.estado === "PUBLICADA") {
      throw CustomError.badRequest(
        "La salida todavía no tiene recursos asignados (CU-40). La logística solo se modifica sobre salidas con asignación previa."
      );
    }
    if (salida.estado !== "CERRADA" || salida.fechaInicio <= hoyUTC()) {
      throw CustomError.badRequest(
        "La logística solo puede modificarse en salidas que no hayan comenzado y no estén canceladas ni finalizadas."
      );
    }
    return salida;
  }

  private formatearPanel(panel: Panel) {
    const transporte = panel.servicios[0] ?? null;
    return {
      idsalida: panel.idsalida,
      nroSalida: panel.nroSalida,
      estado: panel.estado,
      fechaInicio: panel.fechaInicio,
      fechaFin: panel.fechaFin,
      equipamiento: panel.equipamientos.map((e) => ({
        idservicio: e.servicio.idservicio,
        nombreServicio: e.servicio.nombreServicio,
        tipoEquipamiento: e.servicio.equipamiento?.tipoEquipamiento ?? null,
        cantidad: e.cantidad,
        proveedor: e.servicio.proveedor,
      })),
      transporte: transporte
        ? {
            idservicio: transporte.idservicio,
            nombreServicio: transporte.servicio.nombreServicio,
            comprobanteReserva: transporte.comprobanteReserva,
            proveedor: transporte.servicio.proveedor,
          }
        : null,
      // "Sin asignar" no es una fila: es la ausencia del recurso
      requerimientosSinAsignar: transporte ? [] : [TIPO_SERVICIO.TRANSPORTE],
    };
  }
}