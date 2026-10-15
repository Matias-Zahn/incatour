import { CustomError } from "../../../error/CustomError";
import { DevolucionEquipamientoDto } from "./devolucion-equipamiento.dto";
import { DevolucionEquipamientoRepository } from "./devolucion-equipamiento.repository";

export class DevolucionEquipamientoService {
  private repository = new DevolucionEquipamientoRepository();

  /**
   * Consulta el equipamiento que la salida tenía asignado para cargarlo en pantalla de devolución.
   */
  async obtenerEquipamientoAsignado(idsalida: number) {
    const salida = await this.repository.obtenerSalidaConEquipamiento(idsalida);
    if (!salida) {
      throw CustomError.notFound(`La salida #${idsalida} no existe.`);
    }

    return {
      idsalida: salida.idsalida,
      nroSalida: salida.nroSalida,
      estado: salida.estado,
      fechaFin: salida.fechaFin,
      equipamientos: salida.equipamientos.map((e) => ({
        idservicio: e.idservicio,
        nombreServicio: e.servicio.nombreServicio,
        tipoEquipamiento: e.servicio.equipamiento?.tipoEquipamiento ?? "Sin especificar",
        proveedor: e.servicio.proveedor.razonSocial,
        cantidadAsignada: e.cantidad,
        stockActualDisponible: e.servicio.equipamiento?.cantidadDisponible ?? 0,
      })),
    };
  }

  /**
   * CU-41: Registrar la devolución del equipamiento reintegrándolo al stock del proveedor.
   */
  async registrarDevolucion(
    idsalida: number,
    dto: DevolucionEquipamientoDto,
    usuarioEmail: string
  ) {
    const salida = await this.repository.obtenerSalidaConEquipamiento(idsalida);
    if (!salida) {
      throw CustomError.notFound(`La salida #${idsalida} no existe.`);
    }

    // Regla de Negocio: la salida debe haber finalizado
    const ahora = new Date();
    const yaConcluyo = salida.estado === "FINALIZADA" || salida.fechaFin <= ahora;
    if (!yaConcluyo) {
      throw CustomError.badRequest(
        "Solo se puede registrar la devolución del equipamiento de una salida concluida o en estado FINALIZADA."
      );
    }

    if (salida.equipamientos.length === 0) {
      throw CustomError.badRequest(`La salida #${idsalida} no tenía equipamiento de camping asignado.`);
    }

    // Mapa de equipamiento asignado a la salida
    const mapaAsignados = new Map<number, number>();
    for (const e of salida.equipamientos) {
      mapaAsignados.set(e.idservicio, e.cantidad);
    }

    // Validar cada item devuelto contra lo asignado
    for (const item of dto.items) {
      const cantidadAsignada = mapaAsignados.get(item.idservicio);
      if (cantidadAsignada === undefined) {
        throw CustomError.badRequest(
          `El servicio #${item.idservicio} no formaba parte del equipamiento asignado a la salida #${idsalida}.`
        );
      }

      const totalDevueltoItem = item.cantidadBuenEstado + item.cantidadDaniada;
      if (totalDevueltoItem > cantidadAsignada) {
        throw CustomError.badRequest(
          `La cantidad devuelta para el servicio #${item.idservicio} (${totalDevueltoItem}) supera la cantidad que la salida tenía asignada (${cantidadAsignada}).`
        );
      }
    }

    // Ejecutar el registro atómico y reintegro al stock del proveedor
    const resultado = await this.repository.registrarDevolucion({
      idsalida,
      usuarioAuditoria: usuarioEmail,
      items: dto.items,
      observacionesGenerales: dto.observacionesGenerales,
    });

    return {
      mensaje: "Devolución de equipamiento registrada y stock reintegrado exitosamente.",
      idsalida,
      auditoriaId: resultado.auditoriaId,
      detalle: dto.items.map((it) => ({
        idservicio: it.idservicio,
        cantidadReintegradaAlStock: it.cantidadBuenEstado,
        cantidadDaniadaOExtraviada: it.cantidadDaniada,
        observaciones: it.observaciones ?? null,
      })),
    };
  }
}
