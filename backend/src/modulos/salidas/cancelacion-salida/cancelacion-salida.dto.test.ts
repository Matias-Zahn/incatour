import { describe, it, expect } from "vitest";
import { CancelarSalidaDto } from "./cancelacion-salida.dto";

describe("CU-37: CancelarSalidaDto", () => {
  it("valida y recorta el motivo de cancelación obligatorio", () => {
    const [error, dto] = CancelarSalidaDto.create({
      motivo: " Cancelación por condiciones meteorológicas adversas ",
    });

    expect(error).toBeUndefined();
    expect(dto?.motivo).toBe("Cancelación por condiciones meteorológicas adversas");
  });

  it("rechaza si falta el motivo o es muy corto", () => {
    const [errVacio] = CancelarSalidaDto.create({});
    expect(errVacio).toBe("El motivo de la cancelación es requerido.");

    const [errCorto] = CancelarSalidaDto.create({ motivo: " abc" });
    expect(errCorto).toBe("El motivo debe tener entre 5 y 300 caracteres.");
  });
});
