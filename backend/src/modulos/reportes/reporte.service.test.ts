import { beforeEach, describe, expect, it, vi } from "vitest";
import { FiltrosReporteDto } from "./reporte.dto";
import { ReporteService } from "./reporte.service";

const { repo } = vi.hoisted(() => ({
  repo: {
    reservasDelPeriodo: vi.fn(), salidasDelPeriodo: vi.fn(), reembolsosDelPeriodo: vi.fn(),
    solicitudesDelPeriodo: vi.fn(), calidadDelPeriodo: vi.fn(),
  },
}));
vi.mock("./reporte.repository", () => ({ ReporteRepository: class { constructor() { return repo; } } }));

const filtros = FiltrosReporteDto.create({})[1]!;
const pago = (monto: number, estadoTransaccion = "APROBADA") => ({ monto, estadoTransaccion });

describe("FiltrosReporteDto", () => {
  it("hasta incluye todo ese día", () => {
    const [, f] = FiltrosReporteDto.create({ desde: "2026-01-01", hasta: "2026-01-31" });
    expect(f!.hastaExclusivo).toEqual(new Date("2026-02-01"));
  });

  it.each([
    [{ desde: "ayer" }, "desde no es una fecha"],
    [{ hasta: "2026-13-45" }, "hasta no es una fecha"],
    [{ desde: "2026-02-01", hasta: "2026-01-01" }, "no puede ser posterior"],
  ])("rechaza %j", (query, mensaje) => {
    expect(FiltrosReporteDto.create(query)[0]).toContain(mensaje);
  });
});

describe("ReporteService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ventas: el neto descuenta reintegros, ignora pagos no aprobados y los cancelados no suman pasajeros", async () => {
    const reserva = (estado: string, cantidadPasajeros: number, pagos: unknown[], reintegro: number[], fecha: string, nombrePaquete: string) => ({
      estado, cantidadPasajeros, pagos, fechaRealizacion: new Date(fecha),
      reembolsos: reintegro.map((montoReembolsado) => ({ montoReembolsado })),
      salida: { paquete: { idpaquete: 1, nombrePaquete } },
    });
    repo.reservasDelPeriodo.mockResolvedValue([
      reserva("CONFIRMADA", 2, [pago(1000), pago(999, "RECHAZADA")], [], "2026-01-10", "Clásico"),
      reserva("CANCELADA", 3, [pago(1500)], [1500], "2026-02-10", "Clásico"),
      reserva("CONFIRMADA", 1, [pago(800)], [], "2026-01-20", "Salkantay"),
    ]);

    const r = await new ReporteService().ventas(filtros);

    expect(r.resumen).toEqual({ reservas: 3, canceladas: 1, pasajeros: 3, facturado: 3300, reintegrado: 1500, neto: 1800 });
    expect(r.porPaquete.map((p) => [p.paquete, p.neto])).toEqual([["Clásico", 1000], ["Salkantay", 800]]);
    expect(r.porMes.map((m) => m.mes)).toEqual(["2026-01", "2026-02"]);
  });

  it("ocupación: solo cuenta confirmadas y una salida cancelada no pesa en el promedio", async () => {
    const salida = (idsalida: number, estado: string, tamanoMaximo: number, reservas: unknown[]) => ({
      idsalida, nroSalida: `SAL-${idsalida}`, estado, tamanoMaximo, fechaInicio: new Date("2026-03-01"), paquete: { nombrePaquete: "Clásico" }, reservas,
    });
    repo.salidasDelPeriodo.mockResolvedValue([
      salida(1, "FINALIZADA", 10, [{ estado: "CONFIRMADA", cantidadPasajeros: 6 }, { estado: "CANCELADA", cantidadPasajeros: 4 }]),
      salida(2, "CANCELADA", 10, [{ estado: "CANCELADA", cantidadPasajeros: 2 }]),
    ]);

    const r = await new ReporteService().ocupacion(filtros);

    expect(r.resumen).toEqual({ salidas: 2, canceladas: 1, lugares: 10, ocupados: 6, ocupacion: 60 });
    expect(r.salidas[0]).toMatchObject({ ocupados: 6, ocupacion: 60 });
  });

  it("cancelaciones: retenido es lo abonado menos lo reintegrado y distingue quién canceló", async () => {
    const reembolso = (idreembolso: number, montoReembolsado: number, rol: string) => ({
      idreembolso, montoReembolsado, motivo: "Cambio de planes", condicionAplicada: "x", fechaReembolso: new Date("2026-03-01"),
      usuario: { rol },
      reserva: { nroReserva: "RES", pagos: [pago(1000)], salida: { nroSalida: "SAL", fechaInicio: new Date(), paquete: { nombrePaquete: "Clásico" } } },
    });
    repo.reembolsosDelPeriodo.mockResolvedValue([reembolso(1, 0, "CLIENTE"), reembolso(2, 1000, "ADMIN")]);

    const r = await new ReporteService().cancelaciones(filtros);

    expect(r.resumen).toEqual({ cancelaciones: 2, sinReintegro: 1, abonado: 2000, reintegrado: 1000, retenido: 1000 });
    expect(r.porOrigen).toEqual(expect.arrayContaining([expect.objectContaining({ nombre: "Administrador", cantidad: 1 })]));
  });

  it("solicitudes: historial con reintentos y tasa de aceptación por hotel", async () => {
    const gestion = (idservicio: number, resultado: string, motivoRechazo: string | null) => ({
      idservicio, resultado, motivoRechazo, fechaRespuesta: new Date("2026-03-02"),
      servicio: { nombreServicio: `Hotel ${idservicio}`, proveedor: { razonSocial: "Prov" } },
    });
    const solicitud = (idsolicitud: number, nroSolicitud: string, estado: string, gestiones: unknown[]) => ({
      idsolicitud, nroSolicitud, estado, cantidadPlazas: 2, criterios: null, gestiones,
      reserva: { nroReserva: "RES", fechaRealizacion: new Date("2026-03-01"), salida: { nroSalida: "SAL", fechaInicio: new Date(), paquete: { nombrePaquete: "Clásico" } } },
    });
    repo.solicitudesDelPeriodo.mockResolvedValue([
      solicitud(1, "SOL-1", "RECHAZADA", [gestion(7, "Rechazada", "Sin cupo")]),
      solicitud(2, "SOL-1-R", "CONFIRMADA", [gestion(8, "Aceptada", null)]),
      solicitud(3, "SOL-2", "PENDIENTE", []),
    ]);

    const r = await new ReporteService().solicitudes(filtros);

    expect(r.resumen).toMatchObject({ solicitudes: 3, pendientes: 1, confirmadas: 1, rechazadas: 1, reintentos: 1, tasaAceptacion: 50 });
    expect(r.porHotel.find((h) => h.hotel === "Hotel 7")).toMatchObject({ contactos: 1, rechazadas: 1, tasaAceptacion: 0 });
    expect(r.motivosRechazo).toEqual([expect.objectContaining({ nombre: "Sin cupo", cantidad: 1 })]);
  });

  it("calidad: sin datos no inventa promedios", async () => {
    repo.calidadDelPeriodo.mockResolvedValue({ resenias: [], incidentes: [], evaluacionesProveedor: [], evaluacionesPersonal: [] });
    const r = await new ReporteService().calidad(filtros);
    expect(r.resumen).toEqual({ resenias: 0, valoracionPromedio: null, incidentes: 0, puntajeProveedores: null, puntajePersonal: null });
  });
});
