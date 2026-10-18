/**
 * Prueba de concurrencia de la compra (CU-30), pedida en la verificación del plan:
 * 20 compras simultáneas de 1 pasajero sobre una salida con 10 lugares.
 * Tienen que confirmarse exactamente 10 y el stock tiene que quedar en 0, nunca negativo.
 *
 * Usa la base local (Docker levantado y seed cargado). Crea una salida propia y la borra al terminar.
 * Uso, desde backend: npm run test:concurrencia
 */
import crypto from "crypto";
import { db } from "../src/config/postgresDatabase";
import { CrearReservaDto } from "../src/modulos/reservas/reservas/reserva.dto";
import { ReservaService } from "../src/modulos/reservas/reservas/reserva.service";

const LUGARES = 10;
const COMPRAS = 20;

async function main() {
  const cliente = await db.usuario.findUniqueOrThrow({ where: { email: "juan@test.com" } });
  const paquete = await db.paquete.findUniqueOrThrow({ where: { nroPaquete: "PAQ-INC-01" } });
  const prueba = crypto.randomBytes(3).toString("hex").toUpperCase();

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

    console.log(`${COMPRAS} compras simultáneas sobre ${LUGARES} lugares`);
    console.log(`  confirmadas: ${confirmadas}  rechazadas: ${COMPRAS - confirmadas}`);
    console.log(`  reservas en la base: ${reservas}  stock final: ${final.stockLocal}`);

    const ok = confirmadas === LUGARES && reservas === LUGARES && final.stockLocal === 0;
    console.log(ok ? "✅ OK: no se vendió de más" : "❌ FALLÓ: se vendieron más o menos lugares de los que había");
    process.exitCode = ok ? 0 : 1;
  } finally {
    // Limpieza: la salida de prueba y todo lo que generaron las compras
    const idsReserva = (await db.reserva.findMany({ where: { idsalida: salida.idsalida }, select: { idreserva: true } })).map((r) => r.idreserva);
    const idsPasajero = (await db.reservaPasajero.findMany({ where: { idreserva: { in: idsReserva } }, select: { idpasajero: true } })).map((p) => p.idpasajero);
    await db.$transaction([
      db.gestionSolicitud.deleteMany({ where: { solicitud: { idreserva: { in: idsReserva } } } }),
      db.solicitud.deleteMany({ where: { idreserva: { in: idsReserva } } }),
      db.pago.deleteMany({ where: { idreserva: { in: idsReserva } } }),
      db.reservaPasajero.deleteMany({ where: { idreserva: { in: idsReserva } } }),
      db.reserva.deleteMany({ where: { idreserva: { in: idsReserva } } }),
      db.pasajero.deleteMany({ where: { idpasajero: { in: idsPasajero } } }),
      db.salida.delete({ where: { idsalida: salida.idsalida } }),
    ]);
    await db.$disconnect();
  }
}

main();
