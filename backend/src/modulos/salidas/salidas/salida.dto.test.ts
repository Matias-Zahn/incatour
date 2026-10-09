import { describe, it, expect } from "vitest";
import { ConsultarSalidasDto } from "./salida.dto";

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
