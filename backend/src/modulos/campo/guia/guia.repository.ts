import { db } from "../../../config/postgresDatabase";
import { ESTADO_RESERVA, ESTADO_SALIDA, SALIDAS_NO_INICIADAS, TIPO_SERVICIO } from "../../../shared/constantes";
import { plazasADevolverAlHotel } from "../../salidas/cancelacion-salida/cancelacion-salida.plazas";

export class GuiaRepository {
  // El token trae idusuario; el legajo se encuentra por Usuario → Guia → Personal
  async idPersonalDelUsuario(idusuario: number) {
    const guia = await db.guia.findUnique({ where: { idusuario }, select: { idpersonal: true } });
    return guia?.idpersonal ?? null;
  }

  // CU-48: salidas asignadas al guía, sin las canceladas ni las que siguen a la venta (la asignación las cierra)
  async salidasAsignadas(idpersonal: number) {
    return db.salida.findMany({
      where: {
        personalAsignado: { some: { idpersonal } },
        estado: { notIn: [ESTADO_SALIDA.CANCELADA, ESTADO_SALIDA.PUBLICADA] },
      },
      select: {
        idsalida: true,
        nroSalida: true,
        fechaInicio: true,
        fechaFin: true,
        estado: true,
        paquete: { select: { nombrePaquete: true, circuito: { select: { nombreCircuito: true } } } },
        reservas: { where: { estado: ESTADO_RESERVA.CONFIRMADA }, select: { cantidadPasajeros: true } },
      },
      orderBy: { fechaInicio: "asc" },
    });
  }

  // CU-48: itinerario, nómina, personal y equipamiento de una salida
  async detalleSalida(idsalida: number) {
    return db.salida.findUnique({
      where: { idsalida },
      include: {
        paquete: { include: { circuito: { include: { etapas: { orderBy: { numeroOrden: "asc" } } } } } },
        avances: { orderBy: { fechaHoraReporte: "desc" } },
        incidentes: { orderBy: { fechaHoraReporte: "desc" } },
        personalAsignado: { include: { personal: { select: { idpersonal: true, nombreCompleto: true, rol: true } } } },
        reservas: {
          where: { estado: ESTADO_RESERVA.CONFIRMADA },
          include: {
            pasajeros: { include: { pasajero: true } },
            cliente: { include: { usuario: { select: { nombre: true, apellido: true, email: true } } } },
          },
        },
        servicios: { include: { servicio: { select: { nombreServicio: true } } } },
        equipamientos: {
          include: { servicio: { select: { nombreServicio: true, equipamiento: { select: { tipoEquipamiento: true } } } } },
        },
      },
    });
  }

  // CU-49: el grupo partió. Pasa una sola vez: dos toques seguidos no pisan la hora de partida
  async iniciarSalida(idsalida: number, ahora: Date) {
    await db.salida.updateMany({
      where: { idsalida, estado: { in: SALIDAS_NO_INICIADAS } },
      data: { estado: ESTADO_SALIDA.EN_CURSO, fechaHoraInicioReal: ahora },
    });
    return db.salida.findUniqueOrThrow({
      where: { idsalida },
      select: { idsalida: true, estado: true, fechaHoraInicioReal: true },
    });
  }

