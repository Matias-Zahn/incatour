/**
 * Caja blanca de CU-32 (cancelar reserva). Cada caso recorre un camino del grafo de control:
 * el diseño, la complejidad ciclomática y la cobertura están en docs/pruebas/caja-blanca-cancelacion.md.
 * Corre con: npm run test:caja-blanca
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hoyUTC } from "../../../shared/fechas";
import { calcularReintegro } from "./reintegro";
import { GestionReservaRepository } from "./gestion-reserva.repository";
import { GestionReservaService } from "./gestion-reserva.service";

const { tx, enviarEmail } = vi.hoisted(() => ({
  tx: {
    $queryRaw: vi.fn(),
    permisoPasajero: { count: vi.fn(), updateMany: vi.fn() },
    reserva: { updateMany: vi.fn(), findUnique: vi.fn() },
    reembolso: { create: vi.fn() },
    solicitud: { updateMany: vi.fn() },
    salida: { update: vi.fn() },
    salidaServicio: { findFirst: vi.fn() },
    servicioAlojamiento: { update: vi.fn() },
  },
  enviarEmail: vi.fn(),
}));
vi.mock("../../../config/postgresDatabase", () => ({
  db: { ...tx, $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
}));
vi.mock("../../../integraciones/notificador/notificador.mock", () => ({
  NotificadorMock: class { enviarEmailCancelacionReserva = enviarEmail; },
}));

const DIA = 24 * 60 * 60 * 1000;
const dias = (n: number) => new Date(Date.now() + n * DIA);
const cliente = { idusuario: 5, email: "a@b.com", rol: "CLIENTE" };
const admin = { idusuario: 1, email: "x@y.com", rol: "ADMIN" };

const reserva = (over: Record<string, unknown> = {}) => ({
  idreserva: 1, nroReserva: "RES-1", estado: "CONFIRMADA", estadoAlojamiento: "CONFIRMADO", cantidadPasajeros: 2, diasMinimosReintegro: 15,
  cliente: { idusuario: 5, usuario: { email: "a@b.com" } },
  salida: { idsalida: 7, estado: "PUBLICADA", fechaInicio: dias(30) },
  pagos: [{ monto: 1000 }], permisos: [], solicitudes: [],
  ...over,
});

const base = { abonado: 1000, rol: "CLIENTE", permisosEmitidos: false, diasMinimos: 15 as number | null, fechaInicio: dias(30), ahora: new Date() };

describe("calcularReintegro: V(G) = 5", () => {
  it("R1 administrador: 100% aunque haya permisos emitidos", () => {
    expect(calcularReintegro({ ...base, rol: "ADMIN", permisosEmitidos: true }).monto).toBe(1000);
  });
  it("R2 cliente con permisos emitidos: $0", () => {
    expect(calcularReintegro({ ...base, permisosEmitidos: true }).monto).toBe(0);
  });
  it("R3 paquete sin plazo: 100%", () => {
    const r = calcularReintegro({ ...base, diasMinimos: null, fechaInicio: dias(1) });
    expect(r).toMatchObject({ monto: 1000, condicionAplicada: expect.stringContaining("sin plazo") });
  });
  it("R4 un día menos que el plazo: $0 (límite)", () => {
    expect(calcularReintegro({ ...base, fechaInicio: dias(14) }).monto).toBe(0);
  });
  it("R5 justo en el plazo: 100% (límite)", () => {
    expect(calcularReintegro({ ...base, fechaInicio: dias(15) }).monto).toBe(1000);
  });
});

describe("evaluarCancelacion (a través de solicitarCancelacion)", () => {
  const repo = () => {
    const servicio = new GestionReservaService();
    return { servicio, buscar: vi.spyOn(GestionReservaRepository.prototype, "findParaCancelacion") };
  };
  beforeEach(() => vi.restoreAllMocks());
  const evaluar = (r: unknown, usuario = cliente) => {
    const { servicio, buscar } = repo();
    buscar.mockResolvedValue(r as never);
    return servicio.solicitarCancelacion(1, usuario);
  };

  it("E1 reserva inexistente: 404", async () => {
    await expect(evaluar(null)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("E2 cliente que no es el titular: 403", async () => {
    await expect(evaluar(reserva(), { ...cliente, idusuario: 99 })).rejects.toMatchObject({ statusCode: 403 });
  });
  it("E3 rol que no es cliente ni administrador: 403", async () => {
    await expect(evaluar(reserva(), { ...cliente, rol: "GUIA" })).rejects.toMatchObject({ statusCode: 403 });
  });
  it("E4 reserva ya cancelada: 400", async () => {
    await expect(evaluar(reserva({ estado: "CANCELADA" }))).rejects.toThrow("estado Confirmada");
  });
  it("E5 salida que empieza hoy: 400 (límite de fecha)", async () => {
    await expect(evaluar(reserva({ salida: { idsalida: 7, estado: "PUBLICADA", fechaInicio: hoyUTC() } }))).rejects.toThrow("no admiten cancelaciones");
  });
  it.each(["EN_CURSO", "FINALIZADA", "CANCELADA"])("E6 salida futura en estado %s: 400", async (estado) => {
    await expect(evaluar(reserva({ salida: { idsalida: 7, estado, fechaInicio: dias(30) } }))).rejects.toThrow("no admiten cancelaciones");
  });
  it("E7 a la venta y sin permisos: los lugares vuelven a la venta", async () => {
    expect(await evaluar(reserva())).toMatchObject({ lugaresVuelvenALaVenta: true, advertencia: null, montoAReintegrar: 1000 });
  });
  it("E8 con permisos emitidos: los lugares no vuelven y hay advertencia", async () => {
    const r = await evaluar(reserva({ permisos: [{ estadoTramite: "Emitido" }] }));
    expect(r).toMatchObject({ lugaresVuelvenALaVenta: false, montoAReintegrar: 0 });
    expect(r.advertencia).toContain("nominales");
  });
  it("E9 un permiso que no está emitido no cuenta como emitido", async () => {
    expect(await evaluar(reserva({ permisos: [{ estadoTramite: "Perdido" }] }))).toMatchObject({ lugaresVuelvenALaVenta: true });
  });
  it("E10 salida cerrada sin permisos: los lugares no vuelven", async () => {
    expect(await evaluar(reserva({ salida: { idsalida: 7, estado: "CERRADA", fechaInicio: dias(30) } }))).toMatchObject({ lugaresVuelvenALaVenta: false });
  });
});

describe("confirmarCancelacion: V(G) = 4", () => {
  const preparar = (...cancelar: unknown[]) => {
    vi.spyOn(GestionReservaRepository.prototype, "findParaCancelacion").mockResolvedValue(reserva() as never);
    const espia = vi.spyOn(GestionReservaRepository.prototype, "cancelarReserva");
    cancelar.forEach((c) => espia.mockResolvedValueOnce(c as never));
    return espia;
  };
  beforeEach(() => {
    vi.restoreAllMocks();
    enviarEmail.mockReset().mockResolvedValue(undefined);
  });

  it("C1 camino feliz: cancela, avisa al titular y usa el motivo por defecto", async () => {
    const espia = preparar({ idreembolso: 1, montoReembolsado: 1000 });
    const r = await new GestionReservaService().confirmarCancelacion(1, { motivo: null }, cliente);
    expect(r).toMatchObject({ estado: "CANCELADA", lugaresVuelvenALaVenta: true });
    expect(espia).toHaveBeenCalledWith(expect.objectContaining({ motivo: "Sin motivo informado" }));
    expect(enviarEmail).toHaveBeenCalledWith("a@b.com", "RES-1", 1000, null);
  });
  it("C2 cambió en el medio: recalcula una vez y cancela", async () => {
    const espia = preparar("CAMBIO", { idreembolso: 1, montoReembolsado: 1000 });
    await new GestionReservaService().confirmarCancelacion(1, { motivo: "Viaje" }, cliente);
    expect(espia).toHaveBeenCalledTimes(2);
  });
  it("C3 cambió dos veces: 409", async () => {
    preparar("CAMBIO", "CAMBIO");
    await expect(new GestionReservaService().confirmarCancelacion(1, { motivo: "Viaje" }, cliente)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("C4 otro pedido la canceló antes: 409 y no avisa", async () => {
    preparar(null);
    await expect(new GestionReservaService().confirmarCancelacion(1, { motivo: "Viaje" }, cliente)).rejects.toThrow("ya había sido cancelada");
    expect(enviarEmail).not.toHaveBeenCalled();
  });
  it("C5 si el mail falla, la cancelación queda firme", async () => {
    preparar({ idreembolso: 1, montoReembolsado: 1000 });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    enviarEmail.mockRejectedValue(new Error("SMTP"));
    await expect(new GestionReservaService().confirmarCancelacion(1, { motivo: "Viaje" }, cliente)).resolves.toMatchObject({ estado: "CANCELADA" });
    await vi.waitFor(() => expect(log).toHaveBeenCalled());
  });
  it("C7 con solicitud confirmada el alojamiento no salió del stock de la salida", async () => {
    const espia = preparar({ idreembolso: 1, montoReembolsado: 1000 });
    vi.mocked(GestionReservaRepository.prototype.findParaCancelacion).mockResolvedValue(reserva({ solicitudes: [{ estado: "CONFIRMADA" }] }) as never);
    await new GestionReservaService().confirmarCancelacion(1, { motivo: "Viaje" }, cliente);
    expect(espia).toHaveBeenCalledWith(expect.objectContaining({ alojamientoPorStock: false }));
  });
  it("C6 el administrador reintegra el 100% de una reserva ajena", async () => {
    const espia = preparar({ idreembolso: 1, montoReembolsado: 1000 });
    await new GestionReservaService().confirmarCancelacion(1, { motivo: "Viaje" }, admin);
    expect(espia).toHaveBeenCalledWith(expect.objectContaining({ montoReembolsado: 1000, idusuario: 1 }));
  });
});

describe("cancelarReserva (repositorio): decide stock, plazas, permisos y solicitudes", () => {
  const datos = (over: Record<string, unknown> = {}) => ({
    idreserva: 1, idsalida: 7, idusuario: 5, motivo: "Viaje", montoReembolsado: 1000, condicionAplicada: "x", cantidadPasajeros: 2,
    permisosEmitidos: false, alojamientoPorStock: false, salidaEnVenta: true, ...over,
  });
  const repository = new GestionReservaRepository();

  beforeEach(() => {
    vi.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([{ estado: "PUBLICADA" }]);
    tx.permisoPasajero.count.mockResolvedValue(0);
    tx.reserva.updateMany.mockResolvedValue({ count: 1 });
    tx.reembolso.create.mockResolvedValue({ idreembolso: 1 });
    tx.salidaServicio.findFirst.mockResolvedValue({ idservicio: 3 });
  });

  it("P1 aparecieron permisos desde el cálculo: CAMBIO y no toca nada", async () => {
    tx.permisoPasajero.count.mockResolvedValue(1);
    expect(await repository.cancelarReserva(datos())).toBe("CAMBIO");
    expect(tx.reserva.updateMany).not.toHaveBeenCalled();
  });
  it("P2 la salida dejó de estar a la venta: CAMBIO", async () => {
    tx.$queryRaw.mockResolvedValue([{ estado: "CERRADA" }]);
    expect(await repository.cancelarReserva(datos())).toBe("CAMBIO");
  });
  it("P3 la guarda por estado no encuentra la reserva: null y sin reembolso", async () => {
    tx.reserva.updateMany.mockResolvedValue({ count: 0 });
    expect(await repository.cancelarReserva(datos())).toBeNull();
    expect(tx.reembolso.create).not.toHaveBeenCalled();
  });
  it("P4 a la venta, alojamiento por solicitud: repone lugares pero no plazas", async () => {
    await repository.cancelarReserva(datos());
    expect(tx.salida.update).toHaveBeenCalledWith({ where: { idsalida: 7 }, data: { stockLocal: { increment: 2 } } });
    expect(tx.solicitud.updateMany).toHaveBeenCalled();
    expect(tx.permisoPasajero.updateMany).not.toHaveBeenCalled();
    expect(tx.servicioAlojamiento.update).not.toHaveBeenCalled();
  });
  it("P5 a la venta, alojamiento por stock: repone lugares y plazas de la salida", async () => {
    await repository.cancelarReserva(datos({ alojamientoPorStock: true }));
    expect(tx.salida.update).toHaveBeenCalledWith({ where: { idsalida: 7 }, data: { stockLocal: { increment: 2 }, stockLocalAlojamiento: { increment: 2 } } });
  });
  it("P6 permisos emitidos a la venta: los pierde y solo repone plazas", async () => {
    tx.permisoPasajero.count.mockResolvedValue(2);
    await repository.cancelarReserva(datos({ permisosEmitidos: true, alojamientoPorStock: true }));
    expect(tx.permisoPasajero.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { estadoTramite: "Perdido" } }));
    expect(tx.salida.update).toHaveBeenCalledWith({ where: { idsalida: 7 }, data: { stockLocalAlojamiento: { increment: 2 } } });
  });
  it("P7 permisos emitidos y alojamiento por solicitud: no repone nada", async () => {
    tx.permisoPasajero.count.mockResolvedValue(2);
    await repository.cancelarReserva(datos({ permisosEmitidos: true }));
    expect(tx.salida.update).not.toHaveBeenCalled();
  });
  it("P8 salida cerrada con alojamiento por stock: las plazas vuelven al hotel", async () => {
    tx.$queryRaw.mockResolvedValue([{ estado: "CERRADA" }]);
    await repository.cancelarReserva(datos({ salidaEnVenta: false, alojamientoPorStock: true }));
    expect(tx.salida.update).not.toHaveBeenCalled();
    expect(tx.servicioAlojamiento.update).toHaveBeenCalledWith({ where: { idservicio: 3 }, data: { capacidadDisponible: { increment: 2 } } });
  });
  it("P9 salida cerrada sin hotel asignado: no falla", async () => {
    tx.$queryRaw.mockResolvedValue([{ estado: "CERRADA" }]);
    tx.salidaServicio.findFirst.mockResolvedValue(null);
    await repository.cancelarReserva(datos({ salidaEnVenta: false, alojamientoPorStock: true }));
    expect(tx.servicioAlojamiento.update).not.toHaveBeenCalled();
  });
});
