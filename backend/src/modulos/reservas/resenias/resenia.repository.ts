import { Prisma } from "@prisma/client";
import { db } from "../../../config/postgresDatabase";
import { ESTADO_RESERVA } from "../../../shared/constantes";
import { FiltrosReseniaDto, PublicarReseniaDto } from "./resenia.dto";

export class ReseniaRepository {
  async findClientePorUsuario(idusuario: number) {
    return db.cliente.findUnique({ where: { idusuario } });
  }

  async findSalida(idsalida: number) {
    return db.salida.findUnique({ where: { idsalida }, select: { idsalida: true, estado: true } });
  }

  // Precondición 2: el cliente participó en la salida con una reserva confirmada
  async tieneReservaConfirmada(idcliente: number, idsalida: number): Promise<boolean> {
    const count = await db.reserva.count({ where: { idcliente, idsalida, estado: ESTADO_RESERVA.CONFIRMADA } });
    return count > 0;
  }

  // Precondición 4 / regla 2: una única reseña por cliente y salida (la PK compuesta lo garantiza)
  async existeResenia(idcliente: number, idsalida: number): Promise<boolean> {
    const count = await db.resenia.count({ where: { idcliente, idsalida } });
    return count > 0;
  }

  /** Devuelve null si dos pedidos simultáneos chocaron contra la PK (idcliente, idsalida). */
  async crear(idcliente: number, dto: PublicarReseniaDto) {
    try {
      return await db.resenia.create({
        data: {
          idcliente,
          idsalida: dto.idsalida,
          valoracion: dto.valoracion,
          comentario: dto.comentario,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
      throw error;
    }
  }

  // CU-47, pasos 1 a 4: historial de reservas del cliente con la salida y su reseña (si ya la hizo)
  async findHistorialReservas(idcliente: number) {
    return db.reserva.findMany({
      where: { idcliente },
      orderBy: { fechaRealizacion: "desc" },
      select: {
        idreserva: true,
        nroReserva: true,
        estado: true,
        cantidadPasajeros: true,
        salida: {
          select: {
            idsalida: true,
            nroSalida: true,
            estado: true,
            fechaInicio: true,
            fechaFin: true,
            paquete: { select: { idpaquete: true, nombrePaquete: true } },
            resenias: { where: { idcliente } },
          },
        },
      },
    });
  }

  // CU-43
  async findConFiltros(f: FiltrosReseniaDto) {
    return db.resenia.findMany({
      where: this.armarFiltro(f),
      orderBy: { fechaEnvio: "desc" },
      include: {
        cliente: { select: { idcliente: true, usuario: { select: { nombre: true, apellido: true } } } },
        salida: { select: { idsalida: true, nroSalida: true, fechaInicio: true, paquete: { select: { idpaquete: true, nombrePaquete: true } } } },
      },
    });
  }

  async resumen(f: FiltrosReseniaDto) {
    const r = await db.resenia.aggregate({
      where: this.armarFiltro(f),
      _count: { _all: true },
      _avg: { valoracion: true },
    });
    return { cantidad: r._count._all, promedio: r._avg.valoracion };
  }

  private armarFiltro(f: FiltrosReseniaDto): Prisma.ReseniaWhereInput {
    return {
      ...(f.idsalida && { idsalida: f.idsalida }),
      ...(f.idpaquete && { salida: { idpaquete: f.idpaquete } }),
      ...((f.valoracionMin || f.valoracionMax) && {
        valoracion: { ...(f.valoracionMin && { gte: f.valoracionMin }), ...(f.valoracionMax && { lte: f.valoracionMax }) },
      }),
      ...((f.fechaDesde || f.fechaHasta) && {
        fechaEnvio: { ...(f.fechaDesde && { gte: f.fechaDesde }), ...(f.fechaHasta && { lte: (() => { const h = new Date(f.fechaHasta); if (h.getUTCHours() === 0 && h.getUTCMinutes() === 0 && h.getUTCSeconds() === 0 && h.getUTCMilliseconds() === 0) { h.setUTCHours(23, 59, 59, 999); } return h; })() }) },
      }),
    };
  }
}