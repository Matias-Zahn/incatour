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

  // BE-02: el cliente autenticado consulta su propio perfil sin conocer su idcliente
  async consultarMiPerfil(idusuario: number) {
    const cliente = await this.repository.findByUsuario(idusuario);
    if (!cliente) {
      throw CustomError.notFound("Cliente no encontrado.");
    }
    return cliente;
  }

  async crearCliente(dto: CrearClienteDto) {
    // 1. Buscamos si el correo ya pertenece a alguien
    const clienteExistente = await this.repository.buscarPorEmail(dto.email);

    const salt = await bcrypt.genSalt(10);
    const contraseniaHasheada = await bcrypt.hash(dto.contrasenia, salt);

    // 2. Si el correo ya existe, evaluamos su estado
    if (clienteExistente) {
      if (clienteExistente.estado === "INACTIVO") {
        // MODO MÁGICO: La cuenta estaba de baja. La reactivamos con los datos nuevos.
        return await this.repository.reactivarCliente(
          clienteExistente.idcliente, 
          clienteExistente.idusuario, 
          dto, 
          contraseniaHasheada
        );
      } else {
        // FIX CTA-10: La cuenta existe y está ACTIVA. Bloqueamos el registro.
        throw CustomError.conflict("Ya existe un usuario registrado con ese correo electrónico.");
      }
    }

    // 3. Si el correo NO existe, seguimos el flujo de creación normal
    const nroCliente = `CLI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Ya no hace falta el try/catch para el "CONFLICTO_DUPLICADO" porque lo validamos arriba
    return await this.repository.createWithUser(dto, contraseniaHasheada, nroCliente);
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
        throw CustomError.conflict("El correo electrónico ya está en uso por otra cuenta.");
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

    const baja = await this.repository.softDelete(id, cliente.idusuario);
    if (!baja) {
      throw CustomError.badRequest("No se puede dar de baja porque tiene reservas activas.");
    }
    return baja;
  }
}
