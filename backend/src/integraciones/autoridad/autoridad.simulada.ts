import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "../../config/postgresDatabase";
import {
  CUPO_DIARIO,
  IApiAutoridad,
  PermisoEmitido,
  ResultadoBloqueo,
  TitularPermiso,
  diaDelCupo,
  validarCantidad,
} from "./autoridad.interface";

/**
 * Simulación de la autoridad del Camino Inca (DDC) con almacenamiento propio, para el servidor.
 *
 * - Guarda el cupo diario, los bloqueos y los permisos en sus tablas (autoridad_*), así que
 *   sobrevive a los reinicios. Esas tablas no tienen FK al sistema: simulan otro sistema.
 * - Cupo diario: 500 personas, contando turistas, guías y porteadores.
 * - AUTORIDAD_CAIDA=true en el .env simula que la autoridad no responde (FA2 del CU-36, CU-37).
 *
 * Los tests unitarios usan AutoridadMock (en memoria), que cumple el mismo contrato.
 */
const nuevoId = (prefijo: string) => `${prefijo}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

export class AutoridadSimulada implements IApiAutoridad {
  constructor(private caida = process.env.AUTORIDAD_CAIDA === "true") {}

  async solicitarBloqueoCupo(fechaInicio: Date, totalLugares: number): Promise<ResultadoBloqueo> {
    this.verificarConexion();
    validarCantidad(totalLugares);
    const fecha = diaDelCupo(fechaInicio);

    return db.$transaction(async (tx) => {
      await tx.autoridadCupoDiario.createMany({ data: [{ fecha }], skipDuplicates: true });

      // Descuento condicional: si otro pedido se llevó los lugares en el medio, no suma nada
      const sumado = await tx.autoridadCupoDiario.updateMany({
        where: { fecha, ocupados: { lte: CUPO_DIARIO - totalLugares } },
        data: { ocupados: { increment: totalLugares } },
      });
      if (sumado.count === 0) {
        const dia = await tx.autoridadCupoDiario.findUniqueOrThrow({ where: { fecha } });
        return { aprobado: false, lugaresDisponibles: CUPO_DIARIO - dia.ocupados };
      }

      const idBloqueo = nuevoId("BLQ");
      await tx.autoridadBloqueo.create({ data: { idBloqueo, fecha, lugares: totalLugares } });
      return { aprobado: true, idBloqueo };
    });
  }

  async liberarLugaresSobrantes(idBloqueo: string, sobrantes: number): Promise<void> {
    this.verificarConexion();
    const bloqueo = await this.buscarBloqueo(idBloqueo);
    if (sobrantes <= 0 || sobrantes > bloqueo.lugares) {
      throw new Error(`Sobrantes inválidos: el bloqueo ${idBloqueo} tiene ${bloqueo.lugares} lugares`);
    }
    await db.$transaction([
      db.autoridadBloqueo.update({ where: { idBloqueo }, data: { lugares: { decrement: sobrantes } } }),
      db.autoridadCupoDiario.update({ where: { fecha: bloqueo.fecha }, data: { ocupados: { decrement: sobrantes } } }),
    ]);
  }

  async liberarTotalidadCupos(idBloqueo: string): Promise<void> {
    this.verificarConexion();
    // Idempotente: si el bloqueo ya no existe, no hay nada que liberar. Los permisos se borran en cascada
    await db.$transaction(async (tx) => {
      const bloqueo = await this.bloquearFila(tx, idBloqueo);
      if (!bloqueo) return;
      await tx.autoridadCupoDiario.update({ where: { fecha: bloqueo.fecha }, data: { ocupados: { decrement: bloqueo.lugares } } });
      await tx.autoridadBloqueo.delete({ where: { idBloqueo } });
    });
  }

  async solicitarEmisionNominal(idBloqueo: string, nomina: TitularPermiso[]): Promise<PermisoEmitido[]> {
    this.verificarConexion();
    const bloqueo = await this.buscarBloqueo(idBloqueo);
    if (nomina.length > bloqueo.lugares) {
      throw new Error(`La nómina tiene ${nomina.length} personas y el bloqueo ${bloqueo.lugares} lugares`);
    }
    const permisos = nomina.map((titular) => this.armarPermiso(titular));
    await db.autoridadPermiso.createMany({
      data: permisos.map((p) => ({ nroPermiso: p.nroPermiso, idBloqueo })),
    });
    return permisos;
  }

  async darDeBajaPermiso(idBloqueo: string, nroPermiso: string): Promise<void> {
    this.verificarConexion();
    await this.buscarPermiso(idBloqueo, nroPermiso);
    await db.autoridadPermiso.update({ where: { nroPermiso }, data: { vigente: false } });
  }

  async solicitarPermisoIndividual(
    idBloqueo: string,
    reemplazante: TitularPermiso,
    nroPermisoAnterior: string,
  ): Promise<PermisoEmitido> {
    this.verificarConexion();
    const anterior = await this.buscarPermiso(idBloqueo, nroPermisoAnterior);
    if (anterior.vigente) {
      throw new Error(`El permiso ${nroPermisoAnterior} sigue vigente: primero hay que darlo de baja`);
    }
    const nuevo = this.armarPermiso(reemplazante);
    // El permiso nuevo ocupa el mismo lugar que el anterior
    await db.$transaction([
      db.autoridadPermiso.delete({ where: { nroPermiso: nroPermisoAnterior } }),
      db.autoridadPermiso.create({ data: { nroPermiso: nuevo.nroPermiso, idBloqueo } }),
    ]);
    return nuevo;
  }

  private armarPermiso(titular: TitularPermiso): PermisoEmitido {
    return { titular: { tipo: titular.tipo, id: titular.id }, nroPermiso: nuevoId("PER"), fechaEmision: new Date() };
  }

  // Toma el lock de la fila del bloqueo hasta que termine la transacción. Orden de locks: siempre bloqueo → cupo
  private async bloquearFila(tx: Prisma.TransactionClient, idBloqueo: string) {
    const [bloqueo] = await tx.$queryRaw<{ fecha: string; lugares: number }[]>`
      SELECT fecha, lugares FROM autoridad.bloqueo WHERE "idBloqueo" = ${idBloqueo} FOR UPDATE`;
    return bloqueo ?? null;
  }

  private async buscarBloqueo(idBloqueo: string) {
    const bloqueo = await db.autoridadBloqueo.findUnique({ where: { idBloqueo } });
    if (!bloqueo) throw new Error(`El bloqueo ${idBloqueo} no existe`);
    return bloqueo;
  }

  private async buscarPermiso(idBloqueo: string, nroPermiso: string) {
    const permiso = await db.autoridadPermiso.findUnique({ where: { nroPermiso } });
    if (!permiso || permiso.idBloqueo !== idBloqueo) {
      throw new Error(`El permiso ${nroPermiso} no existe en el bloqueo ${idBloqueo}`);
    }
    return permiso;
  }

  private verificarConexion() {
    if (this.caida) throw new Error("La autoridad no responde");
  }
}
