import { CustomError } from "../../../error/CustomError";
import { CrearCircuitoDto, ModificarCircuitoDto } from "./circuito.dto";
import { CircuitoRepository, FiltrosCircuito } from "./circuito.repository";

export class CircuitoService {
  private repository: CircuitoRepository;

  constructor() {
    this.repository = new CircuitoRepository();
  }

  // CU-01: Consultar circuitos
  async consultarCircuitos(filtros?: FiltrosCircuito) {
    return this.repository.findAll(filtros);
  }

  // CU-02: Crear circuito
  async crearCircuito(dto: CrearCircuitoDto) {
    // Validar que no exista otro circuito activo con el mismo nombre
    const existe = await this.repository.existeNombre(dto.nombreCircuito);
    if (existe) {
      throw CustomError.conflict(
        `Ya existe un circuito activo con el nombre "${dto.nombreCircuito}".`
      );
    }

    return this.repository.create(dto);
  }

  // CU-03: Modificar circuito
  async modificarCircuito(id: number, dto: ModificarCircuitoDto) {
    const circuito = await this.repository.findById(id);

    if (!circuito) {
      throw CustomError.notFound(`No se encontró el circuito con ID ${id}.`);
    }

    if (circuito.estado !== "ACTIVO") {
      throw CustomError.badRequest("No se puede modificar un circuito que no está activo.");
    }

    // RF-03: Bloquear atributos estructurales (duración y dotación) si hay paquetes activos o salidas
    const cambiaEstructura =
      (dto.duracionDias !== undefined && dto.duracionDias !== circuito.duracionDias) ||
      (dto.minimoGuias !== undefined && dto.minimoGuias !== circuito.minimoGuias) ||
      (dto.parametrosPorteadores !== undefined && dto.parametrosPorteadores !== circuito.parametrosPorteadores);

    if (cambiaEstructura) {
      const tienePaquetes = await this.repository.tienePaquetesActivos(id);
      const tieneSalidas = await this.repository.tieneSalidas(id);
      if (tienePaquetes || tieneSalidas) {
        throw CustomError.badRequest(
          "No se pueden modificar los atributos estructurales del circuito (duración o dotación) porque está en uso por paquetes activos o salidas."
        );
      }
    }

    // Si cambia el nombre, verificar que no colisione con otro
    if (dto.nombreCircuito) {
      const existe = await this.repository.existeNombre(dto.nombreCircuito, id);
      if (existe) {
        throw CustomError.conflict(
          `Ya existe un circuito activo con el nombre "${dto.nombreCircuito}".`
        );
      }
    }

    return this.repository.update(id, dto);
  }

  // CU-04: Baja lógica de circuito
  async darDeBajaCircuito(id: number) {
    const circuito = await this.repository.findById(id);

    if (!circuito) {
      throw CustomError.notFound(`No se encontró el circuito con ID ${id}.`);
    }

    if (circuito.estado !== "ACTIVO") {
      throw CustomError.badRequest("El circuito ya se encuentra dado de baja.");
    }

    // Verificar que no tenga paquetes activos asociados
    const tienePaquetes = await this.repository.tienePaquetesActivos(id);
    if (tienePaquetes) {
      throw CustomError.badRequest(
        "No se puede dar de baja el circuito porque tiene paquetes activos asociados."
      );
    }

    return this.repository.updateEstado(id, "INACTIVO");
  }
}
