import { describe, it, expect } from "vitest";
import { FiltrosCuentaGuiaDto } from "./cuenta-guia.dto";

describe("CU-44: FiltrosCuentaGuiaDto", () => {
  it("acepta query vacía sin filtros", () => {
    const [error, dto] = FiltrosCuentaGuiaDto.create({});
    expect(error).toBeUndefined();
    expect(dto?.rol).toBeUndefined();
    expect(dto?.estado).toBeUndefined();
    expect(dto?.habilitacion).toBeUndefined();
    expect(dto?.busqueda).toBeUndefined();
  });

  it("acepta y recorta búsqueda válida", () => {
    const [error, dto] = FiltrosCuentaGuiaDto.create({
      rol: "GUIA",
      estado: "ACTIVO",
      habilitacion: "VIGENTE",
      busqueda: "  Mamani  ",
    });

    expect(error).toBeUndefined();
    expect(dto?.rol).toBe("GUIA");
    expect(dto?.estado).toBe("ACTIVO");
    expect(dto?.habilitacion).toBe("VIGENTE");
    expect(dto?.busqueda).toBe("Mamani");
  });

  it("rechaza roles o estados no permitidos", () => {
    const [errRol] = FiltrosCuentaGuiaDto.create({ rol: "ADMIN" });
    expect(errRol).toMatch("rol debe ser uno de: GUIA");

    const [errEstado] = FiltrosCuentaGuiaDto.create({ estado: "ELIMINADO" });
    expect(errEstado).toMatch("estado debe ser uno de: ACTIVO, INACTIVO");

    const [errHab] = FiltrosCuentaGuiaDto.create({ habilitacion: "CADUCADA" });
    expect(errHab).toMatch("habilitacion debe ser uno de: VIGENTE, VENCIDA");
  });
});
