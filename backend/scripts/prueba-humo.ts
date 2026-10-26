/**
 * Prueba de humo: recorre la API real contra una base aparte (incatour_humo) para encontrar
 * lo que los tests unitarios no ven porque mockean el repositorio (campos que Prisma rechaza,
 * relaciones mal armadas, 500 inesperados).
 *
 * A. Todos los GET del openapi.json con ids del seed: ninguno puede responder 5xx.
 * B. Cada escritura con cuerpo vacío: tiene que responder 4xx, nunca 5xx.
 * C. Un recorrido de negocio completo con datos válidos: cada paso tiene que responder 2xx.
 * D. La autoridad simulada con pedidos en paralelo: el lock del bloqueo tiene que serializarlos.
 *
 * Resetea incatour_humo con las migraciones y el seed, y levanta el back en el puerto 3999.
 * La base de desarrollo no se toca. Uso, desde backend, con Docker levantado: npm run test:humo
 */
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { Back, crearEntorno, idDe, resumen } from "./lib-prueba";

// HUMO_DB y HUMO_PUERTO permiten correr varias pruebas a la vez (una por worktree)
const HUMO_DB = process.env.HUMO_DB ?? "incatour_humo";
const PUERTO = Number(process.env.HUMO_PUERTO ?? 3999);
const entorno = crearEntorno(HUMO_DB);
const DB_URL = entorno.DB_URL;

const fallas: string[] = [];
const avisos: string[] = [];
const omitidos: string[] = [];
const token = { admin: "", cliente: "", guia: "" };
let back: Back;

const llamar = (metodo: string, ruta: string, body?: unknown, tok = token.admin) => back.llamar(metodo, ruta, body, tok);
const login = (email: string, contrasenia: string) => back.login(email, contrasenia);

// Paso del recorrido: tiene que dar 2xx. Devuelve data para encadenar ids.
async function paso(nombre: string, metodo: string, ruta: string, body?: unknown, tok?: string): Promise<any> {
  if (/undefined|null/.test(ruta) || (body && JSON.stringify(body).includes(":null"))) {
    omitidos.push(nombre);
    console.log(`- omitido ${nombre} (falló un paso anterior)`);
    return undefined;
  }
  const r = await llamar(metodo, ruta, body, tok);
  const ok = r.status >= 200 && r.status < 300;
  console.log(`${ok ? "✓" : "✗"} ${r.status} ${nombre}`);
  if (!ok) fallas.push(`C ${nombre} → ${metodo} ${ruta} → ${r.status} ${resumen(r.body)}${r.error}`);
  return ok ? r.body?.data ?? r.body : undefined;
}

function tokenPara(ruta: string) {
  if (ruta.startsWith("/guia")) return token.guia;
  if (/^\/reservas\/(mis-reservas|\{idreserva\})|^\/resenias\/historial/.test(ruta)) return token.cliente;
  if (/^\/clientes\/\{id\}$/.test(ruta)) return token.cliente;
  return token.admin;
}

async function faseA_B() {
  const openapi = JSON.parse(fs.readFileSync("docs/openapi.json", "utf-8"));
  const ids: Record<string, number> = { idsalida: 1, id: 1, idreserva: 1, idproveedor: 1, idpersonal: 2, idcircuito: 1, idusuario: 3 };
  for (const [plantilla, metodos] of Object.entries<any>(openapi.paths)) {
    const relativa = plantilla.replace(/^\/api/, "");
    const ruta = relativa.replace(/\{(\w+)\}/g, (_, k) => String(ids[k] ?? 1));
    for (const metodo of Object.keys(metodos)) {
      if (metodo === "get") {
        const r = await llamar("GET", ruta + (ruta.endsWith("/disponibles") ? "?tipo=EQUIPAMIENTO" : ""), undefined, tokenPara(relativa));
        if (r.status >= 500) fallas.push(`A GET ${ruta} → ${r.status} ${resumen(r.body)}${r.error}`);
        else if (r.status >= 400) avisos.push(`A GET ${ruta} → ${r.status} ${resumen(r.body)}`);
        continue;
      }
      // Sin cuerpo obligatorio ejecutarían la acción sobre el seed: van en el recorrido
      if (/\/baja$|\/reservas\/\{idreserva\}\/cancelar$|\/imagen$/.test(plantilla)) continue;
      const r = await llamar(metodo.toUpperCase(), ruta, {}, tokenPara(relativa));
      if (r.status >= 500) fallas.push(`B ${metodo.toUpperCase()} ${ruta} con {} → ${r.status} ${resumen(r.body)}${r.error}`);
      else if (r.status < 400) avisos.push(`B ${metodo.toUpperCase()} ${ruta} con {} → ${r.status}: aceptó un cuerpo vacío`);
    }
  }
  console.log(`Fases A y B: ${Object.keys(openapi.paths).length} rutas recorridas\n`);
}

