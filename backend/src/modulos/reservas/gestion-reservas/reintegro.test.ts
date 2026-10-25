import { describe, expect, it } from "vitest";
import { calcularReintegro } from "./reintegro";

const AHORA = new Date("2030-06-01T15:30:00Z");
const base = {
  abonado: 1000, rol: "CLIENTE", permisosEmitidos: false, diasMinimos: 15 as number | null,
  fechaInicio: new Date("2030-06-21T00:00:00Z"), ahora: AHORA, // faltan 20 días
};

describe("calcularReintegro (RES-06)", () => {
  it("cliente con anticipación suficiente: 100%", () => {
    expect(calcularReintegro(base)).toMatchObject({ monto: 1000 });
  });

  it("cliente con menos anticipación que el plazo: $0 y condición legible", () => {
    const r = calcularReintegro({ ...base, fechaInicio: new Date("2030-06-06T00:00:00Z") });
    expect(r).toEqual({ monto: 0, condicionAplicada: "Cancelación con 5 días de anticipación (mínimo 15): sin reintegro" });
  });

  it("justo en el plazo (días calendario) reintegra el 100%", () => {
    expect(calcularReintegro({ ...base, fechaInicio: new Date("2030-06-16T00:00:00Z") }).monto).toBe(1000);
  });

  it("permisos emitidos: $0 aunque haya anticipación", () => {
    expect(calcularReintegro({ ...base, permisosEmitidos: true }).monto).toBe(0);
  });

  it("sin plazo en el paquete: 100%", () => {
    expect(calcularReintegro({ ...base, diasMinimos: null, fechaInicio: new Date("2030-06-02T00:00:00Z") }).monto).toBe(1000);
  });

  it("ADMIN: 100% aunque falten pocos días o haya permisos emitidos", () => {
    const r = calcularReintegro({ ...base, rol: "ADMIN", permisosEmitidos: true, fechaInicio: new Date("2030-06-02T00:00:00Z") });
    expect(r.monto).toBe(1000);
    expect(r.condicionAplicada).toContain("administrador");
  });
});
