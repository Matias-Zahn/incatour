import { db } from "../../../config/postgresDatabase";
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
