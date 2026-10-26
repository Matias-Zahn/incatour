import { beforeEach, describe, expect, it, vi } from "vitest";
import { GestionReservaService } from "./gestion-reserva.service";

const { repo } = vi.hoisted(() => ({
  repo: { findParaCancelacion: vi.fn(), findDetalle: vi.fn(), cancelarReserva: vi.fn() },
}));
vi.mock("./gestion-reserva.repository", () => ({ GestionReservaRepository: class { constructor() { return repo; } } }));
vi.mock("../../../integraciones/notificador/notificador.mock", () => ({
  NotificadorMock: class { enviarEmailCancelacionReserva = vi.fn().mockResolvedValue(undefined); },
}));

const dias = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const reserva = (over: Record<string, unknown> = {}) => ({
  idreserva: 1, nroReserva: "RES-1", estado: "CONFIRMADA", estadoAlojamiento: "CONFIRMADO", cantidadPasajeros: 2,
  diasMinimosReintegro: 15,
  cliente: { idusuario: 5, usuario: { email: "a@b.com" } },
  salida: { idsalida: 7, estado: "PUBLICADA", fechaInicio: dias(5) },
  pagos: [{ monto: 1000 }],
  permisos: [], solicitudes: [],
  ...over,
});

describe("GestionReservaService.solicitarCancelacion (RES-06)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cliente fuera de plazo: $0 y muestra la condición aplicada", async () => {
    repo.findParaCancelacion.mockResolvedValue(reserva());
    const r = await new GestionReservaService().solicitarCancelacion(1, { idusuario: 5, email: "a@b.com", rol: "CLIENTE" });
    expect(r).toMatchObject({ importeAbonado: 1000, montoAReintegrar: 0, condicionAplicada: expect.stringContaining("mínimo 15") });
  });

  it("admin sobre la misma reserva: 100%", async () => {
    repo.findParaCancelacion.mockResolvedValue(reserva());
    const r = await new GestionReservaService().solicitarCancelacion(1, { idusuario: 1, email: "x@y.com", rol: "ADMIN" });
    expect(r.montoAReintegrar).toBe(1000);
  });

  it("permisos emitidos: la advertencia usa el monto real (admin 100%, cliente $0)", async () => {
    repo.findParaCancelacion.mockResolvedValue(reserva({ permisos: [{ estadoTramite: "Emitido" }] }));
    const admin = await new GestionReservaService().solicitarCancelacion(1, { idusuario: 1, email: "x@y.com", rol: "ADMIN" });
    expect(admin.advertencia).toContain("El reintegro es de $1000");
    expect(admin.lugaresVuelvenALaVenta).toBe(false);
    const cliente = await new GestionReservaService().solicitarCancelacion(1, { idusuario: 5, email: "a@b.com", rol: "CLIENTE" });
    expect(cliente.advertencia).toContain("El reintegro es de $0");
  });
});

describe("GestionReservaService.confirmarCancelacion sobre una salida CERRADA (RES-13)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("los lugares no vuelven a la venta y el repositorio sabe que la salida ya no vende", async () => {
    repo.findParaCancelacion.mockResolvedValue(reserva({ salida: { idsalida: 7, estado: "CERRADA", fechaInicio: dias(20) } }));
    repo.cancelarReserva.mockResolvedValue({ idreembolso: 1, montoReembolsado: 1000 });
    const admin = { idusuario: 1, email: "x@y.com", rol: "ADMIN" };

    const resumen = await new GestionReservaService().solicitarCancelacion(1, admin);
    const r = await new GestionReservaService().confirmarCancelacion(1, { motivo: "Prueba" }, admin);

    expect(resumen.lugaresVuelvenALaVenta).toBe(false);
    expect(r.lugaresVuelvenALaVenta).toBe(false);
    expect(repo.cancelarReserva).toHaveBeenCalledWith(expect.objectContaining({ salidaEnVenta: false, alojamientoPorStock: true }));
  });
});

