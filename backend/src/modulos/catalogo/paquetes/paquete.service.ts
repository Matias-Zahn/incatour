import { CustomError } from "../../../error/CustomError";
import { db } from "../../../config/postgresDatabase";
import { CrearPaqueteDto, ModificarPaqueteDto } from "./paquete.dto";
import { PaqueteRepository } from "./paquete.repository";

export class PaqueteService {
  private repository = new PaqueteRepository();

  async consultarPaquetes() {
    return this.repository.findAll();
  }

  async consultarPaquetePorId(id: number) {
    const paquete = await this.repository.findById(id);
    if (!paquete || paquete.estado !== "ACTIVO") {
      throw CustomError.notFound("Paquete no encontrado o inactivo.");
    }
    return paquete;
  }

  /**
   * CU-10: Crear Paquete Turístico.
   * Sigue estrictamente el DSS: registrarNuevoPaquete(datosPaquete, alojamientoId, tipoGarantia, matrizPrecios)
   */
  async registrarNuevoPaquete(dto: CrearPaqueteDto) {
    // 1. Validar que el circuito existe y está activo
    const circuito = await db.circuito.findUnique({
      where: { idcircuito: dto.idcircuito },
    });
    if (!circuito || circuito.estado !== "ACTIVO") {
      throw CustomError.notFound("El circuito no existe o no está activo.");
    }

    // 2. Validar que el circuito tenga etapas establecidas (Precondición del CU)
    const etapas = await db.etapaRuta.count({ where: { idcircuito: dto.idcircuito } });
    if (etapas === 0) {
      throw CustomError.badRequest("El circuito debe tener etapas establecidas antes de crear un paquete.");
    }

    // 3. DSS: h = buscarPorId(alojamientoId) + validarGarantiaAlojamiento
    if (dto.tipoGarantia === "POR_ESTABLECIMIENTO") {
      await this.validarGarantiaAlojamiento(dto.idservicioGarantizado!);
    }

    // 4. DSS: validarViabilidadComercial(matrizPrecios)
    await this.validarViabilidadComercial(dto.matrizPrecios);

    // 5. Validar servicios incluidos (si vienen)
    if (dto.serviciosIncluidos && dto.serviciosIncluidos.length > 0) {
      await this.validarServiciosExisten(dto.serviciosIncluidos);
    }

    // 6. Generar nroPaquete automáticamente
    const nroPaquete = await this.generarNroPaquete();

    // 7. DSS: guardar(p) — Persistencia atómica
    return this.repository.guardar(
      {
        nroPaquete,
        idcircuito: dto.idcircuito,
        nombrePaquete: dto.nombrePaquete,
        condiciones: dto.condiciones,
        estado: "ACTIVO",
        tipoGarantia: dto.tipoGarantia,
        idservicioGarantizado: dto.idservicioGarantizado,
        localidadGarantizada: dto.localidadGarantizada,
        categoriaGarantizada: dto.categoriaGarantizada,
        tipoHabitacionGarantizada: dto.tipoHabitacionGarantizada,
        nochesPrevias: dto.nochesPrevias ?? 0,
        nochesPosteriores: dto.nochesPosteriores ?? 0,
        diasDisponibles: dto.diasDisponibles,
      },
      dto.matrizPrecios,
      dto.serviciosIncluidos ?? [],
    );
  }

  /**
   * CU-12: Modificar Paquete.
   */
  async modificarPaquete(id: number, dto: ModificarPaqueteDto) {
    const paquete = await this.repository.findById(id);
    if (!paquete || paquete.estado !== "ACTIVO") {
      throw CustomError.notFound("Paquete no encontrado o inactivo.");
    }

    // Construimos los datos a actualizar
    const dataUpdate: Record<string, any> = {};
    if (dto.nombrePaquete) dataUpdate.nombrePaquete = dto.nombrePaquete;
    if (dto.condiciones !== undefined) dataUpdate.condiciones = dto.condiciones;
    if (dto.nochesPrevias != null) dataUpdate.nochesPrevias = dto.nochesPrevias;
    if (dto.nochesPosteriores != null) dataUpdate.nochesPosteriores = dto.nochesPosteriores;
    if (dto.diasDisponibles !== undefined) dataUpdate.diasDisponibles = dto.diasDisponibles;

    // Si mandan nueva matriz de precios, reemplazamos las tarifas
    if (dto.matrizPrecios) {
      await this.validarViabilidadComercial(dto.matrizPrecios);
      await this.repository.reemplazarTarifas(id, dto.matrizPrecios);
    }

    // Si hay datos del paquete para actualizar
    if (Object.keys(dataUpdate).length > 0) {
      return this.repository.update(id, dataUpdate);
    }

    // Si solo se modificaron tarifas, devolver el paquete actualizado
    return this.repository.findById(id);
  }

