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

  it.each([
    [{ vencimiento: "01/20" }, 100],
    [{ vencimiento: "13/30" }, 100],
    [{}, -5],
    [{}, 0],
    [{}, 10.555],
    [{ numero: "4111-2222-3333-4444" }, 100],
    [{ cvv: "12a" }, 100],
  ])("rechaza tarjeta %o con monto %d", async (tarjeta, monto) => {
    const r = await pagar(solicitud(tarjeta, monto));
    expect(r.aprobado).toBe(false);
  });

  it("aprueba una tarjeta y un monto válidos", async () => {
    const r = await pagar(solicitud());
    expect(r.aprobado).toBe(true);
  });

  describe("reembolsar", () => {
    const reembolsar = async (id: any, monto = 100) => {
      vi.useFakeTimers();
      const promesa = new PasarelaMock().reembolsar(id, monto);
      await vi.runAllTimersAsync();
      return promesa;
    };

    it("es idempotente: repetir el mismo reembolso aprueba las dos veces", async () => {
      expect((await reembolsar("TXN-0123456789AB")).aprobado).toBe(true);
      expect((await reembolsar("TXN-0123456789AB")).aprobado).toBe(true);
    });

    it.each([["TXN-1"], [12345], [undefined]])("transacción inválida %o: rechaza sin tirar", async (id) => {
      expect((await reembolsar(id)).aprobado).toBe(false);
    });

    it("monto inválido: rechaza", async () => {
      expect((await reembolsar("TXN-0123456789AB", 0)).aprobado).toBe(false);
    });
  });
});
