import { db } from "../../../config/postgresDatabase";
import { SALIDAS_ACTIVAS, ESTADO_SOLICITUD } from "../../../shared/constantes";
import { CrearProveedorDto, FiltrosProveedorDto, ModificarProveedorDto } from "./proveedor.dto";

export class ProveedorRepository {
  // CU-14
  async findAll(filtros: FiltrosProveedorDto) {
    return db.proveedor.findMany({
      where: {
        ...(filtros.tipoProveedor && { tipoProveedor: filtros.tipoProveedor }),
        ...(filtros.localidad && { localidad: { contains: filtros.localidad, mode: "insensitive" } }),
        ...(filtros.estado && { estado: filtros.estado }),
      },
      include: { _count: { select: { servicios: true } } },
      orderBy: { razonSocial: "asc" },
    });
  }

  async findById(id: number) {
    return db.proveedor.findUnique({
      where: { idproveedor: id },
      include: { _count: { select: { servicios: true } } },
    });
  }

  async existeRazonSocial(razonSocial: string, localidad: string, excluirId?: number) {
    const proveedor = await db.proveedor.findFirst({
      where: {
        razonSocial: { equals: razonSocial, mode: "insensitive" },
        localidad: { equals: localidad, mode: "insensitive" },
        estado: "ACTIVO",
        ...(excluirId ? { NOT: { idproveedor: excluirId } } : {}),
      },
    });
    return !!proveedor;
  }

  async create(data: CrearProveedorDto) {
    return db.proveedor.create({
      data: {
        tipoProveedor: data.tipoProveedor,
        razonSocial: data.razonSocial,
        localidad: data.localidad,
        datosContacto: data.datosContacto,
        canalComunicacion: data.canalComunicacion,
        estado: data.estado,
      },
      include: { _count: { select: { servicios: true } } },
    });
  }

  async update(id: number, data: ModificarProveedorDto) {
    return db.proveedor.update({
      where: { idproveedor: id },
      data: {
        ...(data.tipoProveedor !== undefined && { tipoProveedor: data.tipoProveedor }),
        ...(data.razonSocial !== undefined && { razonSocial: data.razonSocial }),
        ...(data.localidad !== undefined && { localidad: data.localidad }),
        ...(data.datosContacto !== undefined && { datosContacto: data.datosContacto }),
        ...(data.canalComunicacion !== undefined && { canalComunicacion: data.canalComunicacion }),
        ...(data.estado !== undefined && { estado: data.estado }),
      },
      include: { _count: { select: { servicios: true } } },
    });
  }

  async updateEstado(id: number, estado: string) {
    return db.$transaction(async (tx) => {
      const proveedor = await tx.proveedor.update({
        where: { idproveedor: id },
        data: { estado },
        include: { _count: { select: { servicios: true } } },
      });

      // CAT-10: Si el proveedor pasa a INACTIVO, se dan de baja en cascada todos sus servicios
      if (estado === "INACTIVO") {
        await tx.servicioBase.updateMany({
          where: { idproveedor: id, estado: "ACTIVO" },
          data: { estado: "INACTIVO" },
        });
      }

      return proveedor;
    });
  }

  async contarServicios(id: number) {
    return db.servicioBase.count({ where: { idproveedor: id } });
  }

  // CU-17, flujo alternativo 1: solicitudes de alojamiento pendientes de confirmación
  async tieneSolicitudesPendientes(id: number): Promise<boolean> {
    const count = await db.solicitud.count({
      // El hotel de la solicitud sale de sus gestiones o de la garantía por establecimiento del paquete
      where: {
        estado: ESTADO_SOLICITUD.PENDIENTE,
        OR: [
          { gestiones: { some: { servicio: { idproveedor: id } } } },
          { reserva: { salida: { paquete: { garantiasEstablecimiento: { some: { servicio: { idproveedor: id } } } } } } },
        ],
      },
    });
    return count > 0;
  }

  // CU-17, flujo alternativo 2: servicios del proveedor asignados a salidas activas o en curso
  async tieneSalidasActivas(id: number): Promise<boolean> {
    const count = await db.salida.count({
      where: {
        estado: { in: SALIDAS_ACTIVAS },
        OR: [
          { servicios: { some: { servicio: { idproveedor: id } } } },
          { equipamientos: { some: { servicio: { idproveedor: id } } } },
        ],
      },
    });
    return count > 0;
  }
}
