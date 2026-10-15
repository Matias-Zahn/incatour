import { describe, it, expect } from "vitest";
import { CancelarReservaDto, FiltrosMisReservasDto, FiltrosReservaDto } from "./gestion-reserva.dto";

describe("CU-32: CancelarReservaDto", () => {
  it("acepta cancelación con o sin motivo", () => {
    const [e1, d1] = CancelarReservaDto.create({});
    expect(e1).toBeUndefined();
    expect(d1?.motivo).toBeNull();

    const [e2, d2] = CancelarReservaDto.create({ motivo: " Viaje pospuesto por motivos personales " });
    expect(e2).toBeUndefined();
    expect(d2?.motivo).toBe("Viaje pospuesto por motivos personales");
  });

  it("rechaza motivos excesivamente largos", () => {
    const textoLargo = "a".repeat(301);
    const [err] = CancelarReservaDto.create({ motivo: textoLargo });
    expect(err).toBe("motivo debe ser un texto de hasta 300 caracteres.");
  });
});

describe("CU-31: Filtros de reservas", () => {
  it("valida filtros de mis reservas", () => {
    const [e, d] = FiltrosMisReservasDto.create({ estado: "CONFIRMADA" });
    expect(e).toBeUndefined();
    expect(d?.estado).toBe("CONFIRMADA");

    const [err] = FiltrosMisReservasDto.create({ estado: "ESTADO_INEXISTENTE" });
    expect(err).toMatch("estado debe ser uno de");
  });

  it("valida filtros de admin", () => {
    const [error, dto] = FiltrosReservaDto.create({
      titular: " Perez ",
      limite: "25",
    });
    expect(error).toBeUndefined();
    expect(dto?.titular).toBe("Perez");
    expect(dto?.limite).toBe(25);
  });
});
