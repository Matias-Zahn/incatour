import { describe, it, expect } from "vitest";
import { plazasADevolverAlHotel } from "./cancelacion-salida.plazas";

// Hotel de 50 plazas, salida de 20 (el hotel queda en 30 al crearla) y 12 vendidas por stock
const porStock = (cantidadPasajeros: number) => ({ cantidadPasajeros, estadoAlojamiento: "CONFIRMADO", solicitudes: [] });

describe("plazasADevolverAlHotel (SAL-02)", () => {
  it("PUBLICADA: el hotel vuelve a 50", () => {
    const hotel = 30;
    expect(hotel + plazasADevolverAlHotel(8, [porStock(7), porStock(5)])).toBe(50);
  });

  it("CERRADA: CU-40 ya devolvió 8 sobrantes y el hotel vuelve a 50, no a 58", () => {
    const hotel = 38;
    expect(hotel + plazasADevolverAlHotel(0, [porStock(7), porStock(5)])).toBe(50);
  });

  it("CERRADA con una reserva de 3 cancelada antes: vuelve a 50", () => {
    const hotel = 38;
    // CU-32 repuso 3 al stock de la salida; quedan 9 vendidas
    expect(hotel + plazasADevolverAlHotel(3, [porStock(4), porStock(5)])).toBe(50);
  });

  it("no cuenta las reservas con alojamiento pendiente ni resuelto por solicitud", () => {
    const pendiente = { cantidadPasajeros: 2, estadoAlojamiento: "PENDIENTE", solicitudes: [] };
    const porSolicitud = { cantidadPasajeros: 3, estadoAlojamiento: "CONFIRMADO", solicitudes: [{ estado: "CONFIRMADA" }] };
    expect(plazasADevolverAlHotel(null, [pendiente, porSolicitud, porStock(4)])).toBe(4);
  });
});
