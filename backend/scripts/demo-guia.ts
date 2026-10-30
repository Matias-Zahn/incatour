/**
 * Base de demo para el portal del guía: resetea DEMO_DB (por defecto incatour_demo) con el seed y le deja a
 * carlos.guia@incatour.com (contraseña guia123) una salida EN_CURSO con pasajeros, permisos emitidos y la etapa 1
 * informada, más una próxima salida asignada. Uso, desde backend, con Docker levantado: npx tsx scripts/demo-guia.ts
 * Después levantar el back contra esa base (DATABASE_URL apuntando a incatour_demo).
 */
import { PrismaClient } from "@prisma/client";
import { crearEntorno, idDe } from "./lib-prueba";
import { crearContexto, fecha, hace } from "./integral/contexto";

const DEMO_DB = process.env.DEMO_DB ?? "incatour_demo";
const H = 3600 * 1000;

const ETAPAS = [
  { puntoInicio: "Km 82 (Piscacucho)", puntoFin: "Wayllabamba", campamentoPrevisto: "Campamento Wayllabamba" },
  { puntoInicio: "Wayllabamba", puntoFin: "Pacaymayo", campamentoPrevisto: "Campamento Pacaymayo" },
  { puntoInicio: "Pacaymayo", puntoFin: "Wiñay Wayna", campamentoPrevisto: "Campamento Wiñay Wayna" },
  { puntoInicio: "Wiñay Wayna", puntoFin: "Machu Picchu", campamentoPrevisto: "Sin campamento" },
];

const PORTEADORES = ["Julián Quispe", "Wilber Huamán", "Rubén Condori", "Efraín Mamani"];

const PASAJEROS = [
  ["Lucía Fernández", "AAB123456", "Argentina"],
  ["Martín Gómez", "AAC654321", "Argentina"],
  ["Sofía Ramírez", "CL9876543", "Chilena"],
  ["Diego Castro", "UY4567890", "Uruguaya"],
];

async function main() {
  const entorno = crearEntorno(DEMO_DB);
  entorno.resetear();
  const db = new PrismaClient({ datasources: { db: { url: entorno.DB_URL } } });
  await db.temporada.create({ data: { nombre: "Demo 2027-2028", fechaInicio: new Date("2027-01-01"), fechaFin: new Date("2028-12-31") } });
  const back = await entorno.levantarBack(3997);
  try {
    const admin = await back.login("admin@incatour.com", "AdminIncaTour123");
    const ctx = crearContexto({ back, backCaido: back, db, admin, conocidas: {} });
    const { f } = ctx;

    const usuario = await db.usuario.findUniqueOrThrow({ where: { email: "carlos.guia@incatour.com" } });
    const carlos = await db.guia.findUniqueOrThrow({ where: { idusuario: usuario.idusuario } });
    const tokenCarlos = await back.login("carlos.guia@incatour.com", "guia123");

    const idcircuito = idDe(await ctx.preparar("Crear circuito", "POST", "/circuitos", {
      nombreCircuito: "Camino Inca Demo", duracionDias: 4, dificultad: "Alta", minimoGuias: 1, parametrosPorteadores: "1 por cada 2 pasajeros",
    }), "idcircuito")!;
    await ctx.preparar("Etapas", "PUT", `/circuitos/${idcircuito}/etapas`, { etapas: ETAPAS.map((e, i) => ({ numeroOrden: i + 1, ...e })) });

    // Dos salidas: la que está en curso y la próxima
    async function salidaAsignada(inicio: number, n: number) {
      const pq = await f.paquete({ idcircuito, localidad: "Cusco Demo" });
      await db.paquete.update({ where: { idpaquete: pq.idpaquete }, data: { nombrePaquete: "Camino Inca Clásico 4 días" } });
      const hotel = await f.hotel(pq.localidad, 50);
      const idsalida = await f.salida(pq.idpaquete, fecha(400 + inicio), 8, hotel.idservicio);
      const cliente = await f.cliente();
      const pasajeros = PASAJEROS.slice(0, n).map(([nombreCompleto, nroPasaporte, nacionalidad]) => ({
        nombreCompleto, nroPasaporte: `${nroPasaporte}${inicio}`, nacionalidad, fechaVencimientoPasaporte: "2034-06-30",
      }));
      await f.comprar(cliente.token, idsalida, { pasajeros });
      const panel = await ctx.preparar("Panel de asignación", "GET", `/salidas/${idsalida}/asignacion`);
      const porteadores: number[] = [];
      for (let i = 0; i < panel.dotacionRequerida.porteadores; i++) {
        const idpersonal = await f.porteador();
        await db.personal.update({ where: { idpersonal }, data: { nombreCompleto: PORTEADORES[i % PORTEADORES.length] } });
        porteadores.push(idpersonal);
      }
      const transporte = await f.transporte(pq.localidad);
      await ctx.preparar("Asignar", "POST", `/salidas/${idsalida}/asignacion`, { personalIds: [carlos.idpersonal, ...porteadores], idtransporte: transporte.idservicio, itemsCamping: [] });
      return idsalida;
    }

    const enCurso = await salidaAsignada(0, 4);
    const proxima = await salidaAsignada(30, 2);
    // "Empezó ayer" y la etapa 1 ya informada: la salida queda EN_CURSO
    await f.moverFechas(enCurso, fecha(-1), fecha(2));
    await f.moverFechas(proxima, fecha(20), fecha(23));
    await ctx.preparar("Avance 1", "POST", `/guia/salidas/${enCurso}/avances`, { numeroOrden: 1, estadoTramo: "COMPLETADO", fechaHoraLlegada: hace(3 * H) }, tokenCarlos);

    console.log(`Listo: salida ${enCurso} EN_CURSO y ${proxima} próxima, asignadas a carlos.guia@incatour.com`);
  } finally {
    back.apagar();
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
