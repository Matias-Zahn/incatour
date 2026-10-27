/**
 * Módulo catalogoCuentas: temporadas, paquetes, circuitos, proveedores, personal, cuentas y control de acceso.
 * Cada escenario arma sus datos con fixtures; las temporadas propias (2029+) se dan de baja al final.
 */
import { Ctx, fecha } from "./contexto";

const texto = (b: unknown) => JSON.stringify(b ?? "").toLowerCase();

export async function catalogoCuentas(ctx: Ctx) {
  const { db, admin, f, esperar, controlar, preparar, escenario, idDe, unico } = ctx;

  const temporada = async (ini: string, fin: string) =>
    idDe(await preparar("Crear temporada", "POST", "/temporadas", { nombre: `Int T ${unico()}`, fechaInicio: ini, fechaFin: fin }), "idtemporada")!;
  const bajaTemporada = (id: number) => ctx.back.llamar("PATCH", `/temporadas/${id}/baja`, undefined, admin);
  const matriz = async () =>
    (await db.temporada.findMany({ where: { estado: "ACTIVO" } })).map((t) => ({ idtemporada: t.idtemporada, monto: 500, moneda: "USD" }));
  const estadoDe = async (modelo: "paquete" | "circuito" | "proveedor" | "servicioBase" | "temporada", where: any) => ((await (db as any)[modelo].findFirst({ where })) as any)?.estado;

  /** Circuito + paquete + hotel + salida PUBLICADA con una reserva confirmada de un cliente nuevo */
  async function conReserva() {
    const localidad = `Loc ${unico()}`;
    const hotel = await f.hotel(localidad);
    const idcircuito = await f.circuito();
    const pq = await f.paquete({ idcircuito, localidad });
    const idsalida = await f.salida(pq.idpaquete, fecha(400), 2, hotel.idservicio);
    const cli = await f.cliente();
    const { idreserva } = await f.comprar(cli.token, idsalida);
    return { ...pq, hotel, idsalida, cli, idreserva };
  }

  // ==================== Temporadas y tarifas ====================
  ctx.seccion("CU-06 a 09 Temporadas y tarifas");

  await escenario("Temporadas: alta y modificación que se superponen", async () => {
    const t1 = await temporada("2029-01-01", "2029-06-30");
    const t3 = await temporada("2030-01-01", "2030-06-30");
    const antes = await db.temporada.count();
    await esperar("Crear temporada superpuesta con otra activa → 400", "POST", "/temporadas", { nombre: `Int T ${unico()}`, fechaInicio: "2029-06-01", fechaFin: "2029-09-01" }, admin, 400);
    controlar("La temporada rechazada no se creó", (await db.temporada.count()) === antes);
    await esperar("Modificar fechas para pisar otra temporada → 400", "PUT", `/temporadas/${t3}`, { fechaInicio: "2029-05-01" }, admin, 400);
    const t = await db.temporada.findUnique({ where: { idtemporada: t3 } });
    controlar("Las fechas de la temporada no cambiaron", t?.fechaInicio.toISOString().startsWith("2030-01-01") === true, String(t?.fechaInicio));
    await bajaTemporada(t1);
    await bajaTemporada(t3);
  });

  await escenario("Temporadas: tarifas de un paquete activo", async () => {
    const t = await temporada("2031-01-01", "2031-06-30");
    const { idpaquete } = await f.paquete();
    controlar("El paquete quedó con tarifa en la temporada nueva", (await db.tarifaPaquete.count({ where: { idpaquete, idtemporada: t } })) === 1);
    await esperar("Baja de temporada con tarifas de un paquete activo → 400", "PATCH", `/temporadas/${t}/baja`, undefined, admin, 400);
    controlar("La temporada sigue ACTIVA", (await estadoDe("temporada", { idtemporada: t })) === "ACTIVO");

    const base = await matriz();
    await esperar("Segundo precio para la misma temporada y paquete (RF-14) → 400", "PUT", `/paquetes/${idpaquete}`, { matrizPrecios: [...base, { ...base[0], monto: 999 }] }, admin, 400);
    controlar("Sigue habiendo una sola tarifa por temporada", (await db.tarifaPaquete.count({ where: { idpaquete, idtemporada: base[0]!.idtemporada } })) === 1);
    await esperar("Tarifa con moneda distinta de USD (RES-16) → 400", "PUT", `/paquetes/${idpaquete}`, { matrizPrecios: base.map((p) => ({ ...p, moneda: "EUR" })) }, admin, 400);
    controlar("Ninguna tarifa quedó en EUR", (await db.tarifaPaquete.count({ where: { idpaquete, moneda: "EUR" } })) === 0);

    // CAT-19: con el paquete dado de baja, la temporada se puede dar de baja
    await preparar("Baja del paquete", "PATCH", `/paquetes/${idpaquete}/baja`);
    await esperar("Baja de temporada cuando el paquete ya está de baja → 200", "PATCH", `/temporadas/${t}/baja`, undefined, admin, 200);
  });

  // ==================== Paquetes ====================
  ctx.seccion("CU-11 a 13 Paquetes");

  await escenario("Paquete: modificar con una temporada inactiva no cambia nada (CAT-16)", async () => {
    const t = await temporada("2032-01-01", "2032-06-30");
    await bajaTemporada(t);
    const { idpaquete } = await f.paquete();
    const antes = await db.paquete.findUnique({ where: { idpaquete }, include: { tarifas: true } });
    await esperar("PUT paquete con nombre nuevo y temporada inactiva → 400", "PUT", `/paquetes/${idpaquete}`, { nombrePaquete: "Nombre nuevo CAT16", matrizPrecios: [{ idtemporada: t, monto: 600, moneda: "USD" }] }, admin, 400);
    const despues = await db.paquete.findUnique({ where: { idpaquete }, include: { tarifas: true } });
    controlar("El nombre del paquete NO cambió", despues?.nombrePaquete === antes?.nombrePaquete, `(quedó "${despues?.nombrePaquete}")`);
    controlar("Las tarifas no cambiaron", despues?.tarifas.length === antes?.tarifas.length);
  });

  await escenario("Paquete: circuito sin etapas o inactivo", async () => {
    const { idpaquete, idcircuito } = await f.paquete();
    const sinEtapas = await f.circuito({ etapas: 0 });
    await esperar("Cambiar a un circuito sin etapas (CAT-17) → 400", "PUT", `/paquetes/${idpaquete}`, { idcircuito: sinEtapas }, admin, 400);
    controlar("El paquete conserva su circuito", (await db.paquete.findUnique({ where: { idpaquete } }))?.idcircuito === idcircuito);

    const inactivo = await f.circuito();
    await preparar("Baja del circuito", "PATCH", `/circuitos/${inactivo}/baja`);
    const antes = await db.paquete.count();
    await esperar("Crear paquete con circuito inactivo → 404", "POST", "/paquetes", {
      idcircuito: inactivo, nombrePaquete: `Int ${unico()}`, tipoGarantia: "POR_CATEGORIA", localidadGarantizada: "X", categoriaGarantizada: "3 Estrellas",
      tipoHabitacionGarantizada: "Doble", matrizPrecios: await matriz(),
    }, admin, 404);
    controlar("No se creó el paquete", (await db.paquete.count()) === antes);
  });

  await escenario("Paquete: garantía por establecimiento exige bloqueo de plazas (RF-06)", async () => {
    const hotel = await f.hotel(`Loc ${unico()}`, 50, "A_SOLICITUD");
    const antes = await db.paquete.count();
    await esperar("POR_ESTABLECIMIENTO con hotel A_SOLICITUD → 400", "POST", "/paquetes", {
      idcircuito: await f.circuito(), nombrePaquete: `Int ${unico()}`, tipoGarantia: "POR_ESTABLECIMIENTO", idservicioGarantizado: hotel.idservicio, matrizPrecios: await matriz(),
    }, admin, 400);
    controlar("No se creó el paquete", (await db.paquete.count()) === antes);
  });

  await escenario("Paquete: baja con salidas activas", async () => {
    const { idpaquete, idsalida } = await conReserva();
    await esperar("Baja de paquete con salida activa → 400", "PATCH", `/paquetes/${idpaquete}/baja`, undefined, admin, 400);
    controlar("El paquete y la salida siguen activos", (await estadoDe("paquete", { idpaquete })) === "ACTIVO" && (await db.salida.findUnique({ where: { idsalida } }))?.estado === "PUBLICADA");
  });

  // ==================== Circuitos ====================
  ctx.seccion("CU-01 a 05 Circuitos y etapas");

  const etapa = (n: number) => ({ numeroOrden: n, puntoInicio: `P${n - 1}`, puntoFin: `P${n}`, campamentoPrevisto: `Camp ${n}` });

  await escenario("Etapas de un circuito con paquete y salida activos", async () => {
    const { idcircuito } = await conReserva();
    await esperar("Reemplazar etapas con paquete y salida activos → 400", "PUT", `/circuitos/${idcircuito}/etapas`, { etapas: [etapa(1), etapa(2), etapa(3)] }, admin, 400);
    controlar("Las etapas del circuito siguen siendo 2", (await db.etapaRuta.count({ where: { idcircuito } })) === 2);
  });

  // CAT-28: el chequeo mira solo paquetes activos y avances; una salida PUBLICADA sin avances no frena el reemplazo
  await escenario("Reemplazar etapas de un circuito con salidas programadas", async () => {
    const { idcircuito, idpaquete } = await conReserva();
    await db.paquete.update({ where: { idpaquete }, data: { estado: "INACTIVO" } });
    await esperar("Reemplazar etapas de un circuito con salidas programadas", "PUT", `/circuitos/${idcircuito}/etapas`, { etapas: [etapa(1), etapa(2), etapa(3)] }, admin, 400);
  });

  await escenario("Reemplazar etapas con avances registrados (CAT-18)", async () => {
    const { idcircuito, idpaquete, idsalida } = await conReserva();
    await db.avance.create({ data: { idsalida, idcircuito, numeroOrden: 1, estadoTramo: "EN_CURSO" } });
    // Sin paquete activo, la única barrera que queda son los avances
    await db.paquete.update({ where: { idpaquete }, data: { estado: "INACTIVO" } });
    const r = await esperar("Reemplazar etapas con avances registrados → 400", "PUT", `/circuitos/${idcircuito}/etapas`, { etapas: [etapa(1), etapa(2), etapa(3)] }, admin, 400);
    controlar("El mensaje explica que hay avances registrados", texto(r).includes("avance"), texto(r));
    controlar("Las etapas del circuito siguen siendo 2", (await db.etapaRuta.count({ where: { idcircuito } })) === 2);
  });

  await escenario("Etapas con hueco o número repetido (RF-05)", async () => {
    const idcircuito = await f.circuito();
    await esperar("Etapas 1 y 3 (hueco) → 400", "PUT", `/circuitos/${idcircuito}/etapas`, { etapas: [etapa(1), { ...etapa(3), puntoInicio: "P1" }] }, admin, 400);
    await esperar("Etapas con número repetido → 400", "PUT", `/circuitos/${idcircuito}/etapas`, { etapas: [etapa(1), etapa(1)] }, admin, 400);
    await esperar("Etapas con discontinuidad espacial → 400", "PUT", `/circuitos/${idcircuito}/etapas`, { etapas: [etapa(1), { ...etapa(2), puntoInicio: "OTRO" }] }, admin, 400);
    const guardadas = await db.etapaRuta.findMany({ where: { idcircuito }, orderBy: { numeroOrden: "asc" } });
    controlar("Las etapas originales quedaron intactas", guardadas.length === 2 && guardadas[1]!.puntoFin === "P2");
  });

  await escenario("Circuito con paquetes activos: duración, guías y baja (RF-03)", async () => {
    const { idcircuito } = await f.paquete();
    const antes = await db.circuito.findUnique({ where: { idcircuito } });
    await esperar("Cambiar duracionDias con paquetes activos → 400", "PUT", `/circuitos/${idcircuito}`, { duracionDias: 9 }, admin, 400);
    await esperar("Cambiar minimoGuias con paquetes activos → 400", "PUT", `/circuitos/${idcircuito}`, { minimoGuias: 3 }, admin, 400);
    const despues = await db.circuito.findUnique({ where: { idcircuito } });
    controlar("Duración y guías sin cambios", despues?.duracionDias === antes?.duracionDias && despues?.minimoGuias === antes?.minimoGuias);
    await esperar("Cambiar solo la dificultad sí se permite → 200", "PUT", `/circuitos/${idcircuito}`, { dificultad: "Difícil" }, admin, 200);
    await esperar("Baja de circuito con paquetes activos → 400", "PATCH", `/circuitos/${idcircuito}/baja`, undefined, admin, 400);
    controlar("El circuito sigue ACTIVO", (await estadoDe("circuito", { idcircuito })) === "ACTIVO");
  });

  // ==================== Proveedores y servicios ====================
  ctx.seccion("CU-14 a 21 Proveedores y servicios");

  await escenario("Baja de proveedor con hotel garantizado o servicio incluido en un paquete activo (CAT-26)", async () => {
    const hotel = await f.hotel(`Loc ${unico()}`);
    await preparar("Paquete con hotel garantizado", "POST", "/paquetes", {
      idcircuito: await f.circuito(), nombrePaquete: `Int ${unico()}`, tipoGarantia: "POR_ESTABLECIMIENTO", idservicioGarantizado: hotel.idservicio, matrizPrecios: await matriz(),
    });
    await esperar("Baja de proveedor con hotel garantizado → 400", "PATCH", `/proveedores/${hotel.idproveedor}/baja`, undefined, admin, 400);
    controlar("Proveedor y servicio siguen ACTIVOS", (await estadoDe("proveedor", { idproveedor: hotel.idproveedor })) === "ACTIVO" && (await estadoDe("servicioBase", { idservicio: hotel.idservicio })) === "ACTIVO");

    const trans = await f.transporte(`Loc ${unico()}`);
    await f.paquete({ serviciosIncluidos: [trans.idservicio] });
    await esperar("Baja de proveedor con servicio incluido en un paquete activo → 400", "PATCH", `/proveedores/${trans.idproveedor}/baja`, undefined, admin, 400);
    controlar("Proveedor y servicio incluido siguen ACTIVOS", (await estadoDe("proveedor", { idproveedor: trans.idproveedor })) === "ACTIVO" && (await estadoDe("servicioBase", { idservicio: trans.idservicio })) === "ACTIVO");
    await esperar("Baja del servicio incluido en paquete activo (CAT-09) → 400", "PATCH", `/servicios/${trans.idservicio}/baja`, undefined, admin, 400);
    controlar("El servicio incluido sigue ACTIVO", (await estadoDe("servicioBase", { idservicio: trans.idservicio })) === "ACTIVO");
  });

  await escenario("Baja de proveedor con servicios asignados a una salida activa", async () => {
    const { hotel, idsalida } = await conReserva();
    controlar("La salida quedó con el hotel asignado", (await db.salidaServicio.count({ where: { idsalida, idservicio: hotel.idservicio } })) === 1);
    await esperar("Baja de proveedor con servicio en salida activa → 400", "PATCH", `/proveedores/${hotel.idproveedor}/baja`, undefined, admin, 400);
    controlar("El proveedor sigue ACTIVO", (await estadoDe("proveedor", { idproveedor: hotel.idproveedor })) === "ACTIVO");
    await esperar("Baja del servicio asignado a salida activa → 400", "PATCH", `/servicios/${hotel.idservicio}/baja`, undefined, admin, 400);
  });

  await escenario("Reactivar un proveedor duplicado (CAT-27)", async () => {
    const datos = { tipoProveedor: "TRANSPORTE", razonSocial: `Int Dup ${unico()}`, localidad: `Loc ${unico()}`, datosContacto: "d@test.com", canalComunicacion: "Email" };
    const a = idDe(await preparar("Alta proveedor A", "POST", "/proveedores", datos), "idproveedor")!;
    await preparar("Baja proveedor A", "PATCH", `/proveedores/${a}/baja`);
    await preparar("Alta proveedor B (misma razón social y localidad)", "POST", "/proveedores", datos);
    await esperar("Reactivar A con B activo → 409", "PUT", `/proveedores/${a}`, { estado: "ACTIVO" }, admin, 409);
    controlar("A sigue INACTIVO", (await estadoDe("proveedor", { idproveedor: a })) === "INACTIVO");
    await esperar("Alta de un tercer proveedor duplicado → 409", "POST", "/proveedores", datos, admin, 409);
  });

  // ==================== Personal y cuentas ====================
  ctx.seccion("CU-22 a 25, 44 a 46 y CTA Personal y cuentas");

  await escenario("Baja de un guía asignado a una salida activa", async () => {
    const c = await conReserva();
    const guia = await f.guia();
    const porteador = await f.porteador();
    const transporte = await f.transporte(c.localidad);
    await preparar("Asignar guía, porteador y transporte", "POST", `/salidas/${c.idsalida}/asignacion`, { personalIds: [guia.idpersonal, porteador], idtransporte: transporte.idservicio, itemsCamping: [] });
    await esperar("Baja de guía asignado a salida activa → 400", "PATCH", `/personal/${guia.idpersonal}/baja`, undefined, admin, 400);
    controlar("El guía sigue ACTIVO", (await db.personal.findUnique({ where: { idpersonal: guia.idpersonal } }))?.estado === "ACTIVO");
    await esperar("Baja de la cuenta del guía asignado → 400", "PATCH", `/cuentas-guia/${guia.idusuario}/baja`, undefined, admin, 400);
    controlar("La cuenta del guía sigue ACTIVA", (await db.usuario.findUnique({ where: { idusuario: guia.idusuario! } }))?.estado === "ACTIVO");
    await esperar("Baja del porteador asignado → 400", "PATCH", `/personal/${porteador}/baja`, undefined, admin, 400);
  });

  await escenario("Cuenta de guía con habilitación vencida (CTA-07)", async () => {
    const u = unico();
    const body = (extra = {}) => ({ nombre: "Guia", apellido: "Vencida", nroPasaporte: `GS${u}`, nacionalidad: "Peruana", fechaVencimientoPasaporte: "2035-01-01", rolOperativo: "Guía", nroHabilitacion: `HAB-${u}`, fechaHabilitacion: "2034-12-31", ...extra });
    await esperar("Alta de guía con habilitación vencida → 400", "POST", "/personal", body({ fechaHabilitacion: "2020-01-01", nroPasaporte: `GV${u}` }), admin, 400);
    controlar("No quedó el legajo del guía vencido", (await db.personal.count({ where: { nroPasaporte: `GV${u}` } })) === 0);
    const g = await preparar("Alta de guía sin cuenta", "POST", "/personal", body());
    const idpersonal = idDe(g, "idpersonal")!;
    await esperar("Alta de cuenta con habilitación vencida → 400", "POST", "/cuentas-guia",
      { idpersonal, email: `gs.${u.toLowerCase()}@integral.com`, contrasenia: "guiaInt123", nroHabilitacion: `HAB-${u}`, fechaHabilitacion: "2020-01-01" }, admin, 400);
    const guia = await db.guia.findUnique({ where: { idpersonal } });
    controlar("El guía sigue sin cuenta", guia?.idusuario === null);
    controlar("No se creó el usuario", (await db.usuario.count({ where: { email: `gs.${u.toLowerCase()}@integral.com` } })) === 0);
  });

  await escenario("Duplicados de email de cliente y pasaporte de personal", async () => {
    const cli = await f.cliente();
    const antes = await db.usuario.count();
    await esperar("Registrar cliente con email repetido → 409", "POST", "/clientes", { email: cli.email, contrasenia: "clienteInt123", nombre: "Otro", apellido: "Cliente" }, "", 409);
    controlar("No se creó otro usuario", (await db.usuario.count()) === antes);
    const g = await f.guia();
    const pas = (await db.personal.findUnique({ where: { idpersonal: g.idpersonal } }))!.nroPasaporte;
    await esperar("Personal con pasaporte repetido → 409", "POST", "/personal", { nombre: "Otro", apellido: "Porteador", nroPasaporte: pas, nacionalidad: "Peruana", fechaVencimientoPasaporte: "2035-01-01", rolOperativo: "Porteador" }, admin, 409);
    controlar("Sigue habiendo un solo personal con ese pasaporte", (await db.personal.count({ where: { nroPasaporte: pas } })) === 1);
  });

  await escenario("Baja de cliente: con reserva activa y sin reservas", async () => {
    const c = await conReserva();
    await esperar("Baja de cliente con reserva activa → 400", "PATCH", `/clientes/${c.cli.idcliente}/baja`, undefined, admin, 400);
    controlar("El cliente sigue ACTIVO", (await db.cliente.findUnique({ where: { idcliente: c.cli.idcliente } }))?.estado === "ACTIVO");
    controlar("La reserva sigue CONFIRMADA", (await db.reserva.findUnique({ where: { idreserva: c.idreserva } }))?.estado === "CONFIRMADA");

    const libre = await f.cliente();
    await esperar("Baja de cliente sin reservas → 200", "PATCH", `/clientes/${libre.idcliente}/baja`, undefined, libre.token, 200);
    const cli = await db.cliente.findUnique({ where: { idcliente: libre.idcliente }, include: { usuario: true } });
    controlar("Cliente y usuario quedaron INACTIVOS", cli?.estado === "INACTIVO" && cli.usuario.estado === "INACTIVO");
    await esperar("Cliente dado de baja no puede loguearse → 401", "POST", "/auth/login", { email: libre.email, contrasenia: "clienteInt123" }, "", 401);
    await esperar("El token anterior del cliente dado de baja deja de valer → 401", "GET", "/clientes/mi-perfil", undefined, libre.token, 401);
    await esperar("Dar de baja dos veces al mismo cliente → 400", "PATCH", `/clientes/${libre.idcliente}/baja`, undefined, admin, 400);
  });

  // ==================== Roles y acceso ====================
  ctx.seccion("Roles y acceso");

  await escenario("Rutas de admin sin token y con otro rol", async () => {
    const cli = await f.cliente();
    const guia = await f.guia();
    await esperar("Sin token a /proveedores → 401", "GET", "/proveedores", undefined, "", 401);
    await esperar("Sin token a POST /temporadas → 401", "POST", "/temporadas", { nombre: "X", fechaInicio: "2040-01-01", fechaFin: "2040-02-01" }, "", 401);
    await esperar("Token basura → 401", "GET", "/proveedores", undefined, "no.es.un.jwt", 401);
    await esperar("Cliente en GET /proveedores → 403", "GET", "/proveedores", undefined, cli.token, 403);
    await esperar("Cliente en POST /circuitos → 403", "POST", "/circuitos", {}, cli.token, 403);
    await esperar("Cliente en GET /personal → 403", "GET", "/personal", undefined, cli.token, 403);
    await esperar("Guía en GET /proveedores → 403", "GET", "/proveedores", undefined, guia.token, 403);
    await esperar("Guía en POST /temporadas → 403", "POST", "/temporadas", { nombre: "X", fechaInicio: "2040-01-01", fechaFin: "2040-02-01" }, guia.token, 403);
    await esperar("Guía en GET /clientes → 403", "GET", "/clientes", undefined, guia.token, 403);
  });

  await escenario("Un cliente no ve datos de otro cliente", async () => {
    const c = await conReserva();
    const otro = await f.cliente();
    await esperar("Cliente pide la reserva de otro → 403", "GET", `/reservas/${c.idreserva}`, undefined, otro.token, 403);
    await esperar("Cliente pide el comprobante de otro → 403", "GET", `/reservas/${c.idreserva}/comprobante`, undefined, otro.token, 403);
    await esperar("Cliente pide GET /clientes/{id} de otro → 403", "GET", `/clientes/${c.cli.idcliente}`, undefined, otro.token, 403);
    await esperar("Cliente modifica a otro → 403", "PUT", `/clientes/${c.cli.idcliente}`, { nombre: "Hack" }, otro.token, 403);
    await esperar("Cliente da de baja a otro → 403", "PATCH", `/clientes/${c.cli.idcliente}/baja`, undefined, otro.token, 403);
    controlar("El cliente ajeno sigue ACTIVO", (await db.cliente.findUnique({ where: { idcliente: c.cli.idcliente } }))?.estado === "ACTIVO");
    await esperar("El dueño sí ve su reserva → 200", "GET", `/reservas/${c.idreserva}`, undefined, c.cli.token, 200);
    await esperar("El admin ve cualquier reserva → 200", "GET", `/reservas/${c.idreserva}`, undefined, admin, 200);
  });

  await escenario("Ids inválidos en la URL y login incorrecto", async () => {
    await esperar("GET /paquetes/5abc → 400", "GET", "/paquetes/5abc", undefined, admin, 400);
    await esperar("GET /circuitos/-1/etapas → 400", "GET", "/circuitos/-1/etapas", undefined, admin, 400);
    await esperar("PATCH /temporadas/1.5/baja → 400", "PATCH", "/temporadas/1.5/baja", undefined, admin, 400);
    await esperar("GET /proveedores/99999999999 → 400", "GET", "/proveedores/99999999999", undefined, admin, 400);
    await esperar("GET /paquetes/999999 (no existe) → 404", "GET", "/paquetes/999999", undefined, admin, 404);
    const cli = await f.cliente();
    await esperar("Login con contraseña incorrecta → 401", "POST", "/auth/login", { email: cli.email, contrasenia: "incorrecta123" }, "", 401);
    await esperar("Login con email inexistente → 401", "POST", "/auth/login", { email: "nadie@integral.com", contrasenia: "clienteInt123" }, "", 401);
    await esperar("Login sin contraseña → 400", "POST", "/auth/login", { email: cli.email }, "", 400);
  });
}
