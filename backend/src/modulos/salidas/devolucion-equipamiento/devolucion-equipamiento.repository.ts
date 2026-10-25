import { db } from "../../../config/postgresDatabase";
import { CustomError } from "../../../error/CustomError";
import { ItemDevolucion } from "./devolucion-equipamiento.dto";

export interface DatosRegistroDevolucion {
  idsalida: number;
  usuarioAuditoria: string;
  items: ItemDevolucion[];
  observacionesGenerales: string | null;
}

export class DevolucionEquipamientoRepository {
  /**
   * Obtiene la salida junto con el equipamiento asignado y su detalle de stock.
   */
  async existeDevolucion(idsalida: number) {
    const auditoria = await db.registroAuditoria.findFirst({
      where: {
        idsalida,
        cambios: { path: ["tipoOperacion"], equals: "DEVOLUCION_EQUIPAMIENTO" },
      },
    });
    return !!auditoria;
  }

  async obtenerSalidaConEquipamiento(idsalida: number) {
    return db.salida.findUnique({
      where: { idsalida },
      include: {
        equipamientos: {
          include: {
            servicio: {
              include: {
                equipamiento: true,
                proveedor: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Ejecuta en una transacción atómica:
   * 1. Reintegro del stock en buen estado a cada ServicioEquipamiento.
   * 2. Ajuste o registro del equipamiento devuelto.
   * 3. Asentamiento en RegistroAuditoria con el detalle completo de la inspección.
   */
  async registrarDevolucion(datos: DatosRegistroDevolucion) {
    return db.$transaction(async (tx) => {
      // SAL-03: lock de la salida para serializar devoluciones concurrentes; sin él, dos
      // transacciones pasan el chequeo siguiente a la vez y reintegran el stock dos veces
      await tx.$queryRaw`SELECT 1 FROM public."Salida" WHERE idsalida = ${datos.idsalida} FOR UPDATE`;

      // Verificación contra doble devolución (ya con el lock tomado)
      const yaExiste = await tx.registroAuditoria.findFirst({
        where: {
          idsalida: datos.idsalida,
          cambios: { path: ["tipoOperacion"], equals: "DEVOLUCION_EQUIPAMIENTO" },
        },
      });
      if (yaExiste) {
        throw CustomError.badRequest("La devolución de equipamiento para esta salida ya fue registrada.");
      }

      const resultadosStock = [];

      for (const item of datos.items) {
        // Solo la cantidad en buen estado se reintegra al stock disponible para futuras salidas
        if (item.cantidadBuenEstado > 0) {
          const equipActualizado = await tx.servicioEquipamiento.update({
            where: { idservicio: item.idservicio },
            data: {
              cantidadDisponible: {
                increment: item.cantidadBuenEstado,
              },
            },
          });
          resultadosStock.push({
            idservicio: item.idservicio,
            nuevoStockDisponible: equipActualizado.cantidadDisponible,
          });
        }
      }

      // Registro de auditoría con snapshot completo de la devolución (CU-41 / RF-56)
      const auditoria = await tx.registroAuditoria.create({
        data: {
          idsalida: datos.idsalida,
          usuario: datos.usuarioAuditoria,
          motivo: datos.observacionesGenerales ?? "Devolución de equipamiento de salida finalizada",
          cambios: JSON.parse(
            JSON.stringify({
              tipoOperacion: "DEVOLUCION_EQUIPAMIENTO",
              fechaRegistro: new Date().toISOString(),
              detalleItems: datos.items,
            })
          ),
        },
      });

      return {
        auditoriaId: auditoria.idcambio,
        stockReintegrado: resultadosStock,
      };
    });
  }
}
