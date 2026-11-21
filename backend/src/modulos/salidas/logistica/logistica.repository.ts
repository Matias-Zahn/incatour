import { Prisma } from "@prisma/client";
import { db } from "../../../config/postgresDatabase";
import { hoyUTC } from "../../../shared/fechas";
import { ESTADO, ESTADO_RESERVA, TIPO_SERVICIO } from "../../../shared/constantes";
import { rangosDe } from "../../../shared/ocupacion";
import { bloquearServicio, disponible, disponibles, liberar, ocupacionesDe, ocupar } from "../../../shared/ocupacion.repository";
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
        ocupaciones: {
          where: { tipo: { in: [TIPO_SERVICIO.EQUIPAMIENTO, TIPO_SERVICIO.TRANSPORTE] } },
          select: {
            tipo: true,
            cantidad: true,
            comprobanteReserva: true,
            servicio: {
              select: {
                idservicio: true,
                nombreServicio: true,
                equipamiento: { select: { tipoEquipamiento: true } },
                proveedor: { select: { idproveedor: true, razonSocial: true } },
              },
            },
          },
          orderBy: { idocupacion: "asc" },
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

  // DCD consultarProveedoresDisponibles. A1: lo disponible en las fechas de la salida, descontando también
  // lo que ella ya tiene (es lo que se le puede sumar). Los que dan 0 no se listan
  async disponiblesEquipamiento(salida: SalidaFechas) {
    const equipos = await db.servicioBase.findMany({
      where: { estado: ESTADO.ACTIVO, proveedor: { estado: ESTADO.ACTIVO }, equipamiento: { isNot: null } },
      include: { proveedor: { select: { idproveedor: true, razonSocial: true } }, equipamiento: true },
      orderBy: { nombreServicio: "asc" },
    });
    const libres = await disponibles(db, equipos, rangosDe(TIPO_SERVICIO.EQUIPAMIENTO, salida));
    return equipos.map((e) => ({ ...e, disponible: libres.get(e.idservicio)! })).filter((e) => e.disponible > 0);
  }

  async disponiblesTransporte(salida: SalidaFechas, pasajeros: number) {
    const transportes = await db.servicioBase.findMany({
      where: {
        estado: ESTADO.ACTIVO,
        proveedor: { estado: ESTADO.ACTIVO },
        transporte: { is: { capacidadVehiculo: { gte: pasajeros } } },
      },
      include: { proveedor: { select: { idproveedor: true, razonSocial: true } }, transporte: true },
      orderBy: { nombreServicio: "asc" },
    });
    // sin otra salida activa que lo ocupe en las fechas de ésta
    const libres = await disponibles(db, transportes, rangosDe(TIPO_SERVICIO.TRANSPORTE, salida), salida.idsalida);
    return transportes.filter((t) => libres.get(t.idservicio)! > 0);
  }

  /**
   * CU-39 pasos 8 a 12, atómico. Primero se desasigna (se borra la ocupación) y recién después se asigna
   * (con control de lo disponible en las fechas), de modo que "cambiar de proveedor" nunca queda a medias.
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
          // SAL-16: se bloquea la salida antes que nada (mismo orden que CU-37 y CU-40) y se revalida adentro
          const [fila] = await tx.$queryRaw<{ estado: string; fechaInicio: Date }[]>`
            SELECT estado, "fechaInicio" FROM public."Salida" WHERE idsalida = ${idsalida} FOR UPDATE`;
          if (fila?.estado !== "CERRADA" || fila.fechaInicio <= hoyUTC()) {
            throw new ReglaLogisticaViolada("La salida cambió mientras se modificaba la logística: ya no está cerrada o ya comenzó.");
          }

          const antes = await this.instantanea(tx, idsalida);

          // 1. Desasignar: A1, borrar la ocupación alcanza; lo liberado vuelve solo por fecha
          for (const item of p.itemsDesasignar) {
            if ((await liberar(tx, idsalida, item.idservicio)) === 0) {
              const recurso = item.tipo === TIPO_SERVICIO.EQUIPAMIENTO ? "equipamiento" : "transporte";
              throw new ReglaLogisticaViolada(`El ${recurso} ${item.idservicio} no está asignado a la salida.`);
            }
          }

          // 2. Asignar, en orden de id: dos modificaciones con los mismos servicios los bloquean en el mismo orden
          for (const item of [...p.itemsNuevos].sort((a, b) => a.idservicio - b.idservicio)) {
            if (item.tipo === TIPO_SERVICIO.EQUIPAMIENTO) {
              await this.asignarEquipamiento(tx, p.salida, item);
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
  private async asignarEquipamiento(tx: Cliente, salida: SalidaFechas, item: ItemNuevo) {
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
    // A1: si ya estaba asignado, la cantidad nueva reemplaza a la anterior en una sola operación
    const rangos = rangosDe(TIPO_SERVICIO.EQUIPAMIENTO, salida);
    const libre = await disponible(tx, item.idservicio, rangos, salida.idsalida);
    if (libre < cantidad) {
      throw new ReglaLogisticaViolada(
        `Stock insuficiente de "${servicio.nombreServicio}": se solicitaron ${cantidad} y hay ${libre} disponibles en las fechas de la salida.`
      );
    }
    await liberar(tx, salida.idsalida, item.idservicio);
    await ocupar(tx, { idservicio: item.idservicio, idsalida: salida.idsalida, tipo: TIPO_SERVICIO.EQUIPAMIENTO, rangos, cantidad });
  }

  private async asignarTransporte(tx: Cliente, salida: SalidaFechas, pasajeros: number, item: ItemNuevo) {
    const existente = await tx.ocupacion.findFirst({
      where: { idsalida: salida.idsalida, tipo: TIPO_SERVICIO.TRANSPORTE },
    });
    if (existente) {
      throw new ReglaLogisticaViolada("La salida ya tiene un transporte asignado: desasignalo en la misma operación para reemplazarlo.");
    }

    const motivo = await this.motivoTransporteNoDisponible(tx, item.idservicio, salida, pasajeros);
    if (motivo) throw new ReglaLogisticaViolada(motivo);

    await ocupar(tx, {
      idservicio: item.idservicio,
      idsalida: salida.idsalida,
      tipo: TIPO_SERVICIO.TRANSPORTE,
      rangos: rangosDe(TIPO_SERVICIO.TRANSPORTE, salida),
      cantidad: 1,
      comprobante: item.comprobanteReserva,
    });
  }

  /** Devuelve el motivo por el que el transporte no puede asignarse, o null si está disponible. */
  async motivoTransporteNoDisponible(
    tx: Cliente,
    idservicio: number,
    salida: SalidaFechas,
    pasajeros: number
  ): Promise<string | null> {
    // Lock del servicio: dos asignaciones del mismo transporte se serializan (orden: Salida, Personal, ServicioBase)
    await bloquearServicio(tx, idservicio);
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
    const superpuesta = await ocupacionesDe(tx, [idservicio], salida.fechaInicio, salida.fechaFin, salida.idsalida);
    if (superpuesta.length) return `"${servicio.nombreServicio}" no está disponible: ya está asignado a otra salida en esas fechas.`;
    return null;
  }

  // Foto de la logística para el registro de auditoría (antes y después)
  private async instantanea(tx: Cliente, idsalida: number) {
    const [equipamiento, transporte] = await Promise.all([
      tx.ocupacion.findMany({ where: { idsalida, tipo: TIPO_SERVICIO.EQUIPAMIENTO }, select: { idservicio: true, cantidad: true } }),
      tx.ocupacion.findFirst({
        where: { idsalida, tipo: TIPO_SERVICIO.TRANSPORTE },
        select: { idservicio: true, comprobanteReserva: true },
      }),
    ]);
    return { equipamiento, transporte };
  }
}