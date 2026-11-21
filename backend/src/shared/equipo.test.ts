import { describe, expect, it } from "vitest";
import { controlEquipo, demandaProyectada, necesidad, tamanoQueAlcanza } from "./equipo";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const carpa = { idservicio: 7, nombreServicio: "Carpa", cantidad: 1, cadaPasajeros: 2 };
const salida = { idsalida: 1, fechaInicio: d("2026-03-10"), fechaFin: d("2026-03-13"), tamanoMaximo: 8 };
const fila = (idsalida: number, cantidad: number, proyectada = cantidad) => ({ idsalida, idservicio: 7, desde: d("2026-03-10"), hasta: d("2026-03-15"), cantidad, proyectada });

describe("equipo (B4, 12.1, A2b)", () => {
  it("1 carpa cada 2: tres pasajeros llevan 2 carpas, no 3", () => {
    expect(necesidad(3, carpa)).toBe(2);
    expect(tamanoQueAlcanza(3, carpa)).toBe(6);
  });
  it("una salida publicada proyecta lo de vendida completa; una confirmada, lo ocupado", () => {
    const definicionPaquete = { servicios: [{ ...carpa, tipo: "EQUIPAMIENTO" }] };
    expect(demandaProyectada({ idservicio: 7, cantidad: 1, salida: { estado: "PUBLICADA", tamanoMaximo: 8, definicionPaquete } })).toBe(4);
    expect(demandaProyectada({ idservicio: 7, cantidad: 1, salida: { estado: "CERRADA", tamanoMaximo: 8, definicionPaquete } })).toBe(1);
  });
  it("nivel contra lo libre de las otras: OK, RIESGO (50 a 100 %) y NO_ALCANZA", () => {
    expect(controlEquipo(carpa, 10, [fila(2, 2, 6)], salida, 0).nivel).toBe("OK"); // libre 4, necesita 4
    expect(controlEquipo(carpa, 8, [fila(2, 2, 6)], salida, 0)).toMatchObject({ nivel: "RIESGO", libre: 2, fechaCritica: "2026-03-10" });
    expect(controlEquipo(carpa, 7, [fila(2, 2, 6)], salida, 0).nivel).toBe("NO_ALCANZA");
  });
  it("falta cuando lo ocupado de todas supera el total, hasta lo que ocupa ésta", () => {
    expect(controlEquipo(carpa, 3, [fila(1, 2), fila(2, 2)], salida, 3)).toMatchObject({ necesita: 2, ocupado: 2, falta: 1 });
    expect(controlEquipo(carpa, 10, [fila(1, 2)], salida, 3).falta).toBe(0);
  });
});
