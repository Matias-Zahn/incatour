import { db } from "../../config/postgresDatabase";
import { FiltrosReporteDto } from "./reporte.dto";

const rango = (f: FiltrosReporteDto) => ({
  ...(f.desde && { gte: f.desde }),
  ...(f.hastaExclusivo && { lt: f.hastaExclusivo }),
});

const paqueteDeSalida = { select: { nroSalida: true, fechaInicio: true, paquete: { select: { nombrePaquete: true } } } };

export class ReporteRepository {
  async reservasDelPeriodo(f: FiltrosReporteDto) {
    return db.reserva.findMany({
      where: { fechaRealizacion: rango(f) },
      select: {
        estado: true,
        cantidadPasajeros: true,
        fechaRealizacion: true,
        pagos: { select: { monto: true, estadoTransaccion: true } },
        reembolsos: { select: { montoReembolsado: true } },
        salida: { select: { paquete: { select: { idpaquete: true, nombrePaquete: true } } } },
      },
    });
  }

  async salidasDelPeriodo(f: FiltrosReporteDto) {
    return db.salida.findMany({
      where: { fechaInicio: rango(f) },
      select: {
        idsalida: true,
        nroSalida: true,
        estado: true,
        fechaInicio: true,
        tamanoMaximo: true,
        paquete: { select: { nombrePaquete: true } },
        reservas: { select: { estado: true, cantidadPasajeros: true } },
      },
      orderBy: { fechaInicio: "desc" },
    });
  }

  async reembolsosDelPeriodo(f: FiltrosReporteDto) {
    return db.reembolso.findMany({
      where: { fechaReembolso: rango(f) },
      select: {
        idreembolso: true,
        montoReembolsado: true,
        motivo: true,
        condicionAplicada: true,
        fechaReembolso: true,
        usuario: { select: { rol: true } },
        reserva: {
          select: {
            nroReserva: true,
            pagos: { select: { monto: true, estadoTransaccion: true } },
            salida: paqueteDeSalida,
          },
        },
      },
      orderBy: { fechaReembolso: "desc" },
    });
  }

  // Solicitud no guarda su fecha de alta: el período se toma de la reserva que la originó
  async solicitudesDelPeriodo(f: FiltrosReporteDto) {
    return db.solicitud.findMany({
      where: { reserva: { fechaRealizacion: rango(f) } },
      select: {
        idsolicitud: true,
        nroSolicitud: true,
        estado: true,
        cantidadPlazas: true,
        criterios: true,
        reserva: { select: { nroReserva: true, fechaRealizacion: true, salida: paqueteDeSalida } },
        gestiones: {
          select: {
            idservicio: true,
            resultado: true,
            motivoRechazo: true,
            fechaRespuesta: true,
            servicio: { select: { nombreServicio: true, proveedor: { select: { razonSocial: true } } } },
          },
          orderBy: { fechaRespuesta: "asc" },
        },
      },
      orderBy: [{ reserva: { fechaRealizacion: "desc" } }, { idsolicitud: "asc" }],
    });
  }

  async calidadDelPeriodo(f: FiltrosReporteDto) {
    const salida = { fechaInicio: rango(f) };
    const [resenias, incidentes, evaluacionesProveedor, evaluacionesPersonal] = await Promise.all([
      db.resenia.findMany({
        where: { salida },
        select: { valoracion: true, salida: { select: { paquete: { select: { nombrePaquete: true } } } } },
      }),
      db.incidente.findMany({ where: { salida }, select: { tipoIncidente: true, nivelGravedad: true } }),
      db.evaluacionProveedor.findMany({
        where: { salida },
        select: { puntaje: true, proveedor: { select: { razonSocial: true, tipoProveedor: true } } },
      }),
      db.evaluacionPersonal.findMany({
        where: { salida },
        select: { puntaje: true, personal: { select: { nombreCompleto: true, rol: true } } },
      }),
    ]);
    return { resenias, incidentes, evaluacionesProveedor, evaluacionesPersonal };
  }
}
