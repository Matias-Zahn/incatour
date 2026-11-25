import { beforeEach, describe, expect, it, vi } from "vitest";
import { costoPorPasajero, SimularCostoDto, simularCostoPaquete } from "./costoPaquete";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    servicioBase: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));
vi.mock("../../../config/postgresDatabase", () => ({ db: dbMock }));

describe("costoPorPasajero (B5 — función pura)", () => {
  it("suma hotel, transporte, tren y equipo con redondeo a 2 decimales", () => {
    const r = costoPorPasajero({
      nochesPrevias: 2,
      nochesPosteriores: 1,
      pasajeros: 12,
      hotel: { idservicio: 1, nombreServicio: "Hotel Valle", costoBase: 45 },
      transporte: { idservicio: 2, nombreServicio: "Bus Sprinter", costoBase: 600 },
      tren: { idservicio: 3, nombreServicio: "IncaRail", costoBase: 90 },
      equipo: [
        {
          servicio: { idservicio: 4, nombreServicio: "Carpa 4 estaciones", costoBase: 80 },
          cantidad: 1,
          cadaPasajeros: 2,
        },
        {
          servicio: { idservicio: 5, nombreServicio: "Bastones", costoBase: 15 },
          cantidad: 1,
          cadaPasajeros: 1,
        },
      ],
    });

    // Hotel: 45*3=135, Transporte: 600/12=50, Tren: 90, Carpa: 80*1/2=40, Bastones: 15 => 330
    expect(r.costoPorPasajero).toBe(330);
    expect(r.moneda).toBe("USD");
    expect(r.avisos).toEqual([]);
    expect(r.desglose).toEqual([
      { tipo: "ALOJAMIENTO", idservicio: 1, nombreServicio: "Hotel Valle", costoBase: 45, calculo: "45 × 3 noches", porPasajero: 135 },
      { tipo: "TRANSPORTE", idservicio: 2, nombreServicio: "Bus Sprinter", costoBase: 600, calculo: "600 ÷ 12 pasajeros", porPasajero: 50 },
      { tipo: "TREN", idservicio: 3, nombreServicio: "IncaRail", costoBase: 90, calculo: "90 por pasajero", porPasajero: 90 },
      { tipo: "EQUIPAMIENTO", idservicio: 4, nombreServicio: "Carpa 4 estaciones", costoBase: 80, calculo: "80 × 1 ÷ 2", porPasajero: 40 },
      { tipo: "EQUIPAMIENTO", idservicio: 5, nombreServicio: "Bastones", costoBase: 15, calculo: "15 × 1 ÷ 1", porPasajero: 15 },
    ]);
  });

  it("omite el hotel y no emite aviso cuando nochesPrevias + nochesPosteriores es 0", () => {
    const r = costoPorPasajero({
      nochesPrevias: 0,
      nochesPosteriores: 0,
      pasajeros: 10,
      hotel: null,
      avisoHotel: "No debería mostrarse",
      transporte: { idservicio: 2, nombreServicio: "Van", costoBase: 333 },
    });

    expect(r.costoPorPasajero).toBe(33.3);
    expect(r.desglose).toHaveLength(1);
    expect(r.avisos).toEqual([]);
  });

  it("el equipo fijo por salida se reparte entre los pasajeros base", () => {
    const r = costoPorPasajero({
      nochesPrevias: 0, nochesPosteriores: 0, pasajeros: 10, hotel: null,
      equipo: [{ servicio: { idservicio: 9, nombreServicio: "Carpa comedor", costoBase: 25 }, cantidad: 2, cadaPasajeros: null }],
    });
    expect(r.costoPorPasajero).toBe(5);
    expect(r.desglose[0]!.calculo).toBe("25 × 2 por salida ÷ 10 pasajeros");
  });

  it("incluye el aviso cuando hay noches pero ningún hotel cumple", () => {
    const r = costoPorPasajero({
      nochesPrevias: 1,
      nochesPosteriores: 1,
      pasajeros: 8,
      hotel: null,
      avisoHotel: "Ningún hotel de Cusco cumple 5 Estrellas · Suite: el costo no incluye el hotel",
    });

    expect(r.costoPorPasajero).toBe(0);
    expect(r.desglose).toEqual([]);
    expect(r.avisos).toEqual([
      "Ningún hotel de Cusco cumple 5 Estrellas · Suite: el costo no incluye el hotel",
    ]);
  });
});

