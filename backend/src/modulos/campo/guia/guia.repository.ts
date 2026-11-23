import { Prisma } from "@prisma/client";
import { db } from "../../../config/postgresDatabase";
import { ESTADO_RESERVA, ESTADO_SALIDA } from "../../../shared/constantes";

export class GuiaRepository {
  // El token trae idusuario; el legajo se encuentra por Usuario → Guia → Personal
  async idPersonalDelUsuario(idusuario: number) {
    const guia = await db.guia.findUnique({ where: { idusuario }, select: { idpersonal: true } });
    return guia?.idpersonal ?? null;
  }

  // CU-48: salidas asignadas al guía, sin las canceladas. B3: desde que se crea, porque el personal se asigna en el alta
  async salidasAsignadas(idpersonal: number) {
    return db.salida.findMany({
      where: {
        personalAsignado: { some: { idpersonal } },
        estado: { not: ESTADO_SALIDA.CANCELADA },
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
        ocupaciones: {
          include: { servicio: { select: { nombreServicio: true, equipamiento: { select: { tipoEquipamiento: true } } } } },
          orderBy: { idocupacion: "asc" },
        },
      },
    });
  }

  // CU-49: el grupo partió. Pasa una sola vez: dos toques seguidos no pisan la hora de partida
  async iniciarSalida(idsalida: number, ahora: Date) {
    await db.salida.updateMany({
      where: { idsalida, estado: ESTADO_SALIDA.CERRADA }, // decisión 18
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
      // A1: al finalizar no se devuelve nada: la ocupación queda como historial y deja de contar
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
    claveCliente?: string | undefined;
  }) {
    const include = { pasajeros: { include: { pasajero: { select: { nombreCompleto: true } } } } } as const;
    try {
      const incidente = await db.incidente.create({
        data: {
          idsalida: p.idsalida,
          tipoIncidente: p.tipoIncidente,
          descripcion: p.descripcion,
          nivelGravedad: p.nivelGravedad,
          fechaHoraOcurrencia: p.fechaHoraOcurrencia,
          claveCliente: p.claveCliente ?? null,
          pasajeros: { create: p.pasajerosAfectados.map((idpasajero) => ({ idpasajero })) },
        },
        include,
      });
      return { incidente, nuevo: true };
    } catch (e) {
      // Reenvío porque se perdió la respuesta (sin señal): la clave única ya está guardada y se devuelve ese incidente
      if (p.claveCliente && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const incidente = await db.incidente.findUniqueOrThrow({
          where: { idsalida_claveCliente: { idsalida: p.idsalida, claveCliente: p.claveCliente } },
          include,
        });
        return { incidente, nuevo: false };
      }
      throw e;
    }
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
