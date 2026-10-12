import { Prisma } from "@prisma/client";
import { db } from "../../../config/postgresDatabase";
import { ESTADO, ESTADO_RESERVA, SALIDAS_ACTIVAS, TIPO_SERVICIO } from "../../../shared/constantes";
import { ItemDesasignar, ItemNuevo } from "./logistica.dto";

/** Regla de negocio violada dentro de la transacción: provoca el rollback y se informa como 400. */
export class ReglaLogisticaViolada extends Error {}

type Cliente = Prisma.TransactionClient;

interface SalidaFechas {
  idsalida: number;
  fechaInicio: Date;
  fechaFin: Date;
}

export class LogisticaRepository {
  async findSalida(idsalida: number) {
    return db.salida.findUnique({
      where: { idsalida },
      select: { idsalida: true, nroSalida: true, estado: true, fechaInicio: true, fechaFin: true },
    });
  }

  // Panel de logística (paso 2)
  async obtenerPanel(idsalida: number) {
    return db.salida.findUnique({
      where: { idsalida },
      select: {
        idsalida: true,
        nroSalida: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
        equipamientos: {
          select: {
            cantidad: true,
            servicio: {
              select: {
                idservicio: true,
                nombreServicio: true,
                equipamiento: { select: { tipoEquipamiento: true } },
                proveedor: { select: { idproveedor: true, razonSocial: true } },
              },
            },
          },
        },
        servicios: {
          where: { tipo: TIPO_SERVICIO.TRANSPORTE },
          select: {
            idservicio: true,
            comprobanteReserva: true,
            servicio: {
              select: { nombreServicio: true, proveedor: { select: { idproveedor: true, razonSocial: true } } },
            },
          },
        },
      },
    });
  }

  // La capacidad del vehículo se contrasta con los pasajeros confirmados de la salida
  async pasajerosConfirmados(idsalida: number): Promise<number> {
    const r = await db.reserva.aggregate({
      where: { idsalida, estado: ESTADO_RESERVA.CONFIRMADA },
      _sum: { cantidadPasajeros: true },
    });
    return r._sum.cantidadPasajeros ?? 0;
  }

  // DCD consultarProveedoresDisponibles
  async disponiblesEquipamiento() {
    return db.servicioBase.findMany({
      where: {
        estado: ESTADO.ACTIVO,
        proveedor: { estado: ESTADO.ACTIVO },
        equipamiento: { is: { cantidadDisponible: { gt: 0 } } },
      },
      include: { proveedor: { select: { idproveedor: true, razonSocial: true } }, equipamiento: true },
      orderBy: { nombreServicio: "asc" },
    });
  }

  async disponiblesTransporte(salida: SalidaFechas, pasajeros: number) {
    return db.servicioBase.findMany({
      where: {
        estado: ESTADO.ACTIVO,
        proveedor: { estado: ESTADO.ACTIVO },
        transporte: { is: { capacidadVehiculo: { gte: pasajeros } } },
        // sin otra salida activa cuyas fechas se superpongan con las de ésta
        NOT: {
          salidas: {
            some: {
              tipo: TIPO_SERVICIO.TRANSPORTE,
              salida: {
                idsalida: { not: salida.idsalida },
                estado: { in: SALIDAS_ACTIVAS },
                fechaInicio: { lte: salida.fechaFin },
                fechaFin: { gte: salida.fechaInicio },
              },
            },
          },
        },
      },
      include: { proveedor: { select: { idproveedor: true, razonSocial: true } }, transporte: true },
      orderBy: { nombreServicio: "asc" },
    });
  }

