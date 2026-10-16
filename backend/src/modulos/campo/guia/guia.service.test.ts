import { describe, it, expect, vi, beforeEach } from "vitest";
import { GuiaService } from "./guia.service";

const { repo } = vi.hoisted(() => ({
  repo: { idPersonalDelUsuario: vi.fn(), salidasAsignadas: vi.fn(), detalleSalida: vi.fn() },
}));
vi.mock("./guia.repository", () => ({ GuiaRepository: class { constructor() { return repo; } } }));

const salida = {
  idsalida: 2, nroSalida: "SAL-2026-002", estado: "CERRADA", fechaInicio: new Date(), fechaFin: new Date(),
  paquete: { nombrePaquete: "Inca", circuito: { nombreCircuito: "Camino", duracionDias: 4, etapas: [] } },
  avances: [], servicios: [], equipamientos: [], reservas: [],
  personalAsignado: [{ idpersonal: 7, personal: { idpersonal: 7, nombreCompleto: "Rosa", rol: "Guía" } }],
};

describe("GuiaService.consultarDetalleSalida (CU-48)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.detalleSalida.mockResolvedValue(salida);
  });

  it("el guía asignado ve el detalle de su salida", async () => {
    repo.idPersonalDelUsuario.mockResolvedValue(7);

    const r = await new GuiaService().consultarDetalleSalida(1, 2);

    expect(r.salida.nroSalida).toBe("SAL-2026-002");
  });

  it("un guía no asignado recibe 403", async () => {
    repo.idPersonalDelUsuario.mockResolvedValue(8);

    await expect(new GuiaService().consultarDetalleSalida(1, 2)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("una cuenta sin legajo de guía recibe 403", async () => {
    repo.idPersonalDelUsuario.mockResolvedValue(null);

    await expect(new GuiaService().consultarDetalleSalida(1, 2)).rejects.toMatchObject({ statusCode: 403 });
  });
});
