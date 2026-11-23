/**
 * Módulo salidas del test integral: CU-36 a CU-41 (crear con personal y transporte, confirmar, reemplazar, logística, cancelar, devolver).
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
  // A1: lo libre en el día más ocupado (con una salida por servicio, el viejo contador)
  const capacidad = ctx.f.libre;
  const stockEq = ctx.f.libre;
  const totalEq = async (id: number) => (await db.servicioEquipamiento.findUniqueOrThrow({ where: { idservicio: id } })).cantidadTotal;
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
  /** Paquete con localidad propia, hotel (bloqueo o a solicitud), salida (con su personal y transporte, B3) y compras */
  async function montar(o: { T?: number; cap?: number; pax?: number[]; bloqueo?: boolean; aSolicitud?: boolean; minimoGuias?: number; inicio?: string } = {}) {
    const idcircuito = await f.circuito({ minimoGuias: o.minimoGuias ?? 1 });
    const pq = await f.paquete({ idcircuito });
    const hotel = o.bloqueo === false ? undefined : await f.hotel(pq.localidad, o.cap ?? 50);
    const hotelA = o.aSolicitud ? await f.hotel(pq.localidad, 20, "A_SOLICITUD") : undefined;
    const inicio = o.inicio ?? proximoInicio();
    const fin = sumar(inicio, 2);
    const T = o.T ?? 6;
    // B10: el a solicitud entra como segundo hotel (cubre lo que falte)
    const alta = await f.altaSalida(pq.idpaquete, inicio, T, undefined, { alojamientos: [hotel, hotelA].flatMap((h) => (h ? [h.idservicio] : [])) });
    const cliente = await f.cliente();
    const reservas = [];
    for (const n of o.pax ?? []) reservas.push(await f.comprar(cliente.token, alta.idsalida, { n }));
    return { ...pq, hotel, hotelA, inicio, fin, T, idsalida: alta.idsalida, alta, cliente, reservas };
  }

  /** CU-39: equipo puesto a mano sobre la salida (la compra solo ocupa el equipo con regla del paquete) */
  const ponerEquipo = (idsalida: number, items: { idservicio: number; cantidad: number }[]) =>
    ctx.back.llamar("PUT", `/salidas/${idsalida}/logistica`, { itemsNuevos: items.map((i) => ({ tipo: "EQUIPAMIENTO", ...i })) }, admin);

  /**
   * Salida confirmada (CU-40) con el personal justo para los vendidos (T = 2 × porteadores) más un guía y un porteador libres
   * (guias[1] y el último porteador), y dos equipamientos puestos con CU-39: 3 y 2 unidades de stock 10
   */
  async function asignada(pax: number[]) {
    const nP = Math.ceil(suma(pax) / 2);
    const m = await montar({ pax, T: 2 * nP });
    const guias = [...m.alta.guias, (await f.guia()).idpersonal];
    const porteadores = [...m.alta.porteadores, await f.porteador()];
    const equipo = (await f.equipamiento("Loc E", 10)).idservicio;
    const equipo2 = (await f.equipamiento("Loc E", 10)).idservicio;
    const resultado = await f.confirmar(m.idsalida);
    const r = await ponerEquipo(m.idsalida, [{ idservicio: equipo, cantidad: 3 }, { idservicio: equipo2, cantidad: 2 }]);
    if (r.status !== 200) throw new Error(`Poner equipo: ${r.status} ${JSON.stringify(r.body)}`);
    return { ...m, guias, porteadores, transporte: m.alta.idtransporte, equipo, equipo2, personalIds: [...m.alta.guias, ...m.alta.porteadores], nP, resultado };
  }

  // ======================================================================
  ctx.seccion("CU-36 Crear salida");

  await ctx.escenario("CU-36 cupo de la autoridad", async () => {
    const pq = await f.paquete();
    // Sin cupo: quedan 3 lugares y la salida necesita 10 (6 + 1 guía + 3 porteadores)
    const F1 = proximoInicio();
    await db.autoridadCupoDiario.upsert({ where: { fecha: F1 }, create: { fecha: F1, ocupados: 497 }, update: { ocupados: 497 } });
    await ctx.esperar("CU-36 FA1 sin cupo suficiente → 400", "POST", "/salidas", await f.cuerpoSalida(pq.idpaquete, F1, 6), admin, 400);
    ok("CU-36 FA1 no queda salida ni cupo tomado", (await db.salida.count({ where: { idpaquete: pq.idpaquete } })) === 0 && (await ocupados(F1)) === 497 && (await db.autoridadBloqueo.count({ where: { fecha: F1 } })) === 0);

    // Borde: justo 10 libres entra y llena el día; 9 libres no entra
    const F2 = proximoInicio();
    await db.autoridadCupoDiario.upsert({ where: { fecha: F2 }, create: { fecha: F2, ocupados: 490 }, update: { ocupados: 490 } });
    await ctx.esperar("CU-36 borde: justo los lugares que hacen falta → 201", "POST", "/salidas", await f.cuerpoSalida(pq.idpaquete, F2, 6), admin, 201);
    ok("CU-36 borde: el día queda en 500", (await ocupados(F2)) === 500, `ocupados ${await ocupados(F2)}`);
    const F3 = proximoInicio();
    await db.autoridadCupoDiario.upsert({ where: { fecha: F3 }, create: { fecha: F3, ocupados: 491 }, update: { ocupados: 491 } });
    await ctx.esperar("CU-36 borde: falta un lugar → 400", "POST", "/salidas", await f.cuerpoSalida(pq.idpaquete, F3, 6), admin, 400);
    ok("CU-36 borde: el cupo no cambió", (await ocupados(F3)) === 491);
  });

  await ctx.escenario("CU-36 autoridad caída", async () => {
    const pq = await f.paquete();
    const F = proximoInicio();
    await ctx.esperar("CU-36 FA2 autoridad caída → 503", "POST", "/salidas", await f.cuerpoSalida(pq.idpaquete, F, 6), admin, 503, ctx.backCaido);
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
    const body = await f.cuerpoSalida(pq.idpaquete, F, 6);
    await ctx.esperar("CU-36 hotel elegido sin capacidad → 400", "POST", "/salidas", { ...body, idalojamiento: chico.idservicio }, admin, 400);
    ok("CU-36 hotel sin capacidad: nada cambia (sin salida, sin cupo, hotel igual)", (await db.salida.count({ where: { idpaquete: pq.idpaquete } })) === 0 && (await ocupados(F)) === 0 && (await capacidad(chico.idservicio)) === 3);
    // FA3: ningún hotel con bloqueo alcanza → se crea sin alojamiento
    const sin = await ctx.esperar("CU-36 FA3 ningún hotel alcanza: se crea sin alojamiento → 201", "POST", "/salidas", body, admin, 201);
    const id = sin?.salida?.idsalida;
    if (id) {
      const s = await salidaDb(id);
      ok("CU-36 FA3 salida sin hotel: stockLocalAlojamiento 0 y hotel intacto", s.stockLocalAlojamiento === 0 && s.stockLocal === 6 && (await capacidad(chico.idservicio)) === 3 && (await db.ocupacion.count({ where: { idsalida: id, tipo: "ALOJAMIENTO" } })) === 0);
    }
    // Con un hotel que alcanza, hay que elegirlo
    const grande = await f.hotel(pq.localidad, 50);
    const F2 = proximoInicio();
    const body2 = await f.cuerpoSalida(pq.idpaquete, F2, 6);
    await ctx.esperar("CU-36 hay hotel que alcanza y no se elige → 400", "POST", "/salidas", body2, admin, 400);
    await ctx.esperar("CU-36 se elige el hotel que no alcanza habiendo otro → 400", "POST", "/salidas", { ...body2, idalojamiento: chico.idservicio }, admin, 400);
    ok("CU-36 los rechazos no tomaron cupo", (await ocupados(F2)) === 0 && (await capacidad(grande.idservicio)) === 50);
  });

  await ctx.escenario("CU-36 camino feliz", async () => {
    const pq = await f.paquete();
    const hotel = await f.hotel(pq.localidad, 50);
    const F = proximoInicio();
    const body = await f.cuerpoSalida(pq.idpaquete, F, 6, { idalojamiento: hotel.idservicio });
    const r = await ctx.esperar("CU-36 crear salida con hotel → 201", "POST", "/salidas", body, admin, 201);
    const id = r?.salida?.idsalida;
    if (!id) return;
    const s = await salidaDb(id);
    ok("CU-36 el hotel pierde tamanoMaximo plazas (50 → 44)", (await capacidad(hotel.idservicio)) === 44, `capacidad ${await capacidad(hotel.idservicio)}`);
    ok("CU-36 salida PUBLICADA con stock = tamanoMaximo y fechaFin = inicio + duración − 1",
      s.estado === "PUBLICADA" && s.stockLocal === 6 && s.stockLocalAlojamiento === 6 && s.tamanoMaximo === 6 && s.fechaFin.toISOString().slice(0, 10) === sumar(F, 2), JSON.stringify(s));
    ok("CU-36 el bloqueo ante la autoridad es tamanoMaximo + dotación (6 + 1 + 3)", (await lugares(id)) === 10 && r.dotacion?.guias === 1 && r.dotacion?.porteadores === 3 && r.totalLugares === 10, `lugares ${await lugares(id)}`);
    ok("CU-36 el cupo del día suma los 10 lugares", (await ocupados(F)) === 10);
    ok("CU-36 el hotel queda asociado a la salida (noche previa y posterior)", (await db.ocupacion.count({ where: { idsalida: id, idservicio: hotel.idservicio, tipo: "ALOJAMIENTO" } })) === 2);
    ok("B3 el personal queda asignado y el transporte ocupado al crear",
      (await asignados(id)).join() === [...body.personalIds].sort((a, b) => a - b).join() && (await db.ocupacion.count({ where: { idsalida: id, idservicio: body.idtransporte, tipo: "TRANSPORTE" } })) === 1);
    ok("B3 la respuesta trae la salida con la forma del listado", r.salida?.ventaAbierta === true && r.salida?.puedeConfirmar === false && Array.isArray(r.salida?.avisos) && Array.isArray(r.advertencias), JSON.stringify(r.salida?.alertas));
  });

  await ctx.escenario("B3 personal y transporte al crear la salida", async () => {
    const pq = await f.paquete();
    const F = proximoInicio();
    const fin = sumar(F, 2);
    const ocupado = await f.altaSalida(pq.idpaquete, F, 2); // 1 guía y 1 porteador ocupados en esas fechas
    const op = await ctx.esperar("B3 opciones con personal y transportes → 200", "GET", `/salidas/opciones?idpaquete=${pq.idpaquete}&fechaInicio=${F}&tamanoMaximo=2`, undefined, admin, 200);
    const guiasOp = (op?.personal?.guias ?? []).map((x: any) => x.idpersonal);
    ok("B3 las opciones no ofrecen al personal ocupado en esas fechas", !guiasOp.includes(ocupado.guias[0]) && !(op?.personal?.porteadores ?? []).some((x: any) => x.idpersonal === ocupado.porteadores[0]), JSON.stringify(guiasOp.slice(0, 5)));
    const vencido = await f.guia({ habilitacionVence: sumar(fin, -1), sinLogin: true });
    const op2 = await ctx.preparar("Opciones", "GET", `/salidas/opciones?idpaquete=${pq.idpaquete}&fechaInicio=${F}&tamanoMaximo=2`);
    ok("12.3 las opciones no listan a un guía no apto (habilitación vencida antes del fin)", !(op2?.personal?.guias ?? []).some((x: any) => x.idpersonal === vencido.idpersonal));
    ok("B3 los guías vienen ordenados por salidas en el mes", (op2?.personal?.guias ?? []).every((x: any, i: number, xs: any[]) => i === 0 || xs[i - 1].salidasEnElMes <= x.salidasEnElMes));
    ok("B3 las opciones traen el transporte del paquete", op2?.paquete?.idtransporte === pq.idtransporte && op2?.transportes?.some((t: any) => t.idservicio === pq.idtransporte && t.delPaquete === true), JSON.stringify(op2?.paquete));

    const libres = await f.cuerpoSalida(pq.idpaquete, F, 2);
    const conOcupado = { ...libres, personalIds: [ocupado.guias[0], ...libres.personalIds.slice(1)] };
    await ctx.esperar("B3 crear con un guía ocupado en esas fechas → 409", "POST", "/salidas", conOcupado, admin, 409);
    const r = await ctx.back.llamar("POST", "/salidas", { ...libres, personalIds: [vencido.idpersonal, ...libres.personalIds.slice(1)] }, admin);
    ok("12.3 crear con un guía no apto → 400 con el motivo", r.status === 400 && /: la habilitación vence el /.test(r.body?.error ?? ""), `${r.status} ${JSON.stringify(r.body)}`);
    await ctx.esperar("B3 crear sin cubrir la dotación → 400", "POST", "/salidas", { ...libres, personalIds: libres.personalIds.slice(0, 1) }, admin, 400);
    await ctx.esperar("B3 crear sin transporte → 400", "POST", "/salidas", { ...libres, idtransporte: undefined }, admin, 400);
    await ctx.esperar("B3 crear con el transporte ocupado por otra salida → 409", "POST", "/salidas", { ...libres, idtransporte: ocupado.idtransporte }, admin, 409);
    ok("B3 los rechazos no crearon salidas", (await db.salida.count({ where: { idpaquete: pq.idpaquete } })) === 1);

    // 12.4: 2 pasajeros + 2 del personal no entran en una van de 3
    const van = (await f.transporte(pq.localidad, 3)).idservicio;
    const chica = await ctx.back.llamar("POST", "/salidas", { ...libres, idtransporte: van }, admin);
    ok("12.4 transporte que no alcanza para pasajeros + personal → 400",
      chica.status === 400 && chica.body?.error === "El transporte elegido tiene 3 asientos y la salida necesita 4 lugares (2 pasajeros y 2 del personal)", `${chica.status} ${JSON.stringify(chica.body)}`);
    const extra = await f.porteador();
    const conExtra = await ctx.esperar("B3 crear con personal libre y un porteador extra → 201", "POST", "/salidas", { ...libres, personalIds: [...libres.personalIds, extra] }, admin, 201);
    ok("Decisión 5 el cupo ante la autoridad se pide por el máximo más todo el personal (2 + 3)", conExtra?.totalLugares === 5 && (await lugares(conExtra.salida.idsalida)) === 5, JSON.stringify(conExtra?.totalLugares));
  });

  await ctx.escenario("A2b equipo del paquete contra el stock proyectado", async () => {
    // 1 carpa cada 2 pasajeros: una salida de 8 necesita 4 carpas si se vende completa
    const carpas = await f.equipamiento("Loc E", 3);
    const localidad = `Loc ${ctx.unico()}`;
    const temporadas = await db.temporada.findMany({ where: { estado: "ACTIVO" } });
    const pq = await ctx.preparar("Paquete con equipo", "POST", "/paquetes", {
      idcircuito: await f.circuito(), nombrePaquete: `Int ${ctx.unico()}`, tipoGarantia: "POR_CATEGORIA", localidadGarantizada: localidad,
      categoriaGarantizada: "3 Estrellas", tipoHabitacionGarantizada: "Doble", nochesPrevias: 0, nochesPosteriores: 0,
      idtransporte: (await f.transporte(localidad)).idservicio, equipo: [{ idservicio: carpas.idservicio, cantidad: 1, cadaPasajeros: 2 }],
      matrizPrecios: temporadas.map((t) => ({ idtemporada: t.idtemporada, monto: 500, moneda: "USD" })),
    });
    const idpaquete = ctx.idDe(pq, "idpaquete")!;
    const F = proximoInicio();
    const op = await ctx.preparar("Opciones", "GET", `/salidas/opciones?idpaquete=${idpaquete}&fechaInicio=${F}&tamanoMaximo=14`);
    ok("A2b opciones: 14 pasajeros necesitan 7 carpas y hay 3 → NO_ALCANZA", op?.equipo?.[0]?.necesitaCompleta === 7 && op.equipo[0].libre === 3 && op.equipo[0].nivel === "NO_ALCANZA", JSON.stringify(op?.equipo));
    const r = await ctx.back.llamar("POST", "/salidas", await f.cuerpoSalida(idpaquete, F, 14), admin);
    ok("A2b bajo el 50 % no crea: 409 con detalle y el máximo sugerido (6)",
      r.status === 409 && /^No alcanza el equipo: /.test(r.body?.error ?? "") && r.body?.detalle?.tamanoMaximoSugerido === 6 && r.body.detalle.faltantes?.[0]?.necesitaMinimo === 4,
      `${r.status} ${JSON.stringify(r.body)}`);
    ok("A2b el rechazo no tomó cupo", (await ocupados(F)) === 0);
    const riesgo = await ctx.esperar("A2b entre el 50 y el 100 % crea con aviso → 201", "POST", "/salidas", await f.cuerpoSalida(idpaquete, F, 8), admin, 201);
    ok("A2b la advertencia dice cuántas faltarían y la salida no ocupa equipo todavía",
      /^Si se vende completa faltarían hasta 1 de /.test(riesgo?.advertencias?.[0] ?? "") && (await db.ocupacion.findFirst({ where: { idsalida: riesgo?.salida?.idsalida, idservicio: carpas.idservicio } }))?.cantidad === 0,
      JSON.stringify(riesgo?.advertencias));
    const lista = await ctx.preparar("Listado", "GET", `/salidas?idpaquete=${idpaquete}`);
    ok("A2b el listado muestra RIESGO_STOCK", lista?.[0]?.alertas?.includes("RIESGO_STOCK") && lista[0].avisos.some((a: any) => a.alerta === "RIESGO_STOCK"), JSON.stringify(lista?.[0]?.avisos));
  });

  await ctx.escenario("B4 la compra descuenta el equipo sobre el total vendido (12.1)", async () => {
    const carpas = await f.equipamiento("Loc E", 10);
    const localidad = `Loc ${ctx.unico()}`;
    const temporadas = await db.temporada.findMany({ where: { estado: "ACTIVO" } });
    const pq = await ctx.preparar("Paquete con equipo", "POST", "/paquetes", {
      idcircuito: await f.circuito(), nombrePaquete: `Int ${ctx.unico()}`, tipoGarantia: "POR_CATEGORIA", localidadGarantizada: localidad,
      categoriaGarantizada: "3 Estrellas", tipoHabitacionGarantizada: "Doble", nochesPrevias: 0, nochesPosteriores: 0,
      idtransporte: (await f.transporte(localidad)).idservicio, equipo: [{ idservicio: carpas.idservicio, cantidad: 1, cadaPasajeros: 2 }],
      matrizPrecios: temporadas.map((t) => ({ idtemporada: t.idtemporada, monto: 500, moneda: "USD" })),
    });
    const idpaquete = ctx.idDe(pq, "idpaquete")!;
    const idsalida = await f.salida(idpaquete, proximoInicio(), 6);
    const carpasDe = async (id: number) => (await db.ocupacion.findFirst({ where: { idsalida: id, idservicio: carpas.idservicio } }))?.cantidad;
    const reservas = [];
    for (let i = 0; i < 3; i++) reservas.push(await f.comprar((await f.cliente()).token, idsalida));
    ok("12.1 tres compras de 1 pasajero con 1 carpa cada 2 dejan 2 carpas (no 3)", (await carpasDe(idsalida)) === 2, `carpas ${await carpasDe(idsalida)}`);
    const cli = await db.reserva.findUniqueOrThrow({ where: { idreserva: reservas[2]!.idreserva }, include: { cliente: { include: { usuario: true } } } });
    void cli;
    await ctx.preparar("Cancelar una reserva (admin)", "POST", `/reservas/${reservas[2]!.idreserva}/cancelar`, { motivo: "Prueba de equipo" });
    ok("12.1 cancelar una reserva lo recalcula: 2 pasajeros → 1 carpa", (await carpasDe(idsalida)) === 1, `carpas ${await carpasDe(idsalida)}`);

    // FALTA_RECURSO: se baja el total por base a lo que ya no alcanza (la venta no se frena)
    await db.servicioEquipamiento.update({ where: { idservicio: carpas.idservicio }, data: { cantidadTotal: 1 } });
    await f.comprar((await f.cliente()).token, idsalida, { n: 2 });
    ok("B4 sin stock se vende igual y se guarda lo necesario (4 pasajeros → 2 carpas)", (await carpasDe(idsalida)) === 2);
    const lista = await ctx.preparar("Listado", "GET", `/salidas?idpaquete=${idpaquete}`);
    ok("B4 la salida muestra FALTA_RECURSO con el faltante", lista?.[0]?.alertas?.includes("FALTA_RECURSO") && lista[0].avisos.some((a: any) => a.alerta === "FALTA_RECURSO" && /^Faltan 1 de /.test(a.mensaje)), JSON.stringify(lista?.[0]?.avisos));
  });

  await ctx.escenario("CU-36 datos inválidos", async () => {
    const pq = await f.paquete();
    const base = await f.cuerpoSalida(pq.idpaquete, proximoInicio(), 6);
    await ctx.esperar("CU-36 paquete inexistente → 404", "POST", "/salidas", { ...base, idpaquete: 99999999 }, admin, 404);
    await ctx.esperar("CU-36 fecha de inicio pasada → 400", "POST", "/salidas", { ...base, fechaInicio: fecha(-3) }, admin, 400);
    await ctx.esperar("CU-36 fecha de inicio hoy → 400", "POST", "/salidas", { ...base, fechaInicio: fecha(0) }, admin, 400);
    await ctx.esperar("CU-36 fecha sin tarifa vigente (2029) → 400", "POST", "/salidas", { ...base, fechaInicio: "2029-03-01" }, admin, 400);
    await ctx.esperar("CU-36 tamanoMaximo 0 → 400", "POST", "/salidas", { ...base, tamanoMaximo: 0 }, admin, 400);
    await ctx.esperar("CU-36 fecha mal formada → 400", "POST", "/salidas", { ...base, fechaInicio: "mañana" }, admin, 400);
    ok("CU-36 ninguna creó salida", (await db.salida.count({ where: { idpaquete: pq.idpaquete } })) === 0);
  });

  // B9 y 12.6: el día de la semana sale de la fecha (getUTCDay: 0 = domingo)
  const DIAS_SEMANA = ["D", "L", "M", "X", "J", "V", "S"];
  const otroDia = (d: string) => DIAS_SEMANA[(new Date(d).getUTCDay() + 1) % 7]!;
  const crearSalida = async (idpaquete: number, fechaInicio: string, idalojamiento?: number) =>
    ctx.back.llamar("POST", "/salidas", await f.cuerpoSalida(idpaquete, fechaInicio, 4, { idalojamiento }), admin);
  const ddmm = (d: string) => d.split("-").reverse().join("/");

  await ctx.escenario("CU-36 día no habilitado del paquete (B9)", async () => {
    const F = proximoInicio();
    const pq = await f.paquete({ diasDisponibles: otroDia(F) });
    const hotel = await f.hotel(pq.localidad, 50);
    const r = await crearSalida(pq.idpaquete, F, hotel.idservicio);
    ok("B9 crear salida un día no habilitado → 400", r.status === 400 && /^El paquete no sale los .+: los días habilitados son /.test(r.body?.error ?? ""), `${r.status} ${JSON.stringify(r.body)}`);
    await ctx.esperar("B9 las opciones también rechazan ese día → 400", "GET", `/salidas/opciones?idpaquete=${pq.idpaquete}&fechaInicio=${F}&tamanoMaximo=4`, undefined, admin, 400);
    const det = await ctx.esperar("B9 detalle del paquete → 200", "GET", `/paquetes/${pq.idpaquete}`, undefined, admin, 200);
    ok("B9 calendarioSalidas: el día habilitado y la fecha mínima hoy + corte + 1",
      JSON.stringify(det?.calendarioSalidas) === JSON.stringify({ diasHabilitados: [otroDia(F)], fechaMinima: fecha(3) }), JSON.stringify(det?.calendarioSalidas));
    ok("B9 no se creó la salida", (await db.salida.count({ where: { idpaquete: pq.idpaquete } })) === 0);
  });

  await ctx.escenario("CU-36 tren que no opera el día del inicio (B9)", async () => {
    const F = proximoInicio();
    const localidad = `Loc ${ctx.unico()}`;
    const tren = await f.tren(localidad, otroDia(F));
    const pq = await f.paquete({ localidad, idtren: tren.idservicio });
    const hotel = await f.hotel(localidad, 50);
    const r = await crearSalida(pq.idpaquete, F, hotel.idservicio);
    ok("B9 crear salida un día en que el tren no opera → 400", r.status === 400 && / no opera los .+ \(opera [LMXJVSD]\)$/.test(r.body?.error ?? ""), `${r.status} ${JSON.stringify(r.body)}`);
    const det = await ctx.esperar("B9 detalle del paquete con tren → 200", "GET", `/paquetes/${pq.idpaquete}`, undefined, admin, 200);
    ok("B9 calendarioSalidas: solo los días del tren", JSON.stringify(det?.calendarioSalidas?.diasHabilitados) === JSON.stringify([otroDia(F)]), JSON.stringify(det?.calendarioSalidas));
    ok("B9 sin salida con el tren parado", (await db.salida.count({ where: { idpaquete: pq.idpaquete } })) === 0);
    const cat = await ctx.esperar("B9 catálogo público → 200", "GET", "/catalogo", undefined, "", 200);
    const enCatalogo = (cat ?? []).find((p: any) => p.idpaquete === pq.idpaquete);
    ok("B2 y B9 el catálogo dice Sale desde y el horario del tren en incluye",
      enCatalogo?.saleDesde === localidad && enCatalogo?.serviciosIncluidos?.some((s: string) => s.endsWith("(sale 06:10, llega 07:45)")), JSON.stringify(enCatalogo?.serviciosIncluidos));
  });

  await ctx.escenario("CU-36 fecha mínima y corte de 5 días con hotel a solicitud (12.6, B4)", async () => {
    // Con hotel con bloqueo rige el corte del paquete (2): la salida tiene que empezar después de hoy + 2
    const pq = await f.paquete();
    const hotel = await f.hotel(pq.localidad, 50);
    const r1 = await crearSalida(pq.idpaquete, fecha(2), hotel.idservicio);
    ok("12.6 empezar en hoy + 2 → 400 (nacería con la venta cerrada)",
      r1.status === 400 && r1.body?.error === `La salida tiene que empezar después del ${ddmm(fecha(2))}: la venta cierra 2 días antes del inicio`, `${r1.status} ${JSON.stringify(r1.body)}`);
    const r2 = await crearSalida(pq.idpaquete, fecha(3), hotel.idservicio);
    ok("12.6 empezar en hoy + 3 → 201 con corte 2", r2.status === 201 && (await salidaDb(ctx.idDe(r2.body, "idsalida")!)).diasCierreVenta === 2, `${r2.status} ${JSON.stringify(r2.body?.error)}`);

    // Solo un hotel a solicitud: las compras van a solicitud y el corte pasa a 5 (DIAS_CIERRE_SOLICITUD)
    const pqS = await f.paquete();
    const hS = await f.hotel(pqS.localidad, 50, "A_SOLICITUD");
    const r3 = await crearSalida(pqS.idpaquete, fecha(5), hS.idservicio);
    ok("B4 a solicitud: empezar en hoy + 5 → 400 por el corte de 5 días",
      r3.status === 400 && r3.body?.error === `La salida tiene que empezar después del ${ddmm(fecha(5))}: la venta cierra 5 días antes del inicio`, `${r3.status} ${JSON.stringify(r3.body)}`);
    const r4 = await crearSalida(pqS.idpaquete, fecha(6), hS.idservicio);
    const idsalida = ctx.idDe(r4.body, "idsalida")!;
    ok("B4 a solicitud: hoy + 6 → 201 y la salida guarda diasCierreVenta 5", r4.status === 201 && (await salidaDb(idsalida)).diasCierreVenta === 5, `${r4.status} ${JSON.stringify(r4.body?.error)}`);
    const lista = await ctx.esperar("B4 listado del admin → 200", "GET", `/salidas?idpaquete=${pqS.idpaquete}`, undefined, admin, 200);
    ok("B4 listado: venta abierta hasta hoy (fechaInicio − 5 − 1)", lista?.[0]?.ventaAbierta === true && lista?.[0]?.ultimoDiaVenta === fecha(0) && lista?.[0]?.diasCierreVenta === 5, JSON.stringify(lista?.[0] && { v: lista[0].ventaAbierta, u: lista[0].ultimoDiaVenta }));
    const cli = await f.cliente();
    await ctx.esperar("B4 a solicitud: comprar el último día de venta → 201", "POST", "/reservas", f.compra(idsalida), cli.token, 201);
    await f.moverFechas(idsalida, fecha(5), fecha(7));
    const r5 = await ctx.back.llamar("POST", "/reservas", f.compra(idsalida), cli.token);
    ok("B4 a solicitud: a 5 días del inicio la compra → 400 venta cerrada", r5.status === 400 && /^La venta de esta salida cerró el /.test(r5.body?.error ?? ""), `${r5.status} ${JSON.stringify(r5.body)}`);
  });

  // ======================================================================
  ctx.seccion("CU-40 Confirmar salida");
  const confirmar = (idsalida: number) => ctx.back.llamar("POST", `/salidas/${idsalida}/asignacion`, {}, admin);

  await ctx.escenario("CU-40 antes y después del corte (decisión 4)", async () => {
    const m = await montar({ pax: [2] });
    const panel = await ctx.esperar("CU-40 panel durante la venta → 200", "GET", `/salidas/${m.idsalida}/asignacion`, undefined, admin, 200);
    ok("CU-40 el panel dice que la venta sigue abierta", panel?.puedeConfirmar === false && /^La venta sigue abierta hasta el /.test(panel?.motivoNoConfirmable ?? ""), JSON.stringify(panel?.motivoNoConfirmable));
    const antes = await confirmar(m.idsalida);
    ok("CU-40 confirmar antes del corte → 400", antes.status === 400 && /^La venta sigue abierta hasta el .+: la salida se confirma después del corte$/.test(antes.body?.error ?? ""), `${antes.status} ${JSON.stringify(antes.body)}`);
    ok("CU-40 antes del corte sigue PUBLICADA y sin permisos", (await salidaDb(m.idsalida)).estado === "PUBLICADA" && (await permisosPas(m.idsalida)).length === 0);
    await f.cerrarVenta(m.idsalida);
    const lista = await ctx.preparar("Listado", "GET", `/salidas?idpaquete=${m.idpaquete}`);
    ok("B4 terminada la venta: PENDIENTE_CONFIRMAR y puedeConfirmar", lista?.[0]?.alertas?.includes("PENDIENTE_CONFIRMAR") && lista[0].puedeConfirmar === true, JSON.stringify(lista?.[0]?.alertas));
    const r = await ctx.esperar("CU-40 confirmar después del corte → 200", "POST", `/salidas/${m.idsalida}/asignacion`, {}, admin, 200);
    ok("CU-40 la respuesta trae la salida CERRADA achicada", r?.salida?.estado === "CERRADA" && r.salida.idsalida === m.idsalida && Object.keys(r.salida).length === 3, JSON.stringify(r?.salida));
    const despues = await ctx.preparar("Listado", "GET", `/salidas?idpaquete=${m.idpaquete}`);
    ok("B4 confirmada: ya no PENDIENTE_CONFIRMAR", !despues?.[0]?.alertas?.includes("PENDIENTE_CONFIRMAR") && despues[0].puedeConfirmar === false);
    const otra = await confirmar(m.idsalida);
    ok("CU-40 repetir la confirmación → 400 ya confirmada", otra.status === 400 && otra.body?.error === "La salida ya está confirmada", `${otra.status} ${JSON.stringify(otra.body)}`);
  });

  await ctx.escenario("CU-40 sin reservas", async () => {
    const m = await montar({ pax: [] });
    await f.cerrarVenta(m.idsalida);
    await ctx.esperar("CU-40 panel de salida sin reservas → 200", "GET", `/salidas/${m.idsalida}/asignacion`, undefined, admin, 200);
    await ctx.esperar("CU-40 confirmar sin reservas confirmadas → 400", "POST", `/salidas/${m.idsalida}/asignacion`, {}, admin, 400);
    ok("CU-40 sin reservas: la salida sigue PUBLICADA", (await salidaDb(m.idsalida)).estado === "PUBLICADA");
    await ctx.esperar("CU-40 salida inexistente → 404", "GET", `/salidas/99999999/asignacion`, undefined, admin, 404);
  });

  await ctx.escenario("CU-40 alojamiento pendiente (RF-53)", async () => {
    // Sin hotel con bloqueo: la compra queda PENDIENTE con su solicitud
    const m = await montar({ bloqueo: false, aSolicitud: true, pax: [2] });
    ok("CU-40 la compra sin hotel con bloqueo queda con alojamiento PENDIENTE", m.reservas[0]?.data?.estadoAlojamiento === "PENDIENTE", JSON.stringify(m.reservas[0]?.data));
    await f.cerrarVenta(m.idsalida);
    const panel = await ctx.esperar("CU-40 panel con solicitud de alojamiento Pendiente → 200", "GET", `/salidas/${m.idsalida}/asignacion`, undefined, admin, 200);
    ok("CU-40 el panel lista la reserva sin alojamiento", panel?.reservasSinAlojamiento?.length === 1 && panel.puedeConfirmar === false, JSON.stringify(panel?.reservasSinAlojamiento));
    await ctx.esperar("CU-40 confirmar con solicitud Pendiente → 409", "POST", `/salidas/${m.idsalida}/asignacion`, {}, admin, 409);
    ok("CU-40 con solicitud Pendiente no se emitió nada", (await salidaDb(m.idsalida)).estado === "PUBLICADA" && (await permisosPas(m.idsalida)).length === 0 && (await lugares(m.idsalida)) === 10);
    // Se resuelve el alojamiento (CU-34) y ahí sí se puede confirmar
    const sol = await db.solicitud.findFirstOrThrow({ where: { idreserva: m.reservas[0]!.idreserva } });
    await ctx.esperar("CU-34 aceptar la solicitud con el hotel a solicitud → 200", "POST", `/solicitudes/${sol.idsolicitud}/resolver`, { servicioId: m.hotelA!.idservicio, resolucion: "ACEPTADA" }, admin, 200);
    await ctx.esperar("CU-40 resuelta la solicitud, confirmar → 200", "POST", `/salidas/${m.idsalida}/asignacion`, {}, admin, 200);
    ok("CU-40 salida CERRADA y reserva con alojamiento CONFIRMADO", (await salidaDb(m.idsalida)).estado === "CERRADA" && (await db.reserva.findUniqueOrThrow({ where: { idreserva: m.reservas[0]!.idreserva } })).estadoAlojamiento === "CONFIRMADO");
  });

  await ctx.escenario("CU-40 y 12.3 personal que deja de ser apto", async () => {
    const m = await montar({ pax: [1] });
    const [guia] = m.alta.guias as [number];
    const vence = sumar(m.fin, -1);
    await db.guia.update({ where: { idpersonal: guia }, data: { fechaHabilitacion: new Date(vence) } });
    const lista = await ctx.preparar("Listado", "GET", `/salidas?idpaquete=${m.idpaquete}`);
    ok("12.3 PERSONAL_NO_APTO apenas vence la habilitación, con el detalle",
      lista?.[0]?.alertas?.includes("PERSONAL_NO_APTO") && lista[0].avisos.some((a: any) => a.alerta === "PERSONAL_NO_APTO" && a.mensaje.endsWith(`: la habilitación vence el ${vence.split("-").reverse().join("/")}`)),
      JSON.stringify(lista?.[0]?.avisos));
    await f.cerrarVenta(m.idsalida);
    const panel = await ctx.preparar("Panel", "GET", `/salidas/${m.idsalida}/asignacion`);
    ok("12.3 el panel lo marca no apto y no deja confirmar", panel?.personal?.find((x: any) => x.idpersonal === guia)?.apto === false && panel.faltantes.length === 1 && panel.puedeConfirmar === false, JSON.stringify(panel?.faltantes));
    const r = await confirmar(m.idsalida);
    ok("12.3 confirmar con personal no apto → 409 con los faltantes en detalle", r.status === 409 && r.body?.detalle?.faltantes?.length === 1 && /^Falta resolver antes de confirmar: /.test(r.body?.error ?? ""), `${r.status} ${JSON.stringify(r.body)}`);
    ok("12.3 no se emitieron permisos", (await vigentes(m.idsalida)) === 0 && (await salidaDb(m.idsalida)).estado === "PUBLICADA");
    // Se reemplaza con CU-38 (acepta PUBLICADA) y ahí se confirma
    const otro = (await f.guia({ sinLogin: true })).idpersonal;
    await ctx.esperar("CU-38 reemplazar al guía no apto en la PUBLICADA → 200", "POST", `/salidas/${m.idsalida}/reemplazos`, { idoriginal: guia, idreemplazante: otro, motivo: "Habilitación vencida" }, admin, 200);
    await ctx.esperar("CU-40 con el reemplazo, confirmar → 200", "POST", `/salidas/${m.idsalida}/asignacion`, {}, admin, 200);
  });

  await ctx.escenario("CU-40 falta el transporte", async () => {
    const m = await montar({ pax: [1] });
    await ctx.preparar("Quitar el transporte (CU-39)", "PUT", `/salidas/${m.idsalida}/logistica`, { itemsDesasignar: [{ tipo: "TRANSPORTE", idservicio: m.alta.idtransporte }] });
    const lista = await ctx.preparar("Listado", "GET", `/salidas?idpaquete=${m.idpaquete}`);
    ok("B4 sin transporte la salida muestra FALTA_RECURSO", lista?.[0]?.alertas?.includes("FALTA_RECURSO"), JSON.stringify(lista?.[0]?.avisos));
    await f.cerrarVenta(m.idsalida);
    const r = await confirmar(m.idsalida);
    ok("CU-40 confirmar sin transporte → 409 \"Falta el transporte\"", r.status === 409 && JSON.stringify(r.body?.detalle?.faltantes) === JSON.stringify(["Falta el transporte"]), `${r.status} ${JSON.stringify(r.body)}`);
  });

  await ctx.escenario("CU-40 pasajero con pasaporte que vence en el recorrido (RF-47)", async () => {
    const m = await montar({ pax: [], T: 2 }); // 1 guía + 1 porteador
    const vence = f.pasajero();
    const normal = f.pasajero();
    await f.comprar(m.cliente.token, m.idsalida, { pasajeros: [vence, normal] });
    await db.pasajero.update({ where: { nroPasaporte: vence.nroPasaporte }, data: { fechaVencimientoPasaporte: new Date(sumar(m.inicio, 1)) } });
    await f.cerrarVenta(m.idsalida);
    const r = await ctx.esperar("CU-40 pasaporte del pasajero vence en el recorrido → 200", "POST", `/salidas/${m.idsalida}/asignacion`, {}, admin, 200);
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
  });

  await ctx.escenario("CU-40 camino feliz", async () => {
    const m = await montar({ pax: [2, 1] }); // máximo 6: 1 guía y 3 porteadores asignados al crear; 3 vendidos
    ok("CU-40 antes de confirmar: hotel en 44 y stock de alojamiento 3", (await capacidad(m.hotel!.idservicio)) === 44 && (await salidaDb(m.idsalida)).stockLocalAlojamiento === 3);
    await f.cerrarVenta(m.idsalida);
    const ocupadosAntes = await ocupados(m.inicio);
    const panel = await ctx.esperar("CU-40 panel → 200", "GET", `/salidas/${m.idsalida}/asignacion`, undefined, admin, 200);
    ok("CU-40 panel informa vendidos, dotación, sobrantes y porteadores de más",
      panel?.puedeConfirmar === true && panel.pasajerosConfirmados === 3 && panel.dotacionRequerida?.guias === 1 && panel.dotacionRequerida?.porteadores === 2 &&
        panel.porteadoresSobrantes === 1 && panel.lugaresSobrantes === 3 && panel.bloqueoInicial === 10 && panel.transporte?.alcanza === true && panel.personal?.length === 4,
      JSON.stringify(panel));
    const r = await ctx.esperar("CU-40 confirmar → 200", "POST", `/salidas/${m.idsalida}/asignacion`, {}, admin, 200);
    const s = await salidaDb(m.idsalida);
    ok("CU-40 salida CERRADA con stocks en 0 y nada por liberar", s.estado === "CERRADA" && s.stockLocal === 0 && s.stockLocalAlojamiento === 0 && s.lugaresPorLiberar === 0, JSON.stringify(s));
    ok("CU-40 sobrantes liberados: lugares del bloqueo = pasajeros + personal (7)", (await lugares(m.idsalida)) === 7 && r?.lugaresLiberados === 3, `lugares ${await lugares(m.idsalida)}, informados ${r?.lugaresLiberados}`);
    ok("CU-40 el cupo del día bajó los 3 sobrantes", ocupadosAntes - (await ocupados(m.inicio)) === 3);
    ok("CU-40 las plazas sobrantes vuelven al hotel (44 → 47)", (await capacidad(m.hotel!.idservicio)) === 47, `capacidad ${await capacidad(m.hotel!.idservicio)}`);
    const pp = await permisosPas(m.idsalida);
    const per = await permisosPer(m.idsalida);
    ok("CU-40 3 permisos de pasajero Emitido con número", pp.length === 3 && pp.every((x) => x.estadoTramite === "Emitido" && !!x.nroPermiso));
    ok("CU-40 4 permisos de personal Emitido con número", per.length === 4 && per.every((x) => x.estadoTramite === "Emitido" && !!x.nroPermiso));
    ok("CU-40 permisos vigentes ante la autoridad = lugares", (await vigentes(m.idsalida)) === 7);
    ok("CU-40 no asigna nada: el personal y el transporte son los del alta", (await asignados(m.idsalida)).join() === [...m.alta.guias, ...m.alta.porteadores].sort((a, b) => a - b).join() && (await db.ocupacion.count({ where: { idsalida: m.idsalida, tipo: "TRANSPORTE" } })) === 1);
    const compra = f.compra(m.idsalida);
    await ctx.esperar("CU-30 comprar en una salida ya CERRADA → 400", "POST", "/reservas", compra, m.cliente.token, 400);
  });

  await ctx.escenario("CU-40 salida que ya inició", async () => {
    const m = await montar({ pax: [1] });
    await f.moverFechas(m.idsalida, fecha(-1), fecha(1));
    await ctx.esperar("CU-40 panel de salida ya iniciada → 400", "GET", `/salidas/${m.idsalida}/asignacion`, undefined, admin, 400);
    await ctx.esperar("CU-40 confirmar una salida ya iniciada → 400", "POST", `/salidas/${m.idsalida}/asignacion`, {}, admin, 400);
    ok("CU-40 salida iniciada: sigue PUBLICADA", (await salidaDb(m.idsalida)).estado === "PUBLICADA");
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
    ok("CU-38 reemplazo del guía: lugares sin cambios y los mismos vigentes", (await lugares(a.idsalida)) === lugaresAntes && (await vigentes(a.idsalida)) === vigAntes);
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
    await post("CU-38 reemplazante asignado a otra salida en esas fechas → 400", { idoriginal: p0, idreemplazante: m2.alta.porteadores[0]! }, 400);
    await ctx.esperar("CU-38 reemplazantes de una persona no asignada → 400", "GET", `/salidas/${a.idsalida}/personal/${p2}/reemplazantes`, undefined, admin, 400);
    await ctx.esperar("CU-38 personal de una salida inexistente → 404", "GET", `/salidas/99999999/personal`, undefined, admin, 404);

    ok("CU-38 los rechazos no cambiaron asignación, permisos ni bloqueo",
      (await asignados(a.idsalida)).join() === antes.asig && (await permisosPer(a.idsalida)).length === antes.per && (await lugares(a.idsalida)) === antes.lug && (await vigentes(a.idsalida)) === antes.lug);
  });

  await ctx.escenario("CU-38 reemplazo de personal rechazado (RF-47)", async () => {
    const m = await montar({ pax: [3], T: 4 }); // 1 guía y 2 porteadores; bloqueo 7
    const p = { porteadores: [...m.alta.porteadores, await f.porteador()] };
    // La autoridad rechaza a quien no tiene número de pasaporte (motivoRechazo): se lo dejamos en blanco por base
    await db.personal.update({ where: { idpersonal: p.porteadores[0]! }, data: { nroPasaporte: " " } });
    await f.cerrarVenta(m.idsalida);
    const r = await ctx.esperar("CU-38 confirmar con un porteador sin pasaporte → 200", "POST", `/salidas/${m.idsalida}/asignacion`, {}, admin, 200);
    ok("CU-38 la confirmación informa un rechazado de tipo PERSONAL", r?.rechazados?.length === 1 && r.rechazados[0].tipo === "PERSONAL", JSON.stringify(r?.rechazados));
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
    const a = await asignada([2]); // equipo: 3 puestos (stock 7), equipo2: 2 (stock 8)
    const chico = (await f.equipamiento("Loc E", 4)).idservicio;
    const url = `/salidas/${a.idsalida}/logistica`;
    const panel = await ctx.esperar("CU-39 panel de logística → 200", "GET", url, undefined, admin, 200);
    ok("CU-39 el panel muestra el equipamiento y el transporte asignados", panel?.equipamiento?.length === 2 && panel.transporte?.idservicio === a.transporte, JSON.stringify(panel));
    const disp = await ctx.esperar("CU-39 equipamiento disponible → 200", "GET", `${url}/disponibles?tipo=EQUIPAMIENTO`, undefined, admin, 200);
    ok("CU-39 el disponible informa el stock", (disp ?? []).find((x: any) => x.idservicio === chico)?.disponibilidad?.cantidadDisponible === 4);

    await ctx.esperar("CU-39 agregar equipamiento por encima del stock → 400", "PUT", url, { itemsNuevos: [{ tipo: "EQUIPAMIENTO", idservicio: chico, cantidad: 5 }] }, admin, 400);
    ok("CU-39 stock intacto y sin fila nueva", (await stockEq(chico)) === 4 && (await db.ocupacion.count({ where: { idsalida: a.idsalida, idservicio: chico } })) === 0);
    await ctx.esperar("CU-39 agregar equipamiento justo el stock → 200", "PUT", url, { itemsNuevos: [{ tipo: "EQUIPAMIENTO", idservicio: chico, cantidad: 4 }], motivo: "Más carpas" }, admin, 200);
    ok("CU-39 stock descontado a 0 y auditado", (await stockEq(chico)) === 0 && (await db.ocupacion.count({ where: { idsalida: a.idsalida, idservicio: chico } })) === 1 && (await db.registroAuditoria.count({ where: { idsalida: a.idsalida, motivo: "Más carpas" } })) === 1);

    // A1: asignar uno que ya está asignado cambia su cantidad en una sola operación
    await ctx.esperar("CU-39 asignar un equipamiento ya asignado cambia la cantidad (3 → 1) → 200", "PUT", url, { itemsNuevos: [{ tipo: "EQUIPAMIENTO", idservicio: a.equipo, cantidad: 1 }] }, admin, 200);
    ok("CU-39 una sola fila con la cantidad nueva: stock 10 − 1 = 9", (await stockEq(a.equipo)) === 9 && (await db.ocupacion.count({ where: { idsalida: a.idsalida, idservicio: a.equipo } })) === 1 && (await db.ocupacion.findFirstOrThrow({ where: { idsalida: a.idsalida, idservicio: a.equipo } })).cantidad === 1);
    await ctx.esperar("CU-39 quitar un equipamiento que no está asignado → 400", "PUT", url, { itemsDesasignar: [{ tipo: "EQUIPAMIENTO", idservicio: (await f.equipamiento("Loc E", 1)).idservicio }] }, admin, 400);
    ok("CU-39 el rechazo no tocó el stock", (await stockEq(a.equipo)) === 9);

    await ctx.esperar("CU-39 quitar equipamiento → 200", "PUT", url, { itemsDesasignar: [{ tipo: "EQUIPAMIENTO", idservicio: a.equipo }] }, admin, 200);
    ok("CU-39 quitar devuelve el stock (9 → 10) y borra la fila", (await stockEq(a.equipo)) === 10 && (await db.ocupacion.count({ where: { idsalida: a.idsalida, idservicio: a.equipo } })) === 0);
    // Cambiar cantidad: desasignar y asignar en la misma operación (sin quedar en un estado intermedio)
    await ctx.esperar("CU-39 cambiar la cantidad (quitar y agregar a la vez) → 200", "PUT", url, { itemsDesasignar: [{ tipo: "EQUIPAMIENTO", idservicio: a.equipo2 }], itemsNuevos: [{ tipo: "EQUIPAMIENTO", idservicio: a.equipo2, cantidad: 6 }] }, admin, 200);
    ok("CU-39 stock coherente tras cambiar la cantidad (10 − 6 = 4)", (await stockEq(a.equipo2)) === 4 && (await db.ocupacion.findFirstOrThrow({ where: { idsalida: a.idsalida, idservicio: a.equipo2 } })).cantidad === 6);
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
    ok("CU-39 los rechazos dejaron el transporte original (la transacción se revirtió)", (await db.ocupacion.findFirst({ where: { idsalida: a.idsalida, tipo: "TRANSPORTE" } }))?.idservicio === a.transporte);
    await ctx.esperar("CU-39 cambiar de transporte → 200", "PUT", url, { itemsDesasignar: [{ tipo: "TRANSPORTE", idservicio: a.transporte }], itemsNuevos: [{ tipo: "TRANSPORTE", idservicio: nuevo, comprobanteReserva: "CMP-3" }] }, admin, 200);
    const st = await db.ocupacion.findFirst({ where: { idsalida: a.idsalida, tipo: "TRANSPORTE" } });
    ok("CU-39 el transporte nuevo queda con su comprobante", st?.idservicio === nuevo && st.comprobanteReserva === "CMP-3");
    const q = await ctx.esperar("CU-39 quitar el transporte → 200", "PUT", url, { itemsDesasignar: [{ tipo: "TRANSPORTE", idservicio: nuevo }] }, admin, 200);
    ok("CU-39 sin transporte: queda 'Sin asignar' con advertencia", (q?.advertencias ?? []).length === 1 && q.panel?.transporte === null, JSON.stringify(q?.advertencias));
  });

  await ctx.escenario("CU-39 salida PUBLICADA (decisión 16) o ya iniciada", async () => {
    const m = await montar({ pax: [1] });
    const eq = (await f.equipamiento("Loc E", 3)).idservicio;
    const url = `/salidas/${m.idsalida}/logistica`;
    await ctx.esperar("CU-39 disponibles de una salida PUBLICADA → 200", "GET", `${url}/disponibles?tipo=EQUIPAMIENTO`, undefined, admin, 200);
    await ctx.esperar("CU-39 agregar equipo a una salida PUBLICADA → 200", "PUT", url, { itemsNuevos: [{ tipo: "EQUIPAMIENTO", idservicio: eq, cantidad: 1 }] }, admin, 200);
    ok("CU-39 PUBLICADA: el equipo quedó ocupado (3 → 2)", (await stockEq(eq)) === 2 && (await db.ocupacion.count({ where: { idsalida: m.idsalida, idservicio: eq } })) === 1);
    // 12.4: en una PUBLICADA el vehículo tiene que llevar el máximo (6) más el personal (4)
    const chico = (await f.transporte("Loc T", 9)).idservicio;
    await ctx.esperar("12.4 CU-39 transporte que no lleva máximo + personal → 400", "PUT", url, { itemsDesasignar: [{ tipo: "TRANSPORTE", idservicio: m.alta.idtransporte }], itemsNuevos: [{ tipo: "TRANSPORTE", idservicio: chico, comprobanteReserva: "CMP-9" }] }, admin, 400);
    await ctx.esperar("CU-39 quitar el equipo → 200", "PUT", url, { itemsDesasignar: [{ tipo: "EQUIPAMIENTO", idservicio: eq }] }, admin, 200);
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
    const m = await montar({ pax: [], aSolicitud: true, T: 4 }); // 1 guía y 2 porteadores
    const original = 50;
    ok("CU-37 hotel con bloqueo: 50 → 46 al crear la salida", (await capacidad(m.hotel!.idservicio)) === 46);
    // Solo 2 plazas del bloqueo quedan para la venta: la segunda compra no entra y va al hotel a solicitud (devolvemos las otras 2 al hotel)
    await db.salida.update({ where: { idsalida: m.idsalida }, data: { stockLocalAlojamiento: 2 } });
    await db.ocupacion.updateMany({ where: { idsalida: m.idsalida, idservicio: m.hotel!.idservicio, tipo: "ALOJAMIENTO" }, data: { cantidad: { decrement: 2 }, plazasLibres: 2 } });
    const r1 = await f.comprar(m.cliente.token, m.idsalida, { n: 2 });
    const cli2 = await f.cliente();
    const r2 = await f.comprar(cli2.token, m.idsalida, { n: 2 });
    ok("CU-37 reserva 1 con plazas del bloqueo y reserva 2 pendiente de solicitud", r1.data.estadoAlojamiento === "CONFIRMADO" && r2.data.estadoAlojamiento === "PENDIENTE", `${r1.data.estadoAlojamiento}/${r2.data.estadoAlojamiento}`);
    const sol = await db.solicitud.findFirstOrThrow({ where: { idreserva: r2.idreserva } });
    await ctx.esperar("CU-34 confirmar la solicitud con el hotel a solicitud → 200", "POST", `/solicitudes/${sol.idsolicitud}/resolver`, { servicioId: m.hotelA!.idservicio, resolucion: "ACEPTADA" }, admin, 200);
    const p = { guias: m.alta.guias, porteadores: m.alta.porteadores, transporte: m.alta.idtransporte, equipo: (await f.equipamiento("Loc E", 10)).idservicio };
    await f.confirmar(m.idsalida);
    await ponerEquipo(m.idsalida, [{ idservicio: p.equipo, cantidad: 4 }]);
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
    const m2 = await f.cuerpoSalida(m.idpaquete, m.inicio, 2, { guias: [p.guias[0]!], porteadores: [p.porteadores[0]!], idtransporte: p.transporte, idalojamiento: m.hotel!.idservicio });
    await ctx.esperar("CU-37 el personal y el transporte de la cancelada se reasignan en esas fechas → 201", "POST", "/salidas", m2, admin, 201);

    await ctx.esperar("CU-37 repetir la cancelación → 400", "POST", `/salidas/${m.idsalida}/cancelar`, { motivo: "Otra vez" }, admin, 400);
    await ctx.esperar("CU-37 impacto de una salida ya cancelada → 400", "GET", `/salidas/${m.idsalida}/cancelacion`, undefined, admin, 400);
    ok("CU-37 repetir no duplicó reembolsos ni tocó el stock", (await db.reembolso.count({ where: { reserva: { idsalida: m.idsalida } } })) === 2 && (await stockEq(p.equipo)) === 10 && (await capacidad(m.hotel!.idservicio)) === original - 2); // 2: la salida nueva de las mismas fechas
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
  ctx.seccion("CU-20 Modificar servicios en salidas activas (sin versionar)");

  await ctx.escenario("CAT-31 hotel editado en el lugar y cancelación", async () => {
    const pq = await f.paquete();
    const hotel = await f.hotel(pq.localidad, 30);
    const idsalida = await f.salida(pq.idpaquete, proximoInicio(), 10, hotel.idservicio);
    ok("CAT-31 hotel 30 con una salida de 10: queda 20", (await capacidad(hotel.idservicio)) === 20);
    const r = await ctx.esperar("CAT-31 editar capacidad del hotel en una salida activa → 200", "PUT", `/servicios/${hotel.idservicio}`, { capacidadDisponible: 25 }, admin, 200);
    ok("CAT-31 no versiona: mismo id, ACTIVO, sin versionado en la respuesta", r?.idservicio === hotel.idservicio && r.estado === "ACTIVO" && !("versionado" in (r ?? {})), JSON.stringify(r));
    ok("CAT-31 el total quedó en 25 (A1: libre 25 − 10 = 15) y sin copias", (await capacidad(hotel.idservicio)) === 15 && (await db.servicioBase.count({ where: { idproveedor: hotel.idproveedor } })) === 1);
    await ctx.esperar("CAT-31 cancelar la salida → 200", "POST", `/salidas/${idsalida}/cancelar`, { motivo: "Sin ventas" }, admin, 200);
    ok("CAT-31 las plazas vuelven al MISMO hotel vigente (libre 25)", (await capacidad(hotel.idservicio)) === 25, `capacidad ${await capacidad(hotel.idservicio)}`);
  });

  await ctx.escenario("CAT-32 garantía por establecimiento tras editar el hotel", async () => {
    const loc = `Loc ${ctx.unico()}`;
    const hotel = await f.hotel(loc, 3);
    const temporadas = await db.temporada.findMany({ where: { estado: "ACTIVO" } });
    const pq = await ctx.preparar("Paquete con hotel garantizado", "POST", "/paquetes", {
      idcircuito: await f.circuito(), nombrePaquete: `Int ${ctx.unico()}`, tipoGarantia: "POR_ESTABLECIMIENTO", idservicioGarantizado: hotel.idservicio,
      localidadGarantizada: loc, idtransporte: (await f.transporte(loc)).idservicio, nochesPrevias: 1, nochesPosteriores: 0, // con noches: sin hotel va a solicitud
      matrizPrecios: temporadas.map((t) => ({ idtemporada: t.idtemporada, monto: 500, moneda: "USD" })),
    });
    const idsalida = await f.salida(ctx.idDe(pq, "idpaquete")!, proximoInicio(), 6); // FA3: el hotel (3) no alcanza, sin bloqueo
    ok("CAT-32 salida creada sin bloqueo de hotel", (await salidaDb(idsalida)).stockLocalAlojamiento === 0);
    const cli = await f.cliente();
    const res = await f.comprar(cli.token, idsalida, { n: 2 });
    ok("CAT-32 la compra queda con alojamiento PENDIENTE", res.data.estadoAlojamiento === "PENDIENTE", JSON.stringify(res.data));
    const sol = await db.solicitud.findFirstOrThrow({ where: { idreserva: res.idreserva } });
    await ctx.esperar("CAT-32 editar la capacidad del hotel garantizado → 200", "PUT", `/servicios/${hotel.idservicio}`, { capacidadDisponible: 20 }, admin, 200);
    await ctx.esperar("CAT-32 resolver la solicitud con el mismo hotel → 200", "POST", `/solicitudes/${sol.idsolicitud}/resolver`, { servicioId: hotel.idservicio, resolucion: "ACEPTADA" }, admin, 200);
    ok("CAT-32 solicitud resuelta y reserva con alojamiento CONFIRMADO", (await db.solicitud.findUniqueOrThrow({ where: { idsolicitud: sol.idsolicitud } })).estado !== "PENDIENTE" && (await db.reserva.findUniqueOrThrow({ where: { idreserva: res.idreserva } })).estadoAlojamiento === "CONFIRMADO");
  });

  await ctx.escenario("CAT-33 transporte asignado editado en el lugar y protecciones", async () => {
    const a = await asignada([2]); // transporte de 30 asignado a una salida CERRADA con 2 pasajeros
    const hotel = a.hotel!.idservicio;
    ok("CAT-33 la salida quedó CERRADA", (await salidaDb(a.idsalida)).estado === "CERRADA");
    await ctx.esperar("CAT-33 bajar la capacidad por debajo de los pasajeros confirmados → 400", "PUT", `/servicios/${a.transporte}`, { capacidadVehiculo: 1 }, admin, 400);
    const r = await ctx.esperar("CAT-33 subir la capacidad del transporte asignado → 200", "PUT", `/servicios/${a.transporte}`, { capacidadVehiculo: 40 }, admin, 200);
    ok("CAT-33 mismo id, ACTIVO y asignado a la salida", r?.idservicio === a.transporte && r.estado === "ACTIVO" && (await db.ocupacion.count({ where: { idsalida: a.idsalida, idservicio: a.transporte } })) === 1, JSON.stringify(r));
    const m2 = await f.cuerpoSalida(a.idpaquete, sumar(a.inicio, 1), 2, { idtransporte: a.transporte, idalojamiento: a.hotel!.idservicio });
    await ctx.esperar("CAT-33 crear una salida superpuesta con el mismo transporte → 409", "POST", "/salidas", m2, admin, 409);
    // Hotel bloqueado en la salida activa: no cambia su criterio, pero sí su nombre
    await ctx.esperar("CU-20 cambiar la categoría de un hotel en una salida activa → 400", "PUT", `/servicios/${hotel}`, { categoria: "5 Estrellas" }, admin, 400);
    await ctx.esperar("CU-20 cambiar la localidad de un hotel en una salida activa → 400", "PUT", `/servicios/${hotel}`, { localidad: "Otra" }, admin, 400);
    await ctx.esperar("CU-20 editar el nombre de un hotel en una salida activa → 200", "PUT", `/servicios/${hotel}`, { nombreServicio: `Renombrado ${ctx.unico()}` }, admin, 200);
  });

  // ======================================================================
  ctx.seccion("CU-41 Devolución de equipamiento");

  await ctx.escenario("CU-41 devolución", async () => {
    const a = await asignada([2]); // equipo: 3 asignados (stock 7), equipo2: 2 (stock 8)
    const url = `/salidas/${a.idsalida}/devolucion-equipamiento`;
    const completa = [{ idservicio: a.equipo, cantidadBuenEstado: 2, cantidadDaniada: 1 }, { idservicio: a.equipo2, cantidadBuenEstado: 2 }];
    const asig = await ctx.esperar("CU-41 equipamiento asignado → 200", "GET", `/salidas/${a.idsalida}/equipamiento-asignado`, undefined, admin, 200);
    // A1: stockActualDisponible es lo libre hoy; la salida ocupa el equipo recién en sus fechas (2028)
    ok("CU-41 lista lo asignado con su stock de hoy", asig?.equipamientos?.length === 2 && asig.equipamientos.find((e: any) => e.idservicio === a.equipo)?.cantidadAsignada === 3 && asig.equipamientos.find((e: any) => e.idservicio === a.equipo)?.stockActualDisponible === 10, JSON.stringify(asig?.equipamientos));

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
    // A1: lo sano vuelve solo por fecha; lo dañado baja el total
    ok("CU-41 la dañada baja el total: 10 → 9 y equipo2 sigue en 10", (await totalEq(a.equipo)) === 9 && (await totalEq(a.equipo2)) === 10, `equipo ${await totalEq(a.equipo)}, equipo2 ${await totalEq(a.equipo2)}`);
    ok("CU-41 el detalle informa lo reintegrado y lo dañado", r?.detalle?.find((d: any) => d.idservicio === a.equipo)?.cantidadReintegradaAlStock === 2 && r.detalle.find((d: any) => d.idservicio === a.equipo)?.cantidadDaniadaOExtraviada === 1, JSON.stringify(r?.detalle));
    ok("CU-41 queda una auditoría de la devolución", (await db.registroAuditoria.count({ where: { idsalida: a.idsalida, motivo: "Una carpa rota" } })) === 1);

    await ctx.esperar("CU-41 segunda devolución → 400", "POST", url, { items: completa }, admin, 400);
    ok("CU-41 la segunda devolución no volvió a bajar el total", (await totalEq(a.equipo)) === 9 && (await totalEq(a.equipo2)) === 10);
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

  // ======================================================================
  ctx.seccion("A1 Ocupación por fechas");

  /** Pone el equipo indicado con CU-39 (la salida ya tiene personal y transporte desde el alta) */
  const cerrar = async (idsalida: number, _pax: number, items: { idservicio: number; cantidad: number }[]) => ponerEquipo(idsalida, items);

  await ctx.escenario("A1 dos salidas en fechas distintas usan las mismas 30 carpas", async () => {
    const carpas = (await f.equipamiento("Loc E", 30)).idservicio;
    const m1 = await montar({ pax: [2] });
    const m2 = await montar({ pax: [2] }); // empieza 5 días después: 3 de recorrido + 2 de reacondicionamiento no se cruzan
    ok("A1 primera salida con las 30 carpas → 200", (await cerrar(m1.idsalida, 2, [{ idservicio: carpas, cantidad: 30 }])).status === 200);
    ok("A1 segunda salida con las mismas 30 carpas → 200", (await cerrar(m2.idsalida, 2, [{ idservicio: carpas, cantidad: 30 }])).status === 200);
    const oc = await ctx.esperar("A1 ocupación de las carpas → 200", "GET", `/servicios/${carpas}/ocupacion?desde=${m1.inicio}&hasta=${sumar(m2.fin, 3)}`, undefined, admin, 200);
    const dia = (d: string) => oc?.dias?.find((x: any) => x.fecha === d);
    ok("A1 el día del reacondicionamiento de la primera está ocupado y el siguiente a él, por la segunda",
      oc?.total === 30 && dia(sumar(m1.fin, 2))?.ocupado === 30 && dia(m2.inicio)?.ocupado === 30 && dia(sumar(m2.fin, 3))?.disponible === 30 && oc.ocupaciones.length === 2,
      JSON.stringify(oc?.ocupaciones));
  });

  await ctx.escenario("A1 dos asignaciones simultáneas se disputan las últimas carpas", async () => {
    const carpas = (await f.equipamiento("Loc E", 10)).idservicio;
    const m1 = await montar({ pax: [2] });
    const m2 = await montar({ pax: [2], inicio: sumar(m1.inicio, 1) });
    const [r1, r2] = await Promise.all([cerrar(m1.idsalida, 2, [{ idservicio: carpas, cantidad: 8 }]), cerrar(m2.idsalida, 2, [{ idservicio: carpas, cantidad: 8 }])]);
    ok("A1 entra una sola (200 y 400)", [r1.status, r2.status].sort().join() === "200,400", `${r1.status} ${resumenDe(r1)} / ${r2.status} ${resumenDe(r2)}`);
    ok("A1 quedan 8 carpas ocupadas y 2 libres", (await db.ocupacion.count({ where: { idservicio: carpas } })) === 1 && (await stockEq(carpas)) === 2);
  });

  await ctx.escenario("A1 dos salidas superpuestas piden el mismo hotel", async () => {
    const pq = await f.paquete();
    const hotel = await f.hotel(pq.localidad, 10);
    const F = proximoInicio();
    await f.salida(pq.idpaquete, F, 6, hotel.idservicio);
    const op = await ctx.esperar("A1 opciones de la segunda salida → 200", "GET", `/salidas/opciones?idpaquete=${pq.idpaquete}&fechaInicio=${F}&tamanoMaximo=6`, undefined, admin, 200);
    const h = op?.alojamientos?.find((a: any) => a.idservicio === hotel.idservicio);
    ok("A1 la segunda ve solo lo que queda (4) y no le alcanza", h?.capacidadDisponible === 4 && h.alcanza === false, JSON.stringify(op?.alojamientos));
    await ctx.esperar("A1 crear la segunda con ese hotel → 400", "POST", "/salidas", await f.cuerpoSalida(pq.idpaquete, F, 6, { idalojamiento: hotel.idservicio }), admin, 400);
    ok("A1 el hotel sigue con 4 libres", (await capacidad(hotel.idservicio)) === 4);
  });

  await ctx.escenario("A1 el hotel no queda ocupado durante el trekking", async () => {
    const pq = await f.paquete(); // 3 días, 1 noche previa y 1 posterior
    const hotel = await f.hotel(pq.localidad, 8);
    const F = proximoInicio();
    await f.salida(pq.idpaquete, F, 8, hotel.idservicio); // ocupa F−1 y F+2
    // La otra duerme F (el primer día de trekking de la primera) y F+3
    const r = await ctx.esperar("A1 otra salida usa el hotel en esas noches → 201", "POST", "/salidas", await f.cuerpoSalida(pq.idpaquete, sumar(F, 1), 8, { idalojamiento: hotel.idservicio }), admin, 201);
    const oc = await ctx.esperar("A1 ocupación del hotel → 200", "GET", `/servicios/${hotel.idservicio}/ocupacion?desde=${sumar(F, -1)}&hasta=${sumar(F, 3)}`, undefined, admin, 200);
    ok("A1 cada noche tiene 8 ocupadas y los días de trekking compartidos no suman", !!r && (oc?.dias ?? []).map((d: any) => d.ocupado).join() === "8,8,0,8,8", JSON.stringify(oc?.dias));
  });

  await ctx.escenario("A1 bajar el total por debajo de lo comprometido", async () => {
    const carpas = (await f.equipamiento("Loc E", 10)).idservicio;
    const m = await montar({ pax: [2] });
    await cerrar(m.idsalida, 2, [{ idservicio: carpas, cantidad: 6 }]);
    const r = await ctx.back.llamar("PUT", `/servicios/${carpas}`, { inventarioTotal: 5 }, admin);
    ok("A1 bajar a 5 con 6 comprometidas → 400 y avisa el día", r.status === 400 && /Hay 6 unidades comprometidas el \d{2}\/\d{2}/.test(resumenDe(r)), `${r.status} ${resumenDe(r)}`);
    await ctx.esperar("A1 bajar justo a lo comprometido (6) → 200", "PUT", `/servicios/${carpas}`, { inventarioTotal: 6 }, admin, 200);
    ok("A1 el total quedó en 6", (await totalEq(carpas)) === 6);
  });

  await ctx.escenario("A1 devolución con 2 carpas dañadas", async () => {
    const carpas = (await f.equipamiento("Loc E", 30)).idservicio;
    const m = await montar({ pax: [2] });
    await cerrar(m.idsalida, 2, [{ idservicio: carpas, cantidad: 10 }]);
    await f.moverFechas(m.idsalida, fecha(-2), fecha(0));
    await ctx.esperar("A1 devolución con 2 dañadas → 200", "POST", `/salidas/${m.idsalida}/devolucion-equipamiento`, { items: [{ idservicio: carpas, cantidadBuenEstado: 8, cantidadDaniada: 2 }] }, admin, 200);
    const oc = await ctx.esperar("A1 ocupación después de la devolución → 200", "GET", `/servicios/${carpas}/ocupacion`, undefined, admin, 200);
    ok("A1 el total queda en 28", (await totalEq(carpas)) === 28 && oc?.total === 28, JSON.stringify(oc?.total));
  });

  await ctx.escenario("A1 cancelar una salida libera todo de inmediato", async () => {
    const carpas = (await f.equipamiento("Loc E", 10)).idservicio;
    const m = await montar({ pax: [2] });
    const r = await cerrar(m.idsalida, 2, [{ idservicio: carpas, cantidad: 10 }]);
    ok("A1 antes de cancelar: hotel, transporte y carpas ocupados", r.status === 200 && (await stockEq(carpas)) === 0 && (await capacidad(m.hotel!.idservicio)) < 50);
    await ctx.esperar("A1 cancelar la salida → 200", "POST", `/salidas/${m.idsalida}/cancelar`, { motivo: "Prueba A1" }, admin, 200);
    ok("A1 sin ocupación y todo libre", (await db.ocupacion.count({ where: { idsalida: m.idsalida } })) === 0 && (await stockEq(carpas)) === 10 && (await capacidad(m.hotel!.idservicio)) === 50);
    // Otra salida en las mismas fechas toma las 10 carpas
    const m2 = await montar({ pax: [2], inicio: m.inicio });
    ok("A1 otra salida en esas fechas usa las 10 carpas → 200", (await cerrar(m2.idsalida, 2, [{ idservicio: carpas, cantidad: 10 }])).status === 200);
  });

  await ctx.escenario("Bloque 8 hotel a solicitud sin plazas", async () => {
    const h = await f.servicio("ALOJAMIENTO", `Loc ${ctx.unico()}`, { categoria: "3 Estrellas", tipoHabitacion: "Doble", modalidadConfirmacion: "A_SOLICITUD" });
    const a = await db.servicioAlojamiento.findUniqueOrThrow({ where: { idservicio: h.idservicio } });
    ok("Bloque 8 se registra sin plazas (NULL)", a.plazasTotales === null, JSON.stringify(a));
    await ctx.esperar("Bloque 8 pasarlo a bloqueo sin indicar plazas → 400", "PUT", `/servicios/${h.idservicio}`, { modalidadConfirmacion: "BLOQUEO_PLAZAS" }, admin, 400);
    const prov = await ctx.preparar("Alta proveedor", "POST", "/proveedores", { tipoProveedor: "ALOJAMIENTO", razonSocial: `Int ${ctx.unico()}`, localidad: "Cusco", datosContacto: "int@test.com", canalComunicacion: "Email" });
    await ctx.esperar("Bloque 8 con bloqueo y sin plazas → 400", "POST", `/proveedores/${ctx.idDe(prov, "idproveedor")}/servicios`, { tipo: "ALOJAMIENTO", nombreServicio: `Int ${ctx.unico()}`, localidad: "Cusco", costoBase: 10, categoria: "3 Estrellas", tipoHabitacion: "Doble", modalidadConfirmacion: "BLOQUEO_PLAZAS" }, admin, 400);
  });

  // ======================================================================
  ctx.seccion("Etapa 4: tarifa congelada (12.5) y varios hoteles (B10, 12.2)");
  const hotelDe = (idreserva: number) => db.reserva.findUniqueOrThrow({ where: { idreserva } }).then((r) => r.idalojamiento);
  const libresDe = async (idsalida: number, idservicio: number) =>
    (await db.ocupacion.findFirst({ where: { idsalida, idservicio, tipo: "ALOJAMIENTO" } }))?.plazasLibres;
  const enCatalogo = async (idpaquete: number, idsalida: number) =>
    ((await ctx.preparar("Catálogo", "GET", "/catalogo", undefined, "")) as any[]).find((p) => p.idpaquete === idpaquete)?.salidasDisponibles?.find((s: any) => s.idsalida === idsalida);

  await ctx.escenario("12.5 tarifa editada no cambia una salida existente", async () => {
    const pq = await f.paquete({ monto: 500 });
    const hotel = await f.hotel(pq.localidad, 50);
    const vieja = await f.salida(pq.idpaquete, proximoInicio(), 4, hotel.idservicio);
    const temporadas = await db.temporada.findMany({ where: { estado: "ACTIVO" } });
    await ctx.esperar("12.5 subir la tarifa del paquete a 900 → 200", "PUT", `/paquetes/${pq.idpaquete}`, { matrizPrecios: temporadas.map((t) => ({ idtemporada: t.idtemporada, monto: 900, moneda: "USD" })) }, admin, 200);
    ok("12.5 el catálogo sigue mostrando 500 en la salida creada antes", (await enCatalogo(pq.idpaquete, vieja))?.precioPersona === 500, JSON.stringify(await enCatalogo(pq.idpaquete, vieja)));
    const cli = await f.cliente();
    const r = await ctx.esperar("12.5 comprar 2 en la salida vieja → 201", "POST", "/reservas", f.compra(vieja, { n: 2 }), cli.token, 201);
    ok("12.5 la compra cobra la tarifa congelada (2 × 500)", r?.precioCongelado === 1000, JSON.stringify(r));
    const nueva = await f.salida(pq.idpaquete, proximoInicio(), 4, hotel.idservicio);
    ok("12.5 una salida nueva toma la tarifa nueva (900)", (await enCatalogo(pq.idpaquete, nueva))?.precioPersona === 900);
    // Sin tarifas en el paquete, la salida vieja se sigue vendiendo con la suya
    await db.tarifaPaquete.deleteMany({ where: { idpaquete: pq.idpaquete } });
    const r2 = await ctx.esperar("12.5 sin tarifas en el paquete, la salida se sigue vendiendo → 201", "POST", "/reservas", f.compra(vieja, { n: 1 }), cli.token, 201);
    ok("12.5 y cobra lo congelado (500)", r2?.precioCongelado === 500, JSON.stringify(r2));
  });

  await ctx.escenario("B10 salida con dos hoteles que suman el máximo", async () => {
    const pq = await f.paquete();
    const [hA, hB] = [await f.hotel(pq.localidad, 3), await f.hotel(pq.localidad, 3)];
    const F = proximoInicio();
    const op = await ctx.esperar("B10 opciones → 200", "GET", `/salidas/opciones?idpaquete=${pq.idpaquete}&fechaInicio=${F}&tamanoMaximo=6`, undefined, admin, 200);
    ok("B10 opciones: los dos hoteles con 3 libres, ninguno alcanza solo", op?.alojamientos?.length === 2 && op.alojamientos.every((a: any) => a.capacidadDisponible === 3 && a.alcanza === false && a.modalidadConfirmacion === "BLOQUEO_PLAZAS"), JSON.stringify(op?.alojamientos));
    const body = await f.cuerpoSalida(pq.idpaquete, F, 6);
    const r1 = await ctx.back.llamar("POST", "/salidas", { ...body, alojamientos: [hA.idservicio] }, admin);
    ok("B10 un hotel de 3 para 6 → 400 con lo cubierto", r1.status === 400 && r1.body?.error === "Los hoteles elegidos cubren 3 de 6 plazas en esas noches", `${r1.status} ${resumenDe(r1)}`);
    const r = await ctx.esperar("B10 los dos hoteles → 201", "POST", "/salidas", { ...body, alojamientos: [hA.idservicio, hB.idservicio] }, admin, 201);
    const idsalida = r?.salida?.idsalida;
    if (!idsalida) return;
    ok("B10 cada hotel queda ocupado por sus 3 plazas y la salida suma 6", (await capacidad(hA.idservicio)) === 0 && (await capacidad(hB.idservicio)) === 0 &&
      (await libresDe(idsalida, hA.idservicio)) === 3 && (await libresDe(idsalida, hB.idservicio)) === 3 && (await salidaDb(idsalida)).stockLocalAlojamiento === 6);
    ok("B10 el listado trae los dos hoteles en servicios", r.salida.servicios.filter((s: any) => s.tipo === "ALOJAMIENTO").length === 2, JSON.stringify(r.salida.servicios));

    // 12.2: las compras llenan el primer hotel y pasan al segundo; un grupo no se parte
    const cli = await f.cliente();
    const c1 = await f.comprar(cli.token, idsalida, { n: 2 });
    const c2 = await f.comprar(cli.token, idsalida, { n: 2 });
    ok("12.2 el primer grupo va al primer hotel y el segundo, que ya no entra, al segundo",
      (await hotelDe(c1.idreserva)) === hA.idservicio && (await hotelDe(c2.idreserva)) === hB.idservicio && c2.data?.hotel?.idservicio === hB.idservicio && c2.data?.estadoAlojamiento === "CONFIRMADO", JSON.stringify(c2.data));
    const rechazo = await ctx.back.llamar("POST", "/reservas", f.compra(idsalida, { n: 2 }), cli.token);
    ok("12.2 quedan 2 lugares, uno en cada hotel: el grupo de 2 → 400", rechazo.status === 400 && /^Quedan 2 lugares, pero no en un mismo hotel: en una reserva entran hasta 1 pasajeros./.test(rechazo.body?.error ?? ""), `${rechazo.status} ${resumenDe(rechazo)}`);
    ok("12.2 el catálogo avisa que en una reserva entra 1 (2 libres, 1 por hotel)", (await enCatalogo(pq.idpaquete, idsalida))?.maximoPorReserva === 1, JSON.stringify(await enCatalogo(pq.idpaquete, idsalida)));
    ok("12.2 el rechazo no tocó nada", (await salidaDb(idsalida)).stockLocal === 2 && (await libresDe(idsalida, hA.idservicio)) === 1 && (await libresDe(idsalida, hB.idservicio)) === 1 && (await db.reserva.count({ where: { idsalida } })) === 2);
    const c3 = await f.comprar(cli.token, idsalida, { n: 1 });
    ok("12.2 uno solo entra en el primer hotel", (await hotelDe(c3.idreserva)) === hA.idservicio && (await libresDe(idsalida, hA.idservicio)) === 0);

    // CU-32: la cancelación devuelve las plazas a su hotel
    await ctx.esperar("12.2 cancelar el primer grupo → 200", "POST", `/reservas/${c1.idreserva}/cancelar`, { motivo: "Prueba" }, cli.token, 200);
    ok("12.2 las 2 plazas vuelven al primer hotel", (await libresDe(idsalida, hA.idservicio)) === 2 && (await libresDe(idsalida, hB.idservicio)) === 1 && (await salidaDb(idsalida)).stockLocalAlojamiento === 3);

    // CU-40: el panel cuenta por hotel y al confirmar cada uno recupera lo que le quedó libre
    await f.cerrarVenta(idsalida);
    const panel = await ctx.preparar("Panel", "GET", `/salidas/${idsalida}/asignacion`);
    ok("12.2 el panel cuenta los pasajeros de cada hotel (1 y 2)", JSON.stringify(panel?.hoteles?.map((h: any) => [h.idservicio, h.pasajeros])) === JSON.stringify([[hA.idservicio, 1], [hB.idservicio, 2]]), JSON.stringify(panel?.hoteles));
    await ctx.esperar("B10 confirmar la salida → 200", "POST", `/salidas/${idsalida}/asignacion`, {}, admin, 200);
    ok("B10 al confirmar cada hotel recupera lo suyo (2 y 1 libres)", (await capacidad(hA.idservicio)) === 2 && (await capacidad(hB.idservicio)) === 1 && (await libresDe(idsalida, hA.idservicio)) === 0,
      `libres ${await capacidad(hA.idservicio)} y ${await capacidad(hB.idservicio)}`);
  });

  await ctx.escenario("B10 corte de 5 días con uno a solicitud", async () => {
    const pq = await f.paquete();
    const hA = await f.hotel(pq.localidad, 2);
    const hS = await f.hotel(pq.localidad, 20, "A_SOLICITUD");
    const op = await ctx.esperar("B10 opciones con el a solicitud → 200", "GET", `/salidas/opciones?idpaquete=${pq.idpaquete}&fechaInicio=${fecha(10)}&tamanoMaximo=4`, undefined, admin, 200);
    const s = op?.alojamientos?.find((a: any) => a.idservicio === hS.idservicio);
    ok("B10 el a solicitud se lista sin plazas y cubre lo que falte", s?.modalidadConfirmacion === "A_SOLICITUD" && s.capacidadDisponible === null && s.alcanza === true, JSON.stringify(op?.alojamientos));
    const r1 = await ctx.back.llamar("POST", "/salidas", { ...(await f.cuerpoSalida(pq.idpaquete, fecha(5), 4)), alojamientos: [hA.idservicio, hS.idservicio] }, admin);
    ok("B10 con uno a solicitud, empezar en hoy + 5 → 400 por el corte de 5 días",
      r1.status === 400 && r1.body?.error === `La salida tiene que empezar después del ${ddmm(fecha(5))}: la venta cierra 5 días antes del inicio`, `${r1.status} ${resumenDe(r1)}`);
    const r = await ctx.esperar("B10 hotel con bloqueo y a solicitud en hoy + 6 → 201", "POST", "/salidas", { ...(await f.cuerpoSalida(pq.idpaquete, fecha(6), 4)), alojamientos: [hA.idservicio, hS.idservicio] }, admin, 201);
    const idsalida = r?.salida?.idsalida;
    if (!idsalida) return;
    ok("B10 corte de 5 días; el de bloqueo pone 2 plazas y el a solicitud queda sin bloquear",
      (await salidaDb(idsalida)).diasCierreVenta === 5 && (await libresDe(idsalida, hA.idservicio)) === 2 && (await libresDe(idsalida, hS.idservicio)) === null && (await capacidad(hA.idservicio)) === 0);
    const cli = await f.cliente();
    const c1 = await f.comprar(cli.token, idsalida, { n: 2 });
    const c2 = await f.comprar(cli.token, idsalida, { n: 2 });
    ok("12.2 el primer grupo al de bloqueo (confirmado) y el segundo al a solicitud (pendiente)",
      c1.data?.hotel?.idservicio === hA.idservicio && c1.data?.estadoAlojamiento === "CONFIRMADO" && c2.data?.hotel?.idservicio === hS.idservicio && c2.data?.estadoAlojamiento === "PENDIENTE", JSON.stringify([c1.data, c2.data]));
    const sol = await db.solicitud.findFirstOrThrow({ where: { idreserva: c2.idreserva } });
    ok("12.2 la solicitud va a ese hotel", sol.criterios?.startsWith(`Hotel: `) === true && (await hotelDe(c2.idreserva)) === hS.idservicio, JSON.stringify(sol.criterios));
    const ops = await ctx.esperar("12.2 opciones de la solicitud → 200", "GET", `/solicitudes/${sol.idsolicitud}/opciones`, undefined, admin, 200);
    ok("12.2 la única opción de contacto es el hotel a solicitud de la salida", JSON.stringify(ops?.opcionesContacto?.map((o: any) => o.servicioId)) === JSON.stringify([hS.idservicio]), JSON.stringify(ops?.opcionesContacto));
  });

  await ctx.escenario("Salida vieja sin personal: confirmar con personalIds", async () => {
    // Como las creadas antes de la etapa 3: sin personal ni transporte
    const m = await montar({ pax: [1] });
    await db.asignacionPersonal.deleteMany({ where: { idsalida: m.idsalida } });
    await db.ocupacion.deleteMany({ where: { idsalida: m.idsalida, tipo: "TRANSPORTE" } });
    await f.cerrarVenta(m.idsalida);
    const panel = await ctx.preparar("Panel", "GET", `/salidas/${m.idsalida}/asignacion`);
    ok("Vieja: el panel pide el personal y el transporte", panel?.personal?.length === 0 && panel.puedeConfirmar === false &&
      panel.faltantes.includes("Sin personal asignado: la salida necesita al menos 1 guías y 1 porteadores (se eligen al confirmar)") && panel.faltantes.includes("Falta el transporte"), JSON.stringify(panel?.faltantes));
    // El transporte, con CU-39 (acepta PUBLICADA)
    const bus = await f.transporte(m.localidad, 30);
    await ctx.esperar("Vieja: cargar el transporte con CU-39 → 200", "PUT", `/salidas/${m.idsalida}/logistica`, { itemsNuevos: [{ tipo: "TRANSPORTE", idservicio: bus.idservicio, comprobanteReserva: "VIEJA-1" }] }, admin, 200);
    const vencido = (await f.guia({ sinLogin: true, habilitacionVence: "2027-06-30" })).idpersonal;
    const porteador = await f.porteador();
    const noApto = await ctx.back.llamar("POST", `/salidas/${m.idsalida}/asignacion`, { personalIds: [vencido, porteador] }, admin);
    ok("Vieja: personal no apto → 400 y no queda asignado", noApto.status === 400 && /: la habilitación vence el /.test(noApto.body?.error ?? "") && (await asignados(m.idsalida)).length === 0, `${noApto.status} ${resumenDe(noApto)}`);
    await ctx.esperar("Vieja: personalIds que no es una lista → 400", "POST", `/salidas/${m.idsalida}/asignacion`, { personalIds: "1" }, admin, 400);
    const guia = (await f.guia({ sinLogin: true })).idpersonal;
    const r = await ctx.esperar("Vieja: confirmar con personalIds → 200", "POST", `/salidas/${m.idsalida}/asignacion`, { personalIds: [guia, porteador] }, admin, 200);
    ok("Vieja: queda CERRADA con ese personal y sus permisos", r?.salida?.estado === "CERRADA" && (await asignados(m.idsalida)).join() === [guia, porteador].sort((a, b) => a - b).join() && (await permisosPer(m.idsalida)).length === 2);
    const otra = await ctx.back.llamar("POST", `/salidas/${m.idsalida}/asignacion`, { personalIds: [guia] }, admin);
    ok("Vieja: personalIds en una salida con personal → 400", otra.status === 400 && /^La salida ya tiene personal/.test(otra.body?.error ?? ""), `${otra.status} ${resumenDe(otra)}`);
  });
}

const resumenDe = (r: { body: any }) => JSON.stringify(r.body?.error ?? r.body).slice(0, 200);
