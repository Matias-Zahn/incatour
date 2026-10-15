import { describe, it, expect } from "vitest";
import { CrearClienteDto, ModificarClienteDto } from "./cliente.dto";

describe("CU-27: CrearClienteDto", () => {
  it("crea DTO válido normalizando email y recortando espacios", () => {
    const [error, dto] = CrearClienteDto.create({
      email: "  Juan.Perez@GMAIL.COM  ",
      contrasenia: "contraseniaSegura1",
      nombre: " Juan Carlos ",
      apellido: " Pérez ",
    });

    expect(error).toBeUndefined();
    expect(dto?.email).toBe("juan.perez@gmail.com");
    expect(dto?.nombre).toBe("Juan Carlos");
    expect(dto?.apellido).toBe("Pérez");
  });

  it("rechaza emails con formato inválido", () => {
    const [err] = CrearClienteDto.create({
      email: "invalido-sin-arroba",
      contrasenia: "password123",
      nombre: "Lucas",
      apellido: "Gomez",
    });
    expect(err).toBe("El formato del correo electrónico no es válido");
  });

  it("rechaza contraseñas con menos de 8 caracteres", () => {
    const [err] = CrearClienteDto.create({
      email: "lucas@incatour.com",
      contrasenia: "1234567",
      nombre: "Lucas",
      apellido: "Gomez",
    });
    expect(err).toBe("La contraseña debe tener como mínimo 8 caracteres");
  });

  it("rechaza nombres o apellidos con números o caracteres extraños", () => {
    const [err1] = CrearClienteDto.create({
      email: "lucas@incatour.com",
      contrasenia: "12345678",
      nombre: "Lucas 123",
      apellido: "Gomez",
    });
    expect(err1).toBe("El nombre solo puede contener letras y espacios");

    const [err2] = CrearClienteDto.create({
      email: "lucas@incatour.com",
      contrasenia: "12345678",
      nombre: "Lucas",
      apellido: "Gomez$$",
    });
    expect(err2).toBe("El apellido solo puede contener letras y espacios");
  });
});

describe("CU-28: ModificarClienteDto", () => {
  it("acepta modificación parcial válida", () => {
    const [error, dto] = ModificarClienteDto.create({
      nombre: " Carlos ",
    });
    expect(error).toBeUndefined();
    expect(dto?.nombre).toBe("Carlos");
    expect(dto?.apellido).toBeUndefined();
    expect(dto?.email).toBeUndefined();
  });

  it("rechaza si no se envía ningún campo para modificar", () => {
    const [err] = ModificarClienteDto.create({});
    expect(err).toBe("Debe proporcionar al menos un campo para modificar (nombre, apellido o email)");
  });
});
