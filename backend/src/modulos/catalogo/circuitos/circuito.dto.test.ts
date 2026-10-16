import { describe, it, expect } from "vitest";
import { CrearCircuitoDto, ModificarCircuitoDto } from "./circuito.dto";

const base = { nombreCircuito: "Camino Inca", duracionDias: 4, dificultad: "MEDIA", minimoGuias: 1 };

describe("CrearCircuitoDto", () => {
  it("acepta un circuito válido, con parametrosPorteadores opcional", () => {
    const [error, dto] = CrearCircuitoDto.create({ ...base, parametrosPorteadores: "1 cada 2" });

    expect(error).toBeUndefined();
    expect(dto).toMatchObject({ ...base, parametrosPorteadores: "1 cada 2" });
  });

  it.each([
    [{ nombreCircuito: undefined }, "nombreCircuito es requerido"],
    [{ nombreCircuito: 5 }, "nombreCircuito debe ser un texto"],
    [{ duracionDias: undefined }, "duracionDias es requerido"],
    [{ duracionDias: 0 }, "duracionDias debe ser un número mayor a 0"],
    [{ duracionDias: "4" }, "duracionDias debe ser un número mayor a 0"],
    [{ dificultad: "" }, "dificultad es requerido"],
    [{ minimoGuias: undefined }, "minimoGuias es requerido"],
    [{ minimoGuias: -1 }, "minimoGuias debe ser un número mayor a 0"],
  ])("rechaza %o", (cambio, mensaje) => {
    expect(CrearCircuitoDto.create({ ...base, ...cambio })[0]).toBe(mensaje);
  });
});

describe("ModificarCircuitoDto", () => {
  it("exige al menos un campo", () => {
    expect(ModificarCircuitoDto.create({})[0]).toBe("Debe enviar al menos un campo para modificar");
  });

  it("acepta una modificación parcial", () => {
    const [error, dto] = ModificarCircuitoDto.create({ minimoGuias: 2 });

    expect(error).toBeUndefined();
    expect(dto?.minimoGuias).toBe(2);
  });

  it("valida los números cuando vienen", () => {
    expect(ModificarCircuitoDto.create({ duracionDias: 0 })[0]).toBe("duracionDias debe ser un número mayor a 0");
    expect(ModificarCircuitoDto.create({ minimoGuias: 0 })[0]).toBe("minimoGuias debe ser un número mayor a 0");
  });
});
