import { describe, it, expect } from "vitest";
import { ResolverSolicitudDto } from "./solicitud.dto";

describe("ResolverSolicitudDto (CU-34)", () => {
  it("acepta una resolución ACEPTADA sin motivo", () => {
    const [error, dto] = ResolverSolicitudDto.create({ servicioId: 40, resolucion: "ACEPTADA" });

    expect(error).toBeUndefined();
    expect(dto).toMatchObject({ servicioId: 40, resolucion: "ACEPTADA" });
  });

  it("acepta una resolución RECHAZADA con motivo", () => {
    expect(ResolverSolicitudDto.create({ servicioId: 40, resolucion: "RECHAZADA", motivo: "Sin cupo" })[0]).toBeUndefined();
  });

  it.each([
    [{ resolucion: "ACEPTADA" }, "El servicioId es requerido y debe ser un número entero"],
    [{ servicioId: "40", resolucion: "ACEPTADA" }, "El servicioId es requerido y debe ser un número entero"],
    [{ servicioId: 1.5, resolucion: "ACEPTADA" }, "El servicioId es requerido y debe ser un número entero"],
    [{ servicioId: 40, resolucion: "QUIZAS" }, "La resolución debe ser 'ACEPTADA' o 'RECHAZADA'"],
    [{ servicioId: 40, resolucion: "RECHAZADA" }, "El motivo es obligatorio cuando la resolución es RECHAZADA"],
    [{ servicioId: 40, resolucion: "RECHAZADA", motivo: "   " }, "El motivo es obligatorio cuando la resolución es RECHAZADA"],
  ])("rechaza %o", (obj, mensaje) => {
    expect(ResolverSolicitudDto.create(obj)[0]).toBe(mensaje);
  });
});
