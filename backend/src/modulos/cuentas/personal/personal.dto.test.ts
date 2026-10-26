import { describe, it, expect } from "vitest";
import { ConsultarPersonalDto, CrearPersonalDto, ModificarPersonalDto } from "./personal.dto";

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

describe("CrearPersonalDto", () => {
  const guia = (email: string) => ({
    nombre: "Ana", apellido: "Quispe", nroPasaporte: "P123", nacionalidad: "Peruana",
    fechaVencimientoPasaporte: "2030-01-01", rolOperativo: "Guía", email,
    contrasenia: "clave1234", nroHabilitacion: "H-1", fechaHabilitacion: "2030-01-01",
  });

  it("rechaza un pasaporte con solo espacios (CTA-14)", () => {
    expect(CrearPersonalDto.create({ ...guia("a@b.com"), nroPasaporte: "   " })[0]).toBe("El número de pasaporte es requerido");
  });

  it("rechaza un email de guía sin formato de correo (CTA-05)", () => {
    expect(CrearPersonalDto.create(guia("abc"))[0]).toBeDefined();
  });

  it("normaliza el email del guía", () => {
    const [error, dto] = CrearPersonalDto.create(guia(" Ana@Mail.com "));
    expect(error).toBeUndefined();
    expect(dto?.email).toBe("ana@mail.com");
  });

  it("email y contraseña son opcionales pero van juntos (CTA-03)", () => {
    const { email: _e, contrasenia: _c, ...sinCuenta } = guia("x") as any;
    const [error, dto] = CrearPersonalDto.create(sinCuenta);
    expect(error).toBeUndefined();
    expect(dto?.email).toBeUndefined();
    expect(dto?.contrasenia).toBeUndefined();
    expect(CrearPersonalDto.create({ ...sinCuenta, email: "a@b.com" })[0]).toMatch("contraseña es requerida");
    expect(CrearPersonalDto.create({ ...sinCuenta, contrasenia: "clave1234" })[0]).toMatch("email es requerido");
  });

  it("la habilitación sigue siendo obligatoria para un guía sin cuenta", () => {
    const { email: _e, contrasenia: _c, nroHabilitacion: _n, ...datos } = guia("x") as any;
    expect(CrearPersonalDto.create(datos)[0]).toMatch("habilitación");
  });
});
