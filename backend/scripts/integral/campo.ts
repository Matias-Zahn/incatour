/**
 * Campo: portal del guía (CU-48 a 50), reseñas (CU-47) y evaluaciones (CU-42).
 * Cada escenario arma su propia salida asignada con personal, hotel y clientes propios.
 */
import { Ctx, fecha, hace } from "./contexto";

const H = 3600 * 1000;

type Opciones = { etapas?: number; pasajeros?: number; compradores?: number };

/** Salida CERRADA (asignada) con 1 guía + porteadores, a fecha futura. Los clientes extra compran 1 pasajero cada uno */
async function armar(ctx: Ctx, o: Opciones = {}) {
  const { f, db } = ctx;
  const idcircuito = await f.circuito({ etapas: o.etapas ?? 2 });
  const pq = await f.paquete({ idcircuito });
  const hotel = await f.hotel(pq.localidad, 50);
  const idsalida = await f.salida(pq.idpaquete, fecha(400), 8, hotel.idservicio);
  const cliente = await f.cliente();
  await f.comprar(cliente.token, idsalida, { n: o.pasajeros ?? 2 });
  const otros: Awaited<ReturnType<typeof f.cliente>>[] = [];
  for (let i = 0; i < (o.compradores ?? 0); i++) {
    const c = await f.cliente();
    await f.comprar(c.token, idsalida, { n: 1 });
    otros.push(c);
  }
  const panel = await ctx.preparar("Panel de asignación", "GET", `/salidas/${idsalida}/asignacion`);
  const guia = await f.guia();
  const porteadores: number[] = [];
  for (let i = 0; i < panel.dotacionRequerida.porteadores; i++) porteadores.push(await f.porteador());
  const guias = [guia.idpersonal];
  for (let i = 1; i < panel.dotacionRequerida.guias; i++) guias.push((await f.guia()).idpersonal);
  const transporte = await f.transporte(pq.localidad);
  await ctx.preparar("Asignar", "POST", `/salidas/${idsalida}/asignacion`, { personalIds: [...guias, ...porteadores], idtransporte: transporte.idservicio, itemsCamping: [] });
  const pasajeros = (await db.reservaPasajero.findMany({ where: { reserva: { idsalida } } })).map((p) => p.idpasajero);
  return { idsalida, guia, porteadores, cliente, otros, pasajeros, idcircuito, hotel, etapas: o.etapas ?? 2 };
}
type Armada = Awaited<ReturnType<typeof armar>>;

/** "Empezó ayer": a partir de acá los avances e incidentes son posibles */
const empezar = (ctx: Ctx, idsalida: number) => ctx.f.moverFechas(idsalida, fecha(-1), fecha(1));

const avance = (numeroOrden: number, llegada: string, estadoTramo = "COMPLETADO") => ({ numeroOrden, estadoTramo, fechaHoraLlegada: llegada });

/** Informa todas las etapas en orden; la salida queda FINALIZADA */
async function finalizar(ctx: Ctx, a: Armada) {
  for (let i = 1; i <= a.etapas; i++) {
    await ctx.preparar(`Avance ${i}`, "POST", `/guia/salidas/${a.idsalida}/avances`, avance(i, hace((a.etapas - i + 2) * H)), a.guia.token);
  }
}

const incidente = (extra: Record<string, unknown> = {}) => ({
  tipoIncidente: "SALUD", descripcion: "Malestar por la altura", nivelGravedad: "BAJO", fechaHoraOcurrencia: hace(2 * H), ...extra,
});

