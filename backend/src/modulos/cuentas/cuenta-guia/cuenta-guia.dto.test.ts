import { describe, it, expect } from "vitest";
import { CrearCuentaGuiaDto, FiltrosCuentaGuiaDto, ModificarCuentaGuiaDto } from "./cuenta-guia.dto";

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

describe("CU-45: CrearCuentaGuiaDto", () => {
  it("crea DTO válido con datos correctos", () => {
    const [error, dto] = CrearCuentaGuiaDto.create({
      idpersonal: 1,
      email: "  guia.nuevo@incatour.com ",
      contrasenia: "contraseniaValida123",
      nroHabilitacion: "HAB-01",
      fechaHabilitacion: "2028-10-10",
    });

    expect(error).toBeUndefined();
    expect(dto).toBeDefined();
    expect(dto?.idpersonal).toBe(1);
    expect(dto?.email).toBe("guia.nuevo@incatour.com");
    expect(dto?.contrasenia).toBe("contraseniaValida123");
  });

  it("rechaza idpersonal inválido", () => {
    const [err] = CrearCuentaGuiaDto.create({
      idpersonal: 0,
      email: "test@incatour.com",
      contrasenia: "12345678",
    });
    expect(err).toMatch("idpersonal debe ser un número entero positivo");
  });

  it("rechaza contraseñas cortas", () => {
    const [err] = CrearCuentaGuiaDto.create({
      idpersonal: 1,
      email: "test@incatour.com",
      contrasenia: "1234",
    });
    expect(err).toMatch("como mínimo 8 caracteres");
  });
});

describe("ModificarCuentaGuiaDto", () => {
  it("acepta actualización parcial", () => {
    const [error, dto] = ModificarCuentaGuiaDto.create({
      nombre: "Carlos Alberto",
      email: "carlos.nuevo@incatour.com",
    });

    expect(error).toBeUndefined();
    expect(dto?.nombre).toBe("Carlos Alberto");
    expect(dto?.email).toBe("carlos.nuevo@incatour.com");
  });

  it("rechaza el estado: la baja tiene su propio endpoint (CTA-03)", () => {
    const [err] = ModificarCuentaGuiaDto.create({ nombre: "Carlos", estado: "INACTIVO" });
    expect(err).toMatch("El estado se cambia con la baja");
  });

  it("un nroHabilitacion vacío no se envía (CTA-13)", () => {
    const [error, dto] = ModificarCuentaGuiaDto.create({ nroHabilitacion: "  ", nombre: "Ana" });

    expect(error).toBeUndefined();
    expect(dto?.nroHabilitacion).toBeUndefined();
  });

  it("rechaza si el body está vacío", () => {
    const [err] = ModificarCuentaGuiaDto.create({});
    expect(err).toMatch("No se envió ningún dato para modificar");
  });
});
