/**
 * Test integral: recorre los flujos alternativos, los errores y los bordes de los casos de uso contra la API real
 * y, después de cada paso, controla el status HTTP exacto y el estado en la base (stocks, plazas de hotel,
 * lugares ante la autoridad, permisos, reintegros, estados).
 *
 * Resetea INTEGRAL_DB (por defecto incatour_integral) con migraciones y seed, levanta el back en INTEGRAL_PUERTO
 * (por defecto 3996) y un segundo back con la autoridad caída (AUTORIDAD_CAIDA=true) en el puerto siguiente.
 * La base de desarrollo no se toca. Uso, desde backend, con Docker levantado: npm run test:integral
 *
 * Los escenarios que fallan por un error ya cargado en el tablero van en CONOCIDAS: salen como pendientes y no
 * cuentan como falla. El exit code es 1 solo si aparece una falla nueva.
 */
import { PrismaClient } from "@prisma/client";
import { Back, crearEntorno } from "./lib-prueba";
import { crearContexto } from "./integral/contexto";
import { ventas } from "./integral/ventas";
import { salidas } from "./integral/salidas";
import { campo } from "./integral/campo";
import { catalogoCuentas } from "./integral/catalogo-cuentas";

const INTEGRAL_DB = process.env.INTEGRAL_DB ?? "incatour_integral";
const PUERTO = Number(process.env.INTEGRAL_PUERTO ?? 3996);

// Nombre del escenario (exacto, como se pasa a esperar/controlar) → error del tablero que lo explica
const CONOCIDAS: Record<string, string> = {};

async function main() {
  const entorno = crearEntorno(INTEGRAL_DB);
  entorno.resetear();
  const db = new PrismaClient({ datasources: { db: { url: entorno.DB_URL } } });
  // Temporada propia para 2027-2028 (la del seed cubre hasta fin de 2026): las salidas futuras tienen tarifa
  await db.temporada.create({ data: { nombre: "Integral 2027-2028", fechaInicio: new Date("2027-01-01"), fechaFin: new Date("2028-12-31") } });

  const backs: Back[] = [];
  let ctx: ReturnType<typeof crearContexto> | undefined;
  let corte = "";
  try {
    const back = await entorno.levantarBack(PUERTO);
    backs.push(back);
    const backCaido = await entorno.levantarBack(PUERTO + 1, { AUTORIDAD_CAIDA: "true" });
    backs.push(backCaido);
    const admin = await back.login("admin@incatour.com", "AdminIncaTour123");
    ctx = crearContexto({ back, backCaido, db, admin, conocidas: CONOCIDAS });

    for (const modulo of [ventas, salidas, campo, catalogoCuentas]) {
      try {
        await modulo(ctx);
      } catch (e) {
        ctx.fallas.push(`Corte del módulo ${modulo.name}: ${e instanceof Error ? e.message : e}`);
      }
    }
  } catch (e) {
    corte = e instanceof Error ? e.message : String(e);
  } finally {
    backs.forEach((b) => b.apagar());
    await db.$disconnect();
  }

  const fallas = [...(ctx?.fallas ?? []), ...(corte ? [`Corte: ${corte}`] : [])];
  if (ctx?.arreglados.length) console.log(`\nYa arreglados (sacarlos de CONOCIDAS):\n  ` + ctx.arreglados.join("\n  "));
  if (ctx?.pendientes.length) console.log(`\nPendientes del tablero (${ctx.pendientes.length}):\n  ` + ctx.pendientes.join("\n  "));
  console.log(`\nLogs del back: ${backs.map((b) => b.log).join(" · ")}`);
  if (fallas.length) {
    console.log(`\nFALLAS NUEVAS (${fallas.length}):\n  ` + fallas.join("\n  "));
    process.exit(1);
  }
  console.log("\nSin fallas nuevas.");
}

main();
