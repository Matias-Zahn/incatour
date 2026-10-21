import { describe, it, expect, vi, beforeEach } from "vitest";
import { CatalogoService } from "./catalogo.service";

const { repo } = vi.hoisted(() => ({
  repo: {
    buscarPaquetesActivos: vi.fn(),
  },
}));
vi.mock("./catalogo.repository", () => ({ CatalogoRepository: class { constructor() { return repo; } } }));

const paqueteMock = (overrides: Record<string, any> = {}) => ({
  idpaquete: 1,
  nroPaquete: "PKG-0001",
  nombrePaquete: "Inca Clásico",
  tipoGarantia: "POR_CATEGORIA",
  categoriaGarantizada: "3 estrellas",
  localidadGarantizada: "Cusco",
  tipoHabitacionGarantizada: "Doble",
  nochesPrevias: 1,
  nochesPosteriores: 1,
  condiciones: "Condiciones test",
  diasDisponibles: "Todos los días",
  circuito: {
    idcircuito: 1,
    nombreCircuito: "Camino Inca Clásico",
    duracionDias: 4,
    dificultad: "Moderada",
    etapas: [
      { numeroOrden: 1, puntoInicio: "Km 82", puntoFin: "Wayllabamba", campamentoPrevisto: "Camp 1" },
    ],
  },
  tarifas: [
    {
      monto: 800,
      moneda: "USD",
      temporada: {
        idtemporada: 1,
        nombre: "Alta Enero",
        estado: "ACTIVO",
        fechaInicio: new Date("2030-01-01T00:00:00Z"),
        fechaFin: new Date("2030-01-31T23:59:59Z"),
      },
    },
  ],
  servicios: [],
  garantiasEstablecimiento: [],
  salidas: [
    {
      idsalida: 10,
      nroSalida: "SAL-0010",
      fechaInicio: new Date("2030-01-15T08:00:00Z"),
      fechaFin: new Date("2030-01-19T18:00:00Z"),
      estado: "PUBLICADA",
      stockLocal: 10,
      tamanoMaximo: 16,
    },
    {
      idsalida: 11,
      nroSalida: "SAL-0011",
      fechaInicio: new Date("2030-07-15T08:00:00Z"), // Fuera de la temporada de enero
      fechaFin: new Date("2030-07-19T18:00:00Z"),
      estado: "PUBLICADA",
      stockLocal: 12,
      tamanoMaximo: 16,
    },
  ],
  ...overrides,
});

describe("CatalogoService (CU-26)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("CAT-07: marca precioPersona como null si ninguna temporada activa cubre la fecha de la salida", async () => {
    repo.buscarPaquetesActivos.mockResolvedValue([paqueteMock()]);

    const resultado = await new CatalogoService().consultarCatalogo();
    expect(resultado).toHaveLength(1);

    const salidas = resultado[0]!.salidasDisponibles!;
    expect(salidas).toHaveLength(2);

    // Salida en enero: tiene tarifa de Alta Enero
    const salidaEnero = salidas.find((s) => s.idsalida === 10);
    expect(salidaEnero).toMatchObject({
      precioPersona: 800,
      moneda: "USD",
      temporadaNombre: "Alta Enero",
    });

    // Salida en julio: no tiene temporada que cubra julio -> precioPersona null, no 800 ni 0
    const salidaJulio = salidas.find((s) => s.idsalida === 11);
    expect(salidaJulio).toMatchObject({
      precioPersona: null,
      moneda: null,
      temporadaNombre: null,
    });
  });

  it("CAT-13: pasa los filtros recibidos al repositorio", async () => {
    repo.buscarPaquetesActivos.mockResolvedValue([]);

    const filtros = { dificultad: "Alta", duracionDias: 4, fechaDesde: "2030-01-01" };
    await new CatalogoService().consultarCatalogo(filtros);

    expect(repo.buscarPaquetesActivos).toHaveBeenCalledWith(filtros);
  });
});