  /**
   * CU-13: Baja de Paquete.
   * RN: No se puede dar de baja si tiene salidas activas.
   */
  async darDeBajaPaquete(id: number) {
    const paquete = await this.repository.findById(id);
    if (!paquete || paquete.estado !== "ACTIVO") {
      throw CustomError.notFound("Paquete no encontrado o ya inactivo.");
    }

    const tieneSalidas = await this.repository.tieneSalidasActivas(id);
    if (tieneSalidas) {
      throw CustomError.badRequest("No se puede dar de baja porque tiene salidas activas (abiertas, cerradas o en curso).");
    }

    return this.repository.updateEstado(id, "INACTIVO");
  }

  // ======================================================
  // MÉTODOS PRIVADOS DE VALIDACIÓN (DSS)
  // ======================================================

  /**
   * DSS: validarGarantiaAlojamiento(tipoGarantia, h.modalidadConfirmacion)
   * RN: Solo puede indicarse un establecimiento determinado cuando su modalidad
   *     de confirmación sea por "bloqueo de plazas".
   * Flujo Alternativo 2: Establecimiento que confirma a solicitud → RECHAZO.
   */
  private async validarGarantiaAlojamiento(idservicio: number) {
    const servicio = await db.servicioBase.findUnique({
      where: { idservicio: idservicio },
      include: { alojamiento: true },
    });

    if (!servicio || servicio.estado !== "ACTIVO") {
      throw CustomError.notFound("El servicio de alojamiento garantizado no existe o no está activo.");
    }

    if (!servicio.alojamiento) {
      throw CustomError.badRequest("El servicio seleccionado no es un servicio de alojamiento.");
    }

    // RN: Garantía Estricta de Alojamiento
    if (servicio.alojamiento.modalidadConfirmacion !== "BLOQUEO_PLAZAS") {
      throw CustomError.badRequest(
        "El servicio de alojamiento seleccionado confirma 'a solicitud'. " +
        "Solo se puede garantizar por establecimiento cuando la modalidad es por 'bloqueo de plazas'. " +
        "Cambie la garantía a 'por categoría' o elija otro establecimiento."
      );
    }
  }

  /**
   * DSS: validarViabilidadComercial(matrizPrecios)
   * RN: El sistema prohíbe la creación de paquetes sin precio.
   * Verifica que las temporadas referenciadas existan y estén activas.
   */
  private async validarViabilidadComercial(matrizPrecios: { idtemporada: number; monto: number; moneda: string }[]) {
    for (const precio of matrizPrecios) {
      const temporada = await db.temporada.findUnique({
        where: { idtemporada: precio.idtemporada },
      });

      if (!temporada || temporada.estado !== "ACTIVO") {
        throw CustomError.badRequest(
          `La temporada con ID ${precio.idtemporada} no existe o no está activa.`
        );
      }
    }
  }

  /**
   * Valida que los servicios incluidos existan y estén activos.
   */
  private async validarServiciosExisten(ids: number[]) {
    for (const idservicio of ids) {
      const servicio = await db.servicioBase.findUnique({
        where: { idservicio },
      });
      if (!servicio || servicio.estado !== "ACTIVO") {
        throw CustomError.badRequest(
          `El servicio con ID ${idservicio} no existe o no está activo.`
        );
      }
    }
  }

  /**
   * Genera un número de paquete auto-incremental (PKG-0001, PKG-0002, etc.).
   */
  private async generarNroPaquete(): Promise<string> {
    const total = await this.repository.contarPaquetes();
    const numero = (total + 1).toString().padStart(4, "0");
    return `PKG-${numero}`;
  }
}