  /**
   * CU-39 pasos 8 a 12, atómico. Primero se desasigna (reintegrando stock) y recién después se asigna
   * (descontando), de modo que "cambiar de proveedor" nunca deja el stock en un estado intermedio.
   * Devuelve { ok: false, error } si una regla de negocio falla: la transacción se revierte entera.
   */
  async aplicarCambios(p: {
    salida: SalidaFechas;
    pasajeros: number;
    itemsDesasignar: ItemDesasignar[];
    itemsNuevos: ItemNuevo[];
    motivo: string | null;
    emailUsuario: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    const { idsalida } = p.salida;
    try {
      await db.$transaction(
        async (tx) => {
          const antes = await this.instantanea(tx, idsalida);

          // 1. Desasignar
          for (const item of p.itemsDesasignar) {
            if (item.tipo === TIPO_SERVICIO.EQUIPAMIENTO) {
              const fila = await tx.salidaEquipamiento.findFirst({ where: { idsalida, idservicio: item.idservicio } });
              if (!fila) {
                throw new ReglaLogisticaViolada(`El equipamiento ${item.idservicio} no está asignado a la salida.`);
              }
              await tx.servicioEquipamiento.update({
                where: { idservicio: item.idservicio },
                data: { cantidadDisponible: { increment: fila.cantidad } },
              });
              await tx.salidaEquipamiento.deleteMany({ where: { idsalida, idservicio: item.idservicio } });
            } else {
              const baja = await tx.salidaServicio.deleteMany({
                where: { idsalida, idservicio: item.idservicio, tipo: TIPO_SERVICIO.TRANSPORTE },
              });
              if (baja.count === 0) {
                throw new ReglaLogisticaViolada(`El transporte ${item.idservicio} no está asignado a la salida.`);
              }
            }
          }

          // 2. Asignar
          for (const item of p.itemsNuevos) {
            if (item.tipo === TIPO_SERVICIO.EQUIPAMIENTO) {
              await this.asignarEquipamiento(tx, idsalida, item);
            } else {
              await this.asignarTransporte(tx, p.salida, p.pasajeros, item);
            }
          }

          // 3. Auditoría: antes y después, con el motivo opcional
          const despues = await this.instantanea(tx, idsalida);
          await tx.registroAuditoria.create({
            data: {
              idsalida,
              usuario: p.emailUsuario,
              motivo: p.motivo,
              cambios: { accion: "MODIFICAR_LOGISTICA", antes, despues },
            },
          });
        },
        { timeout: 15000 }
      );
      return { ok: true };
    } catch (error) {
      if (error instanceof ReglaLogisticaViolada) return { ok: false, error: error.message };
      throw error;
    }
  }

  // ---------- internos (dentro de la transacción) ----------
  private async asignarEquipamiento(tx: Cliente, idsalida: number, item: ItemNuevo) {
    const cantidad = item.cantidad as number;
    const servicio = await tx.servicioBase.findUnique({
      where: { idservicio: item.idservicio },
      include: { equipamiento: true, proveedor: { select: { estado: true } } },
    });
    if (!servicio || !servicio.equipamiento) {
      throw new ReglaLogisticaViolada(`El servicio ${item.idservicio} no existe o no es de equipamiento.`);
    }
    if (servicio.estado !== ESTADO.ACTIVO || servicio.proveedor.estado !== ESTADO.ACTIVO) {
      throw new ReglaLogisticaViolada(`"${servicio.nombreServicio}" o su proveedor están inactivos.`);
    }
    const yaAsignado = await tx.salidaEquipamiento.findFirst({ where: { idsalida, idservicio: item.idservicio } });
    if (yaAsignado) {
      throw new ReglaLogisticaViolada(
        `"${servicio.nombreServicio}" ya está asignado: para cambiar la cantidad desasignalo y volvé a asignarlo en la misma operación.`
      );
    }

    // Descuento condicional y atómico: nunca deja el stock negativo ni compromete dos veces la misma unidad
    const descuento = await tx.servicioEquipamiento.updateMany({
      where: { idservicio: item.idservicio, cantidadDisponible: { gte: cantidad } },
      data: { cantidadDisponible: { decrement: cantidad } },
    });
    if (descuento.count === 0) {
      throw new ReglaLogisticaViolada(
        `Stock insuficiente de "${servicio.nombreServicio}": se solicitaron ${cantidad} y hay ${servicio.equipamiento.cantidadDisponible} disponibles.`
      );
    }
    await tx.salidaEquipamiento.create({ data: { idsalida, idservicio: item.idservicio, cantidad } });
  }

  private async asignarTransporte(tx: Cliente, salida: SalidaFechas, pasajeros: number, item: ItemNuevo) {
    const existente = await tx.salidaServicio.findFirst({
      where: { idsalida: salida.idsalida, tipo: TIPO_SERVICIO.TRANSPORTE },
    });
    if (existente) {
      throw new ReglaLogisticaViolada("La salida ya tiene un transporte asignado: desasignalo en la misma operación para reemplazarlo.");
    }

    const motivo = await this.motivoTransporteNoDisponible(tx, item.idservicio, salida, pasajeros);
    if (motivo) throw new ReglaLogisticaViolada(motivo);

    await tx.salidaServicio.create({
      data: {
        idsalida: salida.idsalida,
        idservicio: item.idservicio,
        tipo: TIPO_SERVICIO.TRANSPORTE,
        comprobanteReserva: item.comprobanteReserva as string,
      },
    });
  }

  /** Devuelve el motivo por el que el transporte no puede asignarse, o null si está disponible. */
  private async motivoTransporteNoDisponible(
    tx: Cliente,
    idservicio: number,
    salida: SalidaFechas,
    pasajeros: number
  ): Promise<string | null> {
    const servicio = await tx.servicioBase.findUnique({
      where: { idservicio },
      include: { transporte: true, proveedor: { select: { estado: true } } },
    });
    if (!servicio || !servicio.transporte) return `El servicio ${idservicio} no existe o no es de transporte.`;
    if (servicio.estado !== ESTADO.ACTIVO || servicio.proveedor.estado !== ESTADO.ACTIVO) {
      return `"${servicio.nombreServicio}" o su proveedor están inactivos.`;
    }
    if (servicio.transporte.capacidadVehiculo < pasajeros) {
      return `"${servicio.nombreServicio}" no tiene capacidad: admite ${servicio.transporte.capacidadVehiculo} y la salida tiene ${pasajeros} pasajeros confirmados.`;
    }
    const superpuesta = await tx.salidaServicio.findFirst({
      where: {
        idservicio,
        tipo: TIPO_SERVICIO.TRANSPORTE,
        salida: {
          idsalida: { not: salida.idsalida },
          estado: { in: SALIDAS_ACTIVAS },
          fechaInicio: { lte: salida.fechaFin },
          fechaFin: { gte: salida.fechaInicio },
        },
      },
    });
    if (superpuesta) return `"${servicio.nombreServicio}" no está disponible: ya está asignado a otra salida en esas fechas.`;
    return null;
  }

  // Foto de la logística para el registro de auditoría (antes y después)
  private async instantanea(tx: Cliente, idsalida: number) {
    const [equipamiento, transporte] = await Promise.all([
      tx.salidaEquipamiento.findMany({ where: { idsalida }, select: { idservicio: true, cantidad: true } }),
      tx.salidaServicio.findFirst({
        where: { idsalida, tipo: TIPO_SERVICIO.TRANSPORTE },
        select: { idservicio: true, comprobanteReserva: true },
      }),
    ]);
    return { equipamiento, transporte };
  }
}