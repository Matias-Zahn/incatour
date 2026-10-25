import { Prisma } from "@prisma/client";
import { db } from "../../../config/postgresDatabase";
import { finDelDiaUTC } from "../../../shared/fechas";

// Filtros que comparte con la consulta de reseñas (CU-43)
export interface FiltrosEvaluacion {
  idsalida?: number | undefined;
  idpaquete?: number | undefined;
  puntajeMin?: number | undefined;
  puntajeMax?: number | undefined;
  fechaDesde?: Date | undefined;
  fechaHasta?: Date | undefined;
}

export class EvaluacionRepository {
  // CU-42: la salida con quiénes participaron y lo que ya se evaluó
  async buscarSalida(idsalida: number) {
    return db.salida.findUnique({
      where: { idsalida },
      include: {
        personalAsignado: { include: { personal: { select: { idpersonal: true, nombreCompleto: true, rol: true } } } },
        // Proveedores que dieron servicio en la salida: alojamiento, transporte, tren o equipamiento
        servicios: { include: { servicio: { select: { proveedor: { select: { idproveedor: true, razonSocial: true } } } } } },
        equipamientos: { include: { servicio: { select: { proveedor: { select: { idproveedor: true, razonSocial: true } } } } } },
        evaluacionesPersonal: true,
        evaluacionesProveedores: true,
      },
    });
  }

  async evaluarPersonal(idsalida: number, idpersonal: number, puntaje: number, comentario: string | null) {
    return db.evaluacionPersonal.create({ data: { idsalida, idpersonal, puntaje, comentario } });
  }

  async evaluarProveedor(idsalida: number, idproveedor: number, puntaje: number, comentario: string | null) {
    return db.evaluacionProveedor.create({ data: { idsalida, idproveedor, puntaje, comentario } });
  }

  // CU-43: evaluaciones de personal y proveedores con los mismos filtros que las reseñas
  async listar(f: FiltrosEvaluacion) {
    const where = {
      ...(f.idsalida && { idsalida: f.idsalida }),
      ...(f.idpaquete && { salida: { idpaquete: f.idpaquete } }),
      ...((f.puntajeMin || f.puntajeMax) && {
        puntaje: { ...(f.puntajeMin && { gte: f.puntajeMin }), ...(f.puntajeMax && { lte: f.puntajeMax }) },
      }),
      ...((f.fechaDesde || f.fechaHasta) && {
        fechaEvaluacion: { ...(f.fechaDesde && { gte: f.fechaDesde }), ...(f.fechaHasta && { lte: finDelDiaUTC(f.fechaHasta) }) },
      }),
    } satisfies Prisma.EvaluacionPersonalWhereInput & Prisma.EvaluacionProveedorWhereInput;

    const [personal, proveedores] = await Promise.all([
      db.evaluacionPersonal.findMany({
        where,
        include: { personal: { select: { nombreCompleto: true, rol: true } }, salida: { select: { nroSalida: true } } },
        orderBy: { fechaEvaluacion: "desc" },
      }),
      db.evaluacionProveedor.findMany({
        where,
        include: { proveedor: { select: { razonSocial: true } }, salida: { select: { nroSalida: true } } },
        orderBy: { fechaEvaluacion: "desc" },
      }),
    ]);
    return { personal, proveedores };
  }
}
