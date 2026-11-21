import { describe, expect, it } from "vitest";
import { motivoNoApto } from "./aptitud";

const fin = new Date("2026-03-15T00:00:00Z");
const guia = (extra: object = {}) => ({
  rol: "Guía",
  estado: "ACTIVO",
  fechaVencimientoPasaporte: new Date("2030-01-01"),
  guia: { fechaHabilitacion: new Date("2027-01-01"), usuario: { estado: "ACTIVO" } },
  ...extra,
});

describe("motivoNoApto (12.3)", () => {
  it("un guía activo, habilitado, con cuenta y pasaporte vigente es apto", () => {
    expect(motivoNoApto(guia(), fin)).toBeNull();
  });
  it("la habilitación tiene que cubrir hasta el fin", () => {
    const vencida = guia({ guia: { fechaHabilitacion: new Date("2026-03-10T00:00:00Z"), usuario: { estado: "ACTIVO" } } });
    expect(motivoNoApto(vencida, fin)).toBe("la habilitación vence el 10/03/2026");
  });
  it("sin cuenta activa el guía no es apto, el porteador no la necesita", () => {
    expect(motivoNoApto(guia({ guia: { fechaHabilitacion: new Date("2027-01-01"), usuario: null } }), fin)).toMatch("cuenta");
    expect(motivoNoApto({ rol: "Porteador", estado: "ACTIVO", fechaVencimientoPasaporte: new Date("2030-01-01"), guia: null }, fin)).toBeNull();
  });
  it("el pasaporte que vence el último día no alcanza, y la baja va primero", () => {
    expect(motivoNoApto(guia({ fechaVencimientoPasaporte: fin }), fin)).toBe("el pasaporte vence el 15/03/2026");
    expect(motivoNoApto(guia({ estado: "INACTIVO" }), fin)).toBe("está dado de baja");
  });
});
