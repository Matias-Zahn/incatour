import { describe, it, expect, vi, beforeEach } from "vitest";
import { CircuitoService } from "./circuito.service";
import { CrearCircuitoDto, ModificarCircuitoDto } from "./circuito.dto";

const { repo } = vi.hoisted(() => ({
  repo: {
    findAll: vi.fn(),
    findById: vi.fn(),
    existeNombre: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateEstado: vi.fn(),
    tienePaquetesActivos: vi.fn(),
    tieneSalidas: vi.fn(),
  },
}));
vi.mock("./circuito.repository", () => ({ CircuitoRepository: class { constructor() { return repo; } } }));

const crearDto = CrearCircuitoDto.create({ nombreCircuito: "Camino Inca", duracionDias: 4, dificultad: "MEDIA", minimoGuias: 1 })[1]!;
const circuito = (estado = "ACTIVO") => ({
  idcircuito: 1,
  nombreCircuito: "Camino Inca",
  duracionDias: 4,
  dificultad: "MEDIA",
  minimoGuias: 1,
  parametrosPorteadores: null,
  estado,
});

describe("CircuitoService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.existeNombre.mockResolvedValue(false);
    repo.findById.mockResolvedValue(circuito());
    repo.tienePaquetesActivos.mockResolvedValue(false);
    repo.tieneSalidas.mockResolvedValue(false);
  });

  it("CU-01: devuelve los circuitos del repositorio y pasa los filtros (CAT-13)", async () => {
    repo.findAll.mockResolvedValue([circuito()]);

    const filtros = { dificultad: "Alta", estado: "INACTIVO" };
    await expect(new CircuitoService().consultarCircuitos(filtros)).resolves.toHaveLength(1);
    expect(repo.findAll).toHaveBeenCalledWith(filtros);
  });

  describe("crearCircuito (CU-02)", () => {
    it("crea el circuito si el nombre está libre", async () => {
      repo.create.mockResolvedValue(circuito());

      await new CircuitoService().crearCircuito(crearDto);

      expect(repo.existeNombre).toHaveBeenCalledWith("Camino Inca");
      expect(repo.create).toHaveBeenCalledWith(crearDto);
    });

    it("rechaza un nombre que ya usa otro circuito activo con 409 (CAT-15)", async () => {
      repo.existeNombre.mockResolvedValue(true);

      await expect(new CircuitoService().crearCircuito(crearDto)).rejects.toMatchObject({ statusCode: 409 });
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("modificarCircuito (CU-03)", () => {
    const dto = ModificarCircuitoDto.create({ nombreCircuito: "Nuevo nombre" })[1]!;

    it("modifica y verifica el nombre excluyendo al propio circuito", async () => {
      await new CircuitoService().modificarCircuito(1, dto);

      expect(repo.existeNombre).toHaveBeenCalledWith("Nuevo nombre", 1);
      expect(repo.update).toHaveBeenCalledWith(1, dto);
    });

    it("no consulta el nombre si no se cambia", async () => {
      await new CircuitoService().modificarCircuito(1, ModificarCircuitoDto.create({ dificultad: "ALTA" })[1]!);

      expect(repo.existeNombre).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalled();
    });

    it("rechaza cambiar la duración o dotación si el circuito tiene salidas (CAT-04, RF-03)", async () => {
      repo.tieneSalidas.mockResolvedValue(true);

      await expect(
        new CircuitoService().modificarCircuito(1, ModificarCircuitoDto.create({ minimoGuias: 5 })[1]!)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("atributos estructurales"),
      });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rechaza cambiar la duración o dotación si el circuito tiene paquetes activos (CAT-04, RF-03)", async () => {
      repo.tienePaquetesActivos.mockResolvedValue(true);

      await expect(
        new CircuitoService().modificarCircuito(1, ModificarCircuitoDto.create({ duracionDias: 6 })[1]!)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("atributos estructurales"),
      });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("permite cambiar dificultad aunque tenga salidas asociadas (no es estructural)", async () => {
      repo.tieneSalidas.mockResolvedValue(true);

      await new CircuitoService().modificarCircuito(1, ModificarCircuitoDto.create({ dificultad: "BAJA" })[1]!);
      expect(repo.update).toHaveBeenCalled();
    });

    it("404 si el circuito no existe", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(new CircuitoService().modificarCircuito(1, dto)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("no permite modificar un circuito inactivo", async () => {
      repo.findById.mockResolvedValue(circuito("INACTIVO"));

      await expect(new CircuitoService().modificarCircuito(1, dto)).rejects.toThrow("no está activo");
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rechaza un nombre duplicado con 409 (CAT-15)", async () => {
      repo.existeNombre.mockResolvedValue(true);

      await expect(new CircuitoService().modificarCircuito(1, dto)).rejects.toMatchObject({ statusCode: 409 });
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe("darDeBajaCircuito (CU-04)", () => {
    it("hace la baja lógica", async () => {
      await new CircuitoService().darDeBajaCircuito(1);

      expect(repo.updateEstado).toHaveBeenCalledWith(1, "INACTIVO");
    });

    it("404 si el circuito no existe", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(new CircuitoService().darDeBajaCircuito(1)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rechaza si ya estaba dado de baja", async () => {
      repo.findById.mockResolvedValue(circuito("INACTIVO"));

      await expect(new CircuitoService().darDeBajaCircuito(1)).rejects.toThrow("ya se encuentra dado de baja");
    });

    it("no permite la baja con paquetes activos asociados", async () => {
      repo.tienePaquetesActivos.mockResolvedValue(true);

      await expect(new CircuitoService().darDeBajaCircuito(1)).rejects.toThrow("paquetes activos");
      expect(repo.updateEstado).not.toHaveBeenCalled();
    });
  });
});
