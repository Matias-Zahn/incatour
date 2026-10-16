import { describe, it, expect, vi, beforeEach } from "vitest";
import { EtapaService } from "./etapa.service";
import { EstablecerSecuenciaDto } from "./etapa.dto";

const { repo, db } = vi.hoisted(() => ({
  repo: { circuitoTienePaquetesActivos: vi.fn(), reemplazarSecuenciaEtapas: vi.fn(), getByCircuitoId: vi.fn() },
  db: { circuito: { findUnique: vi.fn() } },
}));
vi.mock("./etapa.repository", () => ({ EtapaRepository: class { constructor() { return repo; } } }));
vi.mock("../../../config/postgresDatabase", () => ({ db }));

const etapa = (numeroOrden: number, puntoInicio: string, puntoFin: string) => ({ numeroOrden, puntoInicio, puntoFin });
const secuencia = (...etapas: ReturnType<typeof etapa>[]) => EstablecerSecuenciaDto.create({ etapas })[1]!;

describe("EtapaService (CU-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.circuito.findUnique.mockResolvedValue({ idcircuito: 1, estado: "ACTIVO" });
    repo.circuitoTienePaquetesActivos.mockResolvedValue(false);
  });

  describe("registrarSecuenciaEtapas", () => {
    it("ordena las etapas y reemplaza la secuencia completa", async () => {
      const dto = secuencia(etapa(2, "Wayllabamba", "Pacaymayo"), etapa(1, "Km 82", "Wayllabamba"), etapa(3, "Pacaymayo", "Machu Picchu"));

      await new EtapaService().registrarSecuenciaEtapas(1, dto);

      const [, guardadas] = repo.reemplazarSecuenciaEtapas.mock.calls[0]!;
      expect(guardadas.map((e: { numeroOrden: number }) => e.numeroOrden)).toEqual([1, 2, 3]);
    });

    it("rechaza saltos en la numeración (correlatividad temporal)", async () => {
      const dto = secuencia(etapa(1, "A", "B"), etapa(3, "B", "C"));

      await expect(new EtapaService().registrarSecuenciaEtapas(1, dto)).rejects.toThrow("Se esperaba la etapa 2");
      expect(repo.reemplazarSecuenciaEtapas).not.toHaveBeenCalled();
    });

    it("rechaza números de orden repetidos", async () => {
      const dto = secuencia(etapa(1, "A", "B"), etapa(1, "B", "C"));

      await expect(new EtapaService().registrarSecuenciaEtapas(1, dto)).rejects.toThrow("Se esperaba la etapa 2");
    });

    it("rechaza etapas que no empalman (continuidad espacial)", async () => {
      const dto = secuencia(etapa(1, "A", "B"), etapa(2, "X", "C"));

      await expect(new EtapaService().registrarSecuenciaEtapas(1, dto)).rejects.toThrow("Discontinuidad espacial");
      expect(repo.reemplazarSecuenciaEtapas).not.toHaveBeenCalled();
    });

    it("no permite cambiar las etapas si el circuito ya tiene paquetes activos", async () => {
      repo.circuitoTienePaquetesActivos.mockResolvedValue(true);

      await expect(new EtapaService().registrarSecuenciaEtapas(1, secuencia(etapa(1, "A", "B")))).rejects.toThrow("paquetes comerciales activos");
    });

    it("404 si el circuito no existe o está inactivo", async () => {
      db.circuito.findUnique.mockResolvedValue({ idcircuito: 1, estado: "INACTIVO" });

      await expect(new EtapaService().registrarSecuenciaEtapas(1, secuencia(etapa(1, "A", "B")))).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("consultarEtapas", () => {
    it("devuelve las etapas del circuito", async () => {
      repo.getByCircuitoId.mockResolvedValue([etapa(1, "A", "B")]);

      await expect(new EtapaService().consultarEtapas(1)).resolves.toHaveLength(1);
      expect(repo.getByCircuitoId).toHaveBeenCalledWith(1);
    });

    it("404 si el circuito no existe", async () => {
      db.circuito.findUnique.mockResolvedValue(null);

      await expect(new EtapaService().consultarEtapas(1)).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});

describe("EstablecerSecuenciaDto", () => {
  it("acepta una secuencia válida y normaliza campamentoPrevisto", () => {
    const [error, dto] = EstablecerSecuenciaDto.create({ etapas: [etapa(1, "A", "B")] });

    expect(error).toBeUndefined();
    expect(dto?.etapas[0]?.campamentoPrevisto).toBeNull();
  });

  it.each([
    [{ etapas: "x" }, "debe ser un arreglo"],
    [{ etapas: [] }, "no puede estar vac"],
    [{ etapas: [etapa(0, "A", "B")] }, "'numeroOrden' inv"],
    [{ etapas: [etapa(1, "", "B")] }, "'puntoInicio'"],
    [{ etapas: [etapa(1, "A", "")] }, "'puntoFin'"],
  ])("rechaza %o", (obj, mensaje) => {
    expect(EstablecerSecuenciaDto.create(obj)[0]).toContain(mensaje);
  });
});
