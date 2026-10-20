import { describe, it, expect } from "vitest";
import { ConsultarSalidasDto, CrearSalidaDto } from "./salida.dto";

describe("ConsultarSalidasDto", () => {
  it("sin filtros es válido y deja todo sin definir", () => {
    const [error, dto] = ConsultarSalidasDto.create({});

    expect(error).toBeUndefined();
    expect(dto).toMatchObject({ idpaquete: undefined, estado: undefined, idguia: undefined });
  });

  it("convierte los textos de la URL a número y fecha", () => {
    const [, dto] = ConsultarSalidasDto.create({ idpaquete: "2", desde: "2026-11-01", idguia: "5" });

    expect(dto?.idpaquete).toBe(2);
    expect(dto?.idguia).toBe(5);
    expect(dto?.desde).toEqual(new Date("2026-11-01"));
  });

  it("rechaza números y fechas inválidos", () => {
    expect(ConsultarSalidasDto.create({ idpaquete: "abc" })[0]).toMatch("idpaquete");
    expect(ConsultarSalidasDto.create({ desde: "ayer" })[0]).toMatch("desde");
  });

  it("rechaza un rango con desde posterior a hasta", () => {
    const [error] = ConsultarSalidasDto.create({ desde: "2026-12-01", hasta: "2026-11-01" });

    expect(error).toBe("desde no puede ser posterior a hasta");
  });
});

describe("CrearSalidaDto", () => {
  const base = { idpaquete: 1, tamanoMaximo: 10 };

  it("usa solo el día de fechaInicio, sin correrlo por la hora ni la zona", () => {
    const [error, dto] = CrearSalidaDto.create({ ...base, fechaInicio: "2026-11-15T20:00:00-05:00" });

    expect(error).toBeUndefined();
    expect(dto?.fechaInicio.toISOString().slice(0, 10)).toBe("2026-11-15");
  });

  it("rechaza fechas que no empiezan con AAAA-MM-DD", () => {
    expect(CrearSalidaDto.create({ ...base, fechaInicio: "abc" })[0]).toMatch("fechaInicio");
    expect(CrearSalidaDto.create({ ...base, fechaInicio: 1763000000000 })[0]).toMatch("fechaInicio");
  });
});
