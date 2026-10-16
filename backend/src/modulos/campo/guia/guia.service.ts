import { CustomError } from "../../../error/CustomError";
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
    const idpersonal = await this.legajo(idusuario);
    const s = await this.repository.detalleSalida(idsalida);
    if (!s) throw CustomError.notFound("La salida no existe");
    // Un guía solo ve las salidas a las que está asignado
    if (!s.personalAsignado.some((a) => a.idpersonal === idpersonal)) {
      throw CustomError.forbidden("No estás asignado a esta salida");
    }

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

  private async legajo(idusuario: number) {
    const idpersonal = await this.repository.idPersonalDelUsuario(idusuario);
    if (!idpersonal) throw CustomError.forbidden("La cuenta no está vinculada a un guía");
    return idpersonal;
  }
}
