import { db } from "../../../config/postgresDatabase";
import { SALIDAS_ACTIVAS } from "../../../shared/constantes";
import { PrecioTemporada } from "./paquete.dto";

export interface FiltrosPaquete {
  estado?: string | undefined;
  idcircuito?: string | number | undefined;
  nombrePaquete?: string | undefined;
}

export class PaqueteRepository {
  async findAll(filtros?: FiltrosPaquete) {
    const where: any = {};

    if (filtros?.estado) {
      if (filtros.estado !== "TODOS") {
        where.estado = String(filtros.estado).toUpperCase();
      }
    } else {
      where.estado = "ACTIVO";
    }

    if (filtros?.idcircuito != null && filtros.idcircuito !== "") {
      where.idcircuito = Number(filtros.idcircuito);
    }

    if (filtros?.nombrePaquete) {
      where.nombrePaquete = { contains: String(filtros.nombrePaquete), mode: "insensitive" };
    }

    return db.paquete.findMany({
      where,
      include: {
        circuito: true,
        tarifas: { include: { temporada: true } },
      },
      orderBy: { idpaquete: "asc" },
    });
  }

  async findById(id: number) {
    return db.paquete.findUnique({
      where: { idpaquete: id },
      include: {
        circuito: true,
        tarifas: { include: { temporada: true } },
        servicios: { include: { servicio: true } },
        garantiasEstablecimiento: {
          include: { servicio: { include: { alojamiento: true } } },
        },
      },
    });
  }

  /**
   * DSS: guardar(p) — Persistencia atómica del paquete + tarifas + servicios.
   * RN: Transaccionalidad Estructural.
   */
  async guardar(
    data: {
      nroPaquete: string;
      idcircuito: number;
      nombrePaquete: string;
      condiciones?: string | undefined;
      estado: string;
      tipoGarantia: string;
      idservicioGarantizado?: number | undefined;
      localidadGarantizada?: string | undefined;
      categoriaGarantizada?: string | undefined;
      tipoHabitacionGarantizada?: string | undefined;
      nochesPrevias: number;
      nochesPosteriores: number;
      diasDisponibles?: string | undefined;
    },
    matrizPrecios: PrecioTemporada[],
    serviciosIncluidos: number[],
  ) {
    return db.$transaction(async (tx) => {
      // 1. Crear el paquete
      const paquete = await tx.paquete.create({
        data: {
          nroPaquete: data.nroPaquete,
          idcircuito: data.idcircuito,
          nombrePaquete: data.nombrePaquete,
          condiciones: data.condiciones || null,
          estado: data.estado,
          tipoGarantia: data.tipoGarantia,
          localidadGarantizada: data.localidadGarantizada || null,
          categoriaGarantizada: data.categoriaGarantizada || null,
          tipoHabitacionGarantizada: data.tipoHabitacionGarantizada || null,
          nochesPrevias: data.nochesPrevias,
          nochesPosteriores: data.nochesPosteriores,
          diasDisponibles: data.diasDisponibles || null,
        },
      });

      // 2. Crear las tarifas por temporada (DSS: loop PrecioPaquete)
      if (matrizPrecios.length > 0) {
        await tx.tarifaPaquete.createMany({
          data: matrizPrecios.map((p) => ({
            idpaquete: paquete.idpaquete,
            idtemporada: p.idtemporada,
            monto: p.monto,
            moneda: p.moneda,
          })),
        });
      }

      // 3. Crear los servicios incluidos
      if (serviciosIncluidos.length > 0) {
        await tx.paqueteServicio.createMany({
          data: serviciosIncluidos.map((idservicio) => ({
            idpaquete: paquete.idpaquete,
            idservicio,
          })),
        });
      }

      // 3.5. Crear GarantiaEstablecimiento SOLO si es POR_ESTABLECIMIENTO (CAT-08)
      if (data.tipoGarantia === "POR_ESTABLECIMIENTO" && data.idservicioGarantizado) {
        await tx.garantiaEstablecimiento.create({
          data: {
            idpaquete: paquete.idpaquete,
            idservicio: data.idservicioGarantizado,
          },
        });
      }

      // 4. Devolver el paquete completo con relaciones
      return tx.paquete.findUnique({
        where: { idpaquete: paquete.idpaquete },
        include: {
          circuito: true,
          tarifas: { include: { temporada: true } },
          servicios: { include: { servicio: true } },
          garantiasEstablecimiento: {
            include: { servicio: { include: { alojamiento: true } } },
          },
        },
      });
    });
  }

  async update(
    id: number,
    data: Record<string, any>,
    serviciosIncluidos?: number[],
    idservicioGarantizado?: number | null,
    tipoGarantia?: string,
  ) {
    return db.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.paquete.update({
          where: { idpaquete: id },
          data,
        });
      }

      if (serviciosIncluidos !== undefined) {
        await tx.paqueteServicio.deleteMany({ where: { idpaquete: id } });
        if (serviciosIncluidos.length > 0) {
          await tx.paqueteServicio.createMany({
            data: serviciosIncluidos.map((idservicio) => ({
              idpaquete: id,
              idservicio,
            })),
          });
        }
      }

      if (tipoGarantia === "POR_CATEGORIA") {
        await tx.garantiaEstablecimiento.deleteMany({ where: { idpaquete: id } });
      } else if (idservicioGarantizado) {
        await tx.garantiaEstablecimiento.upsert({
          where: { idpaquete: id },
          update: { idservicio: idservicioGarantizado },
          create: { idpaquete: id, idservicio: idservicioGarantizado },
        });
      }

      return tx.paquete.findUnique({
        where: { idpaquete: id },
        include: {
          circuito: true,
          tarifas: { include: { temporada: true } },
          servicios: { include: { servicio: true } },
          garantiasEstablecimiento: {
            include: { servicio: { include: { alojamiento: true } } },
          },
        },
      });
    });
  }

  // CAT-06: Modificar tarifas actualiza o agrega las enviadas sin borrar las existentes
  async reemplazarTarifas(idpaquete: number, matrizPrecios: PrecioTemporada[]) {
    return db.$transaction(async (tx) => {
      for (const p of matrizPrecios) {
        await tx.tarifaPaquete.upsert({
          where: {
            idpaquete_idtemporada: {
              idpaquete,
              idtemporada: p.idtemporada,
            },
          },
          update: {
            monto: p.monto,
            moneda: p.moneda,
          },
          create: {
            idpaquete,
            idtemporada: p.idtemporada,
            monto: p.monto,
            moneda: p.moneda,
          },
        });
      }
    });
  }

  async updateEstado(id: number, estado: string) {
    return db.paquete.update({
      where: { idpaquete: id },
      data: { estado },
    });
  }

  // CAT-02: Considera todas las salidas activas, incluyendo PUBLICADA
  async tieneSalidasActivas(id: number): Promise<boolean> {
    const count = await db.salida.count({
      where: {
        idpaquete: id,
        estado: { in: SALIDAS_ACTIVAS },
      },
    });
    return count > 0;
  }

  async contarPaquetes(): Promise<number> {
    return db.paquete.count();
  }
}
