import { describe, expect, it } from "vitest";
import { corteDeVenta, datosVenta, diasHabilitados, motivoFechaInvalida, ventaAbierta } from "./ventaAbierta";

const hoy = new Date("2026-11-21"); // sábado
const salida = (fechaInicio: string, estado = "PUBLICADA", diasCierreVenta = 2) => ({ estado, fechaInicio: new Date(fechaInicio), diasCierreVenta });

describe("ventaAbierta", () => {
  it("cierra diasCierreVenta días antes del inicio: abierta hasta fechaInicio − dias − 1", () => {
    expect(ventaAbierta(salida("2026-11-24"), hoy)).toBe(true); // último día: 21/11
    expect(ventaAbierta(salida("2026-11-23"), hoy)).toBe(false);
    expect(datosVenta(salida("2026-11-24"), hoy)).toEqual({ diasCierreVenta: 2, ultimoDiaVenta: "2026-11-21", ventaAbierta: true });
  });

  it("solo una PUBLICADA está a la venta", () => {
    expect(ventaAbierta(salida("2026-12-30", "CERRADA"), hoy)).toBe(false);
  });

  it("con un hotel a solicitud el corte es de al menos 5 días", () => {
    expect(corteDeVenta(2, true)).toBe(5);
    expect(corteDeVenta(7, true)).toBe(7);
    expect(corteDeVenta(2, false)).toBe(2);
  });
});

describe("motivoFechaInvalida", () => {
  const paquete = { diasDisponibles: "L-X-V", diasCierreVenta: 2 };

  it("rechaza un día no habilitado", () => {
    expect(motivoFechaInvalida(new Date("2026-12-01"), paquete, hoy)).toBe("El paquete no sale los martes: los días habilitados son L, X y V");
  });

  it("rechaza un día en que el tren no opera", () => {
    const tren = { nombreServicio: "Expedition", diasOperacion: "L-V" };
    expect(motivoFechaInvalida(new Date("2026-12-02"), { ...paquete, tren }, hoy)).toBe("El tren Expedition no opera los miércoles (opera L-V)");
    expect(diasHabilitados({ ...paquete, tren })).toEqual(["L", "V"]);
  });

  it("exige fechaInicio > hoy + corte (12.6)", () => {
    expect(motivoFechaInvalida(new Date("2026-11-23"), { diasDisponibles: null, diasCierreVenta: 2 }, hoy)).toBe(
      "La salida tiene que empezar después del 23/11/2026: la venta cierra 2 días antes del inicio"
    );
    expect(motivoFechaInvalida(new Date("2026-11-24"), { diasDisponibles: null, diasCierreVenta: 2 }, hoy)).toBeNull();
  });
});
