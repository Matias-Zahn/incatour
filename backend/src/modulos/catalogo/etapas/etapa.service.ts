import { CustomError } from "../../../error/CustomError";
import { EstablecerSecuenciaDto, EtapaIndividualDto } from "./etapa.dto";
import { EtapaRepository } from "./etapa.repository";
import { db } from "../../../config/postgresDatabase";
import { SALIDAS_ACTIVAS } from "../../../shared/constantes";

export class EtapaService {
  private repository = new EtapaRepository();

  async registrarSecuenciaEtapas(circuitoId: number, dto: EstablecerSecuenciaDto) {
    const etapas = dto.etapas;

    // 1. Validar que el circuito existe y está activo
    const circuito = await db.circuito.findUnique({
      where: { idcircuito: circuitoId }
    });
    
    if (!circuito || circuito.estado !== "ACTIVO") {
      throw CustomError.notFound("El circuito no existe o no está activo.");
    }

    // 2. Validar que el circuito no tenga reservas/paquetes activos
    // DSS: validarCircuitoSinReservasActivas(circuitoId)
    const tienePaquetesActivos = await this.repository.circuitoTienePaquetesActivos(circuitoId);
    if (tienePaquetesActivos) {
      throw CustomError.badRequest("No se pueden modificar las etapas: el circuito ya tiene paquetes comerciales activos.");
    }

    // CAT-18: las etapas con avances informados por un guía no se pueden borrar (FK de Avance)
    if (await db.avance.count({ where: { idcircuito: circuitoId } })) {
      throw CustomError.badRequest("No se pueden modificar las etapas: ya hay avances de salidas registrados sobre este circuito.");
    }

    // CAT-28: una salida programada conserva su itinerario (RF-07), aunque su paquete ya no esté activo
    if (await db.salida.count({ where: { paquete: { idcircuito: circuitoId }, estado: { in: SALIDAS_ACTIVAS } } })) {
      throw CustomError.badRequest("No se pueden modificar las etapas: el circuito tiene salidas programadas.");
    }

    // 3. DSS: validarCorrelatividadTemporal(arrayEtapas)
    // El orden debe ser secuencial (1, 2, 3...) sin saltos.
    const ordenes = etapas.map(e => e.numeroOrden).sort((a, b) => a - b);
    for (let i = 0; i < ordenes.length; i++) {
      if (ordenes[i] !== i + 1) {
        throw CustomError.badRequest(`La correlatividad temporal falló. Se esperaba la etapa ${i + 1} pero se encontró la ${ordenes[i]}.`);
      }
    }

    // Ordenamos el array original por numeroOrden para la validación espacial
    const etapasOrdenadas = [...etapas].sort((a, b) => a.numeroOrden - b.numeroOrden);

    // 4. DSS: validarContinuidadEspacial(arrayEtapas)
    // El fin de la etapa N debe ser el inicio de la etapa N+1
    for (let i = 0; i < etapasOrdenadas.length - 1; i++) {
      const etapaActual = etapasOrdenadas[i]!;
      const etapaSiguiente = etapasOrdenadas[i + 1]!;

      if (etapaActual.puntoFin !== etapaSiguiente.puntoInicio) {
        throw CustomError.badRequest(
          `Discontinuidad espacial: El fin de la etapa ${etapaActual.numeroOrden} ('${etapaActual.puntoFin}') no coincide con el inicio de la etapa ${etapaSiguiente.numeroOrden} ('${etapaSiguiente.puntoInicio}').`
        );
      }
    }

    // 5. DSS: Persistencia atómica de la entidad raíz modificada
    return this.repository.reemplazarSecuenciaEtapas(circuitoId, etapasOrdenadas);
  }

  async consultarEtapas(circuitoId: number) {
    const circuito = await db.circuito.findUnique({
      where: { idcircuito: circuitoId }
    });
    
    if (!circuito) {
      throw CustomError.notFound("El circuito no existe.");
    }

    return this.repository.getByCircuitoId(circuitoId);
  }
}
