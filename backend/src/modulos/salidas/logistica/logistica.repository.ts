import { Prisma } from "@prisma/client";
import { db } from "../../../config/postgresDatabase";
import { hoyUTC } from "../../../shared/fechas";
import { ESTADO, ESTADO_RESERVA, SALIDAS_NO_INICIADAS, TIPO_SERVICIO } from "../../../shared/constantes";
import { rangosDe } from "../../../shared/ocupacion";
import { bloquearServicio, disponible, disponibles, liberar, ocupacionesDe, ocupar } from "../../../shared/ocupacion.repository";
import { necesidad, ReglaEquipo } from "../../../shared/equipo";
import { DefinicionPaquete } from "../../../shared/definicionPaquete";
import { ItemDesasignar, ItemNuevo } from "./logistica.dto";

/** Regla de negocio violada dentro de la transacción: provoca el rollback y se informa como 400. */
export class ReglaLogisticaViolada extends Error {}

type Cliente = Prisma.TransactionClient;

/**
 * Lo que fijó el paquete (su copia en la salida): el equipo con regla y el costo del transporte con que se calculó el precio.
 * null = sin límite (salidas anteriores a la copia del paquete).
 */
export type LimitesPaquete = { equipos: number[] | null; costoMaxTransporte: number | null };

interface SalidaFechas {
  idsalida: number;
  fechaInicio: Date;
  fechaFin: Date;
  limites: LimitesPaquete;
  /** El equipo con regla de la copia del paquete: su cantidad la calcula la venta, acá solo se reemplaza por otro del mismo tipo */
  reglas: ReglaEquipo[];
  definicion: DefinicionPaquete | null;
}

