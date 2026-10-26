import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevolucionEquipamientoService } from "./devolucion-equipamiento.service";
import { DevolucionEquipamientoDto } from "./devolucion-equipamiento.dto";

const { repo } = vi.hoisted(() => ({
  repo: { obtenerSalidaConEquipamiento: vi.fn(), existeDevolucion: vi.fn(), registrarDevolucion: vi.fn() },
}));
vi.mock("./devolucion-equipamiento.repository", () => ({
  DevolucionEquipamientoRepository: class { constructor() { return repo; } },
}));

// Salida del 10 al 13 de noviembre con 10 carpas asignadas
const salida = (estado = "EN_CURSO") => ({
  idsalida: 2, nroSalida: "SAL-2", estado, fechaFin: new Date("2026-11-13"),
  equipamientos: [{ idservicio: 5, cantidad: 10, servicio: { nombreServicio: "Carpa", equipamiento: null, proveedor: { razonSocial: "X" } } }],
});
const dto = (cantidadBuenEstado: number, cantidadDaniada = 0) =>
  DevolucionEquipamientoDto.create({ items: [{ idservicio: 5, cantidadBuenEstado, cantidadDaniada }] })[1]!;

describe("DevolucionEquipamientoService.registrarDevolucion (CU-41)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    repo.obtenerSalidaConEquipamiento.mockResolvedValue(salida());
    repo.existeDevolucion.mockResolvedValue(false);
    repo.registrarDevolucion.mockResolvedValue({ auditoriaId: 1 });
  });

  afterEach(() => vi.useRealTimers());

  it("SAL-14: la víspera del último día todavía no acepta la devolución", async () => {
    vi.setSystemTime(new Date(2026, 10, 12, 21, 0)); // 12/11 a las 21 hora local

    await expect(new DevolucionEquipamientoService().registrarDevolucion(2, dto(10), "a@b.com")).rejects.toThrow("concluida");
    expect(repo.registrarDevolucion).not.toHaveBeenCalled();
  });

  it("SAL-14: el último día del recorrido ya la acepta", async () => {
    vi.setSystemTime(new Date(2026, 10, 13, 9, 0));

    await expect(new DevolucionEquipamientoService().registrarDevolucion(2, dto(8, 2), "a@b.com")).resolves.toMatchObject({ idsalida: 2 });
  });

  it("SAL-15: si no se informa todo lo asignado responde 400 con lo que falta", async () => {
    vi.setSystemTime(new Date(2026, 10, 14));

    await expect(new DevolucionEquipamientoService().registrarDevolucion(2, dto(6), "a@b.com")).rejects.toThrow("Carpa: faltan 4 de 10");
    expect(repo.registrarDevolucion).not.toHaveBeenCalled();
  });
});
