import { describe, it, expect, vi, afterEach } from "vitest";
import { hoyUTC, finDelDiaLocal, inicioDelDiaLocal } from "./fechas";

afterEach(() => vi.useRealTimers());

describe("hoyUTC (BE-01)", () => {
  it("es el día calendario local a las 00:00Z, sin importar la hora", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 25, 23, 30)); // 25/10 23:30 hora local
    expect(hoyUTC()).toEqual(new Date("2026-10-25T00:00:00Z"));
    vi.setSystemTime(new Date(2026, 9, 25, 0, 5));
    expect(hoyUTC()).toEqual(new Date("2026-10-25T00:00:00Z"));
  });
});

describe("finDelDiaLocal / inicioDelDiaLocal (RES-12/BE-05)", () => {
  it("una fecha date-only va al fin del día calendario local", () => {
    const f = finDelDiaLocal(new Date("2026-10-25"));
    expect([f.getFullYear(), f.getMonth(), f.getDate()]).toEqual([2026, 9, 25]);
    expect([f.getHours(), f.getMinutes(), f.getSeconds(), f.getMilliseconds()]).toEqual([23, 59, 59, 999]);
  });
  it("una fecha date-only va al inicio del día calendario local", () => {
    const f = inicioDelDiaLocal(new Date("2026-10-25"));
    expect([f.getFullYear(), f.getMonth(), f.getDate()]).toEqual([2026, 9, 25]);
    expect([f.getHours(), f.getMinutes(), f.getSeconds(), f.getMilliseconds()]).toEqual([0, 0, 0, 0]);
  });
  it("respeta una fecha que ya trae hora", () => {
    expect(finDelDiaLocal(new Date("2026-10-25T10:00:00Z"))).toEqual(new Date("2026-10-25T10:00:00Z"));
    expect(inicioDelDiaLocal(new Date("2026-10-25T10:00:00Z"))).toEqual(new Date("2026-10-25T10:00:00Z"));
  });
});
