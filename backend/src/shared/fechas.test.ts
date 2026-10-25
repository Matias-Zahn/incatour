import { describe, it, expect, vi, afterEach } from "vitest";
import { hoyUTC, finDelDiaUTC } from "./fechas";

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

describe("finDelDiaUTC (BE-05)", () => {
  it("lleva una fecha date-only a las 23:59:59.999Z", () => {
    expect(finDelDiaUTC(new Date("2026-10-25"))).toEqual(new Date("2026-10-25T23:59:59.999Z"));
  });
  it("respeta una fecha que ya trae hora", () => {
    expect(finDelDiaUTC(new Date("2026-10-25T10:00:00Z"))).toEqual(new Date("2026-10-25T10:00:00Z"));
  });
});
