import { describe, it, expect } from "vitest";
import { calcularDotacion } from "./salida.dotacion";

describe("calcularDotacion", () => {
  it("calcula guías y porteadores redondeando hacia arriba", () => {
    expect(calcularDotacion(2, "1 por cada 2 pasajeros", 16)).toEqual({ guias: 2, porteadores: 8 });
    expect(calcularDotacion(2, "1 por cada 2 pasajeros", 15)).toEqual({ guias: 2, porteadores: 8 });
    expect(calcularDotacion(1, "3 por cada 4 pasajeros", 10)).toEqual({ guias: 1, porteadores: 9 });
  });

  it("devuelve null si el circuito no tiene parámetros válidos", () => {
    expect(calcularDotacion(2, null, 16)).toBeNull();
    expect(calcularDotacion(2, "muchos", 16)).toBeNull();
    expect(calcularDotacion(0, "1 por cada 2 pasajeros", 16)).toBeNull();
  });
});
