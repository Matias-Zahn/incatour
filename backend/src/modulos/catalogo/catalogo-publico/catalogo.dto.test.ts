import { describe, it, expect } from "vitest";
import { FiltrosCatalogoDto } from "./catalogo.dto";

describe("FiltrosCatalogoDto (CAT-13)", () => {
  it("acepta filtros válidos y vacíos", () => {
    expect(FiltrosCatalogoDto.create({})[0]).toBeUndefined();
    const [error, dto] = FiltrosCatalogoDto.create({ duracionDias: "4", fechaInicio: "2026-11-01", fechaFin: "2026-11-30", dificultad: "Moderada" });
    expect(error).toBeUndefined();
    expect(dto).toMatchObject({ duracionDias: 4, fechaDesde: "2026-11-01", fechaHasta: "2026-11-30", dificultad: "Moderada" });
  });

  it("rechaza duracionDias no numérico", () => {
    expect(FiltrosCatalogoDto.create({ duracionDias: "abc" })[0]).toBe("duracionDias debe ser un número entero mayor a 0.");
  });

  it("rechaza fechas inválidas", () => {
    expect(FiltrosCatalogoDto.create({ fechaDesde: "foo" })[0]).toContain("fechaDesde no es una fecha válida");
    expect(FiltrosCatalogoDto.create({ fechaFin: "foo" })[0]).toContain("fechaHasta no es una fecha válida");
  });
});
