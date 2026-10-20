import { describe, it, expect, vi, afterEach } from "vitest";
import { PasarelaMock } from "./pasarela.mock";

const tarjetaOk = { numero: "4242424242424242", titular: "Ana", vencimiento: "12/30", cvv: "123" };
const solicitud = (tarjeta: object = {}, monto = 100) => ({
  monto,
  moneda: "USD",
  referenciaReserva: "R-1",
  tarjeta: { ...tarjetaOk, ...tarjeta },
}) as any;

// Corre procesarPago con timers falsos y devuelve la respuesta
const pagar = async (s: any) => {
  vi.useFakeTimers();
  const promesa = new PasarelaMock().procesarPago(s);
  await vi.runAllTimersAsync();
  return promesa;
};

describe("PasarelaMock", () => {
  afterEach(() => vi.useRealTimers());

  it("un número de tarjeta que no es string se rechaza sin tirar", async () => {
    const r = await pagar(solicitud({ numero: 4111222233334444 }));
    expect(r.aprobado).toBe(false);
  });
});
