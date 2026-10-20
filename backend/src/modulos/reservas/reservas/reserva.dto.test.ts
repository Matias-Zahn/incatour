import { describe, it, expect } from "vitest";
import { CrearReservaDto } from "./reserva.dto";

const pasajero = { nombreCompleto: "Ana Pérez", nroPasaporte: "P1", nacionalidad: "Argentina", fechaVencimientoPasaporte: "2031-01-01" };
const tarjeta = { numero: "4111222233334444", titular: "Ana", vencimiento: "12/30", cvv: "123" };
const base = { idsalida: 7, medioPago: "TARJETA", pasajeros: [pasajero], tarjeta };
const error = (cambio: Record<string, unknown>) => CrearReservaDto.create({ ...base, ...cambio })[0];

describe("CrearReservaDto (CU-30)", () => {
  it("acepta una compra válida; el equipaje es opcional", () => {
    const [err, dto] = CrearReservaDto.create(base);

    expect(err).toBeUndefined();
    expect(dto?.equipaje).toEqual([]);
  });

  it("ignora un idcliente o monto enviados en el body", () => {
    const [, dto] = CrearReservaDto.create({ ...base, idcliente: 999, monto: 1 });

    expect(dto).not.toHaveProperty("idcliente");
    expect(dto).not.toHaveProperty("monto");
  });

  it.each([
    [{ idsalida: "7" }, "idsalida es requerido y debe ser un número entero."],
    [{ idsalida: 7.5 }, "idsalida es requerido y debe ser un número entero."],
    [{ medioPago: undefined }, "medioPago es requerido."],
    [{ pasajeros: [] }, "Debe registrar al menos un pasajero para la reserva."],
    [{ pasajeros: [{ ...pasajero, nombreCompleto: "" }] }, "nombreCompleto es requerido para todos los pasajeros."],
    [{ pasajeros: [{ ...pasajero, nroPasaporte: "" }] }, "nroPasaporte es requerido para todos los pasajeros."],
    [{ pasajeros: [{ ...pasajero, nacionalidad: "" }] }, "nacionalidad es requerido para todos los pasajeros."],
    [{ pasajeros: [{ ...pasajero, fechaVencimientoPasaporte: "" }] }, "fechaVencimientoPasaporte es requerida."],
    [{ pasajeros: [{ ...pasajero, fechaVencimientoPasaporte: "nunca" }] }, "fechaVencimientoPasaporte inválida para Ana Pérez."],
    [{ equipaje: { pesoDeclarado: 1 } }, "equipaje debe ser un arreglo."],
    [{ equipaje: [{ pesoDeclarado: 1 }, { pesoDeclarado: 2 }] }, "equipaje debe tener un elemento por cada pasajero."],
    [{ equipaje: [{ pesoDeclarado: -1 }] }, "pesoDeclarado debe ser un número mayor o igual a 0."],
    [{ tarjeta: { ...tarjeta, cvv: "" } }, "Los datos de la tarjeta (numero, titular, vencimiento, cvv) son requeridos."],
    [{ tarjeta: undefined }, "Los datos de la tarjeta (numero, titular, vencimiento, cvv) son requeridos."],
    [{ tarjeta: { ...tarjeta, numero: 4111222233334444 } }, "Los datos de la tarjeta (numero, titular, vencimiento, cvv) son requeridos."],
    [{ tarjeta: { ...tarjeta, cvv: 999 } }, "Los datos de la tarjeta (numero, titular, vencimiento, cvv) son requeridos."],
  ])("rechaza %o", (cambio, mensaje) => {
    expect(error(cambio)).toBe(mensaje);
  });
});
