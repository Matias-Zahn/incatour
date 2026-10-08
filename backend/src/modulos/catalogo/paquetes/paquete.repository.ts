import { db } from "../../../config/postgresDatabase";

interface PrecioTemporada {
  idtemporada: number;
  monto: number;
  moneda: string;
}

export class PaqueteRepository {
  async findAll() {
    return db.paquete.findMany({
      where: { estado: "ACTIVO" },
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
        servicioGarantizado: {
          include: { alojamiento: true },
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
          idservicioGarantizado: data.idservicioGarantizado || null,
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

      // 4. Devolver el paquete completo con relaciones
      return tx.paquete.findUnique({
        where: { idpaquete: paquete.idpaquete },
        include: {
          circuito: true,
          tarifas: { include: { temporada: true } },
          servicios: { include: { servicio: true } },
        },
      });
    });
  }

  async update(id: number, data: Record<string, any>) {
    return db.paquete.update({
      where: { idpaquete: id },
      data,
      include: {
        circuito: true,
        tarifas: { include: { temporada: true } },
      },
    });
  }

  async reemplazarTarifas(idpaquete: number, matrizPrecios: PrecioTemporada[]) {
    return db.$transaction(async (tx) => {
      await tx.tarifaPaquete.deleteMany({ where: { idpaquete } });
      await tx.tarifaPaquete.createMany({
        data: matrizPrecios.map((p) => ({
          idpaquete,
          idtemporada: p.idtemporada,
          monto: p.monto,
          moneda: p.moneda,
        })),
      });
    });
  }

  async updateEstado(id: number, estado: string) {
    return db.paquete.update({
      where: { idpaquete: id },
      data: { estado },
    });
  }

  async tieneSalidasActivas(id: number): Promise<boolean> {
    const count = await db.salida.count({
      where: {
        idpaquete: id,
        estado: { in: ["ABIERTA", "CERRADA", "EN_CURSO"] },
      },
    });
    return count > 0;
  }

  async contarPaquetes(): Promise<number> {
    return db.paquete.count();
  }
}
