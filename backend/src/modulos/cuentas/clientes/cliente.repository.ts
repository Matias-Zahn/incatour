import { db } from "../../../config/postgresDatabase";
import { CrearClienteDto, ModificarClienteDto } from "./cliente.dto";

export class ClienteRepository {
  async findAll() {
    return db.cliente.findMany({ where: { estado: "ACTIVO" } });
  }

  async findById(idcliente: number) {
    return db.cliente.findUnique({ where: { idcliente } });
  }

  async checkEmailExists(email: string) {
    return db.usuario.findUnique({ where: { email } });
  }

  async createWithUser(data: CrearClienteDto, contraseniaHasheada: string, nroCliente: string) {
    return db.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          email: data.email,
          contrasenia: contraseniaHasheada,
          rol: "CLIENTE",
          estado: "ACTIVO"
        }
      });

      const cliente = await tx.cliente.create({
        data: {
          idusuario: usuario.idusuario,
          nroCliente: nroCliente,
          nombre: data.nombre,
          apellido: data.apellido,
          estado: "ACTIVO"
        }
      });

      return { cliente, idusuario: usuario.idusuario, email: usuario.email };
    });
  }

  async update(idcliente: number, idusuario: number, data: ModificarClienteDto) {
    return db.$transaction(async (tx) => {
      // 1. Si enviaron email, actualizar la tabla Usuario
      if (data.email) {
        await tx.usuario.update({
          where: { idusuario },
          data: { email: data.email }
        });
      }

      // 2. Si enviaron nombre o apellido, actualizar la tabla Cliente
      if (data.nombre || data.apellido) {
        const updateData: any = {};
        if (data.nombre) updateData.nombre = data.nombre;
        if (data.apellido) updateData.apellido = data.apellido;

        await tx.cliente.update({
          where: { idcliente },
          data: updateData
        });
      }

      // Devolver el cliente actualizado incluyendo el email del usuario para confirmación
      return tx.cliente.findUnique({
        where: { idcliente },
        include: { usuario: { select: { email: true } } }
      });
    });
  }

  async softDelete(idcliente: number) {
    return db.cliente.update({
      where: { idcliente },
      data: { estado: "INACTIVO" },
    });
  }

  async hasReservasActivas(idcliente: number) {
    const cliente = await db.cliente.findUnique({
      where: { idcliente },
      include: {
        reservas: {
          where: { estado: "Confirmada" } // Cambiado según CU-30/CU-32
        }
      }
    });
    return cliente ? cliente.reservas.length > 0 : false;
  }
}
