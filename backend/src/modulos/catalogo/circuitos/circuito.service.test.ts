import { describe, it, expect, vi, beforeEach } from "vitest";
import { CircuitoService } from "./circuito.service";
import { CrearCircuitoDto, ModificarCircuitoDto } from "./circuito.dto";

const { repo } = vi.hoisted(() => ({
  repo: {
    findAll: vi.fn(), findById: vi.fn(), existeNombre: vi.fn(), create: vi.fn(),
    update: vi.fn(), updateEstado: vi.fn(), tienePaquetesActivos: vi.fn(),
  },
}));
vi.mock("./circuito.repository", () => ({ CircuitoRepository: class { constructor() { return repo; } } }));

const crearDto = CrearCircuitoDto.create({ nombreCircuito: "Camino Inca", duracionDias: 4, dificultad: "MEDIA", minimoGuias: 1 })[1]!;
const circuito = (estado = "ACTIVO") => ({ idcircuito: 1, nombreCircuito: "Camino Inca", estado });

describe("CircuitoService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.existeNombre.mockResolvedValue(false);
    repo.findById.mockResolvedValue(circuito());
    repo.tienePaquetesActivos.mockResolvedValue(false);
  });

  it("CU-01: devuelve los circuitos del repositorio", async () => {
    repo.findAll.mockResolvedValue([circuito()]);

    await expect(new CircuitoService().consultarCircuitos()).resolves.toHaveLength(1);
  });

  describe("crearCircuito (CU-02)", () => {
    it("crea el circuito si el nombre está libre", async () => {
      repo.create.mockResolvedValue(circuito());

      await new CircuitoService().crearCircuito(crearDto);

      expect(repo.existeNombre).toHaveBeenCalledWith("Camino Inca");
      expect(repo.create).toHaveBeenCalledWith(crearDto);
    });

    it("rechaza un nombre que ya usa otro circuito activo", async () => {
      repo.existeNombre.mockResolvedValue(true);

      await expect(new CircuitoService().crearCircuito(crearDto)).rejects.toMatchObject({ statusCode: 400 });
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
      await new CircuitoService().modificarCircuito(1, ModificarCircuitoDto.create({ duracionDias: 5 })[1]!);

      expect(repo.existeNombre).not.toHaveBeenCalled();
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

    it("rechaza un nombre duplicado", async () => {
      repo.existeNombre.mockResolvedValue(true);

      await expect(new CircuitoService().modificarCircuito(1, dto)).rejects.toThrow("Ya existe un circuito");
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
