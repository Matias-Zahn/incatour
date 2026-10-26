import { describe, expect, it } from "vitest";
import { leerIdUrl } from "./validaciones";

describe("leerIdUrl (INF-04)", () => {
  it("acepta un id de solo dígitos dentro del rango de un INT4", () => {
    expect(leerIdUrl("12")).toBe(12);
    expect(leerIdUrl("2147483647")).toBe(2147483647);
  });

  it.each(["12abc", "1.5", "-1", "0", "", "2147483648", "99999999999", undefined])("rechaza %o con 400", (valor) => {
    expect(() => leerIdUrl(valor)).toThrow(expect.objectContaining({ statusCode: 400 }));
  });
});
