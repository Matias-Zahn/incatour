import { Ctx, fecha } from "./contexto";

export async function ventas(ctx: Ctx) {
  const { f } = ctx;
  ctx.seccion("Prueba de fixtures");
  await ctx.escenario("Fixtures básicas", async () => {
    const pq = await f.paquete();
    const hotel = await f.hotel(pq.localidad, 20);
    const idsalida = await f.salida(pq.idpaquete, fecha(400), 4, hotel.idservicio);
    const cli = await f.cliente();
    await f.comprar(cli.token, idsalida, { n: 2 });
    const s = await ctx.db.salida.findUniqueOrThrow({ where: { idsalida } });
    ctx.controlar("Fixtures: la compra de 2 deja stockLocal en 2", s.stockLocal === 2, `stockLocal=${s.stockLocal}`);
    await f.guia(); await f.porteador(); await f.transporte(pq.localidad); await f.equipamiento(pq.localidad);
  });
}
