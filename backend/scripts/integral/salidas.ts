/**
 * Módulo salidas del test integral: CU-36 a CU-41 (crear, asignar recursos, reemplazar, logística, cancelar, devolver).
 * Cada escenario arma su salida con fixtures propias y controla status exacto + estado en la base
 * (hotel, stocks, bloqueo y permisos de la autoridad, reembolsos).
 */
import { Ctx, fecha } from "./contexto";

const DIA = 24 * 3600 * 1000;
const sumar = (d: string, n: number) => new Date(Date.parse(d) + n * DIA).toISOString().slice(0, 10);
// Cada salida arranca en una fecha distinta (2028, dentro de la temporada del setup) para no cruzar cupos ni personal
let corrida = 0;
const proximoInicio = () => sumar("2028-02-01", 5 * corrida++);

export async function salidas(ctx: Ctx) {
  const { f, db, admin } = ctx;
  const ok = ctx.controlar;
  const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  // ---------- lecturas de la base ----------
  const capacidad = async (id: number) => (await db.servicioAlojamiento.findUniqueOrThrow({ where: { idservicio: id } })).capacidadDisponible;
  const stockEq = async (id: number) => (await db.servicioEquipamiento.findUniqueOrThrow({ where: { idservicio: id } })).cantidadDisponible;
  const salidaDb = (id: number) => db.salida.findUniqueOrThrow({ where: { idsalida: id } });
  const lugares = async (id: number) => {
    const s = await salidaDb(id);
    return s.idbloqueo ? ((await db.autoridadBloqueo.findUnique({ where: { idBloqueo: s.idbloqueo } }))?.lugares ?? 0) : 0;
  };
  const vigentes = async (id: number) => db.autoridadPermiso.count({ where: { idBloqueo: (await salidaDb(id)).idbloqueo ?? "", vigente: true } });
  const ocupados = async (dia: string) => (await db.autoridadCupoDiario.findUnique({ where: { fecha: dia } }))?.ocupados ?? 0;
  const permisosPas = (idsalida: number) => db.permisoPasajero.findMany({ where: { reserva: { idsalida } } });
  const permisosPer = (idsalida: number) => db.permisoPersonal.findMany({ where: { idsalida } });
  const asignados = async (idsalida: number) => (await db.asignacionPersonal.findMany({ where: { idsalida } })).map((a) => a.idpersonal).sort((a, b) => a - b);

  // ---------- armado de datos ----------
  /** Paquete con localidad propia, hotel (bloqueo o a solicitud), salida y compras (`pax` = pasajeros de cada reserva) */
  async function montar(o: { T?: number; cap?: number; pax?: number[]; bloqueo?: boolean; aSolicitud?: boolean; minimoGuias?: number; inicio?: string } = {}) {
    const idcircuito = await f.circuito({ minimoGuias: o.minimoGuias ?? 1 });
    const pq = await f.paquete({ idcircuito });
    const hotel = o.bloqueo === false ? undefined : await f.hotel(pq.localidad, o.cap ?? 50);
    const hotelA = o.aSolicitud ? await f.hotel(pq.localidad, 20, "A_SOLICITUD") : undefined;
    const inicio = o.inicio ?? proximoInicio();
    const fin = sumar(inicio, 2);
    const T = o.T ?? 6;
    const idsalida = await f.salida(pq.idpaquete, inicio, T, hotel?.idservicio);
    const cliente = await f.cliente();
    const reservas = [];
    for (const n of o.pax ?? []) reservas.push(await f.comprar(cliente.token, idsalida, { n }));
    return { ...pq, hotel, hotelA, inicio, fin, T, idsalida, cliente, reservas };
  }

  /** Guías, porteadores, transporte y dos equipamientos (stock 10) para asignar */
  async function plantel(o: { guias?: number; porteadores: number; transporteCap?: number }) {
    const guias: number[] = [];
    for (let i = 0; i < (o.guias ?? 2); i++) guias.push((await f.guia()).idpersonal);
    const porteadores: number[] = [];
    for (let i = 0; i < o.porteadores; i++) porteadores.push(await f.porteador());
    const transporte = (await f.transporte("Loc T", o.transporteCap ?? 30)).idservicio;
    const equipo = (await f.equipamiento("Loc E", 10)).idservicio;
    const equipo2 = (await f.equipamiento("Loc E", 10)).idservicio;
    return { guias, porteadores, transporte, equipo, equipo2 };
  }
  type Plantel = Awaited<ReturnType<typeof plantel>>;

  const cuerpo = (p: Plantel, personalIds: number[], items: { idservicio: number; cantidad: number }[] = []) =>
    ({ personalIds, idtransporte: p.transporte, itemsCamping: items });
  const porteadoresPara = (vendidos: number) => Math.ceil(vendidos / 2);

  /** Salida con compras y asignación hecha (guía 0 + porteadores justos; sobran guias[1] y un porteador). Equipo: 3 y 2 unidades */
  async function asignada(pax: number[]) {
    const m = await montar({ pax });
    const nP = porteadoresPara(suma(pax));
    const p = await plantel({ porteadores: nP + 1 });
    const personalIds = [p.guias[0]!, ...p.porteadores.slice(0, nP)];
    const itemsCamping = [{ idservicio: p.equipo, cantidad: 3 }, { idservicio: p.equipo2, cantidad: 2 }];
    const r = await ctx.preparar("Asignar recursos", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, personalIds, itemsCamping));
    return { ...m, ...p, personalIds, nP, resultado: r };
  }

  // ======================================================================
  ctx.seccion("CU-36 Crear salida");

  await ctx.escenario("CU-36 cupo de la autoridad", async () => {
    const pq = await f.paquete();
    // Sin cupo: quedan 3 lugares y la salida necesita 10 (6 + 1 guía + 3 porteadores)
    const F1 = proximoInicio();
    await db.autoridadCupoDiario.upsert({ where: { fecha: F1 }, create: { fecha: F1, ocupados: 497 }, update: { ocupados: 497 } });
    await ctx.esperar("CU-36 FA1 sin cupo suficiente → 400", "POST", "/salidas", { idpaquete: pq.idpaquete, fechaInicio: F1, tamanoMaximo: 6 }, admin, 400);
    ok("CU-36 FA1 no queda salida ni cupo tomado", (await db.salida.count({ where: { idpaquete: pq.idpaquete } })) === 0 && (await ocupados(F1)) === 497 && (await db.autoridadBloqueo.count({ where: { fecha: F1 } })) === 0);

    // Borde: justo 10 libres entra y llena el día; 9 libres no entra
    const F2 = proximoInicio();
    await db.autoridadCupoDiario.upsert({ where: { fecha: F2 }, create: { fecha: F2, ocupados: 490 }, update: { ocupados: 490 } });
    await ctx.esperar("CU-36 borde: justo los lugares que hacen falta → 201", "POST", "/salidas", { idpaquete: pq.idpaquete, fechaInicio: F2, tamanoMaximo: 6 }, admin, 201);
    ok("CU-36 borde: el día queda en 500", (await ocupados(F2)) === 500, `ocupados ${await ocupados(F2)}`);
    const F3 = proximoInicio();
    await db.autoridadCupoDiario.upsert({ where: { fecha: F3 }, create: { fecha: F3, ocupados: 491 }, update: { ocupados: 491 } });
    await ctx.esperar("CU-36 borde: falta un lugar → 400", "POST", "/salidas", { idpaquete: pq.idpaquete, fechaInicio: F3, tamanoMaximo: 6 }, admin, 400);
    ok("CU-36 borde: el cupo no cambió", (await ocupados(F3)) === 491);
  });

  await ctx.escenario("CU-36 autoridad caída", async () => {
    const pq = await f.paquete();
    const F = proximoInicio();
    await ctx.esperar("CU-36 FA2 autoridad caída → 503", "POST", "/salidas", { idpaquete: pq.idpaquete, fechaInicio: F, tamanoMaximo: 6 }, admin, 503, ctx.backCaido);
    ok("CU-36 FA2 no queda la salida creada ni cupo tomado", (await db.salida.count({ where: { idpaquete: pq.idpaquete } })) === 0 && (await ocupados(F)) === 0);
    const q = `/salidas/opciones?idpaquete=${pq.idpaquete}&fechaInicio=${F}&tamanoMaximo=6`;
    const caida = await ctx.esperar("CU-36 opciones con la autoridad caída siguen (200)", "GET", q, undefined, admin, 200, ctx.backCaido);
    ok("CU-36 opciones con la autoridad caída: cupo sin informar", caida?.cupoAutoridad === null, JSON.stringify(caida?.cupoAutoridad));
    const normal = await ctx.esperar("CU-36 opciones con la autoridad arriba (200)", "GET", q, undefined, admin, 200);
    ok("CU-36 opciones informa dotación, total y cupo", normal?.totalLugares === 10 && normal?.dotacion?.porteadores === 3 && normal?.cupoAutoridad?.lugaresDisponibles === 500 && normal?.cupoAutoridad?.alcanza === true, JSON.stringify(normal));
  });

  await ctx.escenario("CU-36 hotel sin capacidad", async () => {
    const pq = await f.paquete();
    const chico = await f.hotel(pq.localidad, 3);
    const F = proximoInicio();
    const body = { idpaquete: pq.idpaquete, fechaInicio: F, tamanoMaximo: 6 };
    await ctx.esperar("CU-36 hotel elegido sin capacidad → 400", "POST", "/salidas", { ...body, idalojamiento: chico.idservicio }, admin, 400);
    ok("CU-36 hotel sin capacidad: nada cambia (sin salida, sin cupo, hotel igual)", (await db.salida.count({ where: { idpaquete: pq.idpaquete } })) === 0 && (await ocupados(F)) === 0 && (await capacidad(chico.idservicio)) === 3);
    // FA3: ningún hotel con bloqueo alcanza → se crea sin alojamiento
    const sin = await ctx.esperar("CU-36 FA3 ningún hotel alcanza: se crea sin alojamiento → 201", "POST", "/salidas", body, admin, 201);
    const id = sin?.salida?.idsalida;
    if (id) {
      const s = await salidaDb(id);
      ok("CU-36 FA3 salida sin hotel: stockLocalAlojamiento 0 y hotel intacto", s.stockLocalAlojamiento === 0 && s.stockLocal === 6 && (await capacidad(chico.idservicio)) === 3 && (await db.salidaServicio.count({ where: { idsalida: id } })) === 0);
    }
    // Con un hotel que alcanza, hay que elegirlo
    const grande = await f.hotel(pq.localidad, 50);
    const F2 = proximoInicio();
    const body2 = { ...body, fechaInicio: F2 };
    await ctx.esperar("CU-36 hay hotel que alcanza y no se elige → 400", "POST", "/salidas", body2, admin, 400);
    await ctx.esperar("CU-36 se elige el hotel que no alcanza habiendo otro → 400", "POST", "/salidas", { ...body2, idalojamiento: chico.idservicio }, admin, 400);
    ok("CU-36 los rechazos no tomaron cupo", (await ocupados(F2)) === 0 && (await capacidad(grande.idservicio)) === 50);
  });

  await ctx.escenario("CU-36 camino feliz", async () => {
    const pq = await f.paquete();
    const hotel = await f.hotel(pq.localidad, 50);
    const F = proximoInicio();
    const r = await ctx.esperar("CU-36 crear salida con hotel → 201", "POST", "/salidas", { idpaquete: pq.idpaquete, fechaInicio: F, tamanoMaximo: 6, idalojamiento: hotel.idservicio }, admin, 201);
    const id = r?.salida?.idsalida;
    if (!id) return;
    const s = await salidaDb(id);
    ok("CU-36 el hotel pierde tamanoMaximo plazas (50 → 44)", (await capacidad(hotel.idservicio)) === 44, `capacidad ${await capacidad(hotel.idservicio)}`);
    ok("CU-36 salida PUBLICADA con stock = tamanoMaximo y fechaFin = inicio + duración − 1",
      s.estado === "PUBLICADA" && s.stockLocal === 6 && s.stockLocalAlojamiento === 6 && s.tamanoMaximo === 6 && s.fechaFin.toISOString().slice(0, 10) === sumar(F, 2), JSON.stringify(s));
    ok("CU-36 el bloqueo ante la autoridad es tamanoMaximo + dotación (6 + 1 + 3)", (await lugares(id)) === 10 && r.dotacion?.guias === 1 && r.dotacion?.porteadores === 3 && r.totalLugares === 10, `lugares ${await lugares(id)}`);
    ok("CU-36 el cupo del día suma los 10 lugares", (await ocupados(F)) === 10);
    ok("CU-36 el hotel queda asociado a la salida", (await db.salidaServicio.count({ where: { idsalida: id, idservicio: hotel.idservicio, tipo: "ALOJAMIENTO" } })) === 1);
  });

  await ctx.escenario("CU-36 datos inválidos", async () => {
    const pq = await f.paquete();
    const base = { idpaquete: pq.idpaquete, fechaInicio: proximoInicio(), tamanoMaximo: 6 };
    await ctx.esperar("CU-36 paquete inexistente → 404", "POST", "/salidas", { ...base, idpaquete: 99999999 }, admin, 404);
    await ctx.esperar("CU-36 fecha de inicio pasada → 400", "POST", "/salidas", { ...base, fechaInicio: fecha(-3) }, admin, 400);
    await ctx.esperar("CU-36 fecha de inicio hoy → 400", "POST", "/salidas", { ...base, fechaInicio: fecha(0) }, admin, 400);
    await ctx.esperar("CU-36 fecha sin tarifa vigente (2029) → 400", "POST", "/salidas", { ...base, fechaInicio: "2029-03-01" }, admin, 400);
    await ctx.esperar("CU-36 tamanoMaximo 0 → 400", "POST", "/salidas", { ...base, tamanoMaximo: 0 }, admin, 400);
    await ctx.esperar("CU-36 fecha mal formada → 400", "POST", "/salidas", { ...base, fechaInicio: "mañana" }, admin, 400);
    ok("CU-36 ninguna creó salida", (await db.salida.count({ where: { idpaquete: pq.idpaquete } })) === 0);
  });

  // ======================================================================
  ctx.seccion("CU-40 Asignar recursos");

  await ctx.escenario("CU-40 sin reservas", async () => {
    const m = await montar({ pax: [] });
    const p = await plantel({ porteadores: 1 });
    await ctx.esperar("CU-40 panel de salida sin reservas confirmadas → 400", "GET", `/salidas/${m.idsalida}/asignacion`, undefined, admin, 400);
    await ctx.esperar("CU-40 asignar sin reservas confirmadas → 400", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, [p.guias[0]!, p.porteadores[0]!]), admin, 400);
    ok("CU-40 sin reservas: la salida sigue PUBLICADA y sin personal", (await salidaDb(m.idsalida)).estado === "PUBLICADA" && (await asignados(m.idsalida)).length === 0);
    await ctx.esperar("CU-40 salida inexistente → 404", "GET", `/salidas/99999999/asignacion`, undefined, admin, 404);
  });

  await ctx.escenario("CU-40 alojamiento pendiente (RF-53)", async () => {
    // Sin hotel con bloqueo: la compra queda PENDIENTE con su solicitud
    const m = await montar({ bloqueo: false, aSolicitud: true, pax: [2] });
    ok("CU-40 la compra sin hotel con bloqueo queda con alojamiento PENDIENTE", m.reservas[0]?.data?.estadoAlojamiento === "PENDIENTE", JSON.stringify(m.reservas[0]?.data));
    const p = await plantel({ porteadores: 1 });
    const cuerpoOk = cuerpo(p, [p.guias[0]!, p.porteadores[0]!]);
    await ctx.esperar("CU-40 panel con solicitud de alojamiento Pendiente → 409", "GET", `/salidas/${m.idsalida}/asignacion`, undefined, admin, 409);
    await ctx.esperar("CU-40 asignar con solicitud Pendiente → 409", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpoOk, admin, 409);
    ok("CU-40 con solicitud Pendiente no se asignó nada", (await salidaDb(m.idsalida)).estado === "PUBLICADA" && (await asignados(m.idsalida)).length === 0 && (await permisosPas(m.idsalida)).length === 0 && (await lugares(m.idsalida)) === 10);
    // Se resuelve el alojamiento (CU-34) y ahí sí se puede consolidar
    const sol = await db.solicitud.findFirstOrThrow({ where: { idreserva: m.reservas[0]!.idreserva } });
    await ctx.esperar("CU-34 aceptar la solicitud con el hotel a solicitud → 200", "POST", `/solicitudes/${sol.idsolicitud}/resolver`, { servicioId: m.hotelA!.idservicio, resolucion: "ACEPTADA" }, admin, 200);
    await ctx.esperar("CU-40 resuelta la solicitud, asignar → 200", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpoOk, admin, 200);
    ok("CU-40 salida CERRADA y reserva con alojamiento CONFIRMADO", (await salidaDb(m.idsalida)).estado === "CERRADA" && (await db.reserva.findUniqueOrThrow({ where: { idreserva: m.reservas[0]!.idreserva } })).estadoAlojamiento === "CONFIRMADO");
  });

  await ctx.escenario("CU-40 dotación insuficiente", async () => {
    const m = await montar({ pax: [3], minimoGuias: 2 }); // 2 guías y 2 porteadores
    const p = await plantel({ guias: 2, porteadores: 3 });
    const antes = await lugares(m.idsalida);
    await ctx.esperar("CU-40 menos guías que minimoGuias → 400", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, [p.guias[0]!, p.porteadores[0]!, p.porteadores[1]!]), admin, 400);
    await ctx.esperar("CU-40 menos porteadores que los requeridos → 400", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, [p.guias[0]!, p.guias[1]!, p.porteadores[0]!]), admin, 400);
    ok("CU-40 dotación insuficiente: nada asignado, bloqueo intacto, sin permisos", (await asignados(m.idsalida)).length === 0 && (await lugares(m.idsalida)) === antes && (await vigentes(m.idsalida)) === 0 && (await salidaDb(m.idsalida)).estado === "PUBLICADA");
    await ctx.esperar("CU-40 con la dotación completa → 200", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, [p.guias[0]!, p.guias[1]!, p.porteadores[0]!, p.porteadores[1]!]), admin, 200);
  });

  await ctx.escenario("CU-40 FA1 personal superpuesto", async () => {
    const m1 = await montar({ pax: [1] });
    const p1 = await plantel({ porteadores: 2 });
    await ctx.preparar("Asignar salida 1", "POST", `/salidas/${m1.idsalida}/asignacion`, cuerpo(p1, [p1.guias[0]!, p1.porteadores[0]!]));
    // Salida 2 se superpone un día con la 1
    const m2 = await montar({ pax: [1], inicio: sumar(m1.inicio, 1) });
    const eq = await stockEq(p1.equipo);
    const item = [{ idservicio: p1.equipo, cantidad: 2 }];
    const panel = await ctx.esperar("CU-40 panel de la salida superpuesta → 200", "GET", `/salidas/${m2.idsalida}/asignacion`, undefined, admin, 200);
    const ids = (panel?.personalDisponible ?? []).map((x: any) => x.idpersonal);
    ok("CU-40 FA1 el panel no ofrece al personal ocupado", !ids.includes(p1.guias[0]) && !ids.includes(p1.porteadores[0]) && ids.includes(p1.guias[1]) && ids.includes(p1.porteadores[1]), JSON.stringify(ids));
    await ctx.esperar("CU-40 FA1 guía asignado a otra salida en esas fechas → 400", "POST", `/salidas/${m2.idsalida}/asignacion`, cuerpo(p1, [p1.guias[0]!, p1.porteadores[1]!], item), admin, 400);
    await ctx.esperar("CU-40 FA1 porteador asignado a otra salida en esas fechas → 400", "POST", `/salidas/${m2.idsalida}/asignacion`, cuerpo(p1, [p1.guias[1]!, p1.porteadores[0]!], item), admin, 400);
    ok("CU-40 FA1 nada quedó asignado ni se descontó stock", (await asignados(m2.idsalida)).length === 0 && (await stockEq(p1.equipo)) === eq && (await salidaDb(m2.idsalida)).estado === "PUBLICADA");
    const otroTransporte = (await f.transporte("Loc T", 30)).idservicio; // el de la salida 1 está ocupado en esas fechas
    await ctx.esperar("CU-40 FA1 con personal libre → 200", "POST", `/salidas/${m2.idsalida}/asignacion`, { ...cuerpo(p1, [p1.guias[1]!, p1.porteadores[1]!], item), idtransporte: otroTransporte }, admin, 200);
  });

  await ctx.escenario("CU-40 FA1 habilitación vencida y datos inválidos", async () => {
    const m = await montar({ pax: [1] });
    const guiaVencida = (await f.guia({ habilitacionVence: sumar(m.fin, -1) })).idpersonal; // vence antes del fin del recorrido
    const p = await plantel({ porteadores: 1 });
    const panel = await ctx.esperar("CU-40 panel (guía con habilitación vencida) → 200", "GET", `/salidas/${m.idsalida}/asignacion`, undefined, admin, 200);
    ok("CU-40 FA1 el panel no ofrece al guía con habilitación vencida", !(panel?.personalDisponible ?? []).some((x: any) => x.idpersonal === guiaVencida));
    await ctx.esperar("CU-40 FA1 guía con habilitación vencida → 400", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, [guiaVencida, p.porteadores[0]!]), admin, 400);
    ok("CU-40 FA1 habilitación vencida: nada asignado", (await asignados(m.idsalida)).length === 0 && (await salidaDb(m.idsalida)).estado === "PUBLICADA");
    await ctx.esperar("CU-40 personal inexistente → 400", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, [p.guias[0]!, 99999999]), admin, 400);
    await ctx.esperar("CU-40 sin personal → 400", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, []), admin, 400);
    await ctx.esperar("CU-40 personal repetido → 400", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, [p.guias[0]!, p.guias[0]!]), admin, 400);
    await ctx.esperar("CU-40 sin transporte → 400", "POST", `/salidas/${m.idsalida}/asignacion`, { personalIds: [p.guias[0], p.porteadores[0]], itemsCamping: [] }, admin, 400);
    await ctx.esperar("CU-40 cantidad de camping 0 → 400", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, [p.guias[0]!, p.porteadores[0]!], [{ idservicio: p.equipo, cantidad: 0 }]), admin, 400);
  });

  await ctx.escenario("CU-40 FA2 equipamiento sobre el stock", async () => {
    const m = await montar({ pax: [1] });
    const p = await plantel({ porteadores: 1 });
    const chico = (await f.equipamiento("Loc E", 5)).idservicio;
    const ids = [p.guias[0]!, p.porteadores[0]!];
    await ctx.esperar("CU-40 FA2 equipamiento por encima del stock → 400", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, ids, [{ idservicio: p.equipo, cantidad: 2 }, { idservicio: chico, cantidad: 6 }]), admin, 400);
    ok("CU-40 FA2 ningún stock se descontó y no se asignó nada", (await stockEq(chico)) === 5 && (await stockEq(p.equipo)) === 10 && (await asignados(m.idsalida)).length === 0 && (await db.salidaEquipamiento.count({ where: { idsalida: m.idsalida } })) === 0);
    await ctx.esperar("CU-40 FA2 borde: justo el stock → 200", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, ids, [{ idservicio: chico, cantidad: 5 }]), admin, 200);
    ok("CU-40 FA2 borde: el stock queda en 0", (await stockEq(chico)) === 0);
  });

  await ctx.escenario("CU-40 FA3 transporte sin cupo", async () => {
    const m = await montar({ pax: [2] });
    const p = await plantel({ porteadores: 1, transporteCap: 30 });
    const chico = (await f.transporte("Loc T", 1)).idservicio; // 2 pasajeros no entran
    const ids = [p.guias[0]!, p.porteadores[0]!];
    await ctx.esperar("CU-40 FA3 transporte sin capacidad → 400", "POST", `/salidas/${m.idsalida}/asignacion`, { ...cuerpo(p, ids), idtransporte: chico }, admin, 400);
    ok("CU-40 FA3 sin transporte asignado", (await db.salidaServicio.count({ where: { idsalida: m.idsalida, tipo: "TRANSPORTE" } })) === 0 && (await asignados(m.idsalida)).length === 0);
    await ctx.esperar("CU-40 transporte inexistente → 400", "POST", `/salidas/${m.idsalida}/asignacion`, { ...cuerpo(p, ids), idtransporte: 99999999 }, admin, 400);
    await ctx.esperar("CU-40 asignar con el transporte correcto → 200", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, ids), admin, 200);
    // Otra salida que se superpone no puede usar el mismo vehículo
    const m2 = await montar({ pax: [1], inicio: sumar(m.inicio, 1) });
    const p2 = await plantel({ porteadores: 1 });
    await ctx.esperar("CU-40 FA3 transporte ocupado por otra salida en esas fechas → 400", "POST", `/salidas/${m2.idsalida}/asignacion`, { ...cuerpo(p2, [p2.guias[0]!, p2.porteadores[0]!]), idtransporte: p.transporte }, admin, 400);
    ok("CU-40 FA3 transporte ocupado: nada asignado", (await asignados(m2.idsalida)).length === 0 && (await salidaDb(m2.idsalida)).estado === "PUBLICADA");
  });

  await ctx.escenario("CU-40 FA4 pasaporte del personal vencido", async () => {
    const m = await montar({ pax: [1] });
    const p = await plantel({ porteadores: 0 });
    const vencido = await f.porteador({ pasaporteVence: sumar(m.fin, -1) });
    await ctx.esperar("CU-40 FA4 personal con pasaporte vencido durante el recorrido → 400", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, [p.guias[0]!, vencido], [{ idservicio: p.equipo, cantidad: 2 }]), admin, 400);
    ok("CU-40 FA4 sin permisos emitidos, sin asignar, bloqueo intacto, stock intacto",
      (await vigentes(m.idsalida)) === 0 && (await asignados(m.idsalida)).length === 0 && (await permisosPer(m.idsalida)).length === 0 && (await lugares(m.idsalida)) === 10 && (await stockEq(p.equipo)) === 10 && (await salidaDb(m.idsalida)).estado === "PUBLICADA");
  });

  await ctx.escenario("CU-40 pasajero con pasaporte que vence en el recorrido (RF-47)", async () => {
    const m = await montar({ pax: [] });
    const vence = f.pasajero();
    const normal = f.pasajero();
    const rv = await f.comprar(m.cliente.token, m.idsalida, { pasajeros: [vence, normal] });
    await db.pasajero.update({ where: { nroPasaporte: vence.nroPasaporte }, data: { fechaVencimientoPasaporte: new Date(sumar(m.inicio, 1)) } });
    const p = await plantel({ porteadores: 1 }); // 2 vendidos: 1 guía + 1 porteador
    const r = await ctx.esperar("CU-40 pasaporte del pasajero vence en el recorrido → 200", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, [p.guias[0]!, p.porteadores[0]!]), admin, 200);
    ok("CU-40 respuesta informa un rechazado de tipo PASAJERO", r?.rechazados?.length === 1 && r.rechazados[0].tipo === "PASAJERO" && r.permisosEmitidos === 3, JSON.stringify(r?.rechazados));
    const pp = await permisosPas(m.idsalida);
    const idv = (await db.pasajero.findUniqueOrThrow({ where: { nroPasaporte: vence.nroPasaporte } })).idpasajero;
    const pv = pp.find((x) => x.idpasajero === idv);
    const pn = pp.find((x) => x.idpasajero !== idv);
    ok("CU-40 el permiso del vencido queda Rechazado sin número", pv?.estadoTramite === "Rechazado" && pv.nroPermiso === null, JSON.stringify(pv));
    ok("CU-40 el otro pasajero queda Emitido con número", pn?.estadoTramite === "Emitido" && !!pn.nroPermiso, JSON.stringify(pn));
    ok("CU-40 la salida queda CERRADA", (await salidaDb(m.idsalida)).estado === "CERRADA");
    const per = await permisosPer(m.idsalida);
    ok("CU-40 el personal sí tiene permiso Emitido", per.length === 2 && per.every((x) => x.estadoTramite === "Emitido" && !!x.nroPermiso));
    // Lugares del bloqueo = personas con permiso (1 pasajero + guía + porteador): el del vencido se liberó
    ok("CU-40 el lugar del pasajero rechazado se liberó ante la autoridad", (await lugares(m.idsalida)) === 3 && (await vigentes(m.idsalida)) === 3, `lugares ${await lugares(m.idsalida)}, vigentes ${await vigentes(m.idsalida)}`);
    ok("CU-40 el cupo del día quedó en 3", (await ocupados(m.inicio)) === 3, `ocupados ${await ocupados(m.inicio)}`);
    void rv;
  });

  await ctx.escenario("CU-40 camino feliz", async () => {
    const m = await montar({ pax: [2, 1] }); // 3 vendidos: 1 guía y 2 porteadores
    ok("CU-40 antes de asignar: hotel en 44 y stock de alojamiento 3", (await capacidad(m.hotel!.idservicio)) === 44 && (await salidaDb(m.idsalida)).stockLocalAlojamiento === 3);
    const p = await plantel({ porteadores: 2 });
    const ocupadosAntes = await ocupados(m.inicio);
    const panel = await ctx.esperar("CU-40 panel → 200", "GET", `/salidas/${m.idsalida}/asignacion`, undefined, admin, 200);
    ok("CU-40 panel informa vendidos, dotación y sobrantes", panel?.pasajerosConfirmados === 3 && panel.dotacionRequerida?.guias === 1 && panel.dotacionRequerida?.porteadores === 2 && panel.lugaresSobrantes === 4 && panel.bloqueoInicial === 10, JSON.stringify(panel));
    const personalIds = [p.guias[0]!, p.porteadores[0]!, p.porteadores[1]!];
    const r = await ctx.esperar("CU-40 asignar recursos → 200", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, personalIds, [{ idservicio: p.equipo, cantidad: 3 }]), admin, 200);
    const s = await salidaDb(m.idsalida);
    ok("CU-40 salida CERRADA con stocks en 0 y nada por liberar", s.estado === "CERRADA" && s.stockLocal === 0 && s.stockLocalAlojamiento === 0 && s.lugaresPorLiberar === 0, JSON.stringify(s));
    ok("CU-40 sobrantes liberados: lugares del bloqueo = pasajeros + personal (6)", (await lugares(m.idsalida)) === 6 && r?.lugaresLiberados === 4, `lugares ${await lugares(m.idsalida)}, informados ${r?.lugaresLiberados}`);
    ok("CU-40 el cupo del día bajó los 4 sobrantes", ocupadosAntes - (await ocupados(m.inicio)) === 4);
    ok("CU-40 las plazas sobrantes vuelven al hotel (44 → 47)", (await capacidad(m.hotel!.idservicio)) === 47, `capacidad ${await capacidad(m.hotel!.idservicio)}`);
    const pp = await permisosPas(m.idsalida);
    const per = await permisosPer(m.idsalida);
    ok("CU-40 3 permisos de pasajero Emitido con número", pp.length === 3 && pp.every((x) => x.estadoTramite === "Emitido" && !!x.nroPermiso));
    ok("CU-40 3 permisos de personal Emitido con número", per.length === 3 && per.every((x) => x.estadoTramite === "Emitido" && !!x.nroPermiso));
    ok("CU-40 permisos vigentes ante la autoridad = lugares", (await vigentes(m.idsalida)) === 6);
    ok("CU-40 personal, transporte y equipamiento asignados; stock 10 → 7",
      (await asignados(m.idsalida)).join() === [...personalIds].sort((a, b) => a - b).join() && (await db.salidaServicio.count({ where: { idsalida: m.idsalida, idservicio: p.transporte, tipo: "TRANSPORTE" } })) === 1 && (await stockEq(p.equipo)) === 7);
    await ctx.esperar("CU-40 repetir la asignación → 400", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, personalIds), admin, 400);
    ok("CU-40 repetir no duplicó nada", (await permisosPer(m.idsalida)).length === 3 && (await stockEq(p.equipo)) === 7);
    const compra = f.compra(m.idsalida);
    await ctx.esperar("CU-30 comprar en una salida ya CERRADA → 400", "POST", "/reservas", compra, m.cliente.token, 400);
  });

  await ctx.escenario("CU-40 salida que ya inició", async () => {
    const m = await montar({ pax: [1] });
    const p = await plantel({ porteadores: 1 });
    await f.moverFechas(m.idsalida, fecha(-1), fecha(1));
    await ctx.esperar("CU-40 panel de salida ya iniciada → 400", "GET", `/salidas/${m.idsalida}/asignacion`, undefined, admin, 400);
    await ctx.esperar("CU-40 asignar a salida ya iniciada → 400", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, [p.guias[0]!, p.porteadores[0]!]), admin, 400);
    ok("CU-40 salida iniciada: nada asignado", (await asignados(m.idsalida)).length === 0 && (await salidaDb(m.idsalida)).estado === "PUBLICADA");
  });

  // ======================================================================
  ctx.seccion("CU-38 Reemplazo de personal");

  await ctx.escenario("CU-38 reemplazo de personal con permiso emitido", async () => {
    const a = await asignada([3]); // guía 0 + 2 porteadores; sobran guias[1] y porteadores[2]
    const [g0, g1] = a.guias as [number, number];
    const [p0, p1, p2] = a.porteadores as [number, number, number];
    const lista = await ctx.esperar("CU-38 consultar personal de la salida → 200", "GET", `/salidas/${a.idsalida}/personal`, undefined, admin, 200);
    ok("CU-38 lista los 3 asignados con su permiso", lista?.personal?.length === 3 && lista.personal.every((x: any) => !!x.permiso), JSON.stringify(lista?.personal));
    const reempl = await ctx.esperar("CU-38 reemplazantes de un porteador → 200", "GET", `/salidas/${a.idsalida}/personal/${p0}/reemplazantes`, undefined, admin, 200);
    const ids = (reempl ?? []).map((x: any) => x.idpersonal);
    ok("CU-38 ofrece solo porteadores libres que no están asignados", ids.includes(p2) && !ids.includes(p1) && !ids.includes(p0) && !ids.includes(g1), JSON.stringify(ids));

    const viejo = (await permisosPer(a.idsalida)).find((x) => x.idpersonal === p0)!;
    const lugaresAntes = await lugares(a.idsalida);
    const vigAntes = await vigentes(a.idsalida);
    const r = await ctx.esperar("CU-38 reemplazar porteador con permiso emitido → 200", "POST", `/salidas/${a.idsalida}/reemplazos`, { idoriginal: p0, idreemplazante: p2, motivo: "Enfermedad del porteador" }, admin, 200);
    const per = await permisosPer(a.idsalida);
    const pv = per.find((x) => x.idpermisopersonal === viejo.idpermisopersonal);
    const pn = per.find((x) => x.idpersonal === p2);
    ok("CU-38 el permiso del viejo queda Perdido", pv?.estadoTramite === "Perdido", JSON.stringify(pv));
    ok("CU-38 el nuevo tiene permiso Emitido con otro número", pn?.estadoTramite === "Emitido" && !!pn.nroPermiso && pn.nroPermiso !== viejo.nroPermiso && r?.permisoNuevo === pn.nroPermiso && r?.permisoDadoDeBaja === viejo.nroPermiso, JSON.stringify(pn));
    ok("CU-38 RF-48: los lugares del bloqueo no cambian", (await lugares(a.idsalida)) === lugaresAntes && (await vigentes(a.idsalida)) === vigAntes, `lugares ${await lugares(a.idsalida)} (antes ${lugaresAntes}), vigentes ${await vigentes(a.idsalida)} (antes ${vigAntes})`);
    ok("CU-38 la asignación cambió de persona", (await asignados(a.idsalida)).join() === [g0, p1, p2].sort((x, y) => x - y).join());
    ok("CU-38 el permiso viejo ya no existe ante la autoridad", !!viejo.nroPermiso && !(await db.autoridadPermiso.findUnique({ where: { nroPermiso: viejo.nroPermiso } })));
    ok("CU-38 queda auditado con el motivo", (await db.registroAuditoria.count({ where: { idsalida: a.idsalida, motivo: "Enfermedad del porteador" } })) === 1);
    // El que salió vuelve a estar disponible como reemplazante
    const otra = await ctx.esperar("CU-38 el que salió vuelve a ser reemplazante → 200", "GET", `/salidas/${a.idsalida}/personal/${p1}/reemplazantes`, undefined, admin, 200);
    ok("CU-38 el reemplazado figura entre los disponibles", (otra ?? []).some((x: any) => x.idpersonal === p0));

    // Reemplazo de guía por guía
    await ctx.esperar("CU-38 reemplazar al guía → 200", "POST", `/salidas/${a.idsalida}/reemplazos`, { idoriginal: g0, idreemplazante: g1, motivo: "Cambio de guía" }, admin, 200);
    ok("CU-38 reemplazo del guía: lugares sin cambios y 6 vigentes", (await lugares(a.idsalida)) === lugaresAntes && (await vigentes(a.idsalida)) === vigAntes);
  });

  await ctx.escenario("CU-38 reemplazos inválidos", async () => {
    const a = await asignada([3]);
    const [g0, g1] = a.guias as [number, number];
    const [p0, p1, p2] = a.porteadores as [number, number, number];
    const antes = { asig: (await asignados(a.idsalida)).join(), per: (await permisosPer(a.idsalida)).length, lug: await lugares(a.idsalida) };
    const post = (nombre: string, body: any, st: number) => ctx.esperar(nombre, "POST", `/salidas/${a.idsalida}/reemplazos`, { motivo: "Motivo de prueba", ...body }, admin, st);

    await post("CU-38 reemplazante de otro rol → 400", { idoriginal: p0, idreemplazante: g1 }, 400);
    await post("CU-38 reemplazante ya asignado a la salida → 400", { idoriginal: p0, idreemplazante: p1 }, 400);
    await post("CU-38 original que no está asignado → 400", { idoriginal: p2, idreemplazante: p1 }, 400);
    await post("CU-38 reemplazante inexistente → 404", { idoriginal: p0, idreemplazante: 99999999 }, 404);
    await post("CU-38 reemplazante igual al original → 400", { idoriginal: p0, idreemplazante: p0 }, 400);
    await post("CU-38 motivo demasiado corto → 400", { idoriginal: p0, idreemplazante: p2, motivo: "no" }, 400);
    const venc = await f.porteador({ pasaporteVence: sumar(a.fin, -1) });
    await post("CU-38 reemplazante con pasaporte que vence en el recorrido → 400", { idoriginal: p0, idreemplazante: venc }, 400);
    const guiaVenc = (await f.guia({ habilitacionVence: sumar(a.fin, -1) })).idpersonal;
    await post("CU-38 reemplazante guía con habilitación vencida → 400", { idoriginal: g0, idreemplazante: guiaVenc }, 400);
    // Ocupado en otra salida que se superpone
    const m2 = await montar({ pax: [1], inicio: sumar(a.inicio, 1) });
    const p2b = await plantel({ porteadores: 1 });
    await ctx.preparar("Asignar salida superpuesta", "POST", `/salidas/${m2.idsalida}/asignacion`, cuerpo(p2b, [p2b.guias[0]!, p2b.porteadores[0]!]));
    await post("CU-38 reemplazante asignado a otra salida en esas fechas → 400", { idoriginal: p0, idreemplazante: p2b.porteadores[0]! }, 400);
    await ctx.esperar("CU-38 reemplazantes de una persona no asignada → 400", "GET", `/salidas/${a.idsalida}/personal/${p2}/reemplazantes`, undefined, admin, 400);
    await ctx.esperar("CU-38 personal de una salida inexistente → 404", "GET", `/salidas/99999999/personal`, undefined, admin, 404);

    ok("CU-38 los rechazos no cambiaron asignación, permisos ni bloqueo",
      (await asignados(a.idsalida)).join() === antes.asig && (await permisosPer(a.idsalida)).length === antes.per && (await lugares(a.idsalida)) === antes.lug && (await vigentes(a.idsalida)) === antes.lug);
  });

  await ctx.escenario("CU-38 reemplazo de personal rechazado (RF-47)", async () => {
    const m = await montar({ pax: [3] });
    const p = await plantel({ porteadores: 3 });
    // La autoridad rechaza a quien no tiene número de pasaporte (motivoRechazo): se lo dejamos en blanco por base
    await db.personal.update({ where: { idpersonal: p.porteadores[0]! }, data: { nroPasaporte: " " } });
    const ids = [p.guias[0]!, p.porteadores[0]!, p.porteadores[1]!];
    const r = await ctx.esperar("CU-38 asignar con un porteador sin pasaporte → 200", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, ids), admin, 200);
    ok("CU-38 la asignación informa un rechazado de tipo PERSONAL", r?.rechazados?.length === 1 && r.rechazados[0].tipo === "PERSONAL", JSON.stringify(r?.rechazados));
    const rech = (await permisosPer(m.idsalida)).find((x) => x.idpersonal === p.porteadores[0]);
    ok("CU-38 su permiso queda Rechazado sin número", rech?.estadoTramite === "Rechazado" && rech.nroPermiso === null, JSON.stringify(rech));
    ok("CU-38 su lugar queda reservado: 6 lugares y 5 permisos vigentes", (await lugares(m.idsalida)) === 6 && (await vigentes(m.idsalida)) === 5, `lugares ${await lugares(m.idsalida)}, vigentes ${await vigentes(m.idsalida)}`);

    const rr = await ctx.esperar("CU-38 reemplazar al rechazado → 200", "POST", `/salidas/${m.idsalida}/reemplazos`, { idoriginal: p.porteadores[0], idreemplazante: p.porteadores[2], motivo: "Pasaporte sin número" }, admin, 200);
    const nuevo = (await permisosPer(m.idsalida)).find((x) => x.idpersonal === p.porteadores[2]);
    ok("CU-38 el nuevo queda Emitido con número", nuevo?.estadoTramite === "Emitido" && !!nuevo.nroPermiso, JSON.stringify(nuevo));
    ok("CU-38 no hubo baja de permiso (el viejo no tenía)", rr?.permisoDadoDeBaja === null && !!rr?.permisoNuevo);
    ok("CU-38 los 6 lugares ahora tienen permiso vigente", (await lugares(m.idsalida)) === 6 && (await vigentes(m.idsalida)) === 6, `lugares ${await lugares(m.idsalida)}, vigentes ${await vigentes(m.idsalida)}`);
    ok("CU-38 el rechazado salió de la asignación", !(await asignados(m.idsalida)).includes(p.porteadores[0]!));
  });

  await ctx.escenario("CU-38 salida iniciada o cancelada", async () => {
    const a = await asignada([1]);
    const b = await asignada([1]);
    const body = { idoriginal: a.porteadores[0], idreemplazante: a.porteadores[1], motivo: "Motivo de prueba" };
    const antes = (await asignados(a.idsalida)).join();
    await f.moverFechas(a.idsalida, fecha(-1), fecha(1));
    await ctx.esperar("CU-38 FA2 reemplazar en salida ya iniciada → 400", "POST", `/salidas/${a.idsalida}/reemplazos`, body, admin, 400);
    await ctx.esperar("CU-38 FA2 consultar personal de salida iniciada → 400", "GET", `/salidas/${a.idsalida}/personal`, undefined, admin, 400);
    ok("CU-38 FA2 la asignación no cambió", (await asignados(a.idsalida)).join() === antes);
    await ctx.preparar("Cancelar salida", "POST", `/salidas/${b.idsalida}/cancelar`, { motivo: "Salida cancelada" });
    await ctx.esperar("CU-38 reemplazar en salida cancelada → 400", "POST", `/salidas/${b.idsalida}/reemplazos`, { idoriginal: b.porteadores[0], idreemplazante: b.porteadores[1], motivo: "Motivo de prueba" }, admin, 400);
  });

  // ======================================================================
  ctx.seccion("CU-39 Logística");

  await ctx.escenario("CU-39 equipamiento y stock", async () => {
    const a = await asignada([2]); // equipo: 3 asignados (stock 7), equipo2: 2 (stock 8)
    const chico = (await f.equipamiento("Loc E", 4)).idservicio;
    const url = `/salidas/${a.idsalida}/logistica`;
    const panel = await ctx.esperar("CU-39 panel de logística → 200", "GET", url, undefined, admin, 200);
    ok("CU-39 el panel muestra el equipamiento y el transporte asignados", panel?.equipamiento?.length === 2 && panel.transporte?.idservicio === a.transporte, JSON.stringify(panel));
    const disp = await ctx.esperar("CU-39 equipamiento disponible → 200", "GET", `${url}/disponibles?tipo=EQUIPAMIENTO`, undefined, admin, 200);
    ok("CU-39 el disponible informa el stock", (disp ?? []).find((x: any) => x.idservicio === chico)?.disponibilidad?.cantidadDisponible === 4);

    await ctx.esperar("CU-39 agregar equipamiento por encima del stock → 400", "PUT", url, { itemsNuevos: [{ tipo: "EQUIPAMIENTO", idservicio: chico, cantidad: 5 }] }, admin, 400);
    ok("CU-39 stock intacto y sin fila nueva", (await stockEq(chico)) === 4 && (await db.salidaEquipamiento.count({ where: { idsalida: a.idsalida, idservicio: chico } })) === 0);
    await ctx.esperar("CU-39 agregar equipamiento justo el stock → 200", "PUT", url, { itemsNuevos: [{ tipo: "EQUIPAMIENTO", idservicio: chico, cantidad: 4 }], motivo: "Más carpas" }, admin, 200);
    ok("CU-39 stock descontado a 0 y auditado", (await stockEq(chico)) === 0 && (await db.salidaEquipamiento.count({ where: { idsalida: a.idsalida, idservicio: chico } })) === 1 && (await db.registroAuditoria.count({ where: { idsalida: a.idsalida, motivo: "Más carpas" } })) === 1);

    await ctx.esperar("CU-39 asignar un equipamiento que ya está asignado → 400", "PUT", url, { itemsNuevos: [{ tipo: "EQUIPAMIENTO", idservicio: a.equipo, cantidad: 1 }] }, admin, 400);
    await ctx.esperar("CU-39 quitar un equipamiento que no está asignado → 400", "PUT", url, { itemsDesasignar: [{ tipo: "EQUIPAMIENTO", idservicio: (await f.equipamiento("Loc E", 1)).idservicio }] }, admin, 400);
    ok("CU-39 los rechazos no tocaron el stock", (await stockEq(a.equipo)) === 7);

    await ctx.esperar("CU-39 quitar equipamiento → 200", "PUT", url, { itemsDesasignar: [{ tipo: "EQUIPAMIENTO", idservicio: a.equipo }] }, admin, 200);
    ok("CU-39 quitar devuelve el stock (7 → 10) y borra la fila", (await stockEq(a.equipo)) === 10 && (await db.salidaEquipamiento.count({ where: { idsalida: a.idsalida, idservicio: a.equipo } })) === 0);
    // Cambiar cantidad: desasignar y asignar en la misma operación (sin quedar en un estado intermedio)
    await ctx.esperar("CU-39 cambiar la cantidad (quitar y agregar a la vez) → 200", "PUT", url, { itemsDesasignar: [{ tipo: "EQUIPAMIENTO", idservicio: a.equipo2 }], itemsNuevos: [{ tipo: "EQUIPAMIENTO", idservicio: a.equipo2, cantidad: 6 }] }, admin, 200);
    ok("CU-39 stock coherente tras cambiar la cantidad (10 − 6 = 4)", (await stockEq(a.equipo2)) === 4 && (await db.salidaEquipamiento.findFirstOrThrow({ where: { idsalida: a.idsalida, idservicio: a.equipo2 } })).cantidad === 6);
    await ctx.esperar("CU-39 cuerpo vacío → 400", "PUT", url, {}, admin, 400);
    await ctx.esperar("CU-39 cantidad 0 → 400", "PUT", url, { itemsNuevos: [{ tipo: "EQUIPAMIENTO", idservicio: a.equipo, cantidad: 0 }] }, admin, 400);
  });

  await ctx.escenario("CU-39 transporte", async () => {
    const a = await asignada([2]);
    const url = `/salidas/${a.idsalida}/logistica`;
    const chico = (await f.transporte("Loc T", 1)).idservicio;
    const nuevo = (await f.transporte("Loc T", 30)).idservicio;
    await ctx.esperar("CU-39 transporte nuevo sin quitar el actual → 400", "PUT", url, { itemsNuevos: [{ tipo: "TRANSPORTE", idservicio: nuevo, comprobanteReserva: "CMP-1" }] }, admin, 400);
    await ctx.esperar("CU-39 transporte sin comprobante → 400", "PUT", url, { itemsDesasignar: [{ tipo: "TRANSPORTE", idservicio: a.transporte }], itemsNuevos: [{ tipo: "TRANSPORTE", idservicio: nuevo }] }, admin, 400);
    await ctx.esperar("CU-39 transporte sin capacidad → 400", "PUT", url, { itemsDesasignar: [{ tipo: "TRANSPORTE", idservicio: a.transporte }], itemsNuevos: [{ tipo: "TRANSPORTE", idservicio: chico, comprobanteReserva: "CMP-2" }] }, admin, 400);
    ok("CU-39 los rechazos dejaron el transporte original (la transacción se revirtió)", (await db.salidaServicio.findFirst({ where: { idsalida: a.idsalida, tipo: "TRANSPORTE" } }))?.idservicio === a.transporte);
    await ctx.esperar("CU-39 cambiar de transporte → 200", "PUT", url, { itemsDesasignar: [{ tipo: "TRANSPORTE", idservicio: a.transporte }], itemsNuevos: [{ tipo: "TRANSPORTE", idservicio: nuevo, comprobanteReserva: "CMP-3" }] }, admin, 200);
    const st = await db.salidaServicio.findFirst({ where: { idsalida: a.idsalida, tipo: "TRANSPORTE" } });
    ok("CU-39 el transporte nuevo queda con su comprobante", st?.idservicio === nuevo && st.comprobanteReserva === "CMP-3");
    const q = await ctx.esperar("CU-39 quitar el transporte → 200", "PUT", url, { itemsDesasignar: [{ tipo: "TRANSPORTE", idservicio: nuevo }] }, admin, 200);
    ok("CU-39 sin transporte: queda 'Sin asignar' con advertencia", (q?.advertencias ?? []).length === 1 && q.panel?.transporte === null, JSON.stringify(q?.advertencias));
  });

  await ctx.escenario("CU-39 sin asignación previa o ya iniciada", async () => {
    const m = await montar({ pax: [1] });
    const eq = (await f.equipamiento("Loc E", 3)).idservicio;
    const url = `/salidas/${m.idsalida}/logistica`;
    await ctx.esperar("CU-39 salida sin asignación previa → 400", "PUT", url, { itemsNuevos: [{ tipo: "EQUIPAMIENTO", idservicio: eq, cantidad: 1 }] }, admin, 400);
    await ctx.esperar("CU-39 disponibles de salida sin asignación previa → 400", "GET", `${url}/disponibles?tipo=EQUIPAMIENTO`, undefined, admin, 400);
    ok("CU-39 sin asignación previa: stock intacto", (await stockEq(eq)) === 3 && (await db.salidaEquipamiento.count({ where: { idsalida: m.idsalida } })) === 0);
    await ctx.esperar("CU-39 salida inexistente → 404", "PUT", `/salidas/99999999/logistica`, { itemsNuevos: [{ tipo: "EQUIPAMIENTO", idservicio: eq, cantidad: 1 }] }, admin, 404);
    await ctx.esperar("CU-39 tipo de recurso inválido → 400", "GET", `${url}/disponibles?tipo=ALOJAMIENTO`, undefined, admin, 400);

    const a = await asignada([1]);
    await f.moverFechas(a.idsalida, fecha(-1), fecha(1));
    await ctx.esperar("CU-39 salida ya iniciada → 400", "PUT", `/salidas/${a.idsalida}/logistica`, { itemsNuevos: [{ tipo: "EQUIPAMIENTO", idservicio: eq, cantidad: 1 }] }, admin, 400);
    ok("CU-39 salida iniciada: stock intacto", (await stockEq(eq)) === 3);
  });

  // ======================================================================
  ctx.seccion("CU-37 Cancelar salida");

  await ctx.escenario("CU-37 cancelar salida CERRADA con reservas", async () => {
    // Hotel con bloqueo y otro a solicitud en la misma localidad
    const m = await montar({ pax: [], aSolicitud: true });
    const original = 50;
    ok("CU-37 hotel con bloqueo: 50 → 44 al crear la salida", (await capacidad(m.hotel!.idservicio)) === 44);
    // Solo 2 plazas del bloqueo quedan para la venta: la segunda compra no entra y pide solicitud (devolvemos las otras 4 al hotel)
    await db.salida.update({ where: { idsalida: m.idsalida }, data: { stockLocalAlojamiento: 2 } });
    await db.servicioAlojamiento.update({ where: { idservicio: m.hotel!.idservicio }, data: { capacidadDisponible: { increment: 4 } } });
    const r1 = await f.comprar(m.cliente.token, m.idsalida, { n: 2 });
    const cli2 = await f.cliente();
    const r2 = await f.comprar(cli2.token, m.idsalida, { n: 2 });
    ok("CU-37 reserva 1 con plazas del bloqueo y reserva 2 pendiente de solicitud", r1.data.estadoAlojamiento === "CONFIRMADO" && r2.data.estadoAlojamiento === "PENDIENTE", `${r1.data.estadoAlojamiento}/${r2.data.estadoAlojamiento}`);
    const sol = await db.solicitud.findFirstOrThrow({ where: { idreserva: r2.idreserva } });
    await ctx.esperar("CU-34 confirmar la solicitud con el hotel a solicitud → 200", "POST", `/solicitudes/${sol.idsolicitud}/resolver`, { servicioId: m.hotelA!.idservicio, resolucion: "ACEPTADA" }, admin, 200);
    const p = await plantel({ porteadores: 2 }); // 4 vendidos: 1 guía + 2 porteadores
    await ctx.preparar("Asignar recursos", "POST", `/salidas/${m.idsalida}/asignacion`, cuerpo(p, [p.guias[0]!, p.porteadores[0]!, p.porteadores[1]!], [{ idservicio: p.equipo, cantidad: 4 }]));
    ok("CU-37 antes de cancelar: salida CERRADA, equipo 10 → 6, hotel 48", (await salidaDb(m.idsalida)).estado === "CERRADA" && (await stockEq(p.equipo)) === 6 && (await capacidad(m.hotel!.idservicio)) === 48);

    const capHotelA = await capacidad(m.hotelA!.idservicio);
    const ocupadosAntes = await ocupados(m.inicio);
    const lugaresAntes = await lugares(m.idsalida);
    const pagos = await db.pago.findMany({ where: { reserva: { idsalida: m.idsalida } } });
    const abonado = pagos.reduce((t, x) => t + x.monto, 0);

    const imp = await ctx.esperar("CU-37 impacto de la cancelación → 200", "GET", `/salidas/${m.idsalida}/cancelacion`, undefined, admin, 200);
    ok("CU-37 el impacto informa 2 reservas, el total abonado y 7 permisos", imp?.reservasAfectadas === 2 && imp.totalAReembolsar === abonado && imp.permisosQuePasanAPerdido === 7, JSON.stringify(imp));
    const r = await ctx.esperar("CU-37 cancelar salida CERRADA → 200", "POST", `/salidas/${m.idsalida}/cancelar`, { motivo: "Falta de pasajeros" }, admin, 200);
    ok("CU-37 la respuesta informa 2 reservas y el reembolso total", r?.reservasCanceladas === 2 && r.reembolsoTotal === abonado, JSON.stringify(r));

    ok("CU-37 salida CANCELADA y sin bloqueo registrado", (await salidaDb(m.idsalida)).estado === "CANCELADA" && (await salidaDb(m.idsalida)).idbloqueo === null);
    const reservas = await db.reserva.findMany({ where: { idsalida: m.idsalida }, include: { pagos: true, reembolsos: true } });
    ok("CU-37 todas las reservas CANCELADA", reservas.length === 2 && reservas.every((x) => x.estado === "CANCELADA"));
    ok("CU-37 cada reserva tiene un reembolso del 100% de lo abonado",
      reservas.every((x) => x.reembolsos.length === 1 && x.reembolsos[0]!.montoReembolsado === x.pagos.reduce((t, y) => t + y.monto, 0) && x.reembolsos[0]!.montoReembolsado === x.precioCongelado && /100%/.test(x.reembolsos[0]!.condicionAplicada ?? "")),
      JSON.stringify(reservas.map((x) => x.reembolsos)));
    const pp = await permisosPas(m.idsalida);
    const per = await permisosPer(m.idsalida);
    ok("CU-37 los 7 permisos pasan a Perdido (ninguno Emitido)", pp.length === 4 && per.length === 3 && [...pp, ...per].every((x) => x.estadoTramite === "Perdido"), JSON.stringify([...pp, ...per].map((x) => x.estadoTramite)));
    ok("CU-37 el bloqueo ante la autoridad queda en 0 y el cupo del día lo recupera", (await lugares(m.idsalida)) === 0 && ocupadosAntes - (await ocupados(m.inicio)) === lugaresAntes, `lugares ${await lugares(m.idsalida)}, cupo recuperado ${ocupadosAntes - (await ocupados(m.inicio))} de ${lugaresAntes}`);
    ok("CU-37 el equipamiento vuelve al stock (6 → 10)", (await stockEq(p.equipo)) === 10);
    ok("CU-37 el hotel con bloqueo vuelve EXACTO a su capacidad original (50)", (await capacidad(m.hotel!.idservicio)) === original, `capacidad ${await capacidad(m.hotel!.idservicio)}`);
    ok("CU-37 el hotel a solicitud NO cambia su capacidad", (await capacidad(m.hotelA!.idservicio)) === capHotelA, `capacidad ${await capacidad(m.hotelA!.idservicio)} (antes ${capHotelA})`);
    ok("CU-37 la solicitud CONFIRMADA queda CANCELADA", (await db.solicitud.findUniqueOrThrow({ where: { idsolicitud: sol.idsolicitud } })).estado === "CANCELADA");
    // El personal y el transporte quedan libres: se pueden asignar a otra salida en las mismas fechas
    const m2 = await montar({ pax: [1], inicio: m.inicio });
    await ctx.esperar("CU-37 el personal y el transporte de la cancelada se reasignan en esas fechas → 200", "POST", `/salidas/${m2.idsalida}/asignacion`, { personalIds: [p.guias[0], p.porteadores[0]], idtransporte: p.transporte, itemsCamping: [] }, admin, 200);

    await ctx.esperar("CU-37 repetir la cancelación → 400", "POST", `/salidas/${m.idsalida}/cancelar`, { motivo: "Otra vez" }, admin, 400);
    await ctx.esperar("CU-37 impacto de una salida ya cancelada → 400", "GET", `/salidas/${m.idsalida}/cancelacion`, undefined, admin, 400);
    ok("CU-37 repetir no duplicó reembolsos ni tocó el stock", (await db.reembolso.count({ where: { reserva: { idsalida: m.idsalida } } })) === 2 && (await stockEq(p.equipo)) === 10 && (await capacidad(m.hotel!.idservicio)) === original);
  });

  await ctx.escenario("CU-37 cancelar salida PUBLICADA con solicitudes pendiente y confirmada", async () => {
    const m = await montar({ bloqueo: false, aSolicitud: true, pax: [2] });
    const cli2 = await f.cliente();
    const r2 = await f.comprar(cli2.token, m.idsalida, { n: 1 });
    const r1 = m.reservas[0]!;
    const sol1 = await db.solicitud.findFirstOrThrow({ where: { idreserva: r1.idreserva } });
    const sol2 = await db.solicitud.findFirstOrThrow({ where: { idreserva: r2.idreserva } });
    await ctx.esperar("CU-34 confirmar una solicitud → 200", "POST", `/solicitudes/${sol1.idsolicitud}/resolver`, { servicioId: m.hotelA!.idservicio, resolucion: "ACEPTADA" }, admin, 200);
    ok("CU-37 hay una solicitud CONFIRMADA y otra PENDIENTE", (await db.solicitud.findUniqueOrThrow({ where: { idsolicitud: sol1.idsolicitud } })).estado === "CONFIRMADA" && (await db.solicitud.findUniqueOrThrow({ where: { idsolicitud: sol2.idsolicitud } })).estado === "PENDIENTE");
    const capA = await capacidad(m.hotelA!.idservicio);
    const lug = await lugares(m.idsalida);
    await ctx.esperar("CU-37 cancelar salida PUBLICADA → 200", "POST", `/salidas/${m.idsalida}/cancelar`, { motivo: "Clima adverso" }, admin, 200);
    ok("CU-37 las dos solicitudes quedan CANCELADA", (await db.solicitud.findMany({ where: { reserva: { idsalida: m.idsalida } } })).every((x) => x.estado === "CANCELADA"));
    const reservas = await db.reserva.findMany({ where: { idsalida: m.idsalida }, include: { reembolsos: true } });
    ok("CU-37 reservas CANCELADA con su reembolso completo", reservas.length === 2 && reservas.every((x) => x.estado === "CANCELADA" && x.reembolsos.length === 1 && x.reembolsos[0]!.montoReembolsado === x.precioCongelado));
    ok("CU-37 hotel a solicitud sin cambios y bloqueo en 0", (await capacidad(m.hotelA!.idservicio)) === capA && lug === 10 && (await lugares(m.idsalida)) === 0);
    ok("CU-37 la solicitud pendiente ya no figura en las pendientes", !(await ctx.preparar("Solicitudes", "GET", "/solicitudes")).some((s: any) => s.idsolicitud === sol2.idsolicitud));
  });

  await ctx.escenario("CU-37 cancelar sin reservas y datos inválidos", async () => {
    const m = await montar({ pax: [] });
    const cap = await capacidad(m.hotel!.idservicio);
    await ctx.esperar("CU-37 motivo vacío → 400", "POST", `/salidas/${m.idsalida}/cancelar`, { motivo: "" }, admin, 400);
    await ctx.esperar("CU-37 sin motivo → 400", "POST", `/salidas/${m.idsalida}/cancelar`, {}, admin, 400);
    await ctx.esperar("CU-37 salida inexistente → 404", "POST", `/salidas/99999999/cancelar`, { motivo: "No existe" }, admin, 404);
    ok("CU-37 los rechazos no cancelaron nada", (await salidaDb(m.idsalida)).estado === "PUBLICADA" && (await lugares(m.idsalida)) === 10);
    await ctx.esperar("CU-37 FA2 cancelar sin reservas → 200", "POST", `/salidas/${m.idsalida}/cancelar`, { motivo: "Sin ventas" }, admin, 200);
    ok("CU-37 sin reservas: el hotel recupera las 6 plazas bloqueadas (44 → 50) y el bloqueo queda en 0", (await capacidad(m.hotel!.idservicio)) === cap + 6 && cap + 6 === 50 && (await lugares(m.idsalida)) === 0, `capacidad ${await capacidad(m.hotel!.idservicio)}`);
  });

  await ctx.escenario("CU-37 salida en curso", async () => {
    const m = await montar({ pax: [1] });
    await f.moverFechas(m.idsalida, fecha(-1), fecha(1));
    const lug = await lugares(m.idsalida);
    await ctx.esperar("CU-37 impacto de salida en curso → 400", "GET", `/salidas/${m.idsalida}/cancelacion`, undefined, admin, 400);
    await ctx.esperar("CU-37 cancelar salida en curso → 400", "POST", `/salidas/${m.idsalida}/cancelar`, { motivo: "Ya empezó" }, admin, 400);
    const res = await db.reserva.findMany({ where: { idsalida: m.idsalida } });
    ok("CU-37 salida en curso: nada cambió (salida, reservas, bloqueo, reembolsos)", (await salidaDb(m.idsalida)).estado === "PUBLICADA" && res.every((x) => x.estado === "CONFIRMADA") && (await lugares(m.idsalida)) === lug && (await db.reembolso.count({ where: { reserva: { idsalida: m.idsalida } } })) === 0);
    await db.salida.update({ where: { idsalida: m.idsalida }, data: { estado: "EN_CURSO" } });
    await ctx.esperar("CU-37 cancelar salida EN_CURSO → 400", "POST", `/salidas/${m.idsalida}/cancelar`, { motivo: "Ya empezó" }, admin, 400);
  });

  await ctx.escenario("CU-37 autoridad caída", async () => {
    const m = await montar({ pax: [2] });
    const original = 50;
    ok("CU-37 hotel con 4 plazas sin vender y 2 vendidas (44)", (await capacidad(m.hotel!.idservicio)) === 44);
    const ocup = await ocupados(m.inicio);
    await ctx.esperar("CU-37 FA autoridad caída: responde 503", "POST", `/salidas/${m.idsalida}/cancelar`, { motivo: "Autoridad caída" }, admin, 503, ctx.backCaido);
    const s = await salidaDb(m.idsalida);
    ok("CU-37 la salida igual quedó CANCELADA, con reserva cancelada y reembolso", s.estado === "CANCELADA" && (await db.reserva.findFirstOrThrow({ where: { idsalida: m.idsalida } })).estado === "CANCELADA" && (await db.reembolso.count({ where: { reserva: { idsalida: m.idsalida } } })) === 1);
    ok("CU-37 el bloqueo sigue tomado ante la autoridad (se reintenta)", s.idbloqueo !== null && (await lugares(m.idsalida)) === 10 && (await ocupados(m.inicio)) === ocup);
    ok("CU-37 el hotel ya recuperó sus plazas (50)", (await capacidad(m.hotel!.idservicio)) === original);
    await ctx.esperar("CU-37 reintento con la autoridad arriba → 200", "POST", `/salidas/${m.idsalida}/cancelar`, { motivo: "Autoridad caída" }, admin, 200);
    ok("CU-37 el reintento libera los lugares (bloqueo en 0, cupo recuperado)", (await lugares(m.idsalida)) === 0 && ocup - (await ocupados(m.inicio)) === 10 && (await salidaDb(m.idsalida)).idbloqueo === null, `lugares ${await lugares(m.idsalida)}`);
    ok("CU-37 el reintento no duplicó reembolsos ni tocó el hotel", (await db.reembolso.count({ where: { reserva: { idsalida: m.idsalida } } })) === 1 && (await capacidad(m.hotel!.idservicio)) === original);
    await ctx.esperar("CU-37 un tercer intento → 400", "POST", `/salidas/${m.idsalida}/cancelar`, { motivo: "Autoridad caída" }, admin, 400);
  });

  // ======================================================================
  ctx.seccion("CU-41 Devolución de equipamiento");

  await ctx.escenario("CU-41 devolución", async () => {
    const a = await asignada([2]); // equipo: 3 asignados (stock 7), equipo2: 2 (stock 8)
    const url = `/salidas/${a.idsalida}/devolucion-equipamiento`;
    const completa = [{ idservicio: a.equipo, cantidadBuenEstado: 2, cantidadDaniada: 1 }, { idservicio: a.equipo2, cantidadBuenEstado: 2 }];
    const asig = await ctx.esperar("CU-41 equipamiento asignado → 200", "GET", `/salidas/${a.idsalida}/equipamiento-asignado`, undefined, admin, 200);
    ok("CU-41 lista lo asignado con su stock actual", asig?.equipamientos?.length === 2 && asig.equipamientos.find((e: any) => e.idservicio === a.equipo)?.cantidadAsignada === 3 && asig.equipamientos.find((e: any) => e.idservicio === a.equipo)?.stockActualDisponible === 7, JSON.stringify(asig?.equipamientos));

    // Antes del último día: la salida está en curso (termina mañana)
    await f.moverFechas(a.idsalida, fecha(-1), fecha(1));
    await ctx.esperar("CU-41 devolver antes del último día → 400", "POST", url, { items: completa }, admin, 400);
    ok("CU-41 antes del último día: stock intacto y sin auditoría", (await stockEq(a.equipo)) === 7 && (await stockEq(a.equipo2)) === 8 && (await db.registroAuditoria.count({ where: { idsalida: a.idsalida, motivo: { contains: "Devolución" } } })) === 0);

    // Último día (fechaFin = hoy)
    await f.moverFechas(a.idsalida, fecha(-2), fecha(0));
    await ctx.esperar("CU-41 devolución que no informa todo lo asignado (falta un artículo) → 400", "POST", url, { items: [completa[0]] }, admin, 400);
    await ctx.esperar("CU-41 devolución que informa menos unidades de las asignadas → 400", "POST", url, { items: [{ idservicio: a.equipo, cantidadBuenEstado: 1, cantidadDaniada: 1 }, completa[1]] }, admin, 400);
    await ctx.esperar("CU-41 devolución que informa más de lo asignado → 400", "POST", url, { items: [{ idservicio: a.equipo, cantidadBuenEstado: 3, cantidadDaniada: 1 }, completa[1]] }, admin, 400);
    const ajeno = (await f.equipamiento("Loc E", 5)).idservicio;
    await ctx.esperar("CU-41 devolución de un artículo que no era de la salida → 400", "POST", url, { items: [...completa, { idservicio: ajeno, cantidadBuenEstado: 1 }] }, admin, 400);
    await ctx.esperar("CU-41 ítem sin unidades → 400", "POST", url, { items: [{ idservicio: a.equipo, cantidadBuenEstado: 0, cantidadDaniada: 0 }, completa[1]] }, admin, 400);
    ok("CU-41 los rechazos no tocaron el stock", (await stockEq(a.equipo)) === 7 && (await stockEq(a.equipo2)) === 8 && (await stockEq(ajeno)) === 5);

    const r = await ctx.esperar("CU-41 devolución completa el último día → 200", "POST", url, { items: completa, observacionesGenerales: "Una carpa rota" }, admin, 200);
    ok("CU-41 reintegra solo lo bueno: 7 + 2 = 9 (la dañada no) y 8 + 2 = 10", (await stockEq(a.equipo)) === 9 && (await stockEq(a.equipo2)) === 10, `equipo ${await stockEq(a.equipo)}, equipo2 ${await stockEq(a.equipo2)}`);
    ok("CU-41 el detalle informa lo reintegrado y lo dañado", r?.detalle?.find((d: any) => d.idservicio === a.equipo)?.cantidadReintegradaAlStock === 2 && r.detalle.find((d: any) => d.idservicio === a.equipo)?.cantidadDaniadaOExtraviada === 1, JSON.stringify(r?.detalle));
    ok("CU-41 queda una auditoría de la devolución", (await db.registroAuditoria.count({ where: { idsalida: a.idsalida, motivo: "Una carpa rota" } })) === 1);

    await ctx.esperar("CU-41 segunda devolución → 400", "POST", url, { items: completa }, admin, 400);
    ok("CU-41 la segunda devolución no infló el stock", (await stockEq(a.equipo)) === 9 && (await stockEq(a.equipo2)) === 10);
  });

  await ctx.escenario("CU-41 salida inexistente o cancelada", async () => {
    await ctx.esperar("CU-41 salida inexistente → 404", "GET", `/salidas/99999999/equipamiento-asignado`, undefined, admin, 404);
    const a = await asignada([1]);
    await ctx.preparar("Cancelar salida", "POST", `/salidas/${a.idsalida}/cancelar`, { motivo: "Salida cancelada" });
    const stock = await stockEq(a.equipo);
    await f.moverFechas(a.idsalida, fecha(-2), fecha(0));
    await ctx.esperar("CU-41 devolver en una salida cancelada → 400", "POST", `/salidas/${a.idsalida}/devolucion-equipamiento`, { items: [{ idservicio: a.equipo, cantidadBuenEstado: 3 }, { idservicio: a.equipo2, cantidadBuenEstado: 2 }] }, admin, 400);
    ok("CU-41 salida cancelada: el stock no se infló", (await stockEq(a.equipo)) === stock && stock === 10);
  });
}
