import { describe, it, expect } from "vitest";
import { CrearTemporadaDto, ModificarTemporadaDto } from "./temporada.dto";

const base = { nombre: "Alta 2030", fechaInicio: "2030-05-01", fechaFin: "2030-09-30" };

describe("CrearTemporadaDto", () => {
  it("acepta una temporada válida y convierte las fechas a Date", () => {
    const [error, dto] = CrearTemporadaDto.create(base);

    expect(error).toBeUndefined();
    expect(dto?.fechaInicio).toBeInstanceOf(Date);
    expect(dto?.fechaFin.toISOString().slice(0, 10)).toBe("2030-09-30");
  });

  it.each([
    [{ nombre: undefined }, "nombre es requerido y debe ser texto"],
    [{ fechaInicio: undefined }, "fechaInicio es requerida"],
    [{ fechaInicio: "no-fecha" }, "fechaInicio no es una fecha válida"],
    [{ fechaFin: undefined }, "fechaFin es requerida"],
    [{ fechaFin: "2030-13-45" }, "fechaFin no es una fecha válida"],
    [{ fechaFin: "2030-05-01" }, "fechaInicio debe ser anterior a fechaFin"],
    [{ fechaFin: "2030-01-01" }, "fechaInicio debe ser anterior a fechaFin"],
  ])("rechaza %o", (cambio, mensaje) => {
    expect(CrearTemporadaDto.create({ ...base, ...cambio })[0]).toBe(mensaje);
  });
});

describe("ModificarTemporadaDto", () => {
  it("exige al menos un campo", () => {
    expect(ModificarTemporadaDto.create({})[0]).toBe("Debe enviar al menos un campo para modificar");
  });

  it("acepta una sola fecha (la coherencia con la guardada la valida el servicio)", () => {
    const [error, dto] = ModificarTemporadaDto.create({ fechaFin: "2030-10-31" });

    expect(error).toBeUndefined();
    expect(dto?.fechaInicio).toBeUndefined();
  });

  it("valida el orden si vienen las dos fechas", () => {
    expect(ModificarTemporadaDto.create({ fechaInicio: "2030-10-01", fechaFin: "2030-09-01" })[0]).toBe(
      "fechaInicio debe ser anterior a fechaFin"
    );
  });

  it("rechaza fechas inválidas", () => {
    expect(ModificarTemporadaDto.create({ fechaInicio: "xx" })[0]).toBe("fechaInicio no es una fecha válida");
  });
});
