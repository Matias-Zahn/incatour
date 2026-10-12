import { db } from "../../../config/postgresDatabase";
import { ESTADO, ESTADO_SOLICITUD, SALIDAS_ACTIVAS, TipoServicio } from "../../../shared/constantes";
import { CrearServicioDto } from "./servicio.dto";

const INCLUDE_COMPLETO = {
  proveedor: { select: { idproveedor: true, razonSocial: true, tipoProveedor: true, estado: true } },
  alojamiento: true,
  transporte: true,
  tren: true,
  equipamiento: true,
} as const;

const RELACION_SUBTIPO: { [tipo in TipoServicio]: "alojamiento" | "transporte" | "tren" | "equipamiento" } = {
  ALOJAMIENTO: "alojamiento",
  TRANSPORTE: "transporte",
  TREN: "tren",
  EQUIPAMIENTO: "equipamiento",
};

export class ServicioRepository {
  async findProveedor(id: number) {
    return db.proveedor.findUnique({ where: { idproveedor: id } });
  }

  // CU-18
  async findByProveedor(idproveedor: number, estado?: string) {
    return db.servicioBase.findMany({
      where: { idproveedor, ...(estado && { estado }) },
      include: INCLUDE_COMPLETO,
      orderBy: { nombreServicio: "asc" },
    });
  }

  async findById(id: number) {
    return db.servicioBase.findUnique({ where: { idservicio: id }, include: INCLUDE_COMPLETO });
  }

  async existeNombre(idproveedor: number, nombreServicio: string) {
    const s = await db.servicioBase.findFirst({
      where: { idproveedor, estado: ESTADO.ACTIVO, nombreServicio: { equals: nombreServicio, mode: "insensitive" } },
    });
    return !!s;
  }

  // CU-19: servicio base + subtipo en una sola transacción (patrón CTI)
  async create(idproveedor: number, dto: CrearServicioDto) {
    const rel = RELACION_SUBTIPO[dto.tipo];
    return db.servicioBase.create({
      data: {
        idproveedor,
        ...dto.base,
        estado: ESTADO.ACTIVO,
        [rel]: { create: dto.especifico },
      },
      include: INCLUDE_COMPLETO,
    });
  }

  // CU-20: modificación en el mismo registro
  async updateEnSitio(
    id: number,
    tipo: TipoServicio,
    base: { [k: string]: any },
    especifico: { [k: string]: any }
  ) {
    const rel = RELACION_SUBTIPO[tipo];
    return db.servicioBase.update({
      where: { idservicio: id },
      data: {
        ...base,
        ...(Object.keys(especifico).length > 0 && { [rel]: { update: especifico } }),
      },
      include: INCLUDE_COMPLETO,
    });
  }

  /**
   * CU-20, flujo alternativo 1: el servicio está en salidas publicadas o en curso, que deben
   * conservar sus condiciones originales. En vez de pisar el registro se crea una VERSIÓN NUEVA
   * y la anterior queda INACTIVA (sigue vinculada a las salidas existentes). El paquete y su
   * garantía pasan a apuntar a la versión nueva, que es la que rige para salidas futuras.
   */
  async versionar(
    original: { idservicio: number; idproveedor: number; nombreServicio: string; descripcion: string | null; costoBase: number; localidad: string },
    tipo: TipoServicio,
    base: { [k: string]: any },
    especificoCompleto: { [k: string]: any }
  ) {
    const rel = RELACION_SUBTIPO[tipo];
    return db.$transaction(async (tx) => {
      const nuevo = await tx.servicioBase.create({
        data: {
          idproveedor: original.idproveedor,
          nombreServicio: original.nombreServicio,
          descripcion: original.descripcion,
          costoBase: original.costoBase,
          localidad: original.localidad,
          ...base,
          estado: ESTADO.ACTIVO,
          [rel]: { create: especificoCompleto },
        },
        include: INCLUDE_COMPLETO,
      });
      await tx.paqueteServicio.updateMany({
        where: { idservicio: original.idservicio },
        data: { idservicio: nuevo.idservicio },
      });
      await tx.garantiaEstablecimiento.updateMany({
        where: { idservicio: original.idservicio },
        data: { idservicio: nuevo.idservicio },
      });
      await tx.servicioBase.update({ where: { idservicio: original.idservicio }, data: { estado: ESTADO.INACTIVO } });
      return nuevo;
    });
  }

  async updateEstado(id: number, estado: string) {
    return db.servicioBase.update({ where: { idservicio: id }, data: { estado }, include: INCLUDE_COMPLETO });
  }

  // ----- Consultas de dependencias (CU-17, CU-20, CU-21) -----
  async contarSalidasActivas(idservicio: number): Promise<number> {
    return db.salida.count({
      where: {
        estado: { in: SALIDAS_ACTIVAS },
        OR: [{ servicios: { some: { idservicio } } }, { equipamientos: { some: { idservicio } } }],
      },
    });
  }

  async contarSolicitudesPendientes(idservicio: number): Promise<number> {
    return db.solicitud.count({ where: { idservicio, estado: ESTADO_SOLICITUD.PENDIENTE } });
  }

  async contarGarantiasDePaquetesActivos(idservicio: number): Promise<number> {
    return db.garantiaEstablecimiento.count({ where: { idservicio, paquete: { estado: ESTADO.ACTIVO } } });
  }

  /** Unidades de equipamiento comprometidas en salidas activas o en curso (CU-20). */
  async cantidadComprometida(idservicio: number): Promise<number> {
    const r = await db.salidaEquipamiento.aggregate({
      where: { idservicio, salida: { estado: { in: SALIDAS_ACTIVAS } } },
      _sum: { cantidad: true },
    });
    return r._sum.cantidad ?? 0;
  }

  /** Lo mismo, para varios servicios a la vez (listados). */
  async comprometidasPorServicio(ids: number[]): Promise<Map<number, number>> {
    if (ids.length === 0) return new Map();
    const filas = await db.salidaEquipamiento.groupBy({
      by: ["idservicio"],
      where: { idservicio: { in: ids }, salida: { estado: { in: SALIDAS_ACTIVAS } } },
      _sum: { cantidad: true },
    });
    return new Map(filas.map((f) => [f.idservicio, f._sum.cantidad ?? 0]));
  }
}