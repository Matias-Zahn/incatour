import { db } from "../../../config/postgresDatabase";
import { CrearTemporadaDto, ModificarTemporadaDto } from "./temporada.dto";

export class TemporadaRepository {
  async findAll() {
    return db.temporada.findMany({
      where: { estado: "ACTIVO" },
      orderBy: { fechaInicio: "asc" },
    });
  }

  async findById(id: number) {
    return db.temporada.findUnique({
      where: { idtemporada: id },
    });
  }

  async existeNombre(nombre: string, excluirId?: number) {
    const where: any = {
      nombre,
      estado: "ACTIVO",
    };
    if (excluirId) {
      where.idtemporada = { not: excluirId };
    }
    const count = await db.temporada.count({ where });
    return count > 0;
  }

  async create(data: CrearTemporadaDto) {
    return db.temporada.create({
      data: {
        nombre: data.nombre,
        fechaInicio: data.fechaInicio,
        fechaFin: data.fechaFin,
        estado: "ACTIVO",
      },
    });
  }

  async update(id: number, data: ModificarTemporadaDto) {
    return db.temporada.update({
      where: { idtemporada: id },
      data: {
        ...(data.nombre && { nombre: data.nombre }),
        ...(data.fechaInicio && { fechaInicio: data.fechaInicio }),
        ...(data.fechaFin && { fechaFin: data.fechaFin }),
      },
    });
  }

  async updateEstado(id: number, estado: string) {
    return db.temporada.update({
      where: { idtemporada: id },
      data: { estado },
    });
  }

  async tieneTarifasAsociadas(id: number) {
    const count = await db.tarifaPaquete.count({
      where: { idtemporada: id },
    });
    return count > 0;
  }
}