async function faseC() {
  const t = Date.now().toString(36).toUpperCase();

  // Catálogo
  const circuito = await paso("Crear circuito (CU-02)", "POST", "/circuitos", { nombreCircuito: `Humo ${t}`, duracionDias: 3, dificultad: "Moderada", minimoGuias: 1, parametrosPorteadores: "1 por cada 2 pasajeros" });
  const idcircuito = idDe(circuito, "idcircuito");
  await paso("Modificar circuito (CU-03)", "PUT", `/circuitos/${idcircuito}`, { dificultad: "Alta" });
  await paso("Definir etapas (CU-05)", "PUT", `/circuitos/${idcircuito}/etapas`, {
    etapas: [
      { numeroOrden: 1, puntoInicio: "Km 82", puntoFin: "Wayllabamba", campamentoPrevisto: "Camp 1" },
      { numeroOrden: 2, puntoInicio: "Wayllabamba", puntoFin: "Pacaymayo", campamentoPrevisto: "Camp 2" },
    ],
  });
  const temporada = await paso("Crear temporada (CU-07)", "POST", "/temporadas", { nombre: `Humo ${t}`, fechaInicio: "2027-06-01", fechaFin: "2027-06-30" });
  await paso("Modificar temporada (CU-08)", "PUT", `/temporadas/${idDe(temporada, "idtemporada")}`, { nombre: `Humo ${t} bis` });
  const paquete = await paso("Crear paquete (CU-11)", "POST", "/paquetes", {
    idcircuito, nombrePaquete: `Humo ${t}`, condiciones: "Prueba", tipoGarantia: "POR_CATEGORIA",
    localidadGarantizada: "Cusco", categoriaGarantizada: "3 Estrellas", tipoHabitacionGarantizada: "Doble",
    nochesPrevias: 0, nochesPosteriores: 0, matrizPrecios: [{ idtemporada: idDe(temporada, "idtemporada"), monto: 700, moneda: "USD" }],
  });
  await paso("Modificar paquete (CU-12)", "PUT", `/paquetes/${idDe(paquete, "idpaquete")}`, { condiciones: "Prueba de humo" });

  // Proveedores y servicios
  const proveedor = await paso("Alta proveedor (CU-15)", "POST", "/proveedores", { tipoProveedor: "EQUIPAMIENTO", razonSocial: `Humo ${t}`, localidad: "Cusco", datosContacto: "humo@test.com", canalComunicacion: "Email" });
  const idproveedor = idDe(proveedor, "idproveedor");
  await paso("Modificar proveedor (CU-16)", "PUT", `/proveedores/${idproveedor}`, { localidad: "Ollantaytambo" });
  const servicio = await paso("Registrar servicio (CU-19)", "POST", `/proveedores/${idproveedor}/servicios`, { tipo: "EQUIPAMIENTO", nombreServicio: `Carpa ${t}`, localidad: "Cusco", costoBase: 20, tipoEquipamiento: "Carpa", cantidadDisponible: 10 });
  await paso("Modificar servicio (CU-20)", "PUT", `/servicios/${idDe(servicio, "idservicio")}`, { costoBase: 25 });
  await paso("Baja servicio (CU-21)", "PATCH", `/servicios/${idDe(servicio, "idservicio")}/baja`);
  await paso("Baja proveedor (CU-17)", "PATCH", `/proveedores/${idproveedor}/baja`);

  // Personal y cuentas
  const porteador = await paso("Registrar porteador (CU-23)", "POST", "/personal", { nombre: "Hugo", apellido: "Humo", nroPasaporte: `PH${t}`, nacionalidad: "Peruana", fechaVencimientoPasaporte: "2032-01-01", rolOperativo: "Porteador" });
  const emailGuia = `guia.${t.toLowerCase()}@humo.com`;
  const guia = await paso("Registrar guía con cuenta (CU-23/45)", "POST", "/personal", {
    nombre: "Gabriela", apellido: "Humo", nroPasaporte: `GH${t}`, nacionalidad: "Peruana", fechaVencimientoPasaporte: "2032-01-01",
    rolOperativo: "Guía", email: emailGuia, contrasenia: "guiaHumo123", nroHabilitacion: `HAB-${t}`, fechaHabilitacion: "2031-12-31",
  });
  await paso("Modificar personal (CU-24)", "PUT", `/personal/${idDe(porteador, "idpersonal")}`, { nacionalidad: "Boliviana" });
  await paso("Consultar cuentas de guía (CU-44)", "GET", "/cuentas-guia");

  // Cliente
  const emailCliente = `cliente.${t.toLowerCase()}@humo.com`;
  const cliente = await paso("Registrarse como cliente (CU-27)", "POST", "/clientes", { email: emailCliente, contrasenia: "clienteHumo123", nombre: "Carla", apellido: "Humo" }, "");
  const tokCliente = await login(emailCliente, "clienteHumo123");
  await paso("Modificar cliente (CU-28)", "PUT", `/clientes/${idDe(cliente, "idcliente")}`, { nombre: "Carla María" }, tokCliente);

  // Salida y compra
  const opcSalida = await paso("Opciones de salida (CU-36)", "GET", `/salidas/opciones?idpaquete=${idDe(paquete, "idpaquete")}&fechaInicio=2027-06-10&tamanoMaximo=8`);
  const idalojamiento = opcSalida?.alojamientos?.find((a: any) => a.alcanza)?.idservicio;
  const nuevaSalida = (fechaInicio: string, tamanoMaximo: number) =>
    ({ idpaquete: idDe(paquete, "idpaquete"), fechaInicio, tamanoMaximo, ...(idalojamiento && { idalojamiento }) });
  const salida = await paso("Crear salida (CU-36)", "POST", "/salidas", nuevaSalida("2027-06-10", 8));
  const idsalida = idDe(salida, "idsalida");
  const compra = (n: number, sal: number | null | undefined = idsalida) => ({
    idsalida: sal, medioPago: "TARJETA",
    pasajeros: [{ nombreCompleto: `Pasajero ${n} Humo`, nroPasaporte: `PP${n}${t}`, nacionalidad: "Argentina", fechaVencimientoPasaporte: "2031-01-01" }],
    equipaje: [{ pesoDeclarado: 8 }],
    tarjeta: { numero: "4242424242424242", titular: "Carla Humo", vencimiento: "12/30", cvv: "123" },
  });
  const reserva = await paso("Comprar paquete (CU-30)", "POST", "/reservas", compra(1), tokCliente);
  const reserva2 = await paso("Comprar otra reserva (CU-30)", "POST", "/reservas", compra(2), tokCliente);
  const idreserva = idDe(reserva, "idreserva") ?? reserva?.idDe(reserva, "idreserva");
  const idreserva2 = idDe(reserva2, "idreserva") ?? reserva2?.idDe(reserva, "idreserva");
  // CU-35: filtro por circuito y conteo de pasajeros (dos compras de 1 pasajero)
  const listado = await paso("Consultar salidas por circuito (CU-35)", "GET", `/salidas?idcircuito=${idcircuito}`);
  const fila = listado?.find((s: any) => s.idsalida === idDe(salida, "idsalida"));
  if (listado && fila?.pasajerosConfirmados !== 2) fallas.push(`C CU-35: se esperaban 2 pasajeros confirmados y llegó ${fila?.pasajerosConfirmados}`);
  await paso("Mis reservas (CU-31)", "GET", "/reservas/mis-reservas", undefined, tokCliente);
  await paso("Detalle de reserva (CU-31)", "GET", `/reservas/${idreserva}`, undefined, tokCliente);
  await paso("Comprobante (CU-31)", "GET", `/reservas/${idreserva}/comprobante`, undefined, tokCliente);
  await paso("Liquidación de cancelación (CU-32)", "GET", `/reservas/${idreserva2}/cancelacion`, undefined, tokCliente);
  await paso("Cancelar reserva (CU-32)", "POST", `/reservas/${idreserva2}/cancelar`, { motivo: "Prueba de humo" }, tokCliente);

  // Solicitudes de alojamiento que haya generado la compra
  const pendientes: any[] = (await paso("Solicitudes pendientes (CU-33)", "GET", "/solicitudes")) ?? [];
  // Si la compra no generó una, se usa la del seed (SOL-0001)
  const solicitud = pendientes.find((s) => idDe(s, "idreserva") === idreserva) ?? pendientes[0];
  if (solicitud) {
    const opciones = await paso("Opciones de alojamiento (CU-34)", "GET", `/solicitudes/${solicitud.idsolicitud}/opciones`);
    const [primera, segunda] = opciones?.opcionesContacto ?? [];
    await paso("Rechazar solicitud (CU-34)", "POST", `/solicitudes/${solicitud.idsolicitud}/resolver`, { servicioId: primera?.servicioId, resolucion: "RECHAZADA", motivo: "Sin plazas" });
    const reintento = ((await paso("Solicitudes tras el rechazo", "GET", "/solicitudes")) ?? []).find((s: any) => s.nroSolicitud === `${solicitud.nroSolicitud}-R`);
    const op2 = await paso("Opciones del reintento (CU-34)", "GET", `/solicitudes/${reintento?.idsolicitud}/opciones`);
    if (op2?.opcionesContacto?.some((o: any) => o.servicioId === primera?.servicioId)) fallas.push("C El reintento vuelve a ofrecer el hotel rechazado");
    if (segunda) await paso("Aceptar solicitud (CU-34)", "POST", `/solicitudes/${reintento?.idsolicitud}/resolver`, { servicioId: segunda.servicioId, resolucion: "ACEPTADA" });
  } else avisos.push("C No hay solicitudes pendientes: no se probó el CU-34");

  // Asignación (CU-40)
  const asig = await paso("Opciones de asignación (CU-40)", "GET", `/salidas/${idsalida}/asignacion`);
  if (asig) console.log("    opciones de asignación:", JSON.stringify(asig).slice(0, 300));
  const disponibles: any[] = asig?.personalDisponible ?? asig?.personal ?? [];
  const elegidos = [idDe(guia, "idpersonal"), ...disponibles.filter((p) => p.rol === "Porteador").map((p) => p.idpersonal).slice(0, 2)].filter(Boolean);
  const transporte = (asig?.transportes ?? asig?.transportesDisponibles ?? [])[0];
  await paso("Asignar recursos (CU-40)", "POST", `/salidas/${idsalida}/asignacion`, { personalIds: elegidos, idtransporte: transporte?.idservicio ?? null, itemsCamping: [] });

  // Logística (CU-39) y reemplazo (CU-38)
  await paso("Consultar logística (CU-39)", "GET", `/salidas/${idsalida}/logistica`);
  const equipos = await paso("Equipamiento disponible (CU-39)", "GET", `/salidas/${idsalida}/logistica/disponibles?tipo=EQUIPAMIENTO`);
  const equipo = (Array.isArray(equipos) ? equipos : equipos?.disponibles ?? [])[0];
  await paso("Agregar equipamiento (CU-39)", "PUT", `/salidas/${idsalida}/logistica`, { itemsDesasignar: [], itemsNuevos: [{ tipo: "EQUIPAMIENTO", idservicio: equipo?.idservicio ?? null, cantidad: 1 }], motivo: "Prueba de humo" });
  const personal = await paso("Personal de la salida (CU-38)", "GET", `/salidas/${idsalida}/personal`);
  const porteadorSalida = (personal?.personal ?? []).find((p: any) => p.rol === "Porteador");
  const reemplazantes: any[] = (await paso("Reemplazantes (CU-38)", "GET", `/salidas/${idsalida}/personal/${porteadorSalida?.idpersonal}/reemplazantes`)) ?? [];
  if (reemplazantes[0]) await paso("Reemplazar personal (CU-38)", "POST", `/salidas/${idsalida}/reemplazos`, { idoriginal: porteadorSalida.idpersonal, idreemplazante: reemplazantes[0].idpersonal, motivo: "Prueba de humo" });
  else if (porteadorSalida) avisos.push("C Sin reemplazantes disponibles: no se probó el reemplazo");

  // Portal del guía (CU-48 a 50): los avances de todas las etapas finalizan la salida.
  // Una salida nueva empieza en el futuro y los avances no pueden ser futuros: se corre a "empezó ayer"
  const dia = 24 * 3600 * 1000;
  const hace = (ms: number) => new Date(Date.now() - ms).toISOString();
  if (idsalida) {
    const db = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    await db.salida.update({ where: { idsalida }, data: { fechaInicio: new Date(Date.now() - dia), fechaFin: new Date(Date.now() + dia) } });
    await db.$disconnect();
  }
  const tokGuia = guia ? await login(emailGuia, "guiaHumo123") : "";
  await paso("Salidas del guía (CU-48)", "GET", "/guia/salidas", undefined, tokGuia);
  await paso("Detalle para el guía (CU-48)", "GET", `/guia/salidas/${idsalida}`, undefined, tokGuia);
  const pasajeros: any[] = (await paso("Pasajeros (CU-50)", "GET", `/guia/salidas/${idsalida}/pasajeros`, undefined, tokGuia)) ?? [];
  await paso("Notificar incidente (CU-50)", "POST", `/guia/salidas/${idsalida}/incidentes`, {
    tipoIncidente: "SALUD", descripcion: "Malestar leve por la altura", nivelGravedad: "BAJO",
    fechaHoraOcurrencia: hace(3 * 3600 * 1000), pasajerosAfectados: pasajeros.slice(0, 1).map((p) => p.idpasajero),
  }, tokGuia);
  for (const numeroOrden of [1, 2]) {
    await paso(`Registrar avance ${numeroOrden} (CU-49)`, "POST", `/guia/salidas/${idsalida}/avances`, { numeroOrden, estadoTramo: "COMPLETADO", fechaHoraLlegada: hace((3 - numeroOrden) * 3600 * 1000) }, tokGuia);
  }
  await paso("Incidentes para el admin", "GET", "/incidentes");

  // Cierre: devolución, evaluaciones y reseña sobre la salida finalizada
  const asignado = await paso("Equipamiento asignado (CU-41)", "GET", `/salidas/${idsalida}/equipamiento-asignado`);
  const items = (asignado?.equipamientos ?? []).map((i: any) => ({ idservicio: i.idservicio, cantidadBuenEstado: i.cantidad ?? i.cantidadAsignada ?? 1, cantidadDaniada: 0 }));
  if (items.length) await paso("Devolver equipamiento (CU-41)", "POST", `/salidas/${idsalida}/devolucion-equipamiento`, { items });
  const evaluables = await paso("Evaluables (CU-42)", "GET", `/salidas/${idsalida}/evaluaciones`);
  const aEvaluar = (evaluables?.personal ?? [])[0];
  if (aEvaluar) await paso("Evaluar personal (CU-42)", "POST", `/salidas/${idsalida}/evaluaciones`, { tipo: "PERSONAL", id: aEvaluar.idpersonal, puntaje: 5, comentario: "Excelente" });
  await paso("Historial para reseñar (CU-47)", "GET", "/resenias/historial-reservas", undefined, tokCliente);
  await paso("Publicar reseña (CU-47)", "POST", "/resenias", { idsalida: idsalida ?? null, valoracion: 5, comentario: "Muy linda experiencia" }, tokCliente);
  await paso("Consultar reseñas y evaluaciones (CU-43)", "GET", "/resenias");

  // Cancelación de una salida de la empresa (CU-37)
  const salida2 = await paso("Crear otra salida (CU-36)", "POST", "/salidas", nuevaSalida("2027-06-20", 2));
  await paso("Compra sobre la salida a cancelar", "POST", "/reservas", compra(3, idDe(salida2, "idsalida") ?? null), tokCliente);
  await paso("Liquidación de la cancelación (CU-37)", "GET", `/salidas/${idDe(salida2, "idsalida")}/cancelacion`);
  await paso("Cancelar salida (CU-37)", "POST", `/salidas/${idDe(salida2, "idsalida")}/cancelar`, { motivo: "Prueba de humo" });
  // Repetir la cancelación ya liberada tiene que dar 4xx (solo reintenta si faltó liberar los cupos)
  const rep = idDe(salida2, "idsalida") !== undefined
    ? await llamar("POST", `/salidas/${idDe(salida2, "idsalida")}/cancelar`, { motivo: "Prueba de humo" })
    : undefined;
  if (rep) {
    const ok4xx = rep.status >= 400 && rep.status < 500;
    console.log(`${ok4xx ? "✓" : "✗"} ${rep.status} Repetir cancelación (CU-37)`);
    if (!ok4xx) fallas.push(`C Repetir cancelación (CU-37) → ${rep.status} ${resumen(rep.body)}${rep.error}`);
  }

  // Bajas
  await paso("Baja porteador (CU-25)", "PATCH", `/personal/${idDe(porteador, "idpersonal")}/baja`);
  await paso("Baja cuenta guía (CU-46)", "PATCH", `/cuentas-guia/${idDe(guia, "idusuario")}/baja`);
  await paso("Baja paquete (CU-13)", "PATCH", `/paquetes/${idDe(paquete, "idpaquete")}/baja`);
  // La temporada del paquete tiene tarifas y no se puede dar de baja (regla del CU-09): se usa otra
  const libre = await paso("Crear temporada sin tarifas (CU-07)", "POST", "/temporadas", { nombre: `Humo ${t} libre`, fechaInicio: "2027-08-01", fechaFin: "2027-08-31" });
  await paso("Baja temporada (CU-09)", "PATCH", `/temporadas/${idDe(libre, "idtemporada")}/baja`);
  await paso("Baja circuito (CU-04)", "PATCH", `/circuitos/${idcircuito}/baja`);
  // El cliente del flujo tiene reservas activas (no se puede dar de baja): se usa uno nuevo
  const sinReservas = await paso("Registrar cliente sin reservas (CU-27)", "POST", "/clientes", { email: `baja.${t.toLowerCase()}@humo.com`, contrasenia: "clienteHumo123", nombre: "Bruno", apellido: "Humo" }, "");
  await paso("Baja cliente (CU-29)", "PATCH", `/clientes/${idDe(sinReservas, "idcliente")}/baja`);
}

