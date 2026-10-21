import { db } from "../../../config/postgresDatabase";
import { SALIDAS_ACTIVAS } from "../../../shared/constantes";
import { CrearCircuitoDto, ModificarCircuitoDto } from "./circuito.dto";

export interface FiltrosCircuito {
  duracionDias?: string | number | undefined;
  dificultad?: string | undefined;
  estado?: string | undefined;
}

export class CircuitoRepository {
  async findAll(filtros?: FiltrosCircuito) {
    const where: any = {};

    if (filtros?.estado) {
      if (filtros.estado !== "TODOS") {
        where.estado = String(filtros.estado).toUpperCase();
      }
    } else {
      where.estado = "ACTIVO";
    }

    if (filtros?.dificultad) {
      where.dificultad = { equals: String(filtros.dificultad), mode: "insensitive" };
    }

    if (filtros?.duracionDias != null && filtros.duracionDias !== "") {
      where.duracionDias = Number(filtros.duracionDias);
    }

    return db.circuito.findMany({
      where,
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

  async tieneSalidas(id: number): Promise<boolean> {
    const count = await db.salida.count({
      where: {
        paquete: { idcircuito: id },
        estado: { in: SALIDAS_ACTIVAS },
      },
    });
    return count > 0;
  }
}
