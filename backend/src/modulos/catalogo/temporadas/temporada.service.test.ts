import { describe, it, expect, vi, beforeEach } from "vitest";
import { TemporadaService } from "./temporada.service";
import { CrearTemporadaDto, ModificarTemporadaDto } from "./temporada.dto";

const { repo } = vi.hoisted(() => ({
  repo: {
    findAll: vi.fn(),
    findById: vi.fn(),
    existeNombre: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateEstado: vi.fn(),
    tieneTarifasAsociadas: vi.fn(),
    existeSolapamiento: vi.fn(),
    tieneSalidasConReservas: vi.fn(),
  },
}));
vi.mock("./temporada.repository", () => ({ TemporadaRepository: class { constructor() { return repo; } } }));

const temporada = (estado = "ACTIVO") => ({
  idtemporada: 1,
  nombre: "Alta 2030",
  estado,
  fechaInicio: new Date("2030-05-01"),
  fechaFin: new Date("2030-09-30"),
});
const modificar = (obj: Record<string, unknown>) => ModificarTemporadaDto.create(obj)[1]!;

describe("TemporadaService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.existeNombre.mockResolvedValue(false);
    repo.findById.mockResolvedValue(temporada());
    repo.tieneTarifasAsociadas.mockResolvedValue(false);
    repo.existeSolapamiento.mockResolvedValue(false);
    repo.tieneSalidasConReservas.mockResolvedValue(false);
  });

  it("CU-06: devuelve las temporadas del repositorio", async () => {
    repo.findAll.mockResolvedValue([temporada(), temporada()]);

    await expect(new TemporadaService().consultarTemporadas()).resolves.toHaveLength(2);
  });

  describe("crearTemporada (CU-07)", () => {
    const dto = CrearTemporadaDto.create({ nombre: "Alta 2030", fechaInicio: "2030-05-01", fechaFin: "2030-09-30" })[1]!;

    it("crea la temporada si el nombre está libre", async () => {
      await new TemporadaService().crearTemporada(dto);

      expect(repo.create).toHaveBeenCalledWith(dto);
    });

    it("rechaza un nombre que ya usa otra temporada activa con 409 (CAT-15)", async () => {
      repo.existeNombre.mockResolvedValue(true);

      await expect(new TemporadaService().crearTemporada(dto)).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining("Ya existe una temporada activa"),
      });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("rechaza si las fechas se superponen con otra temporada activa (CAT-01, RF-11)", async () => {
      repo.existeSolapamiento.mockResolvedValue(true);

      await expect(new TemporadaService().crearTemporada(dto)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("superponen"),
      });
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("modificarTemporada (CU-08)", () => {
    it("modifica el nombre verificando que no lo use otra temporada", async () => {
      await new TemporadaService().modificarTemporada(1, modificar({ nombre: "Alta 2031" }));

      expect(repo.existeNombre).toHaveBeenCalledWith("Alta 2031", 1);
      expect(repo.update).toHaveBeenCalled();
    });

    it("no consulta duplicados si el nombre es el mismo", async () => {
      await new TemporadaService().modificarTemporada(1, modificar({ nombre: "Alta 2030" }));

      expect(repo.existeNombre).not.toHaveBeenCalled();
    });

    it("rechaza un nombre duplicado con 409 (CAT-15)", async () => {
      repo.existeNombre.mockResolvedValue(true);

      await expect(new TemporadaService().modificarTemporada(1, modificar({ nombre: "Baja" }))).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining("Ya existe otra temporada"),
      });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("con una sola fecha, la compara contra la otra fecha guardada", async () => {
      // fechaFin nueva anterior al inicio guardado (2030-05-01)
      await expect(
        new TemporadaService().modificarTemporada(1, modificar({ fechaFin: "2030-04-01" }))
      ).rejects.toThrow("fecha de inicio debe ser anterior");
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("acepta mover solo la fecha de inicio si sigue antes del fin guardado", async () => {
      await new TemporadaService().modificarTemporada(1, modificar({ fechaInicio: "2030-06-01" }));

      expect(repo.update).toHaveBeenCalled();
    });

    it("rechaza modificar fechas si tiene tarifas de paquetes asociadas (CAT-03, RF-12)", async () => {
      repo.tieneTarifasAsociadas.mockResolvedValue(true);

      await expect(
        new TemporadaService().modificarTemporada(1, modificar({ fechaFin: "2030-10-15" }))
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("tarifas asociadas"),
      });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rechaza modificar fechas si tiene salidas con reservas (CAT-03, RF-12)", async () => {
      repo.tieneSalidasConReservas.mockResolvedValue(true);

      await expect(
        new TemporadaService().modificarTemporada(1, modificar({ fechaFin: "2030-10-15" }))
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("salidas que tienen reservas"),
      });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rechaza modificar fechas si se superponen con otra temporada activa (CAT-01, RF-11)", async () => {
      repo.existeSolapamiento.mockResolvedValue(true);

      await expect(
        new TemporadaService().modificarTemporada(1, modificar({ fechaFin: "2030-10-15" }))
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("superponen"),
      });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("404 si la temporada no existe o está inactiva", async () => {
      repo.findById.mockResolvedValue(temporada("INACTIVO"));

      await expect(new TemporadaService().modificarTemporada(1, modificar({ nombre: "X" }))).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("darDeBajaTemporada (CU-09)", () => {
    it("hace la baja lógica", async () => {
      await new TemporadaService().darDeBajaTemporada(1);

      expect(repo.updateEstado).toHaveBeenCalledWith(1, "INACTIVO");
    });

    it("no permite la baja si hay tarifas de paquetes asociadas", async () => {
      repo.tieneTarifasAsociadas.mockResolvedValue(true);

      await expect(new TemporadaService().darDeBajaTemporada(1)).rejects.toThrow("tarifas de paquetes");
      expect(repo.updateEstado).not.toHaveBeenCalled();
    });

    it("404 si no existe", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(new TemporadaService().darDeBajaTemporada(1)).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