  // CU-49 pasos 10 y 11, en una transacción: el avance y el estado de la salida se actualizan juntos
  async registrarAvance(p: {
    idsalida: number;
    idcircuito: number;
    numeroOrden: number;
    estadoTramo: string;
    fechaHoraLlegada: Date;
    ultimaEtapaAlcanzada: number | null;
    ultimaEtapaLeida: number | null;
    estadoSalida: string;
    fechaHoraFinReal: Date | null;
  }) {
    return db.$transaction(async (tx) => {
      // Se actualiza la salida primero y solo si nadie avanzó desde que se leyó: dos avances simultáneos no pasan los dos
      const { count } = await tx.salida.updateMany({
        where: { idsalida: p.idsalida, ultimaEtapaAlcanzada: p.ultimaEtapaLeida, estado: ESTADO_SALIDA.EN_CURSO },
        data: {
          estado: p.estadoSalida,
          ultimaEtapaAlcanzada: p.ultimaEtapaAlcanzada,
          ...(p.fechaHoraFinReal && { fechaHoraFinReal: p.fechaHoraFinReal }),
        },
      });
      if (count === 0) return null;
      // Al finalizar, el hotel del bloqueo recupera las plazas que ocupó el grupo (misma regla que al cancelar la salida)
      if (p.estadoSalida === ESTADO_SALIDA.FINALIZADA) {
        const hotel = await tx.salidaServicio.findFirst({
          where: { idsalida: p.idsalida, tipo: TIPO_SERVICIO.ALOJAMIENTO },
          select: { idservicio: true, salida: { select: { stockLocalAlojamiento: true } } },
        });
        if (hotel) {
          const reservas = await tx.reserva.findMany({
            where: { idsalida: p.idsalida, estado: ESTADO_RESERVA.CONFIRMADA },
            select: { cantidadPasajeros: true, estadoAlojamiento: true, solicitudes: { select: { estado: true } } },
          });
          await tx.servicioAlojamiento.update({
            where: { idservicio: hotel.idservicio },
            data: { capacidadDisponible: { increment: plazasADevolverAlHotel(hotel.salida.stockLocalAlojamiento, reservas) } },
          });
        }
      }
      // fechaHoraReporte la pone la base (default now): así quedan separados el hecho y el aviso
      const avance = await tx.avance.create({
        data: {
          idsalida: p.idsalida,
          idcircuito: p.idcircuito,
          numeroOrden: p.numeroOrden,
          estadoTramo: p.estadoTramo,
          fechaHoraLlegada: p.fechaHoraLlegada,
        },
      });
      const salida = { idsalida: p.idsalida, estado: p.estadoSalida, ultimaEtapaAlcanzada: p.ultimaEtapaAlcanzada };
      return { avance, salida };
    });
  }

  // CU-50 paso 16: el incidente y sus pasajeros afectados en una sola operación (create anidado)
  async registrarIncidente(p: {
    idsalida: number;
    tipoIncidente: string;
    descripcion: string;
    nivelGravedad: string;
    fechaHoraOcurrencia: Date;
    pasajerosAfectados: number[];
  }) {
    const include = { pasajeros: { include: { pasajero: { select: { nombreCompleto: true } } } } } as const;
    // Si el guía reenvía porque se perdió la respuesta (sin señal), el mismo incidente ya está guardado: se devuelve ese.
    // ponytail: la clave es el contenido (salida, tipo, gravedad, texto y hora); dos reenvíos simultáneos podrían
    // pasar los dos, en ese caso hace falta una clave de idempotencia única en la tabla.
    const existente = await db.incidente.findFirst({
      where: {
        idsalida: p.idsalida,
        tipoIncidente: p.tipoIncidente,
        descripcion: p.descripcion,
        nivelGravedad: p.nivelGravedad,
        fechaHoraOcurrencia: p.fechaHoraOcurrencia,
      },
      include,
    });
    if (existente) return existente;

    return db.incidente.create({
      data: {
        idsalida: p.idsalida,
        tipoIncidente: p.tipoIncidente,
        descripcion: p.descripcion,
        nivelGravedad: p.nivelGravedad,
        fechaHoraOcurrencia: p.fechaHoraOcurrencia,
        pasajeros: { create: p.pasajerosAfectados.map((idpasajero) => ({ idpasajero })) },
      },
      include,
    });
  }

  // CU-50 paso 17: las alertas del panel del administrador son los incidentes, del más reciente al más viejo
  async listarIncidentes(filtros: { idsalida?: number; nivelGravedad?: string }) {
    return db.incidente.findMany({
      where: {
        ...(filtros.idsalida && { idsalida: filtros.idsalida }),
        ...(filtros.nivelGravedad && { nivelGravedad: filtros.nivelGravedad }),
      },
      include: {
        salida: { select: { nroSalida: true } },
        pasajeros: { include: { pasajero: { select: { nombreCompleto: true } } } },
      },
      orderBy: { fechaHoraReporte: "desc" },
    });
  }
}
