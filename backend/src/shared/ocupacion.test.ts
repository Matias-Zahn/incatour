import { describe, expect, it } from "vitest";
import { disponibleEnRango, ocupadoPorDia, rangosDe, totalDe } from "./ocupacion";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const oc = (desde: string, hasta: string, cantidad: number) => ({ desde: d(desde), hasta: d(hasta), cantidad });

describe("ocupadoPorDia y disponibleEnRango", () => {
  it("una salida que termina el día que empieza la otra se superpone ese día (el hasta es inclusive)", () => {
    expect(disponibleEnRango(30, [oc("2026-03-01", "2026-03-05", 20)], d("2026-03-05"), d("2026-03-08"))).toBe(10);
  });
  it("si empieza el día siguiente no se superpone", () => {
    expect(disponibleEnRango(30, [oc("2026-03-01", "2026-03-05", 20)], d("2026-03-06"), d("2026-03-08"))).toBe(30);
  });
  it("resta el máximo diario, no la suma de las ocupaciones", () => {
    const ocupaciones = [oc("2026-03-01", "2026-03-03", 10), oc("2026-03-04", "2026-03-06", 15), oc("2026-03-03", "2026-03-04", 5)];
    expect([...ocupadoPorDia(ocupaciones, d("2026-03-01"), d("2026-03-06")).values()]).toEqual([10, 10, 15, 20, 15, 15]);
    expect(disponibleEnRango(30, ocupaciones, d("2026-03-01"), d("2026-03-06"))).toBe(10);
  });
  it("sin ocupaciones queda todo el total", () => {
    expect(disponibleEnRango(30, [], d("2026-03-01"), d("2026-03-02"))).toBe(30);
  });
});

describe("rangosDe", () => {
  const salida = { fechaInicio: d("2026-03-10"), fechaFin: d("2026-03-13") };

  it("alojamiento: noches previas y posteriores en dos tramos, sin los días del trekking", () => {
    expect(rangosDe("ALOJAMIENTO", salida, { nochesPrevias: 2, nochesPosteriores: 1 })).toEqual([
      { desde: d("2026-03-08"), hasta: d("2026-03-09") },
      { desde: d("2026-03-13"), hasta: d("2026-03-13") },
    ]);
  });
  it("alojamiento sin noches: no ocupa nada", () => {
    expect(rangosDe("ALOJAMIENTO", salida, { nochesPrevias: 0, nochesPosteriores: 0 })).toEqual([]);
  });
  it("transporte: del inicio al fin", () => {
    expect(rangosDe("TRANSPORTE", salida, { nochesPrevias: 2, nochesPosteriores: 1 })).toEqual([{ desde: d("2026-03-10"), hasta: d("2026-03-13") }]);
  });
  it("equipamiento: suma los 2 días de reacondicionamiento", () => {
    expect(rangosDe("EQUIPAMIENTO", salida, { nochesPrevias: 0, nochesPosteriores: 0 })).toEqual([{ desde: d("2026-03-10"), hasta: d("2026-03-15") }]);
  });
});

describe("totalDe", () => {
  it("plazas, unidades o un vehículo", () => {
    expect(totalDe({ alojamiento: { plazasTotales: 20 } })).toBe(20);
    expect(totalDe({ alojamiento: { plazasTotales: null } })).toBe(0);
    expect(totalDe({ equipamiento: { cantidadTotal: 30 } })).toBe(30);
    expect(totalDe({ transporte: { capacidadVehiculo: 19 } })).toBe(1);
  });
});
