import { describe, it, expect } from "vitest";
import { ConsultarPersonalDto } from "./personal.dto";

describe("ConsultarPersonalDto", () => {
  it("sin filtros es válido", () => {
    const [error, dto] = ConsultarPersonalDto.create({});

    expect(error).toBeUndefined();
    expect(dto).toMatchObject({ rol: undefined, estado: undefined, habilitacionVigente: undefined });
  });

  it("convierte habilitacionVigente de texto a booleano", () => {
    expect(ConsultarPersonalDto.create({ habilitacionVigente: "true" })[1]?.habilitacionVigente).toBe(true);
    expect(ConsultarPersonalDto.create({ habilitacionVigente: "false" })[1]?.habilitacionVigente).toBe(false);
  });

  it("rechaza valores fuera de los permitidos", () => {
    expect(ConsultarPersonalDto.create({ rol: "Cocinero" })[0]).toMatch("rol");
    expect(ConsultarPersonalDto.create({ estado: "BORRADO" })[0]).toMatch("estado");
    expect(ConsultarPersonalDto.create({ habilitacionVigente: "si" })[0]).toMatch("habilitacionVigente");
  });
});
