import { CustomError } from "../../../error/CustomError";
import { ESTADO_SALIDA, SALIDAS_ACTIVAS } from "../../../shared/constantes";
import { ESTADO_TRAMO, RegistrarAvanceDto, RegistrarIncidenteDto } from "./guia.dto";
import { GuiaRepository } from "./guia.repository";

export class GuiaService {
  private repository = new GuiaRepository();

  // CU-48: consultarSalidasAsignadas (también es el punto de entrada de los CU-49 y CU-50)
  async consultarSalidasAsignadas(idusuario: number) {
    const idpersonal = await this.legajo(idusuario);
    const salidas = await this.repository.salidasAsignadas(idpersonal);
    return salidas.map((s) => ({
      idsalida: s.idsalida,
      nroSalida: s.nroSalida,
      paquete: s.paquete.nombrePaquete,
      circuito: s.paquete.circuito.nombreCircuito,
      fechaInicio: s.fechaInicio,
      fechaFin: s.fechaFin,
      estado: s.estado,
      pasajeros: s.reservas.reduce((total, r) => total + r.cantidadPasajeros, 0),
    }));
  }

  // CU-48: consultarDetalleSalida — itinerario tramo a tramo, nómina con contacto y equipamiento
  async consultarDetalleSalida(idusuario: number, idsalida: number) {
    const s = await this.salidaDelGuia(idusuario, idsalida);

    const { circuito } = s.paquete;
    return {
      salida: {
        idsalida: s.idsalida,
        nroSalida: s.nroSalida,
        paquete: s.paquete.nombrePaquete,
        circuito: circuito.nombreCircuito,
        duracionDias: circuito.duracionDias,
        fechaInicio: s.fechaInicio,
        fechaFin: s.fechaFin,
        estado: s.estado,
      },
      // Cada etapa con su último avance informado (CU-49), si lo hay
      itinerario: circuito.etapas.map((e) => {
        const ultimo = s.avances.find((a) => a.numeroOrden === e.numeroOrden);
        return {
          numeroOrden: e.numeroOrden,
          puntoInicio: e.puntoInicio,
          puntoFin: e.puntoFin,
          campamentoPrevisto: e.campamentoPrevisto,
          estadoTramo: ultimo?.estadoTramo ?? null,
          fechaHoraLlegada: ultimo?.fechaHoraLlegada ?? null,
        };
      }),
      // El contacto ante emergencias es el titular de la reserva: la base no guarda contacto por pasajero
      nomina: s.reservas.flatMap((r) =>
        r.pasajeros.map(({ pasajero: p }) => ({
          idpasajero: p.idpasajero,
          nombreCompleto: p.nombreCompleto,
          nroPasaporte: p.nroPasaporte,
          nacionalidad: p.nacionalidad,
          nroReserva: r.nroReserva,
          contacto: {
            titular: `${r.cliente.usuario.nombre} ${r.cliente.usuario.apellido}`,
            email: r.cliente.usuario.email,
          },
        }))
      ),
      personal: s.personalAsignado.map((a) => a.personal),
      servicios: s.servicios.map((x) => ({ tipo: x.tipo, nombreServicio: x.servicio.nombreServicio })),
      equipamiento: s.equipamientos.map((e) => ({
        nombreServicio: e.servicio.nombreServicio,
        tipoEquipamiento: e.servicio.equipamiento?.tipoEquipamiento ?? null,
        cantidad: e.cantidad,
      })),
    };
  }

