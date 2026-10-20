import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutoridadMock } from "../../../integraciones/autoridad/autoridad.mock";
import { CrearSalidaDto } from "./salida.dto";

import { SalidaService } from "./salida.service";

// vi.mock se ejecuta antes que los imports: lo que usan los mocks se declara con vi.hoisted
const { repo, actual } = vi.hoisted(() => ({
  // Repositorio falso: sin base de datos, controlamos qué devuelve y si falla
  repo: { buscarPaquete: vi.fn(), buscarAlojamientosConBloqueo: vi.fn(), crearSalida: vi.fn() },
  actual: { autoridad: null as unknown },
}));
vi.mock("./salida.repository", () => ({
  SalidaRepository: class {
    constructor() {
      return repo;
    }
  },
}));
vi.mock("../autoridad.wiring", () => ({ obtenerAutoridad: () => actual.autoridad }));
let autoridad: AutoridadMock;

const FECHA = "2026-11-20";
const paquete = {
  idpaquete: 1,
  nombrePaquete: "Inca Clásico",
  estado: "ACTIVO",
  circuito: { estado: "ACTIVO", duracionDias: 4, minimoGuias: 2, parametrosPorteadores: "1 por cada 2 pasajeros" },
  tarifas: [{ temporada: { estado: "ACTIVO", fechaInicio: new Date("2026-10-01"), fechaFin: new Date("2026-12-31") } }],
  garantiasEstablecimiento: [],
};
const dto = (extra = {}) => CrearSalidaDto.create({ idpaquete: 1, fechaInicio: FECHA, tamanoMaximo: 16, ...extra })[1]!;

describe("SalidaService.crearSalida (CU-36)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    autoridad = actual.autoridad = new AutoridadMock();
    repo.buscarPaquete.mockResolvedValue(paquete);
    repo.buscarAlojamientosConBloqueo.mockResolvedValue([]); // FA3: ninguno confirma por bloqueo
  });

  it("bloquea tamaño máximo + dotación (16 + 2 guías + 8 porteadores = 26)", async () => {
    repo.crearSalida.mockResolvedValue({ idsalida: 9 });

    const r = await new SalidaService().crearSalida(dto());

    expect(r.totalLugares).toBe(26);
    expect(repo.crearSalida).toHaveBeenCalledWith(expect.objectContaining({ fechaFin: new Date("2026-11-23") }));
  });

  it("FA1: sin cupo suficiente no crea la salida y dice cuántos lugares hay", async () => {
    await autoridad.solicitarBloqueoCupo(new Date(FECHA), 490);

    await expect(new SalidaService().crearSalida(dto())).rejects.toThrow("hay 10 disponibles");
    expect(repo.crearSalida).not.toHaveBeenCalled();
  });

  it("FA2: si la autoridad no responde, responde 503 y no crea la salida", async () => {
    actual.autoridad = new AutoridadMock(true);

    await expect(new SalidaService().crearSalida(dto())).rejects.toMatchObject({ statusCode: 503 });
    expect(repo.crearSalida).not.toHaveBeenCalled();
  });

  it("compensación: si la base falla después del bloqueo, devuelve los lugares a la autoridad", async () => {
    repo.crearSalida.mockRejectedValue(new Error("fallo de la base"));

    await expect(new SalidaService().crearSalida(dto())).rejects.toThrow("fallo de la base");

    // Si el bloqueo se hubiera quedado tomado, solo quedarían 474 lugares y esto fallaría
    const resultado = await autoridad.solicitarBloqueoCupo(new Date(FECHA), 500);
    expect(resultado.aprobado).toBe(true);
  });

  it("exige elegir alojamiento si hay alguno que confirma por bloqueo", async () => {
    repo.buscarAlojamientosConBloqueo.mockResolvedValue([{ idservicio: 4, alojamiento: { capacidadDisponible: 20 } }]);

    await expect(new SalidaService().crearSalida(dto())).rejects.toThrow("elegí uno");
  });
});

describe("SalidaService.consultarOpcionesSalida (CU-36)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    autoridad = actual.autoridad = new AutoridadMock();
    repo.buscarPaquete.mockResolvedValue(paquete);
    repo.buscarAlojamientosConBloqueo.mockResolvedValue([]);
  });

  it("informa los lugares libres de la autoridad ese día y si alcanzan", async () => {
    await autoridad.solicitarBloqueoCupo(new Date(FECHA), 490);

    const r = await new SalidaService().consultarOpcionesSalida(dto());

    expect(r.cupoAutoridad).toEqual({ lugaresDisponibles: 10, alcanza: false });
  });

  it("con la autoridad caída no falla: cupoAutoridad queda en null", async () => {
    actual.autoridad = new AutoridadMock(true);

    const r = await new SalidaService().consultarOpcionesSalida(dto());

    expect(r.cupoAutoridad).toBeNull();
  });
});
