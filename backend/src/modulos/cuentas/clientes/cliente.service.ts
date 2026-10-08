import bcrypt from "bcrypt";
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
    const emailExiste = await this.repository.checkEmailExists(dto.email);
    if (emailExiste) {
      throw CustomError.badRequest("Ya existe un usuario registrado con ese correo electrónico.");
    }

    const salt = await bcrypt.genSalt(10);
    const contraseniaHasheada = await bcrypt.hash(dto.contrasenia, salt);

    // Generación más segura para alta concurrencia
    const nroCliente = `CLI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    return this.repository.createWithUser(dto, contraseniaHasheada, nroCliente);
  }

  async modificarCliente(id: number, dto: ModificarClienteDto) {
    const cliente = await this.repository.findById(id);
    if (!cliente) {
      throw CustomError.notFound("Cliente no encontrado.");
    }

    // Prevención de modificación en cuentas inactivas
    if (cliente.estado === "INACTIVO") {
      throw CustomError.badRequest("No se puede modificar una cuenta inactiva.");
    }

    // Validar que si mandaron un email nuevo, no esté en uso por otro usuario
    if (dto.email) {
      const usuarioConEmail = await this.repository.checkEmailExists(dto.email);
      if (usuarioConEmail && usuarioConEmail.idusuario !== cliente.idusuario) {
        throw CustomError.badRequest("El correo electrónico ya está en uso por otra cuenta.");
      }
    }

    return this.repository.update(id, cliente.idusuario, dto);
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
