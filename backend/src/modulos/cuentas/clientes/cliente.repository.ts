import { db } from "../../../config/postgresDatabase";
import { ESTADO_RESERVA } from "../../../shared/constantes";
import { CrearClienteDto, ModificarClienteDto } from "./cliente.dto";

export class ClienteRepository {
  async findAll() {
    return db.cliente.findMany({ 
      where: { estado: "ACTIVO" },
      include: {
        usuario: { select: { nombre: true, apellido: true, email: true } }
      }
    });
  }

  async findById(idcliente: number) {
    return db.cliente.findUnique({ 
      where: { idcliente },
      include: {
        usuario: { select: { nombre: true, apellido: true, email: true } }
      }
    });
  }

  async checkEmailExists(email: string) {
    return db.usuario.findUnique({ where: { email } });
  }

  async createWithUser(data: CrearClienteDto, contraseniaHasheada: string, nroCliente: string) {
    return db.$transaction(async (tx) => {
      // 1. Crear el usuario (ahora con nombre y apellido)
      const usuario = await tx.usuario.create({
        data: {
          nombre: data.nombre,
          apellido: data.apellido,
          email: data.email,
          contrasenia: contraseniaHasheada,
          rol: "CLIENTE",
          estado: "ACTIVO"
        }
      });

      // 2. Crear el cliente (solo datos administrativos de negocio)
      const cliente = await tx.cliente.create({
        data: {
          idusuario: usuario.idusuario,
          nroCliente: nroCliente,
          estado: "ACTIVO"
        }
      });

      return { 
        idcliente: cliente.idcliente,
        idusuario: usuario.idusuario,
        nroCliente: cliente.nroCliente,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        estado: cliente.estado
      };
    });
  }

  async update(idcliente: number, idusuario: number, data: ModificarClienteDto) {
    return db.$transaction(async (tx) => {
      const updateData: { nombre?: string; apellido?: string; email?: string } = {};
      if (data.nombre) updateData.nombre = data.nombre;
      if (data.apellido) updateData.apellido = data.apellido;
      if (data.email) updateData.email = data.email;

      if (Object.keys(updateData).length > 0) {
        await tx.usuario.update({
          where: { idusuario },
          data: updateData
        });
      }

      // Devolver el cliente actualizado incluyendo los datos del usuario
      return tx.cliente.findUnique({
        where: { idcliente },
        include: { usuario: { select: { nombre: true, apellido: true, email: true } } }
      });
    });
  }

  async softDelete(idcliente: number, idusuario: number) {
    return db.$transaction(async (tx) => {
      // SEG-02: Marcar tanto Cliente como Usuario en INACTIVO
      const cliente = await tx.cliente.update({
        where: { idcliente },
        data: { estado: "INACTIVO" },
      });

      await tx.usuario.update({
        where: { idusuario },
        data: { estado: "INACTIVO" },
      });

      return cliente;
    });
  }

  async hasReservasActivas(idcliente: number) {
    const cliente = await db.cliente.findUnique({
      where: { idcliente },
      include: {
        reservas: {
          where: {
            OR: [
              { estado: ESTADO_RESERVA.CONFIRMADA },
              { estado: "Confirmada" },
            ],
          },
        },
      },
    });
    return cliente ? cliente.reservas.length > 0 : false;
  }
}
