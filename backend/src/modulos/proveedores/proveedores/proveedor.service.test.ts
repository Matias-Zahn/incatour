import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProveedorService } from "./proveedor.service";

const { repo } = vi.hoisted(() => ({
  repo: {
    findById: vi.fn(), existeRazonSocial: vi.fn(), update: vi.fn(), updateEstado: vi.fn(),
    tieneSolicitudesPendientes: vi.fn(), tieneSalidasActivas: vi.fn(), contarPaquetesActivosConServicios: vi.fn(),
  },
}));
vi.mock("./proveedor.repository", () => ({ ProveedorRepository: class { constructor() { return repo; } } }));

const proveedor = (estado = "ACTIVO") => ({
  idproveedor: 7, estado, razonSocial: "Hotel X", localidad: "Cusco", tipoProveedor: "ALOJAMIENTO", _count: { servicios: 1 },
});

describe("ProveedorService.darDeBaja (CU-17)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findById.mockResolvedValue(proveedor());
    repo.tieneSolicitudesPendientes.mockResolvedValue(false);
    repo.tieneSalidasActivas.mockResolvedValue(false);
    repo.contarPaquetesActivosConServicios.mockResolvedValue(0);
    repo.updateEstado.mockResolvedValue(proveedor("INACTIVO"));
  });

  it("CAT-26: no da de baja un proveedor cuyos servicios usa un paquete activo", async () => {
    repo.contarPaquetesActivosConServicios.mockResolvedValue(2);

    await expect(new ProveedorService().darDeBaja(7)).rejects.toThrow("2 paquete(s) activo(s)");
    expect(repo.updateEstado).not.toHaveBeenCalled();
  });

  it("sin paquetes, salidas ni solicitudes hace la baja", async () => {
    await expect(new ProveedorService().darDeBaja(7)).resolves.toMatchObject({ estado: "INACTIVO" });
  });
});
