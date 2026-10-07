import { CustomError } from "../../../error/CustomError";
import { ClienteRepository } from "./cliente.repository";
import { CrearClienteDto, ModificarClienteDto } from "./cliente.dto";

export class ClienteService {
  private repository = new ClienteRepository();

  async consultarClientes() {
    return this.repository.findAll();
  }

  async consultarClientePorId(id: number) {
    const cliente = await this.repository.findById(id);
    if (!cliente) {
      throw CustomError.notFound("Cliente no encontrado.");
    }
    return cliente;
  }

  async crearCliente(dto: CrearClienteDto) {
    const existe = await this.repository.findByNroCliente(dto.nroCliente);
    if (existe) {
      throw CustomError.badRequest("Ya existe un cliente con ese número de cliente.");
    }
    return this.repository.create(dto);
  }

  async modificarCliente(id: number, dto: ModificarClienteDto) {
    const cliente = await this.repository.findById(id);
    if (!cliente) {
      throw CustomError.notFound("Cliente no encontrado.");
    }
    return this.repository.update(id, dto);
  }

  async darDeBajaCliente(id: number) {
    const cliente = await this.repository.findById(id);
    if (!cliente) {
      throw CustomError.notFound("Cliente no encontrado.");
    }
    if (cliente.estado === "INACTIVO") {
      throw CustomError.badRequest("El cliente ya se encuentra inactivo.");
    }

    const tieneReservas = await this.repository.hasReservasActivas(id);
    if (tieneReservas) {
      throw CustomError.badRequest("No se puede dar de baja porque tiene reservas activas.");
    }

    return this.repository.softDelete(id);
  }
}
