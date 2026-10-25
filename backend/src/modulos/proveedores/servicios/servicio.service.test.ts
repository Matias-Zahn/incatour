import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServicioService } from "./servicio.service";

const { repo } = vi.hoisted(() => ({
  repo: {
    findById: vi.fn(), contarSolicitudesPendientes: vi.fn(), contarSalidasActivas: vi.fn(),
    contarGarantiasDePaquetesActivos: vi.fn(), contarPaquetesActivosQueLoIncluyen: vi.fn(), updateEstado: vi.fn(),
  },
}));
vi.mock("./servicio.repository", () => ({ ServicioRepository: class { constructor() { return repo; } } }));

describe("ServicioService.darDeBaja (CU-21)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findById.mockResolvedValue({ idservicio: 5, estado: "ACTIVO" });
    repo.contarSolicitudesPendientes.mockResolvedValue(0);
    repo.contarSalidasActivas.mockResolvedValue(0);
    repo.contarGarantiasDePaquetesActivos.mockResolvedValue(0);
    repo.contarPaquetesActivosQueLoIncluyen.mockResolvedValue(0);
  });

  it("CAT-09: rechaza la baja si el servicio está incluido en paquetes activos", async () => {
    repo.contarPaquetesActivosQueLoIncluyen.mockResolvedValue(2);

    await expect(new ServicioService().darDeBaja(5)).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.updateEstado).not.toHaveBeenCalled();
  });
});
