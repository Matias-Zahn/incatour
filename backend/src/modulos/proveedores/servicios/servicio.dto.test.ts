import { describe, it, expect } from "vitest";
import { CrearServicioDto } from "./servicio.dto";

describe("CU-19: CrearServicioDto", () => {
  it("valida y crea servicio de alojamiento", () => {
    const [error, dto] = CrearServicioDto.create({
      tipo: "ALOJAMIENTO",
      nombreServicio: " Habitación Doble Superior ",
      costoBase: 150.5,
      localidad: " Aguas Calientes ",
      descripcion: " Incluye desayuno buffet ",
      categoria: " 3 Estrellas ",
      tipoHabitacion: " Doble ",
      capacidadDisponible: 12,
      modalidadConfirmacion: "BLOQUEO_PLAZAS",
    });

    expect(error).toBeUndefined();
    expect(dto?.tipo).toBe("ALOJAMIENTO");
    expect(dto?.base.nombreServicio).toBe("Habitación Doble Superior");
    expect(dto?.base.costoBase).toBe(150.5);
    expect(dto?.especifico.capacidadDisponible).toBe(12);
  });

  it("valida servicio de tren y rechaza horarios iguales", () => {
    const [err] = CrearServicioDto.create({
      tipo: "TREN",
      nombreServicio: "IncaRail Voyager",
      costoBase: 80,
      localidad: "Cusco",
      horarioSalida: "08:00",
      horarioLlegada: "08:00",
      diasOperacion: "L-M-X-J-V",
    });

    expect(err).toBe("horarioSalida y horarioLlegada no pueden ser iguales.");
  });

  it("valida servicio de equipamiento", () => {
    const [error, dto] = CrearServicioDto.create({
      tipo: "EQUIPAMIENTO",
      nombreServicio: "Carpa 4 Estaciones",
      costoBase: 25,
      localidad: "Cusco",
      tipoEquipamiento: "Carpa Alta Montaña",
      cantidadDisponible: 20,
    });

    expect(error).toBeUndefined();
    expect(dto?.tipo).toBe("EQUIPAMIENTO");
    expect(dto?.especifico.cantidadDisponible).toBe(20);
  });

  it("rechaza costoBase superior a 10.000.000 de dólares", () => {
    const [error] = CrearServicioDto.create({
      tipo: "TRANSPORTE",
      nombreServicio: "Bus Premium",
      costoBase: 10_000_001,
      localidad: "Cusco",
      capacidadVehiculo: 20,
      pesoEquipajeIncluido: 15,
      costoPorKgExcedente: 5,
    });

    expect(error).toContain("no puede superar el máximo de 10000000");
  });

  it("rechaza pesoEquipajeIncluido superior a 20 kg en transporte", () => {
    const [error] = CrearServicioDto.create({
      tipo: "TRANSPORTE",
      nombreServicio: "Bus Premium",
      costoBase: 500,
      localidad: "Cusco",
      capacidadVehiculo: 20,
      pesoEquipajeIncluido: 21,
      costoPorKgExcedente: 5,
    });

    expect(error).toContain("no puede superar el máximo de 20");
  });

  it("capacidadVehiculo: rechaza 0, negativos y más de 60; acepta 60", () => {
    const transporte = (capacidadVehiculo: number) =>
      CrearServicioDto.create({ tipo: "TRANSPORTE", nombreServicio: "Bus", costoBase: 500, localidad: "Cusco", capacidadVehiculo, pesoEquipajeIncluido: 15, costoPorKgExcedente: 5 })[0];
    expect(transporte(0)).toContain("mayor o igual a 1");
    expect(transporte(-5)).toContain("mayor o igual a 1");
    expect(transporte(61)).toContain("no puede superar el máximo de 60");
    expect(transporte(60)).toBeUndefined();
  });

  it("alojamiento y equipamiento: rechazan plazas o unidades por encima del tope", () => {
    const [e1] = CrearServicioDto.create({ tipo: "ALOJAMIENTO", nombreServicio: "Hotel", costoBase: 50, localidad: "Cusco", categoria: "3 Estrellas", tipoHabitacion: "Doble", capacidadDisponible: 5001, modalidadConfirmacion: "BLOQUEO_PLAZAS" });
    const [e2] = CrearServicioDto.create({ tipo: "EQUIPAMIENTO", nombreServicio: "Carpas", costoBase: 5, localidad: "Cusco", tipoEquipamiento: "Carpa", cantidadDisponible: 10001 });
    expect(e1).toContain("no puede superar el máximo de 5000");
    expect(e2).toContain("no puede superar el máximo de 10000");
  });

  it("acepta pesoEquipajeIncluido de 20 kg y costoBase de 10.000.000", () => {
    const [error, dto] = CrearServicioDto.create({
      tipo: "TRANSPORTE",
      nombreServicio: "Bus Premium",
      costoBase: 10_000_000,
      localidad: "Cusco",
      capacidadVehiculo: 20,
      pesoEquipajeIncluido: 20,
      costoPorKgExcedente: 5,
    });

    expect(error).toBeUndefined();
    expect(dto?.base.costoBase).toBe(10_000_000);
    expect(dto?.especifico.pesoEquipajeIncluido).toBe(20);
  });
});