describe("SimularCostoDto (B5)", () => {
  const base = {
    tipoGarantia: "POR_CATEGORIA",
    localidadGarantizada: "Cusco",
    categoriaGarantizada: "3 Estrellas",
    tipoHabitacionGarantizada: "Doble",
    nochesPrevias: 1,
    nochesPosteriores: 1,
    idtransporte: 2,
    pasajeros: 10,
  };

  it("acepta una simulación válida", () => {
    const [err, dto] = SimularCostoDto.create(base);
    expect(err).toBeUndefined();
    expect(dto?.datos.pasajeros).toBe(10);
  });

  it.each([
    [{ pasajeros: 0 }, "pasajeros es requerido y debe ser un número entero entre 1 y 100."],
    [{ pasajeros: 101 }, "pasajeros es requerido y debe ser un número entero entre 1 y 100."],
    [{ nochesPrevias: -1 }, "nochesPrevias debe ser un número entero entre 0 y 30."],
    [{ nochesPosteriores: 31 }, "nochesPosteriores debe ser un número entero entre 0 y 30."],
    [{ localidadGarantizada: "   " }, "localidadGarantizada es obligatoria."],
    [{ equipo: [{ idservicio: 5, cantidad: 0, cadaPasajeros: 2 }] }, "equipo[0]: cantidad y cadaPasajeros deben ser enteros entre 1 y 100."],
    [{ equipo: [{ idservicio: 5, cantidad: 1, cadaPasajeros: 2 }, { idservicio: 5, cantidad: 2, cadaPasajeros: 2 }] }, "equipo repite el servicio 5."],
  ])("rechaza %o", (cambio, mensaje) => {
    const [err] = SimularCostoDto.create({ ...base, ...cambio });
    expect(err).toBe(mensaje);
  });
});

describe("simularCostoPaquete (B5 — integración con servicios)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("por categoría elige el hotel más caro de los que cumplen", async () => {
    dbMock.servicioBase.findMany.mockResolvedValue([
      { idservicio: 11, nombreServicio: "Hotel Caro", costoBase: 120 },
    ]);
    dbMock.servicioBase.findUnique.mockResolvedValue({
      idservicio: 20,
      nombreServicio: "Minibus",
      costoBase: 400,
      estado: "ACTIVO",
      proveedor: { estado: "ACTIVO" },
      transporte: { idservicio: 20 },
    });

    const r = await simularCostoPaquete({
      tipoGarantia: "POR_CATEGORIA",
      localidadGarantizada: "Cusco",
      categoriaGarantizada: "3 Estrellas",
      tipoHabitacionGarantizada: "Doble",
      nochesPrevias: 1,
      nochesPosteriores: 1,
      idtransporte: 20,
      pasajeros: 10,
    });

    expect(r.costoPorPasajero).toBe(280); // 120*2 + 400/10
    expect(r.desglose[0]?.idservicio).toBe(11);
    expect(r.avisos).toEqual([]);
  });

  it("avisa si ningún hotel cumple la categoría en la localidad", async () => {
    dbMock.servicioBase.findMany.mockResolvedValue([]);

    const r = await simularCostoPaquete({
      tipoGarantia: "POR_CATEGORIA",
      localidadGarantizada: "Cusco",
      categoriaGarantizada: "5 Estrellas",
      tipoHabitacionGarantizada: "Suite",
      nochesPrevias: 2,
      nochesPosteriores: 0,
      pasajeros: 8,
    });

    expect(r.costoPorPasajero).toBe(0);
    expect(r.avisos[0]).toContain("Ningún hotel de Cusco cumple 5 Estrellas · Suite");
  });

  it("rechaza con 400 si el transporte indicado no es de tipo TRANSPORTE", async () => {
    dbMock.servicioBase.findUnique.mockResolvedValue({
      idservicio: 12,
      nombreServicio: "IncaRail",
      costoBase: 80,
      estado: "ACTIVO",
      proveedor: { estado: "ACTIVO" },
      transporte: null,
      tren: { idservicio: 12 },
    });

    await expect(
      simularCostoPaquete({
        tipoGarantia: "POR_CATEGORIA",
        localidadGarantizada: "Cusco",
        nochesPrevias: 0,
        nochesPosteriores: 0,
        idtransporte: 12,
        pasajeros: 10,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "El servicio con ID 12 no es un transporte.",
    });
  });

  it("rechaza con 400 si el servicio no existe o está inactivo", async () => {
    dbMock.servicioBase.findUnique.mockResolvedValue(null);

    await expect(
      simularCostoPaquete({
        tipoGarantia: "POR_CATEGORIA",
        localidadGarantizada: "Cusco",
        nochesPrevias: 0,
        nochesPosteriores: 0,
        idtren: 99,
        pasajeros: 10,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "El servicio con ID 99 no existe o no está activo.",
    });
  });
});