// Fase D: usa AutoridadSimulada directo contra la base de la prueba (nunca incatour_db)
async function faseD() {
  // El cliente de Prisma lee DATABASE_URL al importarse: se pisa antes del import dinámico
  process.env.DATABASE_URL = DB_URL;
  const { AutoridadSimulada } = await import("../src/integraciones/autoridad/autoridad.simulada.js");
  const { db } = await import("../src/config/postgresDatabase.js");
  const autoridad = new AutoridadSimulada(false);
  const controlar = (nombre: string, ok: boolean, detalle = "") => {
    console.log(`${ok ? "✓" : "✗"} ${nombre}`);
    if (!ok) fallas.push(`D ${nombre} ${detalle}`);
  };
  const titulares = (desde: number) => Array.from({ length: 6 }, (_, i) => ({
    tipo: "PASAJERO" as const, id: desde + i, nombreCompleto: `Humo ${desde + i}`, nacionalidad: "Peruana",
    nroPasaporte: `D${desde + i}`, fechaVencimientoPasaporte: new Date("2035-01-01"),
  }));
  const exactamenteUno = (r: PromiseSettledResult<unknown>[]) => r.filter((x) => x.status === "fulfilled").length === 1;

  try {
    const bloqueo = await autoridad.solicitarBloqueoCupo(new Date("2030-06-15"), 26);
    controlar("Bloquear 26 lugares", bloqueo.aprobado);
    if (!bloqueo.aprobado) return;
    const id = bloqueo.idBloqueo;

    const sobrantes = await Promise.allSettled([autoridad.liberarLugaresSobrantes(id, 20), autoridad.liberarLugaresSobrantes(id, 20)]);
    controlar("Dos liberaciones de sobrantes en paralelo: solo una pasa", exactamenteUno(sobrantes));
    const quedan = await db.autoridadBloqueo.findUnique({ where: { idBloqueo: id } });
    controlar("Quedan 6 lugares en el bloqueo", quedan?.lugares === 6, `(quedan ${quedan?.lugares})`);

    const emisiones = await Promise.allSettled([autoridad.solicitarEmisionNominal(id, titulares(1)), autoridad.solicitarEmisionNominal(id, titulares(11))]);
    controlar("Dos emisiones de 6 en paralelo: solo una pasa", exactamenteUno(emisiones));

    const liberaciones = await Promise.allSettled([autoridad.liberarTotalidadCupos(id), autoridad.liberarTotalidadCupos(id)]);
    controlar("Liberar la totalidad dos veces: ambas resuelven", liberaciones.every((x) => x.status === "fulfilled"));

    const negativo = await Promise.allSettled([autoridad.solicitarBloqueoCupo(new Date("2030-06-15"), -10)]);
    controlar("Bloquear -10 lugares se rechaza", negativo[0]!.status === "rejected");

    // SAL-05 / SAL-06: asignaciones y compras contra el mismo recurso, con los locks reales de Postgres
    const { AsignacionRepository } = await import("../src/modulos/salidas/asignacion/asignacion.repository.js");
    const { ReservaRepository } = await import("../src/modulos/reservas/reservas/reserva.repository.js");
    const { ESTADO } = await import("../src/shared/constantes.js");
    const paquete = await db.paquete.findUniqueOrThrow({ where: { nroPaquete: "PAQ-INC-01" } });
    const cliente = await db.usuario.findUniqueOrThrow({ where: { email: "juan@test.com" } });
    const transporte = await db.servicioTransporte.findFirstOrThrow();
    const sufijo = Date.now().toString(36).toUpperCase();
    const crearSalida = (n: string, inicio: string, fin: string) => db.salida.create({
      data: {
        idpaquete: paquete.idpaquete, nroSalida: `SAL-D-${sufijo}-${n}`, idbloqueo: `BLQ-D-${sufijo}-${n}`,
        stockLocal: 5, stockLocalAlojamiento: 0, tamanoMaximo: 5,
        fechaInicio: new Date(inicio), fechaFin: new Date(fin), estado: "PUBLICADA",
      },
    });
    const personal = await db.personal.create({
      data: { nombreCompleto: `Humo D ${sufijo}`, nroPasaporte: `DP-${sufijo}`, nacionalidad: "Peruana", fechaVencimientoPasaporte: new Date("2035-01-01"), estado: ESTADO.ACTIVO, rol: "Porteador" },
    });
    const salidas: number[] = [];
    try {
      const repoAsig = new AsignacionRepository();
      const confirmarAsignacion = async (idsalida: number) => repoAsig.confirmar({
        salida: (await repoAsig.buscarSalida(idsalida))!, personalIds: [personal.idpersonal],
        idtransporte: transporte.idservicio, itemsCamping: [], permisos: [], rechazados: [], reservaDePasajero: new Map(), lugaresPorLiberar: 0,
      });

      // a) dos salidas superpuestas con el mismo personal y transporte: solo una se asigna
      const s1 = await crearSalida("A1", "2031-03-10", "2031-03-13");
      const s2 = await crearSalida("A2", "2031-03-12", "2031-03-15");
      salidas.push(s1.idsalida, s2.idsalida);
      const paralelas = await Promise.allSettled([confirmarAsignacion(s1.idsalida), confirmarAsignacion(s2.idsalida)]);
      controlar("Dos asignaciones superpuestas con el mismo personal/transporte: solo una pasa", exactamenteUno(paralelas));

      // b) compra sobre una salida que se cierra: reserva cupo, la asignación cierra, el pago ya no confirma
      const s3 = await crearSalida("B", "2031-06-10", "2031-06-13");
      salidas.push(s3.idsalida);
      const repoReserva = new ReservaRepository();
      await repoReserva.reservarCupos(s3.idsalida, 1);
      await confirmarAsignacion(s3.idsalida).then(
        () => controlar("Asignar una salida PUBLICADA sin reservas confirmadas", true),
        (e) => controlar("Asignar una salida PUBLICADA sin reservas confirmadas", false, String(e)),
      );
      const compra = await Promise.allSettled([repoReserva.confirmarReserva({
        idcliente: cliente.idusuario, idsalida: s3.idsalida, nroReserva: `RES-D-${sufijo}`, precioCongelado: 100, temporadaAplicada: "Humo", precioPaquetePorPersona: 100, adicionalesEquipaje: 0, moneda: "USD", diasMinimosReintegro: null,
        condicionesComerciales: "humo", medioPago: "TARJETA", estadoAlojamiento: "CONFIRMADO",
        pasajeros: [{ nombreCompleto: "Humo D", nroPasaporte: `DPAS-${sufijo}`, nacionalidad: "Peruana", fechaVencimientoPasaporte: "2035-01-01" }],
      })]);
      controlar("Confirmar una compra sobre una salida ya cerrada se rechaza", compra[0]!.status === "rejected");
    } finally {
      await db.asignacionPersonal.deleteMany({ where: { idsalida: { in: salidas } } });
      await db.salidaServicio.deleteMany({ where: { idsalida: { in: salidas } } });
      await db.salida.deleteMany({ where: { idsalida: { in: salidas } } });
      await db.personal.delete({ where: { idpersonal: personal.idpersonal } });
    }
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  entorno.resetear();
  try {
    back = await entorno.levantarBack(PUERTO);
  } catch (e) {
    console.log(`
FALLAS (1):
  Corte: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
  try {
    token.admin = await login("admin@incatour.com", "AdminIncaTour123");
    token.cliente = await login("juan@test.com", "hash123");
    token.guia = await login("carlos.guia@incatour.com", "guia123");
    await faseA_B();
    await faseC();
    await faseD();
  } catch (e) {
    fallas.push(`Corte: ${e instanceof Error ? e.message : e}`);
  } finally {
    back.apagar();
  }
  if (avisos.length) console.log(`\nAvisos (${avisos.length}):\n  ` + avisos.join("\n  "));
  if (omitidos.length) console.log(`\nOmitidos por fallas anteriores: ${omitidos.length}`);
  console.log(`Salida completa del back: ${back.log}`);
  if (fallas.length) {
    console.log(`\nFALLAS (${fallas.length}):\n  ` + fallas.join("\n  "));
    process.exit(1);
  }
  console.log("\nSin fallas.");
}

main();