  // CU-49: registrarAvance — el guía informa la llegada al final de una etapa
  async registrarAvance(idusuario: number, idsalida: number, dto: RegistrarAvanceDto) {
    const s = await this.salidaDelGuia(idusuario, idsalida);
    if (!SALIDAS_ACTIVAS.includes(s.estado)) {
      throw CustomError.badRequest(`No se pueden registrar avances en una salida ${s.estado}`);
    }

    // La etapa tiene que pertenecer al circuito del paquete de la salida (restricción del documento de la base)
    const { etapas } = s.paquete.circuito;
    const etapa = etapas.find((e) => e.numeroOrden === dto.numeroOrden);
    if (!etapa) throw CustomError.badRequest(`La etapa ${dto.numeroOrden} no pertenece al circuito de la salida`);

    // Las etapas se informan en orden: no se saltea ninguna ni se vuelve a una ya completada
    const ultima = s.ultimaEtapaAlcanzada ?? 0;
    if (dto.numeroOrden <= ultima) {
      throw CustomError.badRequest(`La etapa ${dto.numeroOrden} ya se informó como completada`);
    }
    if (dto.numeroOrden > ultima + 1) {
      throw CustomError.badRequest(`Antes hay que informar la etapa ${ultima + 1}`);
    }

    if (dto.fechaHoraLlegada > new Date()) throw CustomError.badRequest("La fecha y hora de llegada no puede ser futura");
    if (dto.fechaHoraLlegada < s.fechaInicio) {
      throw CustomError.badRequest("La fecha y hora de llegada es anterior al inicio de la salida");
    }
    const anterior = s.avances.find((a) => a.numeroOrden === ultima && a.estadoTramo === ESTADO_TRAMO.COMPLETADO);
    if (anterior?.fechaHoraLlegada && dto.fechaHoraLlegada < anterior.fechaHoraLlegada) {
      throw CustomError.badRequest(`La llegada no puede ser anterior a la de la etapa ${ultima}`);
    }

    // Paso 11: el primer avance pone la salida en curso; completar la última etapa la finaliza
    const completa = dto.estadoTramo === ESTADO_TRAMO.COMPLETADO;
    const ultimaDelCircuito = Math.max(...etapas.map((e) => e.numeroOrden));

    const r = await this.repository.registrarAvance({
      idsalida,
      idcircuito: etapa.idcircuito,
      numeroOrden: dto.numeroOrden,
      estadoTramo: dto.estadoTramo,
      fechaHoraLlegada: dto.fechaHoraLlegada,
      ultimaEtapaAlcanzada: completa ? dto.numeroOrden : s.ultimaEtapaAlcanzada,
      ultimaEtapaLeida: s.ultimaEtapaAlcanzada,
      estadoSalida:
        completa && dto.numeroOrden === ultimaDelCircuito ? ESTADO_SALIDA.FINALIZADA : ESTADO_SALIDA.EN_CURSO,
    });
    if (!r) throw CustomError.conflict("Otro avance de esta salida se registró al mismo tiempo; volvé a consultar la salida");
    return r;
  }

  // CU-50 FA1: pasajeros de la salida, para elegir a los afectados
  async consultarPasajerosSalida(idusuario: number, idsalida: number) {
    const s = await this.salidaDelGuia(idusuario, idsalida);
    return s.reservas.flatMap((r) =>
      r.pasajeros.map(({ pasajero: p }) => ({ idpasajero: p.idpasajero, nombreCompleto: p.nombreCompleto, nroPasaporte: p.nroPasaporte }))
    );
  }

  // CU-50: confirmarRegistro — el guía informa un imprevisto de la salida
  async registrarIncidente(idusuario: number, idsalida: number, dto: RegistrarIncidenteDto) {
    const s = await this.salidaDelGuia(idusuario, idsalida);
    if (!SALIDAS_ACTIVAS.includes(s.estado)) {
      throw CustomError.badRequest(`No se pueden registrar incidentes en una salida ${s.estado}`);
    }

    if (dto.fechaHoraOcurrencia > new Date()) {
      throw CustomError.badRequest("La fecha y hora del incidente no puede ser futura");
    }
    if (dto.fechaHoraOcurrencia < s.fechaInicio) {
      throw CustomError.badRequest("La fecha y hora del incidente es anterior al inicio de la salida");
    }

    // FA1: los afectados tienen que ser pasajeros de esta salida
    const nomina = new Set(s.reservas.flatMap((r) => r.pasajeros.map((rp) => rp.idpasajero)));
    const ajenos = dto.pasajerosAfectados.filter((id) => !nomina.has(id));
    if (ajenos.length) {
      throw CustomError.badRequest(`Estos pasajeros no viajan en la salida: ${ajenos.join(", ")}`);
    }

    // Paso 17: el incidente registrado es la alerta del panel del administrador (GET /api/incidentes)
    return this.repository.registrarIncidente({ idsalida, ...dto });
  }

  // CU-50 paso 17: panel de alertas del administrador
  async listarIncidentes(filtros: { idsalida?: number; nivelGravedad?: string }) {
    return this.repository.listarIncidentes(filtros);
  }

  // La salida, solo si el guía del token está asignado a ella
  private async salidaDelGuia(idusuario: number, idsalida: number) {
    const idpersonal = await this.legajo(idusuario);
    const s = await this.repository.detalleSalida(idsalida);
    if (!s) throw CustomError.notFound("La salida no existe");
    if (!s.personalAsignado.some((a) => a.idpersonal === idpersonal)) {
      throw CustomError.forbidden("No estás asignado a esta salida");
    }
    return s;
  }

  private async legajo(idusuario: number) {
    const idpersonal = await this.repository.idPersonalDelUsuario(idusuario);
    if (!idpersonal) throw CustomError.forbidden("La cuenta no está vinculada a un guía");
    return idpersonal;
  }
}
