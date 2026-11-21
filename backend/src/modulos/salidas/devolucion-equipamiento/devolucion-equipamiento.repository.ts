import { db } from "../../../config/postgresDatabase";
import { CustomError } from "../../../error/CustomError";
import { TIPO_SERVICIO } from "../../../shared/constantes";
import { hoyUTC } from "../../../shared/fechas";
import { disponibles } from "../../../shared/ocupacion.repository";
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
        ocupaciones: {
          where: { tipo: TIPO_SERVICIO.EQUIPAMIENTO },
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
   * 1. Baja del total de cada ServicioEquipamiento por lo dañado o extraviado (lo sano vuelve solo por fecha).
   * 2. Asentamiento en RegistroAuditoria con el detalle completo de la inspección.
   */
  async registrarDevolucion(datos: DatosRegistroDevolucion) {
    return db.$transaction(async (tx) => {
      // SAL-03: lock de la salida para serializar devoluciones concurrentes; sin él, dos
      // transacciones pasan el chequeo siguiente a la vez y descuentan el inventario dos veces
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

      // A1: lo que vuelve en buen estado queda libre solo por fecha. Lo dañado o extraviado baja el total
      const totalesActualizados = [];
      for (const item of datos.items) {
        if (item.cantidadDaniada > 0) {
          const equipo = await tx.servicioEquipamiento.update({
            where: { idservicio: item.idservicio },
            data: { cantidadTotal: { decrement: item.cantidadDaniada } },
          });
          totalesActualizados.push({ idservicio: item.idservicio, nuevoTotal: equipo.cantidadTotal });
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
              totalesActualizados, // A1: la baja de inventario por rotura o pérdida queda auditada
            })
          ),
        },
      });

      return { auditoriaId: auditoria.idcambio, totalesActualizados };
    });
  }

  // A1: lo que cada equipo tiene libre hoy
  async disponiblesHoy(servicios: { idservicio: number; equipamiento: { cantidadTotal: number } | null }[]) {
    const hoy = hoyUTC();
    return disponibles(db, servicios, [{ desde: hoy, hasta: hoy }]);
  }
}
