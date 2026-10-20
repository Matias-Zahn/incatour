import { describe, it, expect, vi, beforeEach } from "vitest";
import { PersonalService } from "./personal.service";

const { repo } = vi.hoisted(() => ({
  repo: { buscarPorId: vi.fn(), modificar: vi.fn(), checkPasaporteExists: vi.fn() },
}));
vi.mock("./personal.repository", () => ({ PersonalRepository: class { constructor() { return repo; } } }));

describe("PersonalService.modificarPersonal (CU-24)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.buscarPorId.mockResolvedValue({ estado: "ACTIVO", nroPasaporte: "X", guia: { idusuario: 9 } });
  });

  it("al cambiar el nombre de un guía también actualiza nombre y apellido de su usuario (CTA-04)", async () => {
    await new PersonalService().modificarPersonal(1, { nombreCompleto: "Rosa Quispe Mamani" } as any);

    expect(repo.modificar).toHaveBeenCalledWith(1, expect.anything(), {
      idusuario: 9,
      nombre: "Rosa",
      apellido: "Quispe Mamani",
    });
  });

  it("rechaza con 400 un nombre de guía sin apellido", async () => {
    await expect(new PersonalService().modificarPersonal(1, { nombreCompleto: "Rosa" } as any)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(repo.modificar).not.toHaveBeenCalled();
  });
});