describe("GestionReservaService.confirmarCancelacion con cambios en el medio (RES-14)", () => {
  beforeEach(() => vi.clearAllMocks());
  const cliente = { idusuario: 5, email: "a@b.com", rol: "CLIENTE" };

  it("si CU-40 emitió permisos mientras tanto, recalcula con los permisos nuevos", async () => {
    const lejana = { idsalida: 7, estado: "PUBLICADA", fechaInicio: dias(30) };
    repo.findParaCancelacion
      .mockResolvedValueOnce(reserva({ salida: lejana }))
      .mockResolvedValueOnce(reserva({ salida: { ...lejana, estado: "CERRADA" }, permisos: [{ estadoTramite: "Emitido" }] }));
    repo.cancelarReserva.mockResolvedValueOnce("CAMBIO").mockResolvedValueOnce({ idreembolso: 1, montoReembolsado: 0 });

    const r = await new GestionReservaService().confirmarCancelacion(1, { motivo: "Prueba" }, cliente);

    expect(repo.cancelarReserva).toHaveBeenLastCalledWith(expect.objectContaining({ permisosEmitidos: true, montoReembolsado: 0 }));
    expect(r.lugaresVuelvenALaVenta).toBe(false);
  });

  it("si vuelve a cambiar, responde 409", async () => {
    repo.findParaCancelacion.mockResolvedValue(reserva({ salida: { idsalida: 7, estado: "PUBLICADA", fechaInicio: dias(30) } }));
    repo.cancelarReserva.mockResolvedValue("CAMBIO");

    await expect(new GestionReservaService().confirmarCancelacion(1, { motivo: "Prueba" }, cliente)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("GestionReservaService.obtenerReserva: desglose (RES-07)", () => {
  const detalle = (over: Record<string, unknown>) => ({
    idreserva: 1, nroReserva: "RES-1", estado: "CONFIRMADA", estadoAlojamiento: null, fechaRealizacion: new Date(),
    cantidadPasajeros: 2, precioCongelado: 1650, condicionesComerciales: null,
    temporadaAplicada: null, precioPaquetePorPersona: null, adicionalesEquipaje: null, moneda: null,
    cliente: { idusuario: 5, usuario: {} },
    salida: { fechaInicio: new Date("2030-06-10"), paquete: { tarifas: [] } },
    pagos: [], pasajeros: [], reembolsos: [], solicitudes: [], permisos: [],
    ...over,
  });
  const usuario = { idusuario: 5, email: "a@b.com", rol: "CLIENTE" };

  it("usa las columnas congeladas aunque la tarifa viva haya cambiado", async () => {
    repo.findDetalle.mockResolvedValue(detalle({
      temporadaAplicada: "Alta", precioPaquetePorPersona: 800, adicionalesEquipaje: 50,
      salida: { fechaInicio: new Date("2030-06-10"), paquete: { tarifas: [{ monto: 999, temporada: { nombre: "Otra", estado: "ACTIVO", fechaInicio: new Date("2030-01-01"), fechaFin: new Date("2030-12-31") } }] } },
    }));
    const r = await new GestionReservaService().obtenerReserva(1, usuario);
    expect(r).toMatchObject({ temporadaAplicada: "Alta", precioUnitario: 800, precioPaquete: 1600, adicionalesEquipaje: 50 });
  });

  it("reserva vieja: reconstruye con la tarifa viva e ignora temporadas inactivas", async () => {
    const t = (nombre: string, estado: string, monto: number) => ({
      monto, temporada: { nombre, estado, fechaInicio: new Date("2030-01-01"), fechaFin: new Date("2030-12-31") },
    });
    repo.findDetalle.mockResolvedValue(detalle({
      salida: { fechaInicio: new Date("2030-06-10"), paquete: { tarifas: [t("Vieja", "INACTIVO", 100), t("Alta", "ACTIVO", 800)] } },
    }));
    const r = await new GestionReservaService().obtenerReserva(1, usuario);
    expect(r).toMatchObject({ temporadaAplicada: "Alta", precioUnitario: 800, adicionalesEquipaje: 50 });
  });
});
