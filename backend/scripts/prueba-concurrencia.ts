/**
 * Prueba de concurrencia de la compra (CU-30), pedida en la verificación del plan:
 * 20 compras simultáneas de 1 pasajero sobre una salida con 10 lugares.
 * Tienen que confirmarse exactamente 10 y el stock tiene que quedar en 0, nunca negativo.
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
    // La base es de la prueba: se resetea en la próxima corrida, no hace falta limpiar
    await db.$disconnect();
  }
}

main();
