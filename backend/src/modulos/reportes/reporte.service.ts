import { ESTADO_RESERVA, ESTADO_SALIDA, ESTADO_SOLICITUD, redondear2 } from "../../shared/constantes";
import { FiltrosReporteDto } from "./reporte.dto";
import { ReporteRepository } from "./reporte.repository";

const PAGO_APROBADO = "APROBADA";

const sumar = (valores: number[]) => redondear2(valores.reduce((a, b) => a + b, 0));
const porcentaje = (parte: number, total: number) => (total > 0 ? redondear2((parte / total) * 100) : 0);
const promedio = (valores: number[]) => (valores.length > 0 ? redondear2(sumar(valores) / valores.length) : null);
const abonado = (pagos: { monto: number; estadoTransaccion: string }[]) =>
  sumar(pagos.filter((p) => p.estadoTransaccion === PAGO_APROBADO).map((p) => p.monto));

/** Agrupa filas por clave, respetando el orden en que aparece cada grupo */
function agrupar<T>(filas: T[], clave: (fila: T) => string) {
  const grupos = new Map<string, T[]>();
  for (const fila of filas) {
    const k = clave(fila);
    grupos.set(k, [...(grupos.get(k) ?? []), fila]);
  }
  return [...grupos.entries()];
}

const conteoPor = <T>(filas: T[], clave: (fila: T) => string) =>
  agrupar(filas, clave)
    .map(([nombre, grupo]) => ({ id: nombre, nombre, cantidad: grupo.length }))
    .sort((a, b) => b.cantidad - a.cantidad);

const promedioPor = <T>(filas: T[], clave: (fila: T) => string, valor: (fila: T) => number) =>
  agrupar(filas, clave)
    .map(([nombre, grupo]) => ({ id: nombre, nombre, cantidad: grupo.length, promedio: promedio(grupo.map(valor))! }))
    .sort((a, b) => b.promedio - a.promedio);

export class ReporteService {
  private repository = new ReporteRepository();

  // Ventas del período, por fecha de compra. El pasajero de una reserva cancelada no cuenta como vendido
  async ventas(f: FiltrosReporteDto) {
    const reservas = (await this.repository.reservasDelPeriodo(f)).map((r) => ({
      paquete: r.salida.paquete.nombrePaquete,
      mes: r.fechaRealizacion.toISOString().slice(0, 7),
      cancelada: r.estado === ESTADO_RESERVA.CANCELADA,
      pasajeros: r.estado === ESTADO_RESERVA.CONFIRMADA ? r.cantidadPasajeros : 0,
      facturado: abonado(r.pagos),
      reintegrado: sumar(r.reembolsos.map((x) => x.montoReembolsado)),
    }));

    const totalizar = (grupo: typeof reservas) => {
      const facturado = sumar(grupo.map((r) => r.facturado));
      const reintegrado = sumar(grupo.map((r) => r.reintegrado));
      return {
        reservas: grupo.length,
        canceladas: grupo.filter((r) => r.cancelada).length,
        pasajeros: grupo.reduce((a, r) => a + r.pasajeros, 0),
        facturado,
        reintegrado,
        neto: redondear2(facturado - reintegrado),
      };
    };

    return {
      resumen: totalizar(reservas),
      porPaquete: agrupar(reservas, (r) => r.paquete)
        .map(([paquete, grupo]) => ({ id: paquete, paquete, ...totalizar(grupo) }))
        .sort((a, b) => b.neto - a.neto),
      porMes: agrupar(reservas, (r) => r.mes)
        .map(([mes, grupo]) => ({ id: mes, mes, ...totalizar(grupo) }))
        .sort((a, b) => a.mes.localeCompare(b.mes)),
    };
  }

  // Ocupación por salida, por fecha de inicio. Las salidas canceladas se listan pero no pesan en el promedio
  async ocupacion(f: FiltrosReporteDto) {
    const salidas = (await this.repository.salidasDelPeriodo(f)).map((s) => {
      const ocupados = s.reservas
        .filter((r) => r.estado === ESTADO_RESERVA.CONFIRMADA)
        .reduce((a, r) => a + r.cantidadPasajeros, 0);
      return {
        id: s.idsalida,
        nroSalida: s.nroSalida,
        paquete: s.paquete.nombrePaquete,
        fechaInicio: s.fechaInicio,
        estado: s.estado,
        capacidad: s.tamanoMaximo,
        ocupados,
        ocupacion: porcentaje(ocupados, s.tamanoMaximo),
      };
    });

    const vigentes = salidas.filter((s) => s.estado !== ESTADO_SALIDA.CANCELADA);
    const lugares = vigentes.reduce((a, s) => a + s.capacidad, 0);
    const ocupados = vigentes.reduce((a, s) => a + s.ocupados, 0);

    return {
      resumen: {
        salidas: salidas.length,
        canceladas: salidas.length - vigentes.length,
        lugares,
        ocupados,
        ocupacion: porcentaje(ocupados, lugares),
      },
      porPaquete: agrupar(vigentes, (s) => s.paquete)
        .map(([paquete, grupo]) => {
          const capacidad = grupo.reduce((a, s) => a + s.capacidad, 0);
          const vendidos = grupo.reduce((a, s) => a + s.ocupados, 0);
          return { id: paquete, paquete, salidas: grupo.length, capacidad, ocupados: vendidos, ocupacion: porcentaje(vendidos, capacidad) };
        })
        .sort((a, b) => b.ocupacion - a.ocupacion),
      salidas,
    };
  }

