import { db } from "../../../config/postgresDatabase";
import { CrearCircuitoDto, ModificarCircuitoDto } from "./circuito.dto";

export class CircuitoRepository {

  async findAll() {
    return db.circuito.findMany({
      where: { estado: "ACTIVO" },
      include: { etapas: { orderBy: { numeroOrden: "asc" } } },
    });
  }

  async findById(id: number) {
    return db.circuito.findUnique({
      where: { idcircuito: id },
      include: {
        etapas: { orderBy: { numeroOrden: "asc" } },
        paquetes: true,
      },
    });
  }

  async existeNombre(nombre: string, excluirId?: number) {
    const circuito = await db.circuito.findFirst({
      where: {
        nombreCircuito: nombre,
        estado: "ACTIVO",
        ...(excluirId ? { NOT: { idcircuito: excluirId } } : {}),
      },
    });
    return !!circuito;
  }

  async create(data: CrearCircuitoDto) {
    return db.circuito.create({
      data: {
        nombreCircuito: data.nombreCircuito,
        duracionDias: data.duracionDias,
        dificultad: data.dificultad,
        minimoGuias: data.minimoGuias,
        parametrosPorteadores: data.parametrosPorteadores ?? null,
        estado: "ACTIVO",
      },
      include: { etapas: true },
    });
  }

  async update(id: number, data: ModificarCircuitoDto) {
    return db.circuito.update({
      where: { idcircuito: id },
      data: {
        ...(data.nombreCircuito !== undefined && { nombreCircuito: data.nombreCircuito }),
        ...(data.duracionDias !== undefined && { duracionDias: data.duracionDias }),
        ...(data.dificultad !== undefined && { dificultad: data.dificultad }),
        ...(data.minimoGuias !== undefined && { minimoGuias: data.minimoGuias }),
        ...(data.parametrosPorteadores !== undefined && { parametrosPorteadores: data.parametrosPorteadores }),
      },
      include: { etapas: true },
    });
  }

  async updateEstado(id: number, estado: string) {
    return db.circuito.update({
      where: { idcircuito: id },
      data: { estado },
    });
  }

  async tienePaquetesActivos(id: number): Promise<boolean> {
    const count = await db.paquete.count({
      where: {
        idcircuito: id,
        estado: "ACTIVO",
      },
    });
    return count > 0;
  }
}
