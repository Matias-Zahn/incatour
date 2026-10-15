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
});