  // Cancelaciones del período, por fecha del reembolso (que existe siempre, aunque sea de $0)
  async cancelaciones(f: FiltrosReporteDto) {
    const filas = (await this.repository.reembolsosDelPeriodo(f)).map((r) => {
      const importeAbonado = abonado(r.reserva.pagos);
      return {
        id: r.idreembolso,
        nroReserva: r.reserva.nroReserva,
        paquete: r.reserva.salida.paquete.nombrePaquete,
        nroSalida: r.reserva.salida.nroSalida,
        fecha: r.fechaReembolso,
        origen: r.usuario.rol === "ADMIN" ? "Administrador" : "Cliente",
        motivo: r.motivo,
        condicionAplicada: r.condicionAplicada,
        abonado: importeAbonado,
        reintegrado: r.montoReembolsado,
        retenido: redondear2(importeAbonado - r.montoReembolsado),
      };
    });

    return {
      resumen: {
        cancelaciones: filas.length,
        sinReintegro: filas.filter((c) => c.reintegrado === 0).length,
        abonado: sumar(filas.map((c) => c.abonado)),
        reintegrado: sumar(filas.map((c) => c.reintegrado)),
        retenido: sumar(filas.map((c) => c.retenido)),
      },
      porOrigen: conteoPor(filas, (c) => c.origen),
      porMotivo: conteoPor(filas, (c) => c.motivo),
      cancelaciones: filas,
    };
  }

  // Historial de solicitudes a hoteles (CU-33/34): todas, con cada respuesta de los proveedores
  async solicitudes(f: FiltrosReporteDto) {
    const solicitudes = (await this.repository.solicitudesDelPeriodo(f)).map((s) => ({
      id: s.idsolicitud,
      nroSolicitud: s.nroSolicitud,
      estado: s.estado,
      reintento: s.nroSolicitud.endsWith("-R"),
      plazas: s.cantidadPlazas,
      criterios: s.criterios,
      nroReserva: s.reserva.nroReserva,
      fechaPedido: s.reserva.fechaRealizacion,
      paquete: s.reserva.salida.paquete.nombrePaquete,
      nroSalida: s.reserva.salida.nroSalida,
      fechaSalida: s.reserva.salida.fechaInicio,
      gestiones: s.gestiones.map((g) => ({
        idservicio: g.idservicio,
        hotel: g.servicio.nombreServicio,
        proveedor: g.servicio.proveedor.razonSocial,
        resultado: g.resultado,
        motivoRechazo: g.motivoRechazo,
        fechaRespuesta: g.fechaRespuesta,
      })),
    }));

    const gestiones = solicitudes.flatMap((s) => s.gestiones);
    const aceptadas = gestiones.filter((g) => g.resultado === "Aceptada").length;
    const contar = (estado: string) => solicitudes.filter((s) => s.estado === estado).length;

    return {
      resumen: {
        solicitudes: solicitudes.length,
        pendientes: contar(ESTADO_SOLICITUD.PENDIENTE),
        confirmadas: contar(ESTADO_SOLICITUD.CONFIRMADA),
        rechazadas: contar("RECHAZADA"),
        canceladas: contar(ESTADO_SOLICITUD.CANCELADA),
        reintentos: solicitudes.filter((s) => s.reintento).length,
        tasaAceptacion: porcentaje(aceptadas, gestiones.length),
      },
      porHotel: agrupar(gestiones, (g) => String(g.idservicio))
        .map(([id, grupo]) => {
          const si = grupo.filter((g) => g.resultado === "Aceptada").length;
          return {
            id,
            hotel: grupo[0]!.hotel,
            proveedor: grupo[0]!.proveedor,
            contactos: grupo.length,
            aceptadas: si,
            rechazadas: grupo.length - si,
            tasaAceptacion: porcentaje(si, grupo.length),
          };
        })
        .sort((a, b) => b.contactos - a.contactos),
      motivosRechazo: conteoPor(gestiones.filter((g) => g.motivoRechazo), (g) => g.motivoRechazo!),
      solicitudes,
    };
  }

  // Calidad del servicio, por fecha de inicio de la salida
  async calidad(f: FiltrosReporteDto) {
    const { resenias, incidentes, evaluacionesProveedor, evaluacionesPersonal } = await this.repository.calidadDelPeriodo(f);

    return {
      resumen: {
        resenias: resenias.length,
        valoracionPromedio: promedio(resenias.map((r) => r.valoracion)),
        incidentes: incidentes.length,
        puntajeProveedores: promedio(evaluacionesProveedor.map((e) => e.puntaje)),
        puntajePersonal: promedio(evaluacionesPersonal.map((e) => e.puntaje)),
      },
      reseniasPorPaquete: promedioPor(resenias, (r) => r.salida.paquete.nombrePaquete, (r) => r.valoracion),
      incidentesPorTipo: conteoPor(incidentes, (i) => i.tipoIncidente),
      incidentesPorGravedad: conteoPor(incidentes, (i) => i.nivelGravedad),
      proveedores: promedioPor(evaluacionesProveedor, (e) => e.proveedor.razonSocial, (e) => e.puntaje),
      personal: promedioPor(evaluacionesPersonal, (e) => `${e.personal.nombreCompleto} (${e.personal.rol})`, (e) => e.puntaje),
    };
  }
}
