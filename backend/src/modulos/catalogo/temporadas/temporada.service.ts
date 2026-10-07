import { CustomError } from "../../../error/CustomError";
import { CrearTemporadaDto, ModificarTemporadaDto } from "./temporada.dto";
import { TemporadaRepository } from "./temporada.repository";

export class TemporadaService {
  private repository = new TemporadaRepository();

  async consultarTemporadas() {
    return this.repository.findAll();
  }

  async crearTemporada(dto: CrearTemporadaDto) {
    const existe = await this.repository.existeNombre(dto.nombre);
    if (existe) {
      throw CustomError.badRequest("Ya existe una temporada activa con ese nombre.");
    }
    return this.repository.create(dto);
  }

  async modificarTemporada(id: number, dto: ModificarTemporadaDto) {
    const temporadaActual = await this.repository.findById(id);
    if (!temporadaActual || temporadaActual.estado !== "ACTIVO") {
      throw CustomError.notFound("Temporada no encontrada o inactiva.");
    }

    if (dto.nombre && dto.nombre !== temporadaActual.nombre) {
      const existeNombre = await this.repository.existeNombre(dto.nombre, id);
      if (existeNombre) {
        throw CustomError.badRequest("Ya existe otra temporada activa con ese nombre.");
      }
    }

    // Validar fechas mixtas (ej. manda solo fechaFin, hay que chequear que sea > fechaInicio actual)
    const nuevaFechaInicio = dto.fechaInicio || temporadaActual.fechaInicio;
    const nuevaFechaFin = dto.fechaFin || temporadaActual.fechaFin;

    if (nuevaFechaInicio >= nuevaFechaFin) {
      throw CustomError.badRequest("La fecha de inicio debe ser anterior a la fecha de fin.");
    }

    return this.repository.update(id, dto);
  }

  async darDeBajaTemporada(id: number) {
    const temporadaActual = await this.repository.findById(id);
    if (!temporadaActual || temporadaActual.estado !== "ACTIVO") {
      throw CustomError.notFound("Temporada no encontrada o ya inactiva.");
    }

    const tieneTarifas = await this.repository.tieneTarifasAsociadas(id);
    if (tieneTarifas) {
      throw CustomError.badRequest("No se puede dar de baja porque tiene tarifas de paquetes asociadas.");
    }

    return this.repository.updateEstado(id, "INACTIVO");
  }
}
