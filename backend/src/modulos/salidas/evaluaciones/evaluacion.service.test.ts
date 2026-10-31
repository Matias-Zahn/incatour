import { describe, it, expect, vi, beforeEach } from "vitest";
import { EvaluacionService } from "./evaluacion.service";
import { EvaluarDto } from "./evaluacion.dto";

const { repo } = vi.hoisted(() => ({
  repo: { buscarSalida: vi.fn(), salidasFinalizadas: vi.fn(), evaluarPersonal: vi.fn(), evaluarProveedor: vi.fn(), listar: vi.fn() },
}));
vi.mock("./evaluacion.repository", () => ({ EvaluacionRepository: class { constructor() { return repo; } } }));

const proveedor = { idproveedor: 4, razonSocial: "Andes Travel" };
const salida = (extra = {}) => ({
  idsalida: 1, nroSalida: "SAL-2026-001", estado: "FINALIZADA",
  personalAsignado: [{ idpersonal: 1, personal: { idpersonal: 1, nombreCompleto: "Carlos", rol: "Guía" } }],
  servicios: [{ servicio: { proveedor } }],
  equipamientos: [{ servicio: { proveedor } }], // el mismo proveedor dos veces: se cuenta una
  evaluacionesPersonal: [],
  evaluacionesProveedores: [],
  ...extra,
});
const dto = (extra: object) => EvaluarDto.create({ tipo: "PERSONAL", id: 1, puntaje: 4, ...extra })[1]!;

describe("EvaluacionService (CU-42)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.buscarSalida.mockResolvedValue(salida());
    repo.evaluarPersonal.mockImplementation(async (...a) => a);
    repo.evaluarProveedor.mockImplementation(async (...a) => a);
  });

  it("lista el personal y los proveedores sin repetir", async () => {
    const r = await new EvaluacionService().consultarEvaluables(1);

    expect(r.personal).toHaveLength(1);
    expect(r.proveedores).toEqual([{ ...proveedor, evaluacion: null }]);
  });

  it("cuenta lo que falta evaluar: cada persona y cada proveedor una sola vez", async () => {
    repo.salidasFinalizadas.mockResolvedValue([
      salida(),
      salida({ idsalida: 2, evaluacionesPersonal: [{ idpersonal: 1 }] }),
      salida({ idsalida: 3, evaluacionesPersonal: [{ idpersonal: 1 }], evaluacionesProveedores: [{ idproveedor: 4 }] }),
    ]);

    expect(await new EvaluacionService().pendientes()).toEqual([
      { idsalida: 1, pendientes: 2 },
      { idsalida: 2, pendientes: 1 },
      { idsalida: 3, pendientes: 0 },
    ]);
  });

  it("evalúa a una persona y a un proveedor que participaron", async () => {
    const s = new EvaluacionService();

    expect(await s.evaluar(1, dto({ comentario: "Muy bien" }))).toEqual([1, 1, 4, "Muy bien"]);
    expect(await s.evaluar(1, dto({ tipo: "PROVEEDOR", id: 4, puntaje: 2 }))).toEqual([1, 4, 2, null]);
  });

  it("rechaza a quien no participó y a quien ya fue evaluado", async () => {
    const s = new EvaluacionService();
    await expect(s.evaluar(1, dto({ id: 9 }))).rejects.toThrow("no participó");
    await expect(s.evaluar(1, dto({ tipo: "PROVEEDOR", id: 9 }))).rejects.toThrow("ningún servicio");

    repo.buscarSalida.mockResolvedValue(salida({ evaluacionesPersonal: [{ idpersonal: 1 }] }));
    await expect(s.evaluar(1, dto({}))).rejects.toThrow("ya fue evaluada");
  });

  it("solo evalúa salidas finalizadas", async () => {
    repo.buscarSalida.mockResolvedValue(salida({ estado: "EN_CURSO" }));

    await expect(new EvaluacionService().evaluar(1, dto({}))).rejects.toThrow("finalizada");
  });

  it("el DTO exige puntaje de 1 a 5 y un tipo válido", () => {
    expect(EvaluarDto.create({ tipo: "PERSONAL", id: 1, puntaje: 6 })[0]).toMatch("1 a 5");
    expect(EvaluarDto.create({ tipo: "PERSONAL", id: 1, puntaje: 0 })[0]).toMatch("1 a 5");
    expect(EvaluarDto.create({ tipo: "CLIENTE", id: 1, puntaje: 3 })[0]).toMatch("tipo");
  });
});
