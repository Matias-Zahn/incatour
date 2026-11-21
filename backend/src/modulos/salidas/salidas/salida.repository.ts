import { db } from "../../../config/postgresDatabase";
import { Prisma } from "@prisma/client";
import { CustomError } from "../../../error/CustomError";
import {
  DIAS_REACONDICIONAMIENTO, ESTADO, ESTADO_PERMISO, ESTADO_RESERVA, ESTADO_SALIDA, ESTADO_SOLICITUD, MODALIDAD_BLOQUEO_PLAZAS,
  SALIDAS_NO_INICIADAS, TIPO_SERVICIO,
} from "../../../shared/constantes";
import { DefinicionPaquete } from "../../../shared/definicionPaquete";
import { reglasEquipo } from "../../../shared/equipo";
import { Rango, rangosDe, sumarDias } from "../../../shared/ocupacion";
import { cargarEquipo, disponible, disponibles, ocupar } from "../../../shared/ocupacion.repository";
import { AsignacionRepository } from "../asignacion/asignacion.repository";
import { ConsultarSalidasDto } from "./salida.dto";

export type SalidaListada = Awaited<ReturnType<SalidaRepository["buscar"]>>[number];
export type PaqueteParaSalida = NonNullable<Awaited<ReturnType<SalidaRepository["buscarPaquete"]>>>;

/** B10: lo que la salida le bloquea a cada hotel; plazas null = a solicitud (cubre lo que falte, sin bloquear). */
export type HotelSalida = { idservicio: number; nombreServicio: string; plazas: number | null };

export interface DatosNuevaSalida {
  idpaquete: number;
  fechaInicio: Date;
  fechaFin: Date;
  tamanoMaximo: number;
  idbloqueo: string;
  hoteles: HotelSalida[]; // B10: en el orden en que la compra los llena; los a solicitud, al final
  idtransporte: number; // B3
  personalIds: number[]; // B3: guías y porteadores
  equipos: number[]; // B3: los equipos con regla, que quedan en 0 hasta la primera compra
  diasCierreVenta: number; // B4
  rangosAlojamiento: Rango[]; // A1: noches previas y posteriores
  definicionPaquete: DefinicionPaquete; // CAT-05
}

export class SalidaRepository {
  async buscar(dto: Partial<ConsultarSalidasDto>, idsalida?: number) {
    return db.salida.findMany({
      where: {
        ...(idsalida && { idsalida }),
        ...(dto.idpaquete && { idpaquete: dto.idpaquete }),
        ...(dto.estado && { estado: dto.estado }),
        ...((dto.desde || dto.hasta) && {
          fechaInicio: {
            ...(dto.desde && { gte: dto.desde }),
            ...(dto.hasta && { lte: dto.hasta }),
          },
        }),
        ...(dto.idguia && { personalAsignado: { some: { idpersonal: dto.idguia, personal: { rol: "Guía" } } } }),
        ...(dto.idcircuito && { paquete: { idcircuito: dto.idcircuito } }),
      },
      include: {
        paquete: {
          select: {
            nroPaquete: true,
            nombrePaquete: true,
            circuito: {
              select: {
                idcircuito: true, nombreCircuito: true, duracionDias: true, _count: { select: { etapas: true } },
                // Para mostrar dónde está el grupo, no solo el número de etapa
                etapas: { select: { numeroOrden: true, puntoInicio: true, puntoFin: true }, orderBy: { numeroOrden: "asc" } },
              },
            },
          },
        },
        // 12.3: lo necesario para volver a controlar la aptitud
        personalAsignado: {
          include: {
            personal: {
              select: {
                idpersonal: true, nombreCompleto: true, rol: true, estado: true, fechaVencimientoPasaporte: true,
                guia: { select: { fechaHabilitacion: true, usuario: { select: { estado: true } } } },
              },
            },
          },
        },
        // RF-50 y RF-61: lo necesario para contar pasajeros, permisos y solicitudes pendientes
        reservas: {
          where: { estado: ESTADO_RESERVA.CONFIRMADA },
          select: {
            _count: { select: { pasajeros: true } },
            permisos: { where: { estadoTramite: ESTADO_PERMISO.EMITIDO }, select: { idpermisopasajero: true } },
            solicitudes: { where: { estado: ESTADO_SOLICITUD.PENDIENTE }, select: { idsolicitud: true } },
          },
        },
        permisos: { where: { estadoTramite: ESTADO_PERMISO.EMITIDO }, select: { idpermisopersonal: true } },
        // Cuánto tardó el primer aviso del guía desde que salió
        avances: { select: { fechaHoraLlegada: true }, orderBy: { fechaHoraLlegada: "asc" }, take: 1 },
        // Decisión 12 del contrato: servicios del listado (hotel y transporte), desde Ocupacion
        ocupaciones: {
          where: { tipo: { in: [TIPO_SERVICIO.ALOJAMIENTO, TIPO_SERVICIO.TRANSPORTE] } },
          select: {
            idsalida: true, idservicio: true, tipo: true, comprobanteReserva: true,
            servicio: { select: { nombreServicio: true, transporte: { select: { capacidadVehiculo: true } } } },
          },
          orderBy: { idocupacion: "asc" },
        },
      },
      orderBy: { fechaInicio: "asc" },
    });
  }