export class LogisticaRepository {
  async findSalida(idsalida: number) {
    return db.salida.findUnique({
      where: { idsalida },
      select: {
        idsalida: true, nroSalida: true, estado: true, fechaInicio: true, fechaFin: true, tamanoMaximo: true, definicionPaquete: true,
        _count: { select: { personalAsignado: true } },
      },
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
        definicionPaquete: true,
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
  async costoDe(idservicio: number) {
    return (await db.servicioBase.findUnique({ where: { idservicio }, select: { costoBase: true } }))?.costoBase ?? null;
  }

  async disponiblesEquipamiento(salida: SalidaFechas) {
    const equipos = await db.servicioBase.findMany({
      where: {
        estado: ESTADO.ACTIVO, proveedor: { estado: ESTADO.ACTIVO }, equipamiento: { isNot: null },
        // Con equipo del paquete se ofrecen los del mismo tipo, para reemplazarlo
        ...(salida.limites.equipos && { equipamiento: { is: { tipoEquipamiento: { in: await this.tiposDe(salida.limites.equipos) } } } }),
      },
      include: { proveedor: { select: { idproveedor: true, razonSocial: true } }, equipamiento: true },
      orderBy: { nombreServicio: "asc" },
    });
    const libres = await disponibles(db, equipos, rangosDe(TIPO_SERVICIO.EQUIPAMIENTO, salida));
    return equipos.map((e) => ({ ...e, disponible: libres.get(e.idservicio)! })).filter((e) => e.disponible > 0);
  }

  private async tiposDe(ids: number[]) {
    const filas = await db.servicioEquipamiento.findMany({ where: { idservicio: { in: ids } }, select: { tipoEquipamiento: true } });
    return [...new Set(filas.map((f) => f.tipoEquipamiento))];
  }

  // 12.4: lugares son los pasajeros más el personal
  async disponiblesTransporte(salida: SalidaFechas, lugares: number) {
    const transportes = await db.servicioBase.findMany({
      where: {
        estado: ESTADO.ACTIVO,
        proveedor: { estado: ESTADO.ACTIVO },
        transporte: { is: { capacidadVehiculo: { gte: lugares } } },
        ...(salida.limites.costoMaxTransporte !== null && { costoBase: { lte: salida.limites.costoMaxTransporte } }),
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
    lugares: number;
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
          if (!fila || !SALIDAS_NO_INICIADAS.includes(fila.estado) || fila.fechaInicio <= hoyUTC()) {
            throw new ReglaLogisticaViolada("La salida cambió mientras se modificaba la logística: se canceló o ya comenzó.");
          }

          const antes = await this.instantanea(tx, idsalida);
          const reemplazos = await this.reemplazosDeEquipo(tx, p.salida, p.itemsDesasignar, p.itemsNuevos);

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
              const regla = reemplazos.get(item.idservicio);
              // El reemplazo hereda la regla: su cantidad es la que piden los vendidos, como la recalcula cada compra
              await this.asignarEquipamiento(tx, p.salida, regla ? { ...item, cantidad: necesidad(reemplazos.vendidos, regla) } : item, !!regla);
            } else {
              await this.asignarTransporte(tx, p.salida, p.lugares, item);
            }
          }

          // La copia del paquete pasa a apuntar al artículo nuevo, así la compra y la confirmación siguen su regla
          if (reemplazos.size && p.salida.definicion) {
            const servicios = p.salida.definicion.servicios.map((s) => {
              const nuevo = [...reemplazos.entries()].find(([, r]) => r.idservicio === s.idservicio);
              return nuevo && s.tipo === TIPO_SERVICIO.EQUIPAMIENTO ? { ...s, idservicio: nuevo[0], nombreServicio: reemplazos.nombres.get(nuevo[0])! } : s;
            });
            await tx.salida.update({ where: { idsalida }, data: { definicionPaquete: { ...p.salida.definicion, servicios } } });
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
  /**
   * Con equipo del paquete, CU-39 solo lo reemplaza por otro del mismo tipo (quitar uno y poner otro en la misma operación).
   * No se quita sin reemplazo ni se le cambia la cantidad a mano: la cantidad sale de la regla y la recalcula cada compra.
   * Devuelve, por cada artículo nuevo, la regla que hereda.
   */
  private async reemplazosDeEquipo(tx: Cliente, salida: SalidaFechas, desasignar: ItemDesasignar[], nuevos: ItemNuevo[]) {
    const reemplazos = Object.assign(new Map<number, ReglaEquipo>(), { vendidos: 0, nombres: new Map<number, string>() });
    if (!salida.reglas.length) return reemplazos;
    const esEquipo = (i: { tipo: string }) => i.tipo === TIPO_SERVICIO.EQUIPAMIENTO;
    const regla = (id: number) => salida.reglas.find((r) => r.idservicio === id);
    const ids = [...desasignar.filter(esEquipo), ...nuevos.filter(esEquipo)].map((i) => i.idservicio);
    const tipos = new Map(
      (await tx.servicioBase.findMany({ where: { idservicio: { in: ids } }, select: { idservicio: true, nombreServicio: true, equipamiento: { select: { tipoEquipamiento: true } } } }))
        .map((s) => [s.idservicio, s])
    );
    for (const n of nuevos.filter(esEquipo)) {
      const r = regla(n.idservicio);
      if (r) throw new ReglaLogisticaViolada(`La cantidad de "${r.nombreServicio}" la calcula la regla del paquete según los vendidos: no se cambia a mano.`);
    }
    const sinPareja = [...nuevos.filter(esEquipo)];
    for (const d of desasignar.filter(esEquipo)) {
      const r = regla(d.idservicio);
      if (!r) continue;
      const tipo = tipos.get(d.idservicio)?.equipamiento?.tipoEquipamiento;
      const i = sinPareja.findIndex((n) => tipos.get(n.idservicio)?.equipamiento?.tipoEquipamiento === tipo);
      if (i < 0) throw new ReglaLogisticaViolada(`"${r.nombreServicio}" lo exige el paquete: se puede reemplazar por otro del mismo tipo, no quitar.`);
      const [nuevo] = sinPareja.splice(i, 1);
      reemplazos.set(nuevo!.idservicio, r);
      reemplazos.nombres.set(nuevo!.idservicio, tipos.get(nuevo!.idservicio)!.nombreServicio);
    }
    if (sinPareja.length) {
      throw new ReglaLogisticaViolada("El equipo de esta salida lo fija el paquete: solo se puede reemplazar un artículo por otro del mismo tipo.");
    }
    reemplazos.vendidos = await tx.reservaPasajero.count({ where: { reserva: { idsalida: salida.idsalida, estado: ESTADO_RESERVA.CONFIRMADA } } });
    return reemplazos;
  }

  private async asignarEquipamiento(tx: Cliente, salida: SalidaFechas, item: ItemNuevo, esReemplazo = false) {
    const cantidad = item.cantidad as number;
    const servicio = await tx.servicioBase.findUnique({
      where: { idservicio: item.idservicio },
      include: { equipamiento: true, proveedor: { select: { estado: true } } },
    });
    if (!servicio || !servicio.equipamiento) {
      throw new ReglaLogisticaViolada(`El servicio ${item.idservicio} no existe o no es de equipamiento.`);
    }
    if (!esReemplazo && salida.limites.equipos && !salida.limites.equipos.includes(item.idservicio)) {
      throw new ReglaLogisticaViolada(`"${servicio.nombreServicio}" no es parte del equipo del paquete.`);
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

  private async asignarTransporte(tx: Cliente, salida: SalidaFechas, lugares: number, item: ItemNuevo) {
    const existente = await tx.ocupacion.findFirst({
      where: { idsalida: salida.idsalida, tipo: TIPO_SERVICIO.TRANSPORTE },
    });
    if (existente) {
      throw new ReglaLogisticaViolada("La salida ya tiene un transporte asignado: desasignalo en la misma operación para reemplazarlo.");
    }

    const motivo = await this.motivoTransporteNoDisponible(tx, item.idservicio, salida, lugares);
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
    lugares: number
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
    if (salida.limites.costoMaxTransporte !== null && servicio.costoBase > salida.limites.costoMaxTransporte) {
      return `"${servicio.nombreServicio}" cuesta más que el transporte del paquete: el precio se fijó con ese costo.`;
    }
    if (servicio.transporte.capacidadVehiculo < lugares) {
      return `"${servicio.nombreServicio}" no tiene capacidad: admite ${servicio.transporte.capacidadVehiculo} y la salida necesita ${lugares} lugares (pasajeros y personal).`;
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