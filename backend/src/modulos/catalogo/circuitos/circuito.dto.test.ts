import { describe, it, expect } from "vitest";
import { CrearCircuitoDto, FiltrosCircuitoDto, ModificarCircuitoDto } from "./circuito.dto";

const base = { nombreCircuito: "Camino Inca", duracionDias: 4, dificultad: "Media", minimoGuias: 1 };

describe("CrearCircuitoDto", () => {
  it("acepta un circuito válido, con parametrosPorteadores opcional", () => {
    const [error, dto] = CrearCircuitoDto.create({ ...base, parametrosPorteadores: "1 cada 2" });

    expect(error).toBeUndefined();
    expect(dto).toMatchObject({ ...base, parametrosPorteadores: "1 cada 2" });
  });

  it("normaliza la dificultad a Baja, Media o Alta sin importar mayúsculas", () => {
    expect(CrearCircuitoDto.create({ ...base, dificultad: "baja" })[1]?.dificultad).toBe("Baja");
    expect(CrearCircuitoDto.create({ ...base, dificultad: "MEDIA" })[1]?.dificultad).toBe("Media");
    expect(CrearCircuitoDto.create({ ...base, dificultad: "Alta" })[1]?.dificultad).toBe("Alta");
  });

  it.each([
    [{ nombreCircuito: undefined }, "nombreCircuito es requerido"],
    [{ nombreCircuito: 5 }, "nombreCircuito debe ser un texto"],
    [{ duracionDias: undefined }, "duracionDias es requerido"],
    [{ duracionDias: 0 }, "duracionDias debe ser un número entero entre 1 y 30"],
    [{ duracionDias: 2.5 }, "duracionDias debe ser un número entero entre 1 y 30"],
    [{ duracionDias: "4" }, "duracionDias debe ser un número entero entre 1 y 30"],
    [{ duracionDias: 31 }, "duracionDias debe ser un número entero entre 1 y 30"],
    [{ minimoGuias: 11 }, "minimoGuias debe ser un número entero entre 1 y 10"],
    [{ dificultad: "" }, "dificultad es requerido"],
    [{ dificultad: "Moderada" }, "dificultad debe ser Baja, Media o Alta"],
    [{ dificultad: "Extrema" }, "dificultad debe ser Baja, Media o Alta"],
    [{ minimoGuias: undefined }, "minimoGuias es requerido"],
    [{ minimoGuias: -1 }, "minimoGuias debe ser un número entero entre 1 y 10"],
    [{ minimoGuias: 1.5 }, "minimoGuias debe ser un número entero entre 1 y 10"],
  ])("rechaza %o", (cambio, mensaje) => {
    expect(CrearCircuitoDto.create({ ...base, ...cambio })[0]).toBe(mensaje);
  });
});

describe("ModificarCircuitoDto", () => {
  it("CAT-20: rechaza textos vacíos o de otro tipo", () => {
    expect(ModificarCircuitoDto.create({ nombreCircuito: "  ", minimoGuias: 2 })[0]).toBe("nombreCircuito es requerido.");
    expect(ModificarCircuitoDto.create({ nombreCircuito: 5 })[0]).toBe("nombreCircuito es requerido.");
    expect(ModificarCircuitoDto.create({ dificultad: "", duracionDias: 3 })[0]).toBe("dificultad es requerido.");
    expect(ModificarCircuitoDto.create({ dificultad: "Moderada" })[0]).toBe("dificultad debe ser Baja, Media o Alta");
  });

  it("exige al menos un campo", () => {
    expect(ModificarCircuitoDto.create({})[0]).toBe("Debe enviar al menos un campo para modificar");
  });

  it("acepta una modificación parcial", () => {
    const [error, dto] = ModificarCircuitoDto.create({ minimoGuias: 2 });

    expect(error).toBeUndefined();
    expect(dto?.minimoGuias).toBe(2);
  });

  it("valida los números enteros cuando vienen (CAT-11)", () => {
    expect(ModificarCircuitoDto.create({ duracionDias: 0 })[0]).toBe("duracionDias debe ser un número entero entre 1 y 30");
    expect(ModificarCircuitoDto.create({ duracionDias: 2.5 })[0]).toBe("duracionDias debe ser un número entero entre 1 y 30");
    expect(ModificarCircuitoDto.create({ minimoGuias: 0 })[0]).toBe("minimoGuias debe ser un número entero entre 1 y 10");
    expect(ModificarCircuitoDto.create({ minimoGuias: 1.5 })[0]).toBe("minimoGuias debe ser un número entero entre 1 y 10");
    // CAT-11: null explícito no es "sin cambio" (terminaba en 500 de Prisma)
    expect(ModificarCircuitoDto.create({ duracionDias: null })[0]).toBe("duracionDias debe ser un número entero entre 1 y 30");
    expect(ModificarCircuitoDto.create({ nombreCircuito: "X", minimoGuias: null })[0]).toBe("minimoGuias debe ser un número entero entre 1 y 10");
  });
});

describe("FiltrosCircuitoDto (CAT-13)", () => {
  it("acepta filtros válidos y vacíos", () => {
    expect(FiltrosCircuitoDto.create({})[0]).toBeUndefined();
    expect(FiltrosCircuitoDto.create({ duracionDias: "4" })[1]?.duracionDias).toBe(4);
  });

  it.each(["abc", "0", "-1", "1.5"])("duracionDias=%s es inválido", (v) => {
    expect(FiltrosCircuitoDto.create({ duracionDias: v })[0]).toBe("duracionDias debe ser un número entero mayor a 0.");
  });
});