  // CU-36: el paquete con todo lo que hace falta para validar y dimensionar la salida
  async buscarPaquete(idpaquete: number) {
    return db.paquete.findUnique({
      where: { idpaquete },
      include: {
        circuito: true,
        tarifas: { include: { temporada: true } },
        // CAT-05: lo necesario para armar la foto de la definición
        garantiasEstablecimiento: { include: { servicio: { include: { alojamiento: true } } } },
        servicios: { include: { servicio: { include: { transporte: true, tren: true, equipamiento: true } } } },
      },
    });
  }

  // CU-36 paso 5: alojamientos que cumplen la garantía del paquete, con lo que tienen disponible en las noches de la
  // salida (A1). B10: también los a solicitud, con disponible null
  async buscarAlojamientos(paquete: PaqueteParaSalida, rangos: Rango[]) {
    const porEstablecimiento = paquete.garantiasEstablecimiento.length > 0;
    const where: Prisma.ServicioBaseWhereInput = {
      estado: ESTADO.ACTIVO,
      alojamiento: {
        ...(!porEstablecimiento && paquete.categoriaGarantizada && { categoria: paquete.categoriaGarantizada }),
        ...(!porEstablecimiento && paquete.tipoHabitacionGarantizada && { tipoHabitacion: paquete.tipoHabitacionGarantizada }),
      },
      ...(porEstablecimiento && { idservicio: { in: paquete.garantiasEstablecimiento.map((g) => g.idservicio) } }),
      ...(!porEstablecimiento && paquete.localidadGarantizada && { localidad: paquete.localidadGarantizada }),
    };
    const hoteles = await db.servicioBase.findMany({
      where,
      select: { idservicio: true, nombreServicio: true, localidad: true, alojamiento: true },
      orderBy: { nombreServicio: "asc" },
    });
    const libres = await disponibles(db, hoteles, rangos);
    return hoteles.map((h) => ({
      ...h,
      disponible: h.alojamiento?.modalidadConfirmacion === MODALIDAD_BLOQUEO_PLAZAS ? libres.get(h.idservicio)! : null,
    }));
  }

  /** A2b: el equipo de las salidas que todavía no empezaron, en una sola consulta (listado y alta). */
  async cargarEquipoDe(salidas: { estado: string; fechaInicio: Date; fechaFin: Date; definicionPaquete: unknown }[]) {
    const activas = salidas.filter((s) => SALIDAS_NO_INICIADAS.includes(s.estado));
    const ids = [...new Set(activas.flatMap((s) => reglasEquipo(s.definicionPaquete as DefinicionPaquete | null).map((r) => r.idservicio)))];
    if (!ids.length) return cargarEquipo(db, [], new Date(), new Date());
    const desde = new Date(Math.min(...activas.map((s) => s.fechaInicio.getTime())));
    const hasta = sumarDias(new Date(Math.max(...activas.map((s) => s.fechaFin.getTime()))), DIAS_REACONDICIONAMIENTO);
    return cargarEquipo(db, ids, desde, hasta);
  }

  // B3: los transportes activos y si están libres en esas fechas
  async buscarTransportes(fechas: { fechaInicio: Date; fechaFin: Date }) {
    const transportes = await db.servicioBase.findMany({
      where: { estado: ESTADO.ACTIVO, proveedor: { estado: ESTADO.ACTIVO }, transporte: { isNot: null } },
      select: { idservicio: true, nombreServicio: true, transporte: { select: { capacidadVehiculo: true } } },
      orderBy: { nombreServicio: "asc" },
    });
    const libres = await disponibles(db, transportes, rangosDe(TIPO_SERVICIO.TRANSPORTE, fechas));
    return transportes.map((t) => ({ ...t, capacidadVehiculo: t.transporte!.capacidadVehiculo, libre: libres.get(t.idservicio)! > 0 }));
  }

