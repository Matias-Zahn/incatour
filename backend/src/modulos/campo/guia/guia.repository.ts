import { db } from "../../../config/postgresDatabase";
import { ESTADO_RESERVA, ESTADO_SALIDA } from "../../../shared/constantes";

export class GuiaRepository {
  // El token trae idusuario; el legajo se encuentra por Usuario → Guia → Personal
  async idPersonalDelUsuario(idusuario: number) {
    const guia = await db.guia.findUnique({ where: { idusuario }, select: { idpersonal: true } });
    return guia?.idpersonal ?? null;
  }

  // CU-48: salidas asignadas al guía, sin las canceladas
  async salidasAsignadas(idpersonal: number) {
    return db.salida.findMany({
      where: { personalAsignado: { some: { idpersonal } }, estado: { not: ESTADO_SALIDA.CANCELADA } },
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

  // CU-49 pasos 10 y 11, en una transacción: el avance y el estado de la salida se actualizan juntos
  async registrarAvance(p: {
    idsalida: number;
    idcircuito: number;
    numeroOrden: number;
    estadoTramo: string;
    fechaHoraLlegada: Date;
    ultimaEtapaAlcanzada: number | null;
    estadoSalida: string;
  }) {
    return db.$transaction(async (tx) => {
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
      const salida = await tx.salida.update({
        where: { idsalida: p.idsalida },
        data: { estado: p.estadoSalida, ultimaEtapaAlcanzada: p.ultimaEtapaAlcanzada },
        select: { idsalida: true, estado: true, ultimaEtapaAlcanzada: true },
      });
      return { avance, salida };
    });
  }
}