export async function campo(ctx: Ctx) {
  const { f, db } = ctx;
  const estadoSalida = (idsalida: number) => db.salida.findUniqueOrThrow({ where: { idsalida } });
  const avances = (idsalida: number) => db.avance.count({ where: { idsalida } });

  // ==================== CU-48: acceso del guía ====================
  ctx.seccion("CU-48 Acceso a las salidas asignadas");
  await ctx.escenario("Guía no asignado: detalle, pasajeros, avance e incidente dan 403", async () => {
    const a = await armar(ctx);
    await empezar(ctx, a.idsalida);
    const ajeno = await f.guia();
    const base = `/guia/salidas/${a.idsalida}`;
    await ctx.esperar("Guía no asignado: GET detalle → 403", "GET", base, undefined, ajeno.token, 403);
    await ctx.esperar("Guía no asignado: GET pasajeros → 403", "GET", `${base}/pasajeros`, undefined, ajeno.token, 403);
    await ctx.esperar("Guía no asignado: POST avance → 403", "POST", `${base}/avances`, avance(1, hace(H)), ajeno.token, 403);
    await ctx.esperar("Guía no asignado: POST incidente → 403", "POST", `${base}/incidentes`, incidente(), ajeno.token, 403);
    ctx.controlar("Guía no asignado: no se creó ningún avance", (await avances(a.idsalida)) === 0);
    ctx.controlar("Guía no asignado: no se creó ningún incidente", (await db.incidente.count({ where: { idsalida: a.idsalida } })) === 0);
    ctx.controlar("Guía no asignado: la salida sigue sin tocar", (await estadoSalida(a.idsalida)).estado === "CERRADA");
    const lista = await ctx.esperar("Guía no asignado: GET /guia/salidas → 200", "GET", "/guia/salidas", undefined, ajeno.token, 200);
    ctx.controlar("Guía no asignado: no ve la salida en su lista", Array.isArray(lista) && !lista.some((s: any) => s.idsalida === a.idsalida));
    const propia = await ctx.esperar("Guía asignado: GET /guia/salidas → 200", "GET", "/guia/salidas", undefined, a.guia.token, 200);
    ctx.controlar("Guía asignado: ve su salida con los pasajeros", propia?.some((s: any) => s.idsalida === a.idsalida && s.pasajeros === 2), JSON.stringify(propia));
    await ctx.esperar("Guía asignado: salida inexistente → 404", "GET", "/guia/salidas/99999999", undefined, a.guia.token, 404);
    await ctx.esperar("Guía: id no numérico → 400", "GET", "/guia/salidas/abc", undefined, a.guia.token, 400);
  });

  await ctx.escenario("Roles y token en las rutas del guía", async () => {
    const a = await armar(ctx);
    const cli = await f.cliente();
    await ctx.esperar("Cliente en GET /guia/salidas → 403", "GET", "/guia/salidas", undefined, cli.token, 403);
    await ctx.esperar("Admin en GET /guia/salidas → 403", "GET", "/guia/salidas", undefined, ctx.admin, 403);
    await ctx.esperar("Sin token en GET /guia/salidas → 401", "GET", "/guia/salidas", undefined, "", 401);
    await ctx.esperar("Cliente en POST avance → 403", "POST", `/guia/salidas/${a.idsalida}/avances`, avance(1, hace(H)), cli.token, 403);
    await ctx.esperar("Guía en GET /incidentes (panel admin) → 403", "GET", "/incidentes", undefined, a.guia.token, 403);
    await ctx.esperar("Cliente en GET /incidentes → 403", "GET", "/incidentes", undefined, cli.token, 403);
    await ctx.esperar("Guía en POST evaluaciones (ruta de admin) → 403", "POST", `/salidas/${a.idsalida}/evaluaciones`, { tipo: "PERSONAL", id: a.guia.idpersonal, puntaje: 5 }, a.guia.token, 403);
    await ctx.esperar("Guía en GET evaluaciones (ruta de admin) → 403", "GET", `/salidas/${a.idsalida}/evaluaciones`, undefined, a.guia.token, 403);
    await ctx.esperar("Guía en POST /resenias (ruta de cliente) → 403", "POST", "/resenias", { idsalida: a.idsalida, valoracion: 5 }, a.guia.token, 403);
    await ctx.esperar("Guía en GET /resenias/historial-reservas → 403", "GET", "/resenias/historial-reservas", undefined, a.guia.token, 403);
    await ctx.esperar("Cliente en POST evaluaciones → 403", "POST", `/salidas/${a.idsalida}/evaluaciones`, { tipo: "PERSONAL", id: a.guia.idpersonal, puntaje: 5 }, cli.token, 403);
    await ctx.esperar("Cliente en GET /resenias (consulta de admin) → 403", "GET", "/resenias", undefined, cli.token, 403);
    await ctx.esperar("Admin en POST /resenias → 403", "POST", "/resenias", { idsalida: a.idsalida, valoracion: 5 }, ctx.admin, 403);
    ctx.controlar("Roles: ninguna evaluación quedó guardada", (await db.evaluacionPersonal.count({ where: { idsalida: a.idsalida } })) === 0);
  });

  // ==================== CU-49: avances ====================
  ctx.seccion("CU-49 Registrar avances");
  await ctx.escenario("Avance de la etapa 2 sin haber informado la 1 → 400", async () => {
    const a = await armar(ctx);
    await empezar(ctx, a.idsalida);
    await ctx.esperar("Avance etapa 2 sin la 1 → 400", "POST", `/guia/salidas/${a.idsalida}/avances`, avance(2, hace(H)), a.guia.token, 400);
    const s = await estadoSalida(a.idsalida);
    ctx.controlar("Etapa salteada: sin avances y la salida no cambia", (await avances(a.idsalida)) === 0 && s.estado === "CERRADA" && s.ultimaEtapaAlcanzada === null, `estado=${s.estado} ultima=${s.ultimaEtapaAlcanzada}`);
  });

  await ctx.escenario("Avance con datos inválidos → 400", async () => {
    const a = await armar(ctx);
    await empezar(ctx, a.idsalida);
    const url = `/guia/salidas/${a.idsalida}/avances`;
    await ctx.esperar("Avance con llegada futura → 400", "POST", url, avance(1, hace(-2 * H)), a.guia.token, 400);
    await ctx.esperar("Avance con etapa que no es del circuito → 400", "POST", url, avance(9, hace(H)), a.guia.token, 400);
    await ctx.esperar("Avance con etapa 0 → 400", "POST", url, avance(0, hace(H)), a.guia.token, 400);
    await ctx.esperar("Avance con estado inválido → 400", "POST", url, avance(1, hace(H), "TERMINADO"), a.guia.token, 400);
    await ctx.esperar("Avance sin fecha de llegada → 400", "POST", url, { numeroOrden: 1, estadoTramo: "COMPLETADO" }, a.guia.token, 400);
    await ctx.esperar("Avance con fecha basura → 400", "POST", url, avance(1, "mañana"), a.guia.token, 400);
    await ctx.esperar("Avance anterior al inicio de la salida → 400", "POST", url, avance(1, hace(5 * 24 * H)), a.guia.token, 400);
    ctx.controlar("Avances inválidos: no se creó ninguno", (await avances(a.idsalida)) === 0);
    ctx.controlar("Avances inválidos: la salida sigue CERRADA", (await estadoSalida(a.idsalida)).estado === "CERRADA");
  });

  await ctx.escenario("Avance sobre una salida que todavía no empezó", async () => {
    const a = await armar(ctx); // CERRADA con fechaInicio futura
    await ctx.esperar("Avance antes de empezar la salida → 400", "POST", `/guia/salidas/${a.idsalida}/avances`, avance(1, hace(H)), a.guia.token, 400);
    const s = await estadoSalida(a.idsalida);
    ctx.controlar("Salida sin empezar: no se creó el Avance ni cambió el estado", (await avances(a.idsalida)) === 0 && s.estado === "CERRADA", `estado=${s.estado}`);
    await ctx.esperar("Incidente antes de empezar la salida → 400", "POST", `/guia/salidas/${a.idsalida}/incidentes`, incidente(), a.guia.token, 400);
    ctx.controlar("Salida sin empezar: no se creó el Incidente", (await db.incidente.count({ where: { idsalida: a.idsalida } })) === 0);
  });

  await ctx.escenario("Orden de etapas: repetida y anterior a la previa → 400", async () => {
    const a = await armar(ctx);
    await empezar(ctx, a.idsalida);
    const url = `/guia/salidas/${a.idsalida}/avances`;
    const llegada1 = hace(3 * H);
    const r = await ctx.esperar("Avance 1 → 201", "POST", url, avance(1, llegada1), a.guia.token, 201);
    ctx.controlar("Avance 1: la salida pasa a EN_CURSO con ultimaEtapa 1", r?.salida?.estado === "EN_CURSO" && r?.salida?.ultimaEtapaAlcanzada === 1, JSON.stringify(r?.salida));
    await ctx.esperar("Avance 1 repetido (COMPLETADO) → 400", "POST", url, avance(1, hace(2 * H)), a.guia.token, 400);
    await ctx.esperar("Avance 2 con llegada anterior a la de la etapa 1 → 400", "POST", url, avance(2, hace(4 * H)), a.guia.token, 400);
    ctx.controlar("Orden: sigue habiendo un solo avance", (await avances(a.idsalida)) === 1);
  });

  await ctx.escenario("DEMORADO reenviado no se duplica (CTA-15)", async () => {
    const a = await armar(ctx);
    await empezar(ctx, a.idsalida);
    const url = `/guia/salidas/${a.idsalida}/avances`;
    const demorado = avance(1, hace(2 * H), "DEMORADO");
    await ctx.esperar("DEMORADO 1ra vez → 201", "POST", url, demorado, a.guia.token, 201);
    await ctx.esperar("DEMORADO reenviado igual → 201 sin error", "POST", url, demorado, a.guia.token, 201);
    const filas = await db.avance.findMany({ where: { idsalida: a.idsalida } });
    ctx.controlar("DEMORADO reenviado: una sola fila", filas.length === 1, `filas=${filas.length}`);
    const s = await estadoSalida(a.idsalida);
    ctx.controlar("DEMORADO: la salida está EN_CURSO y la etapa no cuenta como alcanzada", s.estado === "EN_CURSO" && s.ultimaEtapaAlcanzada === null, `estado=${s.estado} ultima=${s.ultimaEtapaAlcanzada}`);
    await ctx.esperar("COMPLETADO de la misma etapa tras el demorado → 201", "POST", url, avance(1, hace(H)), a.guia.token, 201);
    const s2 = await estadoSalida(a.idsalida);
    ctx.controlar("COMPLETADO tras DEMORADO: ultimaEtapa 1", s2.ultimaEtapaAlcanzada === 1, `ultima=${s2.ultimaEtapaAlcanzada}`);
    const det = await ctx.esperar("Detalle del guía → 200", "GET", `/guia/salidas/${a.idsalida}`, undefined, a.guia.token, 200);
    ctx.controlar("Detalle: la etapa 1 muestra COMPLETADO (el último avance)", det?.itinerario?.[0]?.estadoTramo === "COMPLETADO", JSON.stringify(det?.itinerario?.[0]));
  });

  await ctx.escenario("Completar todas las etapas finaliza la salida", async () => {
    const a = await armar(ctx, { etapas: 3 });
    await empezar(ctx, a.idsalida);
    const url = `/guia/salidas/${a.idsalida}/avances`;
    await ctx.esperar("Avance 1 de 3 → 201", "POST", url, avance(1, hace(4 * H)), a.guia.token, 201);
    await ctx.esperar("Avance 2 de 3 → 201", "POST", url, avance(2, hace(3 * H)), a.guia.token, 201);
    ctx.controlar("A mitad de camino la salida sigue EN_CURSO", (await estadoSalida(a.idsalida)).estado === "EN_CURSO");
    const r = await ctx.esperar("Avance 3 de 3 → 201", "POST", url, avance(3, hace(2 * H)), a.guia.token, 201);
    ctx.controlar("Respuesta: salida FINALIZADA", r?.salida?.estado === "FINALIZADA" && r?.salida?.ultimaEtapaAlcanzada === 3, JSON.stringify(r?.salida));
    const s = await estadoSalida(a.idsalida);
    ctx.controlar("Base: salida FINALIZADA con ultimaEtapa 3 y 3 avances", s.estado === "FINALIZADA" && s.ultimaEtapaAlcanzada === 3 && (await avances(a.idsalida)) === 3, `estado=${s.estado} ultima=${s.ultimaEtapaAlcanzada}`);
    await ctx.esperar("Avance extra tras finalizar (etapa 3) → 400", "POST", url, avance(3, hace(H)), a.guia.token, 400);
    await ctx.esperar("Avance extra tras finalizar (etapa 4) → 400", "POST", url, avance(4, hace(H)), a.guia.token, 400);
    ctx.controlar("Tras finalizar no se agregaron avances", (await avances(a.idsalida)) === 3);
    await ctx.esperar("Incidente tras finalizar → 400", "POST", `/guia/salidas/${a.idsalida}/incidentes`, incidente(), a.guia.token, 400);
    ctx.controlar("Tras finalizar no se agregaron incidentes", (await db.incidente.count({ where: { idsalida: a.idsalida } })) === 0);
  });

  // ==================== CU-50: incidentes ====================
  ctx.seccion("CU-50 Notificar incidente");
  await ctx.escenario("Incidente con un pasajero de otra salida → 400", async () => {
    const a = await armar(ctx);
    const b = await armar(ctx);
    await empezar(ctx, a.idsalida);
    const url = `/guia/salidas/${a.idsalida}/incidentes`;
    await ctx.esperar("Incidente con pasajero ajeno → 400", "POST", url, incidente({ pasajerosAfectados: [a.pasajeros[0], b.pasajeros[0]] }), a.guia.token, 400);
    await ctx.esperar("Incidente con pasajero inexistente → 400", "POST", url, incidente({ pasajerosAfectados: [99999999] }), a.guia.token, 400);
    await ctx.esperar("Incidente con pasajero repetido → 400", "POST", url, incidente({ pasajerosAfectados: [a.pasajeros[0], a.pasajeros[0]] }), a.guia.token, 400);
    ctx.controlar("Incidente ajeno: no se guardó nada", (await db.incidente.count({ where: { idsalida: a.idsalida } })) === 0 && (await db.incidentePasajero.count({ where: { idpasajero: b.pasajeros[0]! } })) === 0);
  });

  await ctx.escenario("Incidente con datos inválidos → 400", async () => {
    const a = await armar(ctx);
    await empezar(ctx, a.idsalida);
    const url = `/guia/salidas/${a.idsalida}/incidentes`;
    await ctx.esperar("Incidente con fecha futura → 400", "POST", url, incidente({ fechaHoraOcurrencia: hace(-2 * H) }), a.guia.token, 400);
    await ctx.esperar("Incidente anterior al inicio de la salida → 400", "POST", url, incidente({ fechaHoraOcurrencia: hace(5 * 24 * H) }), a.guia.token, 400);
    await ctx.esperar("Incidente con tipo inválido → 400", "POST", url, incidente({ tipoIncidente: "ROBO" }), a.guia.token, 400);
    await ctx.esperar("Incidente con gravedad inválida → 400", "POST", url, incidente({ nivelGravedad: "ALTO" }), a.guia.token, 400);
    await ctx.esperar("Incidente con descripción corta → 400", "POST", url, incidente({ descripcion: "ab" }), a.guia.token, 400);
    await ctx.esperar("Incidente con descripción de 1001 caracteres → 400", "POST", url, incidente({ descripcion: "x".repeat(1001) }), a.guia.token, 400);
    ctx.controlar("Incidentes inválidos: no se guardó ninguno", (await db.incidente.count({ where: { idsalida: a.idsalida } })) === 0);
  });

  await ctx.escenario("Incidente válido queda registrado y el admin lo ve", async () => {
    const a = await armar(ctx);
    await empezar(ctx, a.idsalida);
    const url = `/guia/salidas/${a.idsalida}/incidentes`;
    const nomina = await ctx.esperar("Pasajeros de la salida → 200", "GET", `/guia/salidas/${a.idsalida}/pasajeros`, undefined, a.guia.token, 200);
    ctx.controlar("Pasajeros: devuelve los 2 de la compra", Array.isArray(nomina) && nomina.length === 2 && a.pasajeros.every((id) => nomina.some((p: any) => p.idpasajero === id)));
    const afectado = a.pasajeros[0]!;
    await ctx.esperar("Incidente válido con afectado → 201", "POST", url, incidente({ nivelGravedad: "CRITICO", tipoIncidente: "ACCIDENTE", pasajerosAfectados: [afectado] }), a.guia.token, 201);
    await ctx.esperar("Incidente válido sin afectados → 201", "POST", url, incidente({ nivelGravedad: "MEDIO" }), a.guia.token, 201);
    const filas = await db.incidente.findMany({ where: { idsalida: a.idsalida }, include: { pasajeros: true } });
    const critico = filas.find((i) => i.nivelGravedad === "CRITICO");
    ctx.controlar("Base: 2 incidentes y el crítico vinculado al pasajero", filas.length === 2 && critico?.pasajeros.length === 1 && critico.pasajeros[0]!.idpasajero === afectado, `filas=${filas.length}`);
    ctx.controlar("Base: se guardan ocurrencia y reporte por separado", !!critico && critico.fechaHoraOcurrencia.getTime() < critico.fechaHoraReporte.getTime());
    ctx.controlar("Incidente no cambia el estado de la salida", (await estadoSalida(a.idsalida)).estado === "CERRADA");
    const lista = await ctx.esperar("Admin: GET /incidentes?idsalida → 200", "GET", `/incidentes?idsalida=${a.idsalida}`, undefined, ctx.admin, 200);
    ctx.controlar("Admin ve los 2 incidentes de la salida", Array.isArray(lista) && lista.length === 2, `n=${lista?.length}`);
    const soloCriticos = await ctx.esperar("Admin: filtro por gravedad → 200", "GET", `/incidentes?idsalida=${a.idsalida}&nivelGravedad=CRITICO`, undefined, ctx.admin, 200);
    ctx.controlar("Filtro CRITICO deja 1", Array.isArray(soloCriticos) && soloCriticos.length === 1);
    await ctx.esperar("Admin: gravedad inválida en el filtro → 400", "GET", "/incidentes?nivelGravedad=ALTO", undefined, ctx.admin, 400);
  });

  // ==================== CU-47: reseñas ====================
  ctx.seccion("CU-47 Publicar reseña");
  await ctx.escenario("Reseña de una salida no finalizada → 400", async () => {
    const a = await armar(ctx);
    await empezar(ctx, a.idsalida);
    await ctx.preparar("Primer avance", "POST", `/guia/salidas/${a.idsalida}/avances`, avance(1, hace(2 * H)), a.guia.token);
    await ctx.esperar("Reseña de salida EN_CURSO → 400", "POST", "/resenias", { idsalida: a.idsalida, valoracion: 5 }, a.cliente.token, 400);
    const h = await ctx.esperar("Historial → 200", "GET", "/resenias/historial-reservas", undefined, a.cliente.token, 200);
    const fila = h?.find((r: any) => r.salida.idsalida === a.idsalida);
    ctx.controlar("Historial: salida EN_CURSO no se puede reseñar", fila && fila.puedeResenar === false, JSON.stringify(fila?.puedeResenar));
    ctx.controlar("Reseña no finalizada: no se guardó", (await db.resenia.count({ where: { idsalida: a.idsalida } })) === 0);
  });

  await ctx.escenario("Reseña: duplicada, sin reserva, inválida y válida", async () => {
    const a = await armar(ctx, { etapas: 2, compradores: 1 });
    await empezar(ctx, a.idsalida);
    await finalizar(ctx, a);
    const s = await estadoSalida(a.idsalida);
    ctx.controlar("Salida FINALIZADA antes de reseñar", s.estado === "FINALIZADA");

    const ajeno = await f.cliente();
    await ctx.esperar("Reseña de cliente sin reserva en la salida → 403", "POST", "/resenias", { idsalida: a.idsalida, valoracion: 5 }, ajeno.token, 403);
    const hAjeno = await ctx.esperar("Historial del cliente sin reservas → 200", "GET", "/resenias/historial-reservas", undefined, ajeno.token, 200);
    ctx.controlar("Historial del cliente sin reservas: vacío", Array.isArray(hAjeno) && hAjeno.length === 0);
    await ctx.esperar("Reseña con valoración 0 → 400", "POST", "/resenias", { idsalida: a.idsalida, valoracion: 0 }, a.cliente.token, 400);
    await ctx.esperar("Reseña con valoración 6 → 400", "POST", "/resenias", { idsalida: a.idsalida, valoracion: 6 }, a.cliente.token, 400);
    await ctx.esperar("Reseña con valoración decimal → 400", "POST", "/resenias", { idsalida: a.idsalida, valoracion: 4.5 }, a.cliente.token, 400);
    await ctx.esperar("Reseña con comentario de 1001 caracteres → 400", "POST", "/resenias", { idsalida: a.idsalida, valoracion: 5, comentario: "x".repeat(1001) }, a.cliente.token, 400);
    await ctx.esperar("Reseña de salida inexistente → 404", "POST", "/resenias", { idsalida: 99999999, valoracion: 5 }, a.cliente.token, 404);
    ctx.controlar("Reseñas rechazadas: no se guardó ninguna", (await db.resenia.count({ where: { idsalida: a.idsalida } })) === 0);

    const antes = await ctx.esperar("Historial antes de reseñar → 200", "GET", "/resenias/historial-reservas", undefined, a.cliente.token, 200);
    ctx.controlar("Historial: FINALIZADA con reserva confirmada puede reseñar", antes?.find((r: any) => r.salida.idsalida === a.idsalida)?.puedeResenar === true);

    await ctx.esperar("Reseña válida tras FINALIZADA → 201", "POST", "/resenias", { idsalida: a.idsalida, valoracion: 4, comentario: "Muy buena" }, a.cliente.token, 201);
    const fila = await db.resenia.findFirst({ where: { idsalida: a.idsalida, idcliente: (await db.cliente.findFirstOrThrow({ where: { usuario: { email: a.cliente.email } } })).idcliente } });
    ctx.controlar("Base: reseña con valoración 4", fila?.valoracion === 4 && fila.comentario === "Muy buena");
    await ctx.esperar("Segunda reseña de la misma salida → 400", "POST", "/resenias", { idsalida: a.idsalida, valoracion: 1 }, a.cliente.token, 400);
    ctx.controlar("Duplicada: sigue habiendo 1 reseña y no se pisó la valoración", (await db.resenia.count({ where: { idsalida: a.idsalida } })) === 1 && (await db.resenia.findFirst({ where: { idsalida: a.idsalida } }))?.valoracion === 4);
    const despues = await ctx.esperar("Historial tras reseñar → 200", "GET", "/resenias/historial-reservas", undefined, a.cliente.token, 200);
    const fd = despues?.find((r: any) => r.salida.idsalida === a.idsalida);
    ctx.controlar("Historial: ya no puede reseñar y muestra su reseña", fd?.puedeResenar === false && fd?.resenia?.valoracion === 4);

    // Otro cliente de la misma salida sí puede publicar la suya
    await ctx.esperar("Reseña de otro cliente de la misma salida → 201", "POST", "/resenias", { idsalida: a.idsalida, valoracion: 5 }, a.otros[0]!.token, 201);
    ctx.controlar("Base: 2 reseñas, una por cliente", (await db.resenia.count({ where: { idsalida: a.idsalida } })) === 2);
    const adm = await ctx.esperar("Admin: consulta de reseñas de la salida → 200", "GET", `/resenias?idsalida=${a.idsalida}`, undefined, ctx.admin, 200);
    ctx.controlar("Admin: resumen con 2 reseñas y promedio 4.5", adm?.resumen?.cantidad === 2 && adm?.resumen?.promedio === 4.5, JSON.stringify(adm?.resumen));
    await ctx.esperar("Admin: filtro de valoración inválido → 400", "GET", "/resenias?valoracionMin=9", undefined, ctx.admin, 400);
  });

  await ctx.escenario("Reseña de una reserva cancelada → 403", async () => {
    const a = await armar(ctx, { compradores: 1 });
    const canc = a.otros[0]!;
    const reserva = await db.reserva.findFirstOrThrow({ where: { idsalida: a.idsalida, cliente: { usuario: { email: canc.email } } } });
    const ok = await ctx.esperar("Cancelar la reserva antes de empezar → 200", "POST", `/reservas/${reserva.idreserva}/cancelar`, { motivo: "Integral" }, canc.token, 200);
    await empezar(ctx, a.idsalida);
    await finalizar(ctx, a);
    if (ok === undefined) return;
    await ctx.esperar("Reseña de quien canceló su reserva → 403", "POST", "/resenias", { idsalida: a.idsalida, valoracion: 5 }, canc.token, 403);
    const h = await ctx.esperar("Historial del que canceló → 200", "GET", "/resenias/historial-reservas", undefined, canc.token, 200);
    ctx.controlar("Historial: reserva cancelada no puede reseñar", h?.find((r: any) => r.idreserva === reserva.idreserva)?.puedeResenar === false);
    ctx.controlar("Cancelada: no se guardó reseña", (await db.resenia.count({ where: { idsalida: a.idsalida } })) === 0);
  });

  // ==================== CU-42: evaluaciones ====================
  ctx.seccion("CU-42 Evaluar personal y proveedores");
  await ctx.escenario("Evaluación sobre una salida no finalizada → 400", async () => {
    const a = await armar(ctx);
    await empezar(ctx, a.idsalida);
    await ctx.preparar("Primer avance", "POST", `/guia/salidas/${a.idsalida}/avances`, avance(1, hace(2 * H)), a.guia.token);
    await ctx.esperar("GET evaluables de salida EN_CURSO → 400", "GET", `/salidas/${a.idsalida}/evaluaciones`, undefined, ctx.admin, 400);
    await ctx.esperar("POST evaluación de salida EN_CURSO → 400", "POST", `/salidas/${a.idsalida}/evaluaciones`, { tipo: "PERSONAL", id: a.guia.idpersonal, puntaje: 5 }, ctx.admin, 400);
    ctx.controlar("Evaluación no finalizada: no se guardó", (await db.evaluacionPersonal.count({ where: { idsalida: a.idsalida } })) === 0);
    await ctx.esperar("GET evaluables de salida inexistente → 404", "GET", "/salidas/99999999/evaluaciones", undefined, ctx.admin, 404);
    await ctx.esperar("POST evaluación de salida inexistente → 404", "POST", "/salidas/99999999/evaluaciones", { tipo: "PERSONAL", id: 1, puntaje: 5 }, ctx.admin, 404);
  });

  await ctx.escenario("Evaluación: rangos, duplicada, ajeno y proveedor", async () => {
    const a = await armar(ctx);
    const otra = await armar(ctx);
    await empezar(ctx, a.idsalida);
    await finalizar(ctx, a);
    const url = `/salidas/${a.idsalida}/evaluaciones`;
    const idguia = a.guia.idpersonal;

    const ev = await ctx.esperar("GET evaluables de salida FINALIZADA → 200", "GET", url, undefined, ctx.admin, 200);
    ctx.controlar("Evaluables: incluye al guía y al hotel, sin evaluar", ev?.personal?.some((p: any) => p.idpersonal === idguia && p.evaluacion === null) && ev?.proveedores?.some((p: any) => p.idproveedor === a.hotel.idproveedor), JSON.stringify(ev)?.slice(0, 200));

    for (const puntaje of [0, 6, -1, 3.5, "5"]) {
      await ctx.esperar(`Puntaje fuera de rango (${JSON.stringify(puntaje)}) → 400`, "POST", url, { tipo: "PERSONAL", id: idguia, puntaje }, ctx.admin, 400);
    }
    await ctx.esperar("Evaluación sin puntaje → 400", "POST", url, { tipo: "PERSONAL", id: idguia }, ctx.admin, 400);
    await ctx.esperar("Evaluación con tipo inválido → 400", "POST", url, { tipo: "GUIA", id: idguia, puntaje: 3 }, ctx.admin, 400);
    await ctx.esperar("Evaluación con comentario de 501 caracteres → 400", "POST", url, { tipo: "PERSONAL", id: idguia, puntaje: 3, comentario: "x".repeat(501) }, ctx.admin, 400);
    ctx.controlar("Evaluaciones inválidas: no se guardó ninguna", (await db.evaluacionPersonal.count({ where: { idsalida: a.idsalida } })) === 0);

    await ctx.esperar("Evaluar a personal de otra salida → 400", "POST", url, { tipo: "PERSONAL", id: otra.guia.idpersonal, puntaje: 5 }, ctx.admin, 400);
    await ctx.esperar("Evaluar a personal inexistente → 400", "POST", url, { tipo: "PERSONAL", id: 99999999, puntaje: 5 }, ctx.admin, 400);
    await ctx.esperar("Evaluar a proveedor que no dio servicio → 400", "POST", url, { tipo: "PROVEEDOR", id: otra.hotel.idproveedor, puntaje: 5 }, ctx.admin, 400);

    await ctx.esperar("Evaluar al guía (puntaje 5) → 201", "POST", url, { tipo: "PERSONAL", id: idguia, puntaje: 5, comentario: "Excelente" }, ctx.admin, 201);
    await ctx.esperar("Evaluar al mismo guía otra vez → 400", "POST", url, { tipo: "PERSONAL", id: idguia, puntaje: 1 }, ctx.admin, 400);
    const filas = await db.evaluacionPersonal.findMany({ where: { idsalida: a.idsalida, idpersonal: idguia } });
    ctx.controlar("Evaluación duplicada: una sola fila y conserva el puntaje 5", filas.length === 1 && filas[0]!.puntaje === 5, `filas=${filas.length}`);

    await ctx.esperar("Evaluar al hotel (puntaje 1, borde) → 201", "POST", url, { tipo: "PROVEEDOR", id: a.hotel.idproveedor, puntaje: 1 }, ctx.admin, 201);
    await ctx.esperar("Evaluar al hotel otra vez → 400", "POST", url, { tipo: "PROVEEDOR", id: a.hotel.idproveedor, puntaje: 2 }, ctx.admin, 400);
    ctx.controlar("Evaluación de proveedor duplicada: una sola fila", (await db.evaluacionProveedor.count({ where: { idsalida: a.idsalida, idproveedor: a.hotel.idproveedor } })) === 1);

    const adm = await ctx.esperar("Admin: consulta con evaluaciones → 200", "GET", `/resenias?idsalida=${a.idsalida}`, undefined, ctx.admin, 200);
    ctx.controlar("Consulta CU-43: ve la evaluación del guía y del hotel", adm?.evaluaciones?.personal?.length === 1 && adm?.evaluaciones?.proveedores?.length === 1, JSON.stringify(adm?.evaluaciones)?.slice(0, 200));
  });
}
