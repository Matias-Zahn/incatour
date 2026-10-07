import { db } from "../../../config/postgresDatabase";
import { EtapaIndividualDto } from "./etapa.dto";

export class EtapaRepository {
  async getByCircuitoId(idcircuito: number) {
    return db.etapaRuta.findMany({
      where: { idcircuito },
      orderBy: { numeroOrden: "asc" },
    });
  }

  async reemplazarSecuenciaEtapas(idcircuito: number, etapas: EtapaIndividualDto[]) {
    // DSS: Persistencia atómica de la entidad raíz modificada
    return db.$transaction(async (tx) => {
      // 1. Borramos las etapas viejas
      await tx.etapaRuta.deleteMany({
        where: { idcircuito },
      });

      // 2. Insertamos las nuevas
      const nuevasEtapas = etapas.map(e => ({
        idcircuito: idcircuito,
        numeroOrden: e.numeroOrden,
        puntoInicio: e.puntoInicio,
        puntoFin: e.puntoFin,
        campamentoPrevisto: e.campamentoPrevisto || null,
      }));

      await tx.etapaRuta.createMany({
        data: nuevasEtapas,
      });

      // Devolvemos las etapas recién insertadas para confirmación
      return tx.etapaRuta.findMany({
        where: { idcircuito },
        orderBy: { numeroOrden: "asc" },
      });
    });
  }

  async circuitoTienePaquetesActivos(idcircuito: number): Promise<boolean> {
    const count = await db.paquete.count({
      where: {
        idcircuito,
        estado: "ACTIVO",
      },
    });
    return count > 0;
  }
}
