/**
 * Prueba de concurrencia de la compra (CU-30), pedida en la verificación del plan:
 * 20 compras simultáneas de 1 pasajero sobre una salida con 10 lugares.
 * Tienen que confirmarse exactamente 10 y el stock tiene que quedar en 0, nunca negativo.
 * B4: cada compra recalcula el equipo sobre el total vendido; con "1 carpa cada 2" tienen que quedar 5 carpas, no menos.
 *
 * Corre sobre su propia base (incatour_concurrencia), que resetea con el seed: nunca toca incatour_db.
 * Uso, desde backend: npm run test:concurrencia
 */
import crypto from "crypto";
import { crearEntorno } from "./lib-prueba";

const entorno = crearEntorno("incatour_concurrencia");

const LUGARES = 10;
const COMPRAS = 20;

async function main() {
  entorno.resetear();
  // El cliente de Prisma lee DATABASE_URL al importarse: se pisa antes del import dinámico
  process.env.DATABASE_URL = entorno.DB_URL;
  process.env.SMTP_HOST = "";
  const { db } = await import("../src/config/postgresDatabase.js");
  const { CrearReservaDto } = await import("../src/modulos/reservas/reservas/reserva.dto.js");
  const { ReservaService } = await import("../src/modulos/reservas/reservas/reserva.service.js");

  const cliente = await db.usuario.findUniqueOrThrow({ where: { email: "juan@test.com" } });
  const paquete = await db.paquete.findUniqueOrThrow({ where: { nroPaquete: "PAQ-INC-01" } });
  const prueba = crypto.randomBytes(3).toString("hex").toUpperCase();
  const carpa = await db.servicioBase.findFirstOrThrow({ where: { equipamiento: { isNot: null } } });
  const regla = { idservicio: carpa.idservicio, nombreServicio: carpa.nombreServicio, tipo: "EQUIPAMIENTO", cantidad: 1, cadaPasajeros: 2 };

  const salida = await db.salida.create({
    data: {
      idpaquete: paquete.idpaquete,
      nroSalida: `SAL-CONC-${prueba}`,
      idbloqueo: `BLQ-CONC-${prueba}`,
      stockLocal: LUGARES,
      stockLocalAlojamiento: 0,
      tamanoMaximo: LUGARES,
      fechaInicio: new Date("2026-12-28T00:00:00Z"),
      fechaFin: new Date("2026-12-31T00:00:00Z"),
      estado: "PUBLICADA",
      definicionPaquete: { servicios: [regla] },
      // B3: el alta deja la fila del equipo en 0 y cada compra la recalcula
      ocupaciones: { create: { idservicio: carpa.idservicio, tipo: "EQUIPAMIENTO", desde: new Date("2026-12-28"), hasta: new Date("2027-01-02"), cantidad: 0 } },
    },
  });

  try {
    const servicio = new ReservaService();
    const compras = Array.from({ length: COMPRAS }, (_, i) => {
      const [, dto] = CrearReservaDto.create({
        idsalida: salida.idsalida,
        medioPago: "TARJETA",
        tarjeta: { numero: "4111222233334444", titular: "Prueba", vencimiento: "12/29", cvv: "123" },
        pasajeros: [
          { nombreCompleto: `Pasajero ${i}`, nroPasaporte: `CONC-${prueba}-${i}`, nacionalidad: "Argentina", fechaVencimientoPasaporte: "2030-01-01" },
        ],
      });
      return servicio.crearReserva(dto!, cliente.idusuario);
    });

    const resultados = await Promise.allSettled(compras);
    const confirmadas = resultados.filter((r) => r.status === "fulfilled").length;
    const final = await db.salida.findUniqueOrThrow({ where: { idsalida: salida.idsalida } });
    const reservas = await db.reserva.count({ where: { idsalida: salida.idsalida, estado: "CONFIRMADA" } });
    const carpas = (await db.ocupacion.findFirstOrThrow({ where: { idsalida: salida.idsalida, idservicio: carpa.idservicio } })).cantidad;

    console.log(`${COMPRAS} compras simultáneas sobre ${LUGARES} lugares`);
    console.log(`  confirmadas: ${confirmadas}  rechazadas: ${COMPRAS - confirmadas}`);
    console.log(`  reservas en la base: ${reservas}  stock final: ${final.stockLocal}  carpas ocupadas: ${carpas} (esperadas ${Math.ceil(LUGARES / 2)})`);

    const ok = confirmadas === LUGARES && reservas === LUGARES && final.stockLocal === 0 && carpas === Math.ceil(LUGARES / 2);
    console.log(ok ? "✅ OK: no se vendió de más" : "❌ FALLÓ: se vendieron más o menos lugares de los que había");

    // 12.2: dos grupos de 2 se disputan el último hotel con lugar (A tiene 1 plaza libre, B tiene 2): uno va a B y el otro
    // se rechaza, porque el grupo no se parte; B no queda en negativo
    const [hotelA, hotelB] = await db.servicioBase.findMany({ where: { alojamiento: { modalidadConfirmacion: "BLOQUEO_PLAZAS" } }, take: 2 });
    const noche = { tipo: "ALOJAMIENTO", desde: new Date("2027-02-27"), hasta: new Date("2027-02-27") };
    const conHoteles = await db.salida.create({
      data: {
        idpaquete: paquete.idpaquete, nroSalida: `SAL-CONC-H-${prueba}`, idbloqueo: `BLQ-CONC-H-${prueba}`, stockLocal: 4, stockLocalAlojamiento: 3,
        tamanoMaximo: 4, fechaInicio: new Date("2027-02-28T00:00:00Z"), fechaFin: new Date("2027-03-03T00:00:00Z"), estado: "PUBLICADA",
        // 12.5: la tarifa congelada (el seed no tiene tarifa en 2027)
        definicionPaquete: { servicios: [], nochesPrevias: 1, nochesPosteriores: 0, tarifa: { idtemporada: 0, temporada: "Concurrencia", monto: 100, moneda: "USD" } },
        ocupaciones: { create: [{ ...noche, idservicio: hotelA!.idservicio, cantidad: 1, plazasLibres: 1 }, { ...noche, idservicio: hotelB!.idservicio, cantidad: 2, plazasLibres: 2 }] },
      },
    });
    const grupo = (g: number) => {
      const [, dto] = CrearReservaDto.create({
        idsalida: conHoteles.idsalida, medioPago: "TARJETA",
        tarjeta: { numero: "4111222233334444", titular: "Prueba", vencimiento: "12/29", cvv: "123" },
        pasajeros: [0, 1].map((i) => ({ nombreCompleto: `Grupo ${g} ${i}`, nroPasaporte: `CONC-H-${prueba}-${g}-${i}`, nacionalidad: "Argentina", fechaVencimientoPasaporte: "2030-01-01" })),
      });
      return servicio.crearReserva(dto!, cliente.idusuario);
    };
    const grupos = await Promise.allSettled([grupo(1), grupo(2)]);
    const rechazo = grupos.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    const libres = async (h: { idservicio: number }) => (await db.ocupacion.findFirstOrThrow({ where: { idsalida: conHoteles.idsalida, idservicio: h.idservicio } })).plazasLibres;
    const enB = await db.reserva.count({ where: { idsalida: conHoteles.idsalida, idalojamiento: hotelB!.idservicio } });
    const finalH = await db.salida.findUniqueOrThrow({ where: { idsalida: conHoteles.idsalida } });
    console.log(`Dos grupos de 2 por el último hotel con lugar (A: 1 libre, B: 2 libres)`);
    console.log(`  confirmados: ${grupos.filter((r) => r.status === "fulfilled").length}  en B: ${enB}  libres A/B: ${await libres(hotelA!)}/${await libres(hotelB!)}  stock: ${finalH.stockLocal}`);
    console.log(`  rechazo: ${rechazo?.reason?.message}`);
    const okHotel = grupos.filter((r) => r.status === "fulfilled").length === 1 && enB === 1 && (await libres(hotelA!)) === 1 && (await libres(hotelB!)) === 0 &&
      finalH.stockLocal === 2 && /^Quedan 2 lugares, pero no en un mismo hotel: en una reserva entran hasta 1 pasajeros\./.test(rechazo?.reason?.message ?? "");
    console.log(okHotel ? "✅ OK: el grupo no se partió ni se sobrevendió el hotel" : "❌ FALLÓ: el hotel quedó mal repartido");

    // Límite A1: un admin baja el total mientras otra operación ocupa ese mismo equipo. La ocupación bloquea el
    // ServicioBase y tarda; el guardado espera el bloqueo y ve las 6 unidades ya ocupadas, así que no puede bajar a 5
    const { ServicioService } = await import("../src/modulos/proveedores/servicios/servicio.service.js");
    const { ModificarServicioDto } = await import("../src/modulos/proveedores/servicios/servicio.dto.js");
    const { disponible, ocupar } = await import("../src/shared/ocupacion.repository.js");
    const bastones = await db.servicioBase.create({
      data: { idproveedor: carpa.idproveedor, nombreServicio: `Bastones CONC ${prueba}`, costoBase: 1, estado: "ACTIVO", localidad: carpa.localidad, equipamiento: { create: { tipoEquipamiento: "Bastón", cantidadTotal: 10 } } },
    });
    const rangos = [{ desde: new Date("2026-12-28"), hasta: new Date("2027-01-02") }];
    const ocupacion = db.$transaction(async (tx) => {
      if ((await disponible(tx, bastones.idservicio, rangos)) < 6) throw new Error("sin stock");
      await new Promise((r) => setTimeout(r, 400));
      await ocupar(tx, { idservicio: bastones.idservicio, idsalida: salida.idsalida, tipo: "EQUIPAMIENTO", rangos, cantidad: 6 });
    });
    await new Promise((r) => setTimeout(r, 100));
    const [, baja] = ModificarServicioDto.create({ inventarioTotal: 5 });
    const [ocupo, bajo] = await Promise.allSettled([ocupacion, new ServicioService().modificarServicio(bastones.idservicio, baja!)]);
    const totalFinal = (await db.servicioEquipamiento.findUniqueOrThrow({ where: { idservicio: bastones.idservicio } })).cantidadTotal;
    console.log("Bajar el total a 5 mientras se ocupan 6 de 10");
    console.log(`  ocupación: ${ocupo.status}  baja: ${bajo.status === "rejected" ? bajo.reason?.message : "aceptada"}  total final: ${totalFinal}`);
    const okTotal = ocupo.status === "fulfilled" && bajo.status === "rejected" && /Hay 6 unidades comprometidas/.test(bajo.reason?.message ?? "") && totalFinal === 10;
    console.log(okTotal ? "✅ OK: el total no quedó debajo de lo ocupado" : "❌ FALLÓ: el total quedó debajo de lo ocupado");

    // Límite CU-50: el guía reenvía el mismo incidente dos veces a la vez (se perdió la respuesta). Con la misma clave
    // del dispositivo queda uno solo y el segundo devuelve el mismo
    const { GuiaRepository } = await import("../src/modulos/campo/guia/guia.repository.js");
    const guia = new GuiaRepository();
    const reenvio = () =>
      guia.registrarIncidente({
        idsalida: salida.idsalida, tipoIncidente: "SALUD", descripcion: "Reenvío simultáneo", nivelGravedad: "CRITICO",
        fechaHoraOcurrencia: new Date(), pasajerosAfectados: [], claveCliente: `off_${prueba}_conc`,
      });
    const envios = await Promise.allSettled([reenvio(), reenvio(), reenvio()]);
    const filas = await db.incidente.count({ where: { idsalida: salida.idsalida, claveCliente: `off_${prueba}_conc` } });
    const nuevos = envios.filter((r) => r.status === "fulfilled" && r.value.nuevo).length;
    console.log("Tres reenvíos simultáneos del mismo incidente");
    console.log(`  respondidos: ${envios.filter((r) => r.status === "fulfilled").length}  nuevos: ${nuevos}  filas: ${filas}`);
    const okIncidente = envios.every((r) => r.status === "fulfilled") && nuevos === 1 && filas === 1;
    console.log(okIncidente ? "✅ OK: quedó un solo incidente" : "❌ FALLÓ: el incidente se duplicó");
    process.exitCode = ok && okHotel && okTotal && okIncidente ? 0 : 1;
  } finally {
    // La base es de la prueba: se resetea en la próxima corrida, no hace falta limpiar
    await db.$disconnect();
  }
}

main();