  // B3: personal activo y libre en esas fechas (el de CU-38), con las salidas no canceladas que empiezan en ese mes
  async buscarPersonalLibre(fechas: { fechaInicio: Date; fechaFin: Date }) {
    const libres = await new AsignacionRepository().personalLibre({ idsalida: 0, ...fechas });
    const inicioMes = new Date(Date.UTC(fechas.fechaInicio.getUTCFullYear(), fechas.fechaInicio.getUTCMonth(), 1));
    const finMes = new Date(Date.UTC(fechas.fechaInicio.getUTCFullYear(), fechas.fechaInicio.getUTCMonth() + 1, 1));
    const delMes = await db.asignacionPersonal.groupBy({
      by: ["idpersonal"],
      where: {
        idpersonal: { in: libres.map((p) => p.idpersonal) },
        salida: { estado: { not: ESTADO_SALIDA.CANCELADA }, fechaInicio: { gte: inicioMes, lt: finMes } },
      },
      _count: true,
    });
    const cuenta = new Map(delMes.map((g) => [g.idpersonal, g._count]));
    return libres.map((p) => ({ ...p, salidasEnElMes: cuenta.get(p.idpersonal) ?? 0 }));
  }

  buscarPersonal(ids: number[]) {
    return new AsignacionRepository().buscarPersonal(ids);
  }

  /**
   * CU-36 pasos 10 y 11, en una transacción: asignar el personal (B3), ocupar el hotel y el transporte para el máximo,
   * dejar el equipo en 0 (lo ocupa cada compra) y registrar la salida publicada. La autoridad ya bloqueó el cupo, afuera.
   * Orden de bloqueos: Personal → ServicioBase (hotel, transporte), el mismo de CU-38 y CU-39.
   */
  async crearSalida(d: DatosNuevaSalida) {
    const idsalida = await db.$transaction(async (tx) => {
      const fechas = { idsalida: 0, fechaInicio: d.fechaInicio, fechaFin: d.fechaFin };
      if ((await new AsignacionRepository().personalOcupado(tx, fechas, d.personalIds)).length) {
        throw CustomError.conflict("Parte del personal elegido se asignó a otra salida en esas fechas. Volvé a cargar las opciones");
      }
      // A1: con cada hotel bloqueado (en orden de id) se vuelve a mirar lo disponible en esas noches: otra salida pudo llevárselo
      for (const h of d.hoteles.filter((h) => h.plazas !== null).sort((a, b) => a.idservicio - b.idservicio)) {
        if ((await disponible(tx, h.idservicio, d.rangosAlojamiento)) < h.plazas!) {
          throw CustomError.conflict(`El hotel ${h.nombreServicio} ya no tiene plazas suficientes en esas noches. Volvé a cargar las opciones`);
        }
      }
      const rangosTransporte = rangosDe(TIPO_SERVICIO.TRANSPORTE, d);
      if ((await disponible(tx, d.idtransporte, rangosTransporte)) < 1) {
        throw CustomError.conflict("El transporte elegido ya está ocupado en esas fechas. Volvé a cargar las opciones");
      }

      // Limitación: número correlativo por año; dos altas simultáneas chocan con el @unique y una falla (se compensa)
      const anio = d.fechaInicio.getUTCFullYear();
      const delAnio = await tx.salida.count({ where: { nroSalida: { startsWith: `SAL-${anio}-` } } });
      const nroSalida = `SAL-${anio}-${String(delAnio + 1).padStart(3, "0")}`;

      const salida = await tx.salida.create({
        data: {
          idpaquete: d.idpaquete,
          nroSalida,
          idbloqueo: d.idbloqueo,
          stockLocal: d.tamanoMaximo,
          stockLocalAlojamiento: d.hoteles.reduce((t, h) => t + (h.plazas ?? 0), 0), // la suma de las plazasLibres
          diasCierreVenta: d.diasCierreVenta,
          tamanoMaximo: d.tamanoMaximo,
          fechaInicio: d.fechaInicio,
          fechaFin: d.fechaFin,
          estado: ESTADO_SALIDA.PUBLICADA,
          definicionPaquete: d.definicionPaquete,
          personalAsignado: { create: d.personalIds.map((idpersonal) => ({ idpersonal })) },
        },
      });
      const base = { idsalida: salida.idsalida };
      // B10: cada hotel con bloqueo ocupa sus plazas; el a solicitud queda en 0, para que la compra lo encuentre
      for (const h of d.hoteles) {
        const aloj = { ...base, idservicio: h.idservicio, tipo: TIPO_SERVICIO.ALOJAMIENTO, rangos: d.rangosAlojamiento };
        await ocupar(tx, { ...aloj, cantidad: h.plazas ?? 0, plazasLibres: h.plazas });
      }
      await ocupar(tx, { ...base, idservicio: d.idtransporte, tipo: TIPO_SERVICIO.TRANSPORTE, rangos: rangosTransporte, cantidad: 1 });
      for (const idservicio of d.equipos) {
        await ocupar(tx, { ...base, idservicio, tipo: TIPO_SERVICIO.EQUIPAMIENTO, rangos: rangosDe(TIPO_SERVICIO.EQUIPAMIENTO, d), cantidad: 0 });
      }
      return salida.idsalida;
    }, { timeout: 15000 });
    return (await this.buscar({}, idsalida))[0]!;
  }
}
