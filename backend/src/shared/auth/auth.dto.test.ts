import { describe, it, expect } from "vitest";
import { LoginDto } from "./auth.dto";

describe("CU-00: LoginDto", () => {
  it("valida y normaliza credenciales válidas", () => {
    const [error, dto] = LoginDto.create({
      email: "  ADMIN@INCATOUR.COM ",
      contrasenia: "Password123",
    });

    expect(error).toBeUndefined();
    expect(dto).toBeDefined();
    expect(dto?.email).toBe("admin@incatour.com");
    expect(dto?.contrasenia).toBe("Password123");
  });

  it("rechaza si falta el email o no es texto", () => {
    const [err1] = LoginDto.create({ contrasenia: "12345678" });
    expect(err1).toBe("El email es requerido");

    const [err2] = LoginDto.create({ email: 12345, contrasenia: "12345678" });
    expect(err2).toBe("El email es requerido");
  });

  it("rechaza si falta la contraseña o no es texto", () => {
    const [err] = LoginDto.create({ email: "test@incatour.com" });
    expect(err).toBe("La contraseña es requerida");
  });
});
