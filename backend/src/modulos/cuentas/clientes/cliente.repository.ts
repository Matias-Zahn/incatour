import { db } from "../../../config/postgresDatabase";
import { CrearClienteDto, ModificarClienteDto } from "./cliente.dto";

export class ClienteRepository {
  async findAll() {
    return db.cliente.findMany({ where: { estado: "ACTIVO" } });
  }

  async findById(idcliente: number) {
    return db.cliente.findUnique({ where: { idcliente } });
  }

  async findByNroCliente(nroCliente: string) {
    return db.cliente.findUnique({ where: { nroCliente } });
  }

  async create(data: CrearClienteDto) {
    return db.cliente.create({ 
      data: { 
        ...data, 
        estado: "ACTIVO" 
      } 
    });
  }

  async update(idcliente: number, data: ModificarClienteDto) {
    return db.cliente.update({
      where: { idcliente },
      data,
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
          where: { estado: "ACTIVO" }
        }
      }
    });
    return cliente ? cliente.reservas.length > 0 : false;
  }
}
