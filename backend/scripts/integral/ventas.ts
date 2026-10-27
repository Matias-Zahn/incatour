/**
 * Módulo ventas: CU-30 comprar, CU-31 consultar, CU-32 cancelar, CU-33/34 solicitudes de alojamiento.
 * Cada escenario arma su paquete (localidad propia), su hotel y sus clientes, y controla stocks y montos en la base.
 */
import { Ctx, fecha } from "./contexto";

export async function ventas(ctx: Ctx) {
  const { f, db } = ctx;
  let k = 0; // reparte las fechas de salida: el cupo diario de la autoridad es compartido

  const sal = (idsalida: number) => db.salida.findUniqueOrThrow({ where: { idsalida } });
  const cap = async (idservicio: number) => (await db.servicioAlojamiento.findUniqueOrThrow({ where: { idservicio } })).capacidadDisponible;
  const res = (idreserva: number) => db.reserva.findUniqueOrThrow({ where: { idreserva } });
  /** "stockLocal/stockLocalAlojamiento/reservas" para comparar antes y después de un rechazo */
  const foto = async (idsalida: number) => {
    const s = await sal(idsalida);
    return `${s.stockLocal}/${s.stockLocalAlojamiento}/${await db.reserva.count({ where: { idsalida } })}`;
  };
  const igual = (nombre: string, real: unknown, esperado: unknown) => ctx.controlar(nombre, real === esperado, `real=${real} esperado=${esperado}`);

  /** Paquete + hotel + (transporte) + salida PUBLICADA a `dias` días, todo propio del escenario */
  async function armar(o: { tamano?: number; hotel?: "bloqueo" | "solicitud" | "ninguno"; capHotel?: number; dias?: number; reintegro?: number | null; transporte?: boolean } = {}) {
    const localidad = `Loc ${ctx.unico()}`;
    const transp = o.transporte ? await f.transporte(localidad) : undefined;
    const pq = await f.paquete({ localidad, diasMinimosReintegro: o.reintegro === undefined ? 15 : o.reintegro, ...(transp && { serviciosIncluidos: [transp.idservicio] }) });
    const modo = o.hotel ?? "bloqueo";
    const hotel = modo === "ninguno" ? undefined : await f.hotel(localidad, o.capHotel ?? 50, modo === "solicitud" ? "A_SOLICITUD" : "BLOQUEO_PLAZAS");
    const dias = o.dias ?? 30 + (k++ % 30);
    const idsalida = await f.salida(pq.idpaquete, fecha(dias), o.tamano ?? 4, modo === "bloqueo" ? hotel!.idservicio : undefined);
    return { pq, localidad, hotel, idsalida, dias };
  }

  /** Cierra la salida con la asignación real (CU-40): emite los permisos de los pasajeros vendidos */
  async function cerrar(idsalida: number, localidad: string, vendidos: number) {
    const guia = await f.guia();
    const porteadores = [];
    for (let i = 0; i < Math.ceil(vendidos / 2); i++) porteadores.push(await f.porteador());
    const t = await f.transporte(localidad, 30);
    await ctx.preparar("Cerrar salida", "POST", `/salidas/${idsalida}/asignacion`, { personalIds: [guia.idpersonal, ...porteadores], idtransporte: t.idservicio });
  }

  const cancelacion = (tok: string, id: number) => ctx.back.llamar("GET", `/reservas/${id}/cancelacion`, undefined, tok);
  const cancelar = (tok: string, id: number) => ctx.back.llamar("POST", `/reservas/${id}/cancelar`, { motivo: "Prueba integral" }, tok);

  // ==================================================================================================
  ctx.seccion("CU-30 Comprar un paquete");

  await ctx.escenario("Salida que se llena", async () => {
    const { pq, hotel, idsalida } = await armar({ tamano: 3 });
    const [c1, c2] = [await f.cliente(), await f.cliente()];
    igual("Salida nueva: hotel bloqueó 3 plazas", await cap(hotel!.idservicio), 47);

    const r1 = await ctx.esperar("Comprar 2 de 3 lugares → 201", "POST", "/reservas", f.compra(idsalida, { n: 2 }), c1.token, 201);
    igual("Compra de 2: respuesta estadoAlojamiento CONFIRMADO", r1?.estadoAlojamiento, "CONFIRMADO");
    igual("Compra de 2: stockLocal 1 / alojamiento 1 / 1 reserva", await foto(idsalida), "1/1/1");
    await ctx.esperar("Comprar el último lugar → 201", "POST", "/reservas", f.compra(idsalida, { n: 1 }), c2.token, 201);
    igual("Salida llena: stockLocal 0 / alojamiento 0 / 2 reservas", await foto(idsalida), "0/0/2");
    igual("Dos pagos aprobados registrados", await db.pago.count({ where: { reserva: { idsalida }, estadoTransaccion: "APROBADA" } }), 2);

    await ctx.esperar("Cuarta compra con la salida llena → 400", "POST", "/reservas", f.compra(idsalida, { n: 1 }), c1.token, 400);
    igual("Rechazo por salida llena no cambia nada", await foto(idsalida), "0/0/2");

    const cat = await ctx.esperar("GET /catalogo → 200", "GET", "/catalogo", undefined, "", 200);
    const salidaCat = cat?.find((p: any) => p.idpaquete === pq.idpaquete)?.salidasDisponibles?.find((s: any) => s.idsalida === idsalida);
    // Mostrarla como agotada (cupo 0) es válido: el front no deja comprar más pasajeros que stockLocal
    ctx.controlar("Catálogo muestra la salida agotada sin cupo", !salidaCat || salidaCat.cupoDisponible === 0, `cupoDisponible=${salidaCat?.cupoDisponible}`);
  });

  await ctx.escenario("Comprar más pasajeros que los lugares restantes", async () => {
    const { idsalida } = await armar({ tamano: 3 });
    const [c1, c2] = [await f.cliente(), await f.cliente()];
    await f.comprar(c1.token, idsalida, { n: 2 });
    await ctx.esperar("Comprar 2 con 1 lugar → 400", "POST", "/reservas", f.compra(idsalida, { n: 2 }), c2.token, 400);
    igual("Stock sin cambios tras el rechazo", await foto(idsalida), "1/1/1");
    igual("Sin pago del rechazado", await db.pago.count({ where: { reserva: { idsalida } } }), 1);
    await ctx.esperar("El lugar que quedaba se puede comprar → 201", "POST", "/reservas", f.compra(idsalida, { n: 1 }), c2.token, 201);
  });

  await ctx.escenario("Dos compras simultáneas por el último lugar", async () => {
    const { idsalida } = await armar({ tamano: 1 });
    const [c1, c2] = [await f.cliente(), await f.cliente()];
    const [a, b] = await Promise.all([
      ctx.back.llamar("POST", "/reservas", f.compra(idsalida), c1.token),
      ctx.back.llamar("POST", "/reservas", f.compra(idsalida), c2.token),
    ]);
    const estados = [a.status, b.status].sort();
    ctx.controlar("Simultáneas: una 201 y la otra 400", estados[0] === 201 && estados[1] === 400, `status ${a.status} y ${b.status}`);
    igual("Simultáneas: stockLocal 0 (nunca negativo) y una sola reserva", await foto(idsalida), "0/0/1");
    igual("Simultáneas: un solo pago", await db.pago.count({ where: { reserva: { idsalida } } }), 1);
  });

  await ctx.escenario("Pago rechazado devuelve los lugares", async () => {
    const { idsalida } = await armar({ tamano: 3 });
    const cli = await f.cliente();
    const antes = await foto(idsalida);
    const rechazos: [string, any][] = [
      ["fondos insuficientes (termina en 0000)", { tarjeta: "4242424242420000" }],
      ["tarjeta robada (termina en 1111)", { tarjeta: "4242424242421111" }],
    ];
    for (const [motivo, o] of rechazos) {
      await ctx.esperar(`Pago rechazado por ${motivo} → 400`, "POST", "/reservas", f.compra(idsalida, { n: 2, ...o }), cli.token, 400);
      igual(`Rechazo ${motivo}: stock vuelve a su valor`, await foto(idsalida), antes);
    }
    const cvv = f.compra(idsalida, { n: 2 });
    cvv.tarjeta.cvv = "999";
    await ctx.esperar("Pago rechazado por CVV 999 → 400", "POST", "/reservas", cvv, cli.token, 400);
    igual("Rechazo CVV: stock vuelve a su valor", await foto(idsalida), antes);
    igual("Rechazos: no queda ningún Pago", await db.pago.count({ where: { reserva: { idsalida } } }), 0);
    igual("Rechazos: no queda ninguna Solicitud", await db.solicitud.count({ where: { reserva: { idsalida } } }), 0);
    await ctx.esperar("Tras los rechazos se puede comprar los 3 lugares → 201", "POST", "/reservas", f.compra(idsalida, { n: 3 }), cli.token, 201);
  });

  await ctx.escenario("Precio con exceso de equipaje", async () => {
    // El transporte del paquete (fixture) incluye 15 kg y cobra 2 por kg excedente
    const { idsalida, dias } = await armar({ tamano: 6, transporte: true });
    const cli = await f.cliente();
    const inicio = new Date(fecha(dias));
    const temporada = await db.temporada.findFirstOrThrow({ where: { estado: "ACTIVO", fechaInicio: { lte: inicio }, fechaFin: { gte: inicio } } });

    const sin = await f.comprar(cli.token, idsalida, { n: 1, equipajeKg: 8 });
    igual("Sin exceso: precioCongelado = tarifa", (await res(sin.idreserva)).precioCongelado, 500);
    igual("Sin exceso: adicionalesEquipaje 0", (await res(sin.idreserva)).adicionalesEquipaje, 0);

    // 20 kg (5 de exceso), 15 kg (justo la franquicia, no cobra) y 8 kg: recargo = 5 × 2 = 10
    const body = f.compra(idsalida, { n: 3 });
    body.equipaje = [{ pesoDeclarado: 20 }, { pesoDeclarado: 15 }, { pesoDeclarado: 8 }];
    const r = await ctx.esperar("Compra con exceso de equipaje → 201", "POST", "/reservas", body, cli.token, 201);
    igual("Respuesta: precioCongelado = 500 × 3 + 10", r?.precioCongelado, 1510);
    const reserva = await res(r?.idreserva);
    igual("Reserva congela precioCongelado", reserva.precioCongelado, 1510);
    igual("Reserva congela precioPaquetePorPersona", reserva.precioPaquetePorPersona, 500);
    igual("Reserva congela adicionalesEquipaje", reserva.adicionalesEquipaje, 10);
    igual("Reserva congela temporadaAplicada", reserva.temporadaAplicada, temporada.nombre);
    const pagos = await db.pago.findMany({ where: { idreserva: reserva.idreserva } });
    ctx.controlar("Pago único igual al precio congelado", pagos.length === 1 && pagos[0]!.monto === 1510, `pagos=${JSON.stringify(pagos.map((p) => p.monto))}`);

    const det = await ctx.esperar("GET detalle de la reserva → 200", "GET", `/reservas/${reserva.idreserva}`, undefined, cli.token, 200);
    ctx.controlar("Detalle: desglose 500 + 1500 + 10, pagado 1510",
      det?.precioUnitario === 500 && det?.precioPaquete === 1500 && det?.adicionalesEquipaje === 10 && det?.pagado === 1510,
      JSON.stringify({ u: det?.precioUnitario, p: det?.precioPaquete, a: det?.adicionalesEquipaje, pagado: det?.pagado }));
  });

  await ctx.escenario("Validaciones del body de compra", async () => {
    const { idsalida } = await armar({ tamano: 3 });
    const cli = await f.cliente();
    const antes = await foto(idsalida);
    const casos: [string, (b: any) => void][] = [
      ["sin pasajeros", (b) => (b.pasajeros = [])],
      ["equipaje con menos elementos que pasajeros", (b) => { b.pasajeros = [f.pasajero(), f.pasajero()]; b.equipaje = [{ pesoDeclarado: 1 }]; }],
      ["peso de equipaje negativo", (b) => (b.equipaje = [{ pesoDeclarado: -1 }])],
      ["sin tarjeta", (b) => delete b.tarjeta],
      ["sin medioPago", (b) => delete b.medioPago],
      ["idsalida no numérico", (b) => (b.idsalida = "1")],
      ["fecha de vencimiento de pasaporte inválida", (b) => (b.pasajeros[0].fechaVencimientoPasaporte = "no-es-fecha")],
      ["tarjeta vencida", (b) => (b.tarjeta.vencimiento = "01/20")],
      ["número de tarjeta inválido", (b) => (b.tarjeta.numero = "123")],
    ];
    for (const [nombre, mutar] of casos) {
      const b = f.compra(idsalida, { n: 1 });
      mutar(b);
      await ctx.esperar(`Compra ${nombre} → 400`, "POST", "/reservas", b, cli.token, 400);
    }
    igual("Ninguna validación tocó el stock", await foto(idsalida), antes);
    await ctx.esperar("Compra sobre salida inexistente → 404", "POST", "/reservas", f.compra(99999999), cli.token, 404);
    await ctx.esperar("Compra sin token → 401", "POST", "/reservas", f.compra(idsalida), "", 401);
    await ctx.esperar("Compra con token de administrador → 403", "POST", "/reservas", f.compra(idsalida), ctx.admin, 403);
  });

  await ctx.escenario("Pasaporte repetido en la misma compra", async () => {
    const { idsalida } = await armar({ tamano: 3 });
    const cli = await f.cliente();
    const p = f.pasajero();
    await ctx.esperar("Mismo pasaporte dos veces en una compra → 400", "POST", "/reservas", f.compra(idsalida, { pasajeros: [p, { ...p }] }), cli.token, 400);
    igual("Stock sin cambios", await foto(idsalida), "3/3/0");
  });

  await ctx.escenario("Pasaporte repetido en la misma salida", async () => {
    const { idsalida } = await armar({ tamano: 4 });
    const [c1, c2] = [await f.cliente(), await f.cliente()];
    const p = f.pasajero();
    await f.comprar(c1.token, idsalida, { pasajeros: [p] });
    await ctx.esperar("Mismo pasaporte y nombre en otra compra de la salida → 400", "POST", "/reservas", f.compra(idsalida, { pasajeros: [{ ...p }] }), c2.token, 400);
    await ctx.esperar("Mismo pasaporte, otro cliente y otro nombre → 4xx", "POST", "/reservas", f.compra(idsalida, { pasajeros: [{ ...p, nombreCompleto: "Otro Nombre" }] }), c2.token, [400, 409]);
    igual("Stock sin cambios (queda 1 reserva)", await foto(idsalida), "3/3/1");
    igual("Un solo pasajero con ese pasaporte", await db.pasajero.count({ where: { nroPasaporte: p.nroPasaporte } }), 1);
  });

  await ctx.escenario("Pasaporte de solo espacios", async () => {
    const { idsalida } = await armar({ tamano: 3 });
    const cli = await f.cliente();
    await ctx.esperar("Pasaporte con solo espacios → 400", "POST", "/reservas", f.compra(idsalida, { pasajeros: [f.pasajero({ pasaporte: "   " })] }), cli.token, 400);
    await ctx.esperar("Pasaporte vacío → 400", "POST", "/reservas", f.compra(idsalida, { pasajeros: [f.pasajero({ pasaporte: "" })] }), cli.token, 400);
    igual("Stock sin cambios", await foto(idsalida), "3/3/0");
    igual("No se creó ningún pasajero con pasaporte vacío", await db.pasajero.count({ where: { nroPasaporte: { in: ["", "   "] } } }), 0);
  });

  await ctx.escenario("Pasajero existente con otro nombre", async () => {
    const a = await armar({ tamano: 3 });
    const b = await armar({ tamano: 3 });
    const [c1, c2] = [await f.cliente(), await f.cliente()];
    const p = f.pasajero({ nombre: "Maria Quispe" });
    await f.comprar(c1.token, a.idsalida, { pasajeros: [p] });
    await ctx.esperar("Pasaporte registrado a nombre de otra persona → 409", "POST", "/reservas", f.compra(b.idsalida, { pasajeros: [{ ...p, nombreCompleto: "Pedro Gomez" }] }), c2.token, 409);
    igual("Rechazo 409: stock de la otra salida sin cambios", await foto(b.idsalida), "3/3/0");
    igual("El pasajero existente conserva su nombre", (await db.pasajero.findUniqueOrThrow({ where: { nroPasaporte: p.nroPasaporte } })).nombreCompleto, "Maria Quispe");
    await ctx.esperar("Mismo pasaporte y mismo nombre (otras mayúsculas) en otra salida → 201", "POST", "/reservas", f.compra(b.idsalida, { pasajeros: [{ ...p, nombreCompleto: " MARIA quispe " }] }), c2.token, 201);
    igual("El pasajero se reutiliza (no se duplica)", await db.pasajero.count({ where: { nroPasaporte: p.nroPasaporte } }), 1);
  });

  await ctx.escenario("Compra con pasaporte que vence durante el recorrido", async () => {
    // Circuito de 3 días: fechaFin = inicio + 2
    const { idsalida, dias } = await armar({ tamano: 3 });
    const cli = await f.cliente();
    const antes = await foto(idsalida);
    await ctx.esperar("Pasaporte que vence en medio del recorrido → 400", "POST", "/reservas",
      f.compra(idsalida, { pasajeros: [f.pasajero({ vence: fecha(dias + 1) })] }), cli.token, 400);
    igual("Rechazo por pasaporte: stock sin cambios", await foto(idsalida), antes);
    await ctx.esperar("Pasaporte que vence el último día del recorrido → 400", "POST", "/reservas",
      f.compra(idsalida, { pasajeros: [f.pasajero({ vence: fecha(dias + 2) })] }), cli.token, 400);
    await ctx.esperar("Pasaporte que ya venció → 400", "POST", "/reservas",
      f.compra(idsalida, { pasajeros: [f.pasajero({ vence: fecha(-30) })] }), cli.token, 400);
    await ctx.esperar("Un pasajero vencido entre varios rechaza toda la compra → 400", "POST", "/reservas",
      f.compra(idsalida, { pasajeros: [f.pasajero(), f.pasajero({ vence: fecha(dias + 1) })] }), cli.token, 400);
    igual("Ninguna reserva ni pasajero creados", await foto(idsalida), antes);
  });

  await ctx.escenario("Compra en salida no disponible", async () => {
    const { idsalida } = await armar({ tamano: 3 });
    const cli = await f.cliente();
    // Estados que no se alcanzan por la API de este módulo se setean por base
    for (const estado of ["CERRADA", "CANCELADA", "EN_CURSO", "FINALIZADA"]) {
      await db.salida.update({ where: { idsalida }, data: { estado } });
      await ctx.esperar(`Compra en salida ${estado} → 400`, "POST", "/reservas", f.compra(idsalida), cli.token, 400);
    }
    igual("Salidas no disponibles: stock sin cambios y sin reservas", await foto(idsalida), "3/3/0");
    await db.salida.update({ where: { idsalida }, data: { estado: "PUBLICADA" } });

    await f.moverFechas(idsalida, fecha(-1), fecha(1));
    await ctx.esperar("Compra en salida PUBLICADA que empezó ayer → 400", "POST", "/reservas", f.compra(idsalida), cli.token, 400);
    await f.moverFechas(idsalida, fecha(0), fecha(2));
    await ctx.esperar("Compra en salida que empieza hoy → 400", "POST", "/reservas", f.compra(idsalida), cli.token, 400);
    igual("Salidas empezadas: stock sin cambios", await foto(idsalida), "3/3/0");
    await f.moverFechas(idsalida, fecha(1), fecha(3));
    await ctx.esperar("Compra en salida que empieza mañana → 201", "POST", "/reservas", f.compra(idsalida), cli.token, 201);
  });

  await ctx.escenario("Compra en salida sin tarifa vigente", async () => {
    const { pq, idsalida } = await armar({ tamano: 3 });
    const cli = await f.cliente();
    // Sin temporada que cubra 2029 no se puede ni crear la salida
    await ctx.esperar("Crear salida en fecha sin tarifa → 400", "POST", "/salidas", { idpaquete: pq.idpaquete, fechaInicio: "2029-06-01", tamanoMaximo: 3 }, ctx.admin, 400);
    // Salida existente cuya fecha queda sin tarifa (se mueve por base)
    await f.moverFechas(idsalida, "2029-06-01", "2029-06-03");
    await ctx.esperar("Compra en salida sin tarifa para su fecha → 400", "POST", "/reservas", f.compra(idsalida), cli.token, 400);
    igual("Sin tarifa: stock sin cambios", await foto(idsalida), "3/3/0");
    igual("Sin tarifa: ningún pago", await db.pago.count({ where: { reserva: { idsalida } } }), 0);
  });

  // ==================================================================================================
  ctx.seccion("CU-31 Consultar reservas");

  await ctx.escenario("Consulta de reservas por cliente y administrador", async () => {
    const { idsalida } = await armar({ tamano: 4 });
    const [c1, c2] = [await f.cliente(), await f.cliente()];
    const r1 = await f.comprar(c1.token, idsalida, { n: 1 });
    const r2 = await f.comprar(c2.token, idsalida, { n: 1 });

    const mias = await ctx.esperar("Cliente: GET /reservas/mis-reservas → 200", "GET", "/reservas/mis-reservas", undefined, c1.token, 200);
    const ids = (mias ?? []).map((r: any) => r.idreserva);
    ctx.controlar("Mis reservas: solo la propia", ids.includes(r1.idreserva) && !ids.includes(r2.idreserva), JSON.stringify(ids));
    await ctx.esperar("Cliente: filtro de estado inválido → 400", "GET", "/reservas/mis-reservas?estado=XX", undefined, c1.token, 400);
    const todas = await ctx.esperar("Admin: GET /reservas → 200", "GET", "/reservas?limite=200", undefined, ctx.admin, 200);
    const todasIds = (todas ?? []).map((r: any) => r.idreserva);
    ctx.controlar("Admin ve ambas reservas", todasIds.includes(r1.idreserva) && todasIds.includes(r2.idreserva), `ids=${todasIds.length}`);
    await ctx.esperar("Cliente: GET /reservas (listado de admin) → 403", "GET", "/reservas", undefined, c1.token, 403);
    await ctx.esperar("Admin: filtro limite fuera de rango → 400", "GET", "/reservas?limite=500", undefined, ctx.admin, 400);
    await ctx.esperar("Cliente ve el detalle de su reserva → 200", "GET", `/reservas/${r1.idreserva}`, undefined, c1.token, 200);
    await ctx.esperar("Cliente ve el detalle de la reserva de otro → 403", "GET", `/reservas/${r1.idreserva}`, undefined, c2.token, 403);
    await ctx.esperar("Cliente descarga el comprobante de otro → 403", "GET", `/reservas/${r1.idreserva}/comprobante`, undefined, c2.token, 403);
    const comp = await ctx.esperar("Cliente descarga su comprobante → 200", "GET", `/reservas/${r1.idreserva}/comprobante`, undefined, c1.token, 200);
    igual("Comprobante: totalPagado = precio", comp?.totalPagado, 500);
    await ctx.esperar("Detalle de reserva inexistente → 404", "GET", "/reservas/99999999", undefined, ctx.admin, 404);
    await ctx.esperar("Detalle con id no numérico → 400", "GET", "/reservas/abc", undefined, ctx.admin, 400);
    await ctx.esperar("Detalle sin token → 401", "GET", `/reservas/${r1.idreserva}`, undefined, "", 401);
  });

  // ==================================================================================================
  ctx.seccion("CU-32 Cancelar una reserva");

  await ctx.escenario("Cancelación del cliente dentro del plazo", async () => {
    const { hotel, idsalida } = await armar({ tamano: 4, dias: 60, reintegro: 15 });
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 2 });
    igual("Tras comprar 2: stock 2 / alojamiento 2", await foto(idsalida), "2/2/1");
    const capHotel = await cap(hotel!.idservicio);

    const liq = await ctx.esperar("GET liquidación de cancelación → 200", "GET", `/reservas/${idreserva}/cancelacion`, undefined, cli.token, 200);
    ctx.controlar("Liquidación: abonado 1000, reintegro 1000, sin permisos, lugares vuelven a la venta",
      liq?.importeAbonado === 1000 && liq?.montoAReintegrar === 1000 && liq?.permisosEmitidos === false && liq?.lugaresVuelvenALaVenta === true,
      JSON.stringify(liq));
    igual("Consultar la liquidación no cancela nada", (await res(idreserva)).estado, "CONFIRMADA");
    igual("Consultar la liquidación no mueve el stock", await foto(idsalida), "2/2/1");

    const c = await ctx.esperar("Cancelar dentro del plazo → 200", "POST", `/reservas/${idreserva}/cancelar`, { motivo: "Cambio de planes" }, cli.token, 200);
    igual("Respuesta: reintegro 100%", c?.reembolso?.montoReembolsado, 1000);
    igual("Respuesta: lugaresVuelvenALaVenta", c?.lugaresVuelvenALaVenta, true);
    igual("Reserva CANCELADA", (await res(idreserva)).estado, "CANCELADA");
    const rb = await db.reembolso.findMany({ where: { idreserva } });
    ctx.controlar("Reembolso único = 100% del abonado, con motivo y condición",
      rb.length === 1 && rb[0]!.montoReembolsado === 1000 && rb[0]!.motivo === "Cambio de planes" && /100%/.test(rb[0]!.condicionAplicada ?? ""),
      JSON.stringify(rb));
    igual("stockLocal y stockLocalAlojamiento vuelven (4/4)", (await foto(idsalida)).slice(0, 3), "4/4");
    igual("El hotel no cambia su capacidad (las plazas vuelven a la salida)", await cap(hotel!.idservicio), capHotel);
    igual("El pago original se conserva", await db.pago.count({ where: { idreserva } }), 1);

    await ctx.esperar("Cancelar dos veces → 400", "POST", `/reservas/${idreserva}/cancelar`, { motivo: "otra vez" }, cli.token, 400);
    igual("Segunda cancelación: un solo reembolso", await db.reembolso.count({ where: { idreserva } }), 1);
    igual("Segunda cancelación: el stock no se repone dos veces", (await foto(idsalida)).slice(0, 3), "4/4");
    await ctx.esperar("Cancelar con motivo de más de 300 caracteres → 400", "POST", `/reservas/${idreserva}/cancelar`, { motivo: "x".repeat(301) }, cli.token, 400);
  });

  await ctx.escenario("Cancelación del cliente fuera del plazo", async () => {
    const { idsalida } = await armar({ tamano: 4, dias: 60, reintegro: 15 });
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 2 });
    await f.moverFechas(idsalida, fecha(5), fecha(7));

    const liq = await ctx.esperar("Liquidación con 5 días de anticipación → 200", "GET", `/reservas/${idreserva}/cancelacion`, undefined, cli.token, 200);
    igual("Liquidación: reintegro 0", liq?.montoAReintegrar, 0);
    igual("Liquidación: abonado 1000", liq?.importeAbonado, 1000);
    ctx.controlar("condicionAplicada explica el plazo", /sin reintegro/i.test(liq?.condicionAplicada ?? "") && /15/.test(liq?.condicionAplicada ?? "") && /\b5\b/.test(liq?.condicionAplicada ?? ""), liq?.condicionAplicada);

    const c = await ctx.esperar("Cancelar fuera de plazo → 200", "POST", `/reservas/${idreserva}/cancelar`, {}, cli.token, 200);
    igual("Respuesta: reintegro 0", c?.reembolso?.montoReembolsado, 0);
    const rb = await db.reembolso.findMany({ where: { idreserva } });
    ctx.controlar("Se asienta un Reembolso de $0 con la condición", rb.length === 1 && rb[0]!.montoReembolsado === 0 && /sin reintegro/i.test(rb[0]!.condicionAplicada ?? ""), JSON.stringify(rb));
    igual("Reserva CANCELADA", (await res(idreserva)).estado, "CANCELADA");
    igual("Sin permisos emitidos: los lugares igual vuelven (4/4)", (await foto(idsalida)).slice(0, 3), "4/4");
    igual("Motivo por defecto cuando no se informa", rb[0]?.motivo, "Sin motivo informado");
  });

  await ctx.escenario("Borde del plazo de reintegro", async () => {
    const { idsalida } = await armar({ tamano: 3, dias: 60, reintegro: 15 });
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 1 });
    await f.moverFechas(idsalida, fecha(15), fecha(17));
    const justo = await ctx.esperar("Liquidación con exactamente 15 días → 200", "GET", `/reservas/${idreserva}/cancelacion`, undefined, cli.token, 200);
    igual("Exactamente el plazo mínimo: reintegro 100%", justo?.montoAReintegrar, 500);
    await f.moverFechas(idsalida, fecha(14), fecha(16));
    const corto = await ctx.esperar("Liquidación con 14 días → 200", "GET", `/reservas/${idreserva}/cancelacion`, undefined, cli.token, 200);
    igual("Un día menos que el plazo: reintegro 0", corto?.montoAReintegrar, 0);
  });

  await ctx.escenario("Paquete sin plazo de reintegro", async () => {
    const { idsalida } = await armar({ tamano: 3, dias: 60, reintegro: null });
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 1 });
    igual("La reserva congela diasMinimosReintegro null", (await res(idreserva)).diasMinimosReintegro, null);
    await f.moverFechas(idsalida, fecha(2), fecha(4));
    const liq = await ctx.esperar("Liquidación a 2 días sin plazo → 200", "GET", `/reservas/${idreserva}/cancelacion`, undefined, cli.token, 200);
    igual("Sin plazo definido: reintegro 100% aunque falten 2 días", liq?.montoAReintegrar, 500);
  });

  await ctx.escenario("El plazo se congela al comprar", async () => {
    const { pq, idsalida } = await armar({ tamano: 3, dias: 60, reintegro: 15 });
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 1 });
    await ctx.preparar("Cambiar el plazo del paquete", "PUT", `/paquetes/${pq.idpaquete}`, { diasMinimosReintegro: 90 });
    await f.moverFechas(idsalida, fecha(30), fecha(32));
    const liq = await ctx.esperar("Liquidación tras cambiar el plazo del paquete → 200", "GET", `/reservas/${idreserva}/cancelacion`, undefined, cli.token, 200);
    igual("Rige el plazo de la compra (15), no el nuevo (90): reintegro 100%", liq?.montoAReintegrar, 500);
  });

  await ctx.escenario("Cancelación del administrador", async () => {
    const { idsalida } = await armar({ tamano: 4, dias: 60, reintegro: 15 });
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 2 });
    await f.moverFechas(idsalida, fecha(5), fecha(7)); // fuera de plazo: al cliente no le reintegraría nada
    const liq = await ctx.esperar("Admin: liquidación → 200", "GET", `/reservas/${idreserva}/cancelacion`, undefined, ctx.admin, 200);
    igual("Admin: reintegro 100% aun fuera de plazo", liq?.montoAReintegrar, 1000);
    const c = await ctx.esperar("Admin cancela → 200", "POST", `/reservas/${idreserva}/cancelar`, { motivo: "Decisión de la agencia" }, ctx.admin, 200);
    igual("Respuesta: reintegro 1000", c?.reembolso?.montoReembolsado, 1000);
    const rb = await db.reembolso.findMany({ where: { idreserva } });
    ctx.controlar("Reembolso 100% con condición del administrador", rb.length === 1 && rb[0]!.montoReembolsado === 1000 && /administrador/i.test(rb[0]!.condicionAplicada ?? ""), JSON.stringify(rb));
    igual("Stock repuesto (4/4)", (await foto(idsalida)).slice(0, 3), "4/4");
  });

  await ctx.escenario("Cancelación con permisos emitidos", async () => {
    // Salida CERRADA con la asignación real (CU-40): los permisos de los pasajeros quedan Emitidos
    const { hotel, idsalida, localidad } = await armar({ tamano: 4, dias: 60, reintegro: 15 });
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 2 });
    await cerrar(idsalida, localidad, 2);
    igual("Salida CERRADA", (await sal(idsalida)).estado, "CERRADA");
    const permisos = await db.permisoPasajero.findMany({ where: { idreserva } });
    ctx.controlar("Dos permisos Emitidos", permisos.length === 2 && permisos.every((p) => p.estadoTramite === "Emitido"), JSON.stringify(permisos.map((p) => p.estadoTramite)));

    const s0 = await sal(idsalida);
    const capHotel = await cap(hotel!.idservicio);
    const liq = await ctx.esperar("Liquidación con permisos emitidos → 200", "GET", `/reservas/${idreserva}/cancelacion`, undefined, cli.token, 200);
    ctx.controlar("Liquidación: reintegro 0, permisos emitidos, lugares no vuelven, con advertencia",
      liq?.montoAReintegrar === 0 && liq?.permisosEmitidos === true && liq?.lugaresVuelvenALaVenta === false && !!liq?.advertencia, JSON.stringify(liq));

    const c = await ctx.esperar("Cancelar con permisos emitidos → 200", "POST", `/reservas/${idreserva}/cancelar`, {}, cli.token, 200);
    igual("Respuesta: reintegro 0", c?.reembolso?.montoReembolsado, 0);
    igual("Respuesta: lugaresVuelvenALaVenta false", c?.lugaresVuelvenALaVenta, false);
    igual("Reserva CANCELADA", (await res(idreserva)).estado, "CANCELADA");
    const despues = await db.permisoPasajero.findMany({ where: { idreserva } });
    ctx.controlar("Los permisos pasan a Perdido", despues.length === 2 && despues.every((p) => p.estadoTramite === "Perdido"), JSON.stringify(despues.map((p) => p.estadoTramite)));
    const s1 = await sal(idsalida);
    igual("stockLocal NO aumenta", s1.stockLocal, s0.stockLocal);
    igual("stockLocalAlojamiento no aumenta", s1.stockLocalAlojamiento, s0.stockLocalAlojamiento);
    igual("lugaresPorLiberar no cambia", s1.lugaresPorLiberar, s0.lugaresPorLiberar);
    igual("Salida CERRADA: el hotel recupera las 2 plazas", await cap(hotel!.idservicio), capHotel + 2);
  });

  await ctx.escenario("Administrador cancela con permisos emitidos", async () => {
    const { idsalida, localidad } = await armar({ tamano: 2, dias: 60, reintegro: 15 });
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 2 });
    await cerrar(idsalida, localidad, 2);
    const c = await ctx.esperar("Admin cancela reserva con permisos emitidos → 200", "POST", `/reservas/${idreserva}/cancelar`, {}, ctx.admin, 200);
    igual("Admin: reintegro 100% aunque haya permisos", c?.reembolso?.montoReembolsado, 1000);
    const permisos = await db.permisoPasajero.findMany({ where: { idreserva } });
    ctx.controlar("Los permisos pasan a Perdido", permisos.length === 2 && permisos.every((p) => p.estadoTramite === "Perdido"), JSON.stringify(permisos.map((p) => p.estadoTramite)));
    igual("stockLocal sigue en 0", (await sal(idsalida)).stockLocal, 0);
  });

  await ctx.escenario("Reserva de salida CERRADA sin permisos emitidos", async () => {
    // Se cierra por base (sin permisos) para aislar RES-13: la salida ya no vende y el hotel recupera las plazas
    const { hotel, idsalida } = await armar({ tamano: 4, dias: 60, reintegro: 15 });
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 2 });
    await db.salida.update({ where: { idsalida }, data: { estado: "CERRADA", stockLocal: 0, stockLocalAlojamiento: 0, lugaresPorLiberar: 3 } });
    const capHotel = await cap(hotel!.idservicio);
    const liq = await ctx.esperar("Liquidación en salida CERRADA → 200", "GET", `/reservas/${idreserva}/cancelacion`, undefined, cli.token, 200);
    igual("CERRADA: lugaresVuelvenALaVenta false", liq?.lugaresVuelvenALaVenta, false);
    igual("CERRADA dentro del plazo: reintegro 100%", liq?.montoAReintegrar, 1000);
    const c = await ctx.esperar("Cancelar en salida CERRADA → 200", "POST", `/reservas/${idreserva}/cancelar`, {}, cli.token, 200);
    igual("Respuesta: lugaresVuelvenALaVenta false", c?.lugaresVuelvenALaVenta, false);
    const s = await sal(idsalida);
    igual("stockLocal sigue en 0", s.stockLocal, 0);
    igual("lugaresPorLiberar no cambia", s.lugaresPorLiberar, 3);
    igual("El hotel aumenta su capacidad en 2", await cap(hotel!.idservicio), capHotel + 2);
  });

  await ctx.escenario("Doble cancelación simultánea", async () => {
    const { idsalida } = await armar({ tamano: 4, dias: 60, reintegro: 15 });
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 2 });
    const [a, b] = await Promise.all([cancelar(cli.token, idreserva), cancelar(cli.token, idreserva)]);
    const st = [a.status, b.status].sort();
    ctx.controlar("Una cancelación 200 y la otra 409", st[0] === 200 && st[1] === 409, `status ${a.status} y ${b.status}`);
    igual("Un solo reembolso", await db.reembolso.count({ where: { idreserva } }), 1);
    igual("El stock se repone una sola vez (4/4)", (await foto(idsalida)).slice(0, 3), "4/4");
  });

  await ctx.escenario("Cancelar la reserva de otro cliente", async () => {
    const { idsalida } = await armar({ tamano: 3, dias: 60 });
    const [c1, c2] = [await f.cliente(), await f.cliente()];
    const { idreserva } = await f.comprar(c1.token, idsalida, { n: 1 });
    await ctx.esperar("Otro cliente pide la liquidación → 403", "GET", `/reservas/${idreserva}/cancelacion`, undefined, c2.token, 403);
    await ctx.esperar("Otro cliente cancela → 403", "POST", `/reservas/${idreserva}/cancelar`, {}, c2.token, 403);
    igual("Reserva intacta", (await res(idreserva)).estado, "CONFIRMADA");
    igual("Sin reembolso ni cambio de stock", `${await db.reembolso.count({ where: { idreserva } })}/${await foto(idsalida)}`, "0/2/2/1");
    await ctx.esperar("Cancelar sin token → 401", "POST", `/reservas/${idreserva}/cancelar`, {}, "", 401);
    await ctx.esperar("Cancelar reserva inexistente → 404", "POST", "/reservas/99999999/cancelar", {}, c1.token, 404);
    await ctx.esperar("Cancelar con id no numérico → 400", "POST", "/reservas/abc/cancelar", {}, c1.token, 400);
  });

  await ctx.escenario("Cancelar con la salida en curso", async () => {
    const { idsalida } = await armar({ tamano: 4, dias: 60 });
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 2 });
    const intento = async (etiqueta: string) => {
      await ctx.esperar(`Liquidación ${etiqueta} → 400`, "GET", `/reservas/${idreserva}/cancelacion`, undefined, cli.token, 400);
      await ctx.esperar(`Cancelar ${etiqueta} → 400`, "POST", `/reservas/${idreserva}/cancelar`, {}, cli.token, 400);
      await ctx.esperar(`Admin cancela ${etiqueta} → 400`, "POST", `/reservas/${idreserva}/cancelar`, {}, ctx.admin, 400);
      igual(`Reserva intacta (${etiqueta})`, `${(await res(idreserva)).estado}/${await db.reembolso.count({ where: { idreserva } })}/${await foto(idsalida)}`, "CONFIRMADA/0/2/2/1");
    };
    await f.moverFechas(idsalida, fecha(-1), fecha(1));
    await intento("con la salida iniciada ayer");
    await f.moverFechas(idsalida, fecha(0), fecha(2));
    await intento("con la salida que empieza hoy");
    await f.moverFechas(idsalida, fecha(60), fecha(62));
    await db.salida.update({ where: { idsalida }, data: { estado: "EN_CURSO" } });
    await intento("con la salida EN_CURSO");
  });

  await ctx.escenario("Cancelar con alojamiento confirmado por solicitud", async () => {
    // Alojamiento A_SOLICITUD aceptado: las plazas no salieron del stock de la salida, así que no vuelven al stock
    const { hotel, idsalida } = await armar({ tamano: 4, dias: 60, hotel: "solicitud" });
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 2 });
    const sol = await db.solicitud.findFirstOrThrow({ where: { idreserva } });
    await ctx.preparar("Aceptar solicitud", "POST", `/solicitudes/${sol.idsolicitud}/resolver`, { servicioId: hotel!.idservicio, resolucion: "ACEPTADA" });
    igual("Antes de cancelar: stock 2 / alojamiento 0", (await foto(idsalida)).slice(0, 3), "2/0");
    await ctx.esperar("Cancelar → 200", "POST", `/reservas/${idreserva}/cancelar`, {}, cli.token, 200);
    igual("stockLocal vuelve (4) y stockLocalAlojamiento no se infla (0)", (await foto(idsalida)).slice(0, 3), "4/0");
    igual("La solicitud confirmada pasa a CANCELADA", (await db.solicitud.findUniqueOrThrow({ where: { idsolicitud: sol.idsolicitud } })).estado, "CANCELADA");
  });

  await ctx.escenario("Cancelar con la solicitud de alojamiento pendiente", async () => {
    const { hotel, idsalida } = await armar({ tamano: 4, dias: 60, hotel: "solicitud" });
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 2 });
    const sol = await db.solicitud.findFirstOrThrow({ where: { idreserva } });
    await ctx.esperar("Cancelar la reserva → 200", "POST", `/reservas/${idreserva}/cancelar`, {}, cli.token, 200);
    igual("La solicitud pendiente pasa a CANCELADA", (await db.solicitud.findUniqueOrThrow({ where: { idsolicitud: sol.idsolicitud } })).estado, "CANCELADA");
    await ctx.esperar("Resolver la solicitud de una reserva cancelada → 400", "POST", `/solicitudes/${sol.idsolicitud}/resolver`, { servicioId: hotel!.idservicio, resolucion: "ACEPTADA" }, ctx.admin, 400);
    const pend = await ctx.esperar("GET /solicitudes → 200", "GET", "/solicitudes", undefined, ctx.admin, 200);
    ctx.controlar("La solicitud cancelada ya no figura como pendiente", !(pend ?? []).some((s: any) => s.idsolicitud === sol.idsolicitud), "sigue en la lista");
  });

  // ==================================================================================================
  ctx.seccion("CU-33 / CU-34 Solicitudes de alojamiento");

  await ctx.escenario("Alojamiento por solicitud con hotel A_SOLICITUD", async () => {
    const { hotel, idsalida } = await armar({ tamano: 4, hotel: "solicitud", capHotel: 30 });
    igual("Salida sin hotel con bloqueo: stockLocalAlojamiento 0", (await sal(idsalida)).stockLocalAlojamiento, 0);
    const cli = await f.cliente();
    const r = await ctx.esperar("Comprar 2 → 201", "POST", "/reservas", f.compra(idsalida, { n: 2 }), cli.token, 201);
    igual("Respuesta: estadoAlojamiento PENDIENTE", r?.estadoAlojamiento, "PENDIENTE");
    const reserva = await res(r?.idreserva);
    igual("Reserva CONFIRMADA con alojamiento PENDIENTE", `${reserva.estado}/${reserva.estadoAlojamiento}`, "CONFIRMADA/PENDIENTE");
    igual("stockLocal baja, alojamiento sigue en 0", (await foto(idsalida)).slice(0, 3), "2/0");
    igual("El hotel A_SOLICITUD no pierde capacidad", await cap(hotel!.idservicio), 30);
    const sols = await db.solicitud.findMany({ where: { idreserva: reserva.idreserva } });
    ctx.controlar("Una Solicitud PENDIENTE por las 2 plazas", sols.length === 1 && sols[0]!.estado === "PENDIENTE" && sols[0]!.cantidadPlazas === 2 && sols[0]!.nroSolicitud === `SOL-${reserva.nroReserva}`, JSON.stringify(sols));

    const lista = await ctx.esperar("GET /solicitudes → 200", "GET", "/solicitudes", undefined, ctx.admin, 200);
    ctx.controlar("La solicitud figura entre las pendientes", (lista ?? []).some((s: any) => s.idsolicitud === sols[0]?.idsolicitud), `${lista?.length} pendientes`);
    await ctx.esperar("Cliente consulta solicitudes → 403", "GET", "/solicitudes", undefined, cli.token, 403);
    await ctx.esperar("Solicitudes sin token → 401", "GET", "/solicitudes", undefined, "", 401);

    // CU-40 FA5: con alojamiento sin confirmar no se consolida la salida
    await ctx.esperar("Cerrar la salida con alojamiento pendiente → 409", "POST", `/salidas/${idsalida}/asignacion`, { personalIds: [1], idtransporte: 1 }, ctx.admin, 409);
    igual("La salida sigue PUBLICADA", (await sal(idsalida)).estado, "PUBLICADA");
  });

  await ctx.escenario("Hotel con bloqueo insuficiente deja alojamiento por solicitud", async () => {
    const localidad = `Loc ${ctx.unico()}`;
    const pq = await f.paquete({ localidad });
    const hotel = await f.hotel(localidad, 2);
    await ctx.esperar("Crear salida eligiendo un hotel sin capacidad → 400", "POST", "/salidas", { idpaquete: pq.idpaquete, fechaInicio: fecha(50), tamanoMaximo: 4, idalojamiento: hotel.idservicio }, ctx.admin, 400);
    const idsalida = await f.salida(pq.idpaquete, fecha(50), 4);
    const cli = await f.cliente();
    const r = await ctx.esperar("Comprar → 201", "POST", "/reservas", f.compra(idsalida, { n: 1 }), cli.token, 201);
    igual("estadoAlojamiento PENDIENTE", r?.estadoAlojamiento, "PENDIENTE");
    igual("El hotel conserva su capacidad", await cap(hotel.idservicio), 2);
    igual("Se creó una solicitud pendiente", await db.solicitud.count({ where: { idreserva: r?.idreserva, estado: "PENDIENTE" } }), 1);
  });

  await ctx.escenario("Rechazo de la solicitud genera la -R sin el hotel rechazado", async () => {
    const { hotel: A, idsalida, localidad } = await armar({ tamano: 4, hotel: "solicitud" });
    const B = await f.hotel(localidad, 20, "A_SOLICITUD");
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 2 });
    const sol = await db.solicitud.findFirstOrThrow({ where: { idreserva } });
    const hoteles = (op: any) => (op?.opcionesContacto ?? []).map((o: any) => o.servicioId).sort();

    const op1 = await ctx.esperar("Opciones de la solicitud → 200", "GET", `/solicitudes/${sol.idsolicitud}/opciones`, undefined, ctx.admin, 200);
    igual("Opciones: los dos hoteles", JSON.stringify(hoteles(op1)), JSON.stringify([A!.idservicio, B.idservicio].sort()));

    await ctx.esperar("Rechazar sin motivo → 400", "POST", `/solicitudes/${sol.idsolicitud}/resolver`, { servicioId: A!.idservicio, resolucion: "RECHAZADA" }, ctx.admin, 400);
    await ctx.esperar("Resolución inválida → 400", "POST", `/solicitudes/${sol.idsolicitud}/resolver`, { servicioId: A!.idservicio, resolucion: "TAL VEZ" }, ctx.admin, 400);
    await ctx.esperar("Hotel de otra localidad → 400", "POST", `/solicitudes/${sol.idsolicitud}/resolver`, { servicioId: (await f.hotel(`Otra ${ctx.unico()}`, 10, "A_SOLICITUD")).idservicio, resolucion: "ACEPTADA" }, ctx.admin, 400);
    await ctx.esperar("Servicio inexistente → 400", "POST", `/solicitudes/${sol.idsolicitud}/resolver`, { servicioId: 99999999, resolucion: "ACEPTADA" }, ctx.admin, 400);
    await ctx.esperar("Solicitud inexistente → 404", "POST", "/solicitudes/99999999/resolver", { servicioId: A!.idservicio, resolucion: "ACEPTADA" }, ctx.admin, 404);
    await ctx.esperar("Opciones de solicitud inexistente → 404", "GET", "/solicitudes/99999999/opciones", undefined, ctx.admin, 404);
    igual("Los intentos inválidos no cambiaron la solicitud", (await db.solicitud.findUniqueOrThrow({ where: { idsolicitud: sol.idsolicitud } })).estado, "PENDIENTE");

    const rech = await ctx.esperar("Rechazar el hotel A con motivo → 200", "POST", `/solicitudes/${sol.idsolicitud}/resolver`, { servicioId: A!.idservicio, resolucion: "RECHAZADA", motivo: "Sin disponibilidad" }, ctx.admin, 200);
    igual("La original queda RECHAZADA", (await db.solicitud.findUniqueOrThrow({ where: { idsolicitud: sol.idsolicitud } })).estado, "RECHAZADA");
    const nueva = await db.solicitud.findFirst({ where: { idreserva, nroSolicitud: `${sol.nroSolicitud}-R` } });
    ctx.controlar("Se generó la -R PENDIENTE con las mismas plazas y criterios", !!nueva && nueva.estado === "PENDIENTE" && nueva.cantidadPlazas === 2 && nueva.criterios === sol.criterios && nueva.idsolicitud === rech?.nuevaSolicitudId, JSON.stringify(nueva));
    const gest = await db.gestionSolicitud.findMany({ where: { idsolicitud: sol.idsolicitud } });
    ctx.controlar("Gestión Rechazada del hotel A con su motivo", gest.length === 1 && gest[0]!.idservicio === A!.idservicio && gest[0]!.resultado === "Rechazada" && gest[0]!.motivoRechazo === "Sin disponibilidad", JSON.stringify(gest));
    igual("La reserva sigue con alojamiento PENDIENTE", (await res(idreserva)).estadoAlojamiento, "PENDIENTE");
    await ctx.esperar("Resolver otra vez la original → 400", "POST", `/solicitudes/${sol.idsolicitud}/resolver`, { servicioId: B.idservicio, resolucion: "ACEPTADA" }, ctx.admin, 400);
    await ctx.esperar("Opciones de la original ya resuelta → 400", "GET", `/solicitudes/${sol.idsolicitud}/opciones`, undefined, ctx.admin, 400);

    const op2 = await ctx.esperar("Opciones de la -R → 200", "GET", `/solicitudes/${nueva?.idsolicitud}/opciones`, undefined, ctx.admin, 200);
    igual("Opciones de la -R: solo el hotel B", JSON.stringify(hoteles(op2)), JSON.stringify([B.idservicio]));
    await ctx.esperar("Aceptar el hotel A ya rechazado en la -R → 400", "POST", `/solicitudes/${nueva?.idsolicitud}/resolver`, { servicioId: A!.idservicio, resolucion: "ACEPTADA" }, ctx.admin, 400);

    const ok = await ctx.esperar("Aceptar el hotel B en la -R → 200", "POST", `/solicitudes/${nueva?.idsolicitud}/resolver`, { servicioId: B.idservicio, resolucion: "ACEPTADA" }, ctx.admin, 200);
    igual("Pendientes restantes de la salida: 0", ok?.solicitudesPendientesRestantesEnSalida, 0);
    igual("Reserva con alojamiento CONFIRMADO", (await res(idreserva)).estadoAlojamiento, "CONFIRMADO");
    igual("La -R queda CONFIRMADA", (await db.solicitud.findUniqueOrThrow({ where: { idsolicitud: nueva!.idsolicitud } })).estado, "CONFIRMADA");
    const g2 = await db.gestionSolicitud.findFirst({ where: { idsolicitud: nueva!.idsolicitud } });
    ctx.controlar("Gestión Aceptada del hotel B", g2?.idservicio === B.idservicio && g2?.resultado === "Aceptada", JSON.stringify(g2));
    const lista = await ctx.esperar("GET /solicitudes tras resolver → 200", "GET", "/solicitudes", undefined, ctx.admin, 200);
    ctx.controlar("Ninguna de las dos sigue pendiente", !(lista ?? []).some((s: any) => s.idreserva === idreserva), "sigue pendiente");
    await ctx.esperar("Opciones de una solicitud ya confirmada → 400", "GET", `/solicitudes/${nueva?.idsolicitud}/opciones`, undefined, ctx.admin, 400);
  });

  await ctx.escenario("Se rechazan todos los hoteles posibles", async () => {
    const { hotel: A, idsalida } = await armar({ tamano: 3, hotel: "solicitud" });
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida, { n: 1 });
    const sol = await db.solicitud.findFirstOrThrow({ where: { idreserva } });
    await ctx.esperar("Rechazar el único hotel → 200", "POST", `/solicitudes/${sol.idsolicitud}/resolver`, { servicioId: A!.idservicio, resolucion: "RECHAZADA", motivo: "Completo" }, ctx.admin, 200);
    const nueva = await db.solicitud.findFirstOrThrow({ where: { idreserva, nroSolicitud: `${sol.nroSolicitud}-R` } });
    await ctx.esperar("Sin hoteles que ofrecer → 400", "GET", `/solicitudes/${nueva.idsolicitud}/opciones`, undefined, ctx.admin, 400);
    igual("La -R sigue PENDIENTE y la reserva con alojamiento PENDIENTE", `${nueva.estado}/${(await res(idreserva)).estadoAlojamiento}`, "PENDIENTE/PENDIENTE");
    const lista = await ctx.esperar("GET /solicitudes → 200", "GET", "/solicitudes", undefined, ctx.admin, 200);
    ctx.controlar("La -R figura entre las pendientes (hay que gestionarla por fuera)", (lista ?? []).some((s: any) => s.idsolicitud === nueva.idsolicitud), "no figura");
  });

  await ctx.escenario("Aceptar la solicitud confirma el alojamiento", async () => {
    const { hotel, idsalida } = await armar({ tamano: 4, hotel: "solicitud" });
    const [c1, c2] = [await f.cliente(), await f.cliente()];
    const r1 = await f.comprar(c1.token, idsalida, { n: 1 });
    const r2 = await f.comprar(c2.token, idsalida, { n: 1 });
    const s1 = await db.solicitud.findFirstOrThrow({ where: { idreserva: r1.idreserva } });
    const ok = await ctx.esperar("Aceptar la primera → 200", "POST", `/solicitudes/${s1.idsolicitud}/resolver`, { servicioId: hotel!.idservicio, resolucion: "ACEPTADA" }, ctx.admin, 200);
    igual("Queda 1 pendiente en la salida", ok?.solicitudesPendientesRestantesEnSalida, 1);
    igual("Reserva 1: alojamiento CONFIRMADO", (await res(r1.idreserva)).estadoAlojamiento, "CONFIRMADO");
    igual("Reserva 2 sigue PENDIENTE", (await res(r2.idreserva)).estadoAlojamiento, "PENDIENTE");
    igual("Solicitud 1 CONFIRMADA", (await db.solicitud.findUniqueOrThrow({ where: { idsolicitud: s1.idsolicitud } })).estado, "CONFIRMADA");
    await ctx.esperar("Aceptarla de nuevo → 400", "POST", `/solicitudes/${s1.idsolicitud}/resolver`, { servicioId: hotel!.idservicio, resolucion: "ACEPTADA" }, ctx.admin, 400);
    igual("Doble aceptación: una sola gestión", await db.gestionSolicitud.count({ where: { idsolicitud: s1.idsolicitud } }), 1);
  });
}
