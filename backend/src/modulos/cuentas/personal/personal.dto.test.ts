import { describe, it, expect } from "vitest";
import { ConsultarPersonalDto, ModificarPersonalDto } from "./personal.dto";

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

describe("ModificarPersonalDto", () => {
  it("acepta una modificación parcial y convierte las fechas", () => {
    const [error, dto] = ModificarPersonalDto.create({ nacionalidad: " Peruana ", fechaHabilitacion: "2030-01-01" });

    expect(error).toBeUndefined();
    expect(dto?.nacionalidad).toBe("Peruana");
    expect(dto?.fechaHabilitacion).toEqual(new Date("2030-01-01"));
    expect(dto?.modificaHabilitacion).toBe(true);
  });

  it("rechaza un body vacío", () => {
    expect(ModificarPersonalDto.create({})[0]).toBe("No se envió ningún dato para modificar");
  });

  it("no deja cambiar el rol ni el estado", () => {
    expect(ModificarPersonalDto.create({ rol: "Guía" })[0]).toMatch("rol");
    expect(ModificarPersonalDto.create({ estado: "INACTIVO" })[0]).toMatch("CU-25");
  });

  it("rechaza datos inválidos", () => {
    expect(ModificarPersonalDto.create({ nombreCompleto: "Juan 123" })[0]).toMatch("letras");
    expect(ModificarPersonalDto.create({ fechaVencimientoPasaporte: "mañana" })[0]).toMatch("fecha");
  });
});
