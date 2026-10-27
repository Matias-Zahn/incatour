import { Prisma } from "@prisma/client";
import { CustomError } from "../../../error/CustomError";
import { db } from "../../../config/postgresDatabase";
import { CrearPaqueteDto, ModificarPaqueteDto } from "./paquete.dto";
import { FiltrosPaquete, PaqueteRepository } from "./paquete.repository";

export class PaqueteService {
  private repository = new PaqueteRepository();

  async consultarPaquetes(filtros?: FiltrosPaquete) {
    return this.repository.findAll(filtros);
  }

  // CAT-24: el detalle del admin (GET /paquetes/:id) también muestra los inactivos que lista con ?estado=INACTIVO
  async consultarPaquetePorId(id: number, incluirInactivos = false) {
    const paquete = await this.repository.findById(id);
    if (!paquete || (!incluirInactivos && paquete.estado !== "ACTIVO")) {
      throw CustomError.notFound("Paquete no encontrado o inactivo.");
    }
    return paquete;
  }

  /**
   * CU-11: Crear Paquete Turístico.
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

    // 6 y 7. Generar nroPaquete y guardar(p) de forma atómica.
    // CAT-23: si otro alta tomó el mismo número (o hay un hueco), se reintenta con el siguiente
    for (let intento = 0; ; intento++) {
      const nroPaquete = await this.generarNroPaquete(intento);
      try {
        return await this.guardar(dto, nroPaquete);
      } catch (error) {
        const choque = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (!choque || intento >= 4) throw error;
      }
    }
  }

  private guardar(dto: CrearPaqueteDto, nroPaquete: string) {
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
        diasMinimosReintegro: dto.diasMinimosReintegro ?? null,
      },
      dto.matrizPrecios,
      dto.serviciosIncluidos ?? []
    );
  }

  /**
   * CU-12: Modificar Paquete Turístico.
   * Flujo Básico: modificar datos + reemplazar matriz de precios (si viene).
   * RN: El cambio de precios rige solo para salidas futuras (nuevas reservas).
   */
  async modificarPaquete(id: number, dto: ModificarPaqueteDto) {
    const paquete = await this.repository.findById(id);
    if (!paquete || paquete.estado !== "ACTIVO") {
      throw CustomError.notFound("Paquete no encontrado o inactivo.");
    }

    // Validar circuito si se cambia
    if (dto.idcircuito && dto.idcircuito !== paquete.idcircuito) {
      // CAT-05 / CAT-35: las salidas siguen recorriendo el circuito con el que se vendieron, también las ya realizadas
      // (su historial e itinerario lo leen del circuito del paquete). Solo las canceladas no lo frenan.
      if (await this.repository.tieneSalidasNoCanceladas(id)) {
        throw CustomError.badRequest(
          "No se puede cambiar el circuito de un paquete que tiene salidas programadas o realizadas: creá un paquete nuevo."
        );
      }
      const circuito = await db.circuito.findUnique({
        where: { idcircuito: dto.idcircuito },
      });
      if (!circuito || circuito.estado !== "ACTIVO") {
        throw CustomError.badRequest("El circuito no existe o no está activo.");
      }
      // CAT-17: la misma precondición que el alta
      if ((await db.etapaRuta.count({ where: { idcircuito: dto.idcircuito } })) === 0) {
        throw CustomError.badRequest("El circuito debe tener etapas establecidas antes de asignarlo a un paquete.");
      }
    }

    // Si mandan idservicioGarantizado o cambian a POR_ESTABLECIMIENTO, validar
    const tipoGarantiaFinal = dto.tipoGarantia ?? paquete.tipoGarantia;
    const idGarantizadoActual = paquete.garantiasEstablecimiento?.[0]?.idservicio;
    const idGarantizadoFinal = dto.idservicioGarantizado !== undefined ? dto.idservicioGarantizado : idGarantizadoActual;

    if (tipoGarantiaFinal === "POR_ESTABLECIMIENTO") {
      if (!idGarantizadoFinal) {
        throw CustomError.badRequest("Debe indicar el servicio de alojamiento a garantizar.");
      }
      await this.validarGarantiaAlojamiento(idGarantizadoFinal);
    }

    // CAT-08/CAT-14: por categoría se valida el estado final (RF-06) y no puede quedar un hotel garantizado
    if (tipoGarantiaFinal === "POR_CATEGORIA") {
      if (dto.idservicioGarantizado != null) {
        throw CustomError.badRequest("Con garantía por categoría, no debe indicarse idservicioGarantizado.");
      }
      if (!(dto.localidadGarantizada ?? paquete.localidadGarantizada)) {
        throw CustomError.badRequest("Con garantía por categoría, localidadGarantizada es obligatoria.");
      }
      if (!(dto.categoriaGarantizada ?? paquete.categoriaGarantizada)) {
        throw CustomError.badRequest("Con garantía por categoría, categoriaGarantizada es obligatoria.");
      }
      if (!(dto.tipoHabitacionGarantizada ?? paquete.tipoHabitacionGarantizada)) {
        throw CustomError.badRequest("Con garantía por categoría, tipoHabitacionGarantizada es obligatoria.");
      }
    }

    // Validar servicios incluidos si se envían
    if (dto.serviciosIncluidos && dto.serviciosIncluidos.length > 0) {
      await this.validarServiciosExisten(dto.serviciosIncluidos);
    }

    // CAT-16: las temporadas de la matriz se validan antes de escribir nada, para no dejar el paquete a medias
    if (dto.matrizPrecios && dto.matrizPrecios.length > 0) {
      await this.validarViabilidadComercial(dto.matrizPrecios);
    }

    // 1. Actualizar datos básicos
    const dataUpdate: any = {};
    if (dto.idcircuito) dataUpdate.idcircuito = dto.idcircuito;
    if (dto.nombrePaquete) dataUpdate.nombrePaquete = dto.nombrePaquete;
    if (dto.condiciones !== undefined) dataUpdate.condiciones = dto.condiciones;
    if (dto.tipoGarantia) dataUpdate.tipoGarantia = dto.tipoGarantia;
    if (dto.localidadGarantizada !== undefined) dataUpdate.localidadGarantizada = dto.localidadGarantizada;
    if (dto.categoriaGarantizada !== undefined) dataUpdate.categoriaGarantizada = dto.categoriaGarantizada;
    if (dto.tipoHabitacionGarantizada !== undefined) dataUpdate.tipoHabitacionGarantizada = dto.tipoHabitacionGarantizada;
    if (dto.nochesPrevias !== undefined) dataUpdate.nochesPrevias = dto.nochesPrevias;
    if (dto.nochesPosteriores !== undefined) dataUpdate.nochesPosteriores = dto.nochesPosteriores;
    if (dto.diasDisponibles !== undefined) dataUpdate.diasDisponibles = dto.diasDisponibles;
    if (dto.diasMinimosReintegro !== undefined) dataUpdate.diasMinimosReintegro = dto.diasMinimosReintegro;

    const hasData = Object.keys(dataUpdate).length > 0;
    const hasServicios = dto.serviciosIncluidos !== undefined;
    const hasGarantia = dto.idservicioGarantizado !== undefined || dto.tipoGarantia !== undefined;

    if (hasData || hasServicios || hasGarantia) {
      await this.repository.update(
        id,
        dataUpdate,
        dto.serviciosIncluidos,
        dto.idservicioGarantizado,
        dto.tipoGarantia
      );
    }

    // 2. Si viene matrizPrecios, reemplazar tarifas (CAT-06); las temporadas ya se validaron arriba
    if (dto.matrizPrecios && dto.matrizPrecios.length > 0) {
      await this.repository.reemplazarTarifas(id, dto.matrizPrecios);
    }

    return this.repository.findById(id);
  }

  /**
   * CU-13: Baja de Paquete Turístico (Baja Lógica).
   * RN: No se puede dar de baja si tiene salidas activas (PUBLICADA, ABIERTA, CERRADA, EN_CURSO).
   */
  async darDeBajaPaquete(id: number) {
    const paquete = await this.repository.findById(id);
    if (!paquete || paquete.estado !== "ACTIVO") {
      throw CustomError.notFound("Paquete no encontrado o inactivo.");
    }

    // RN: Control de salidas activas asociadas (CAT-02)
    const tieneSalidas = await this.repository.tieneSalidasActivas(id);
    if (tieneSalidas) {
      throw CustomError.badRequest(
        "No se puede dar de baja el paquete porque tiene salidas activas asociadas."
      );
    }

    return this.repository.updateEstado(id, "INACTIVO");
  }

  // ==================== MÉTODOS PRIVADOS DE VALIDACIÓN (DSS) ====================

  /**
   * DSS: h = buscarPorId(alojamientoId) + validarGarantiaAlojamiento
   * RN: Garantía Estricta de Alojamiento.
   * Flujo Básico: Requiere que el alojamiento exista, esté activo y su modalidad
   *     de confirmación sea por "bloqueo de plazas".
   * Flujo Alternativo 2: Establecimiento que confirma a solicitud → RECHAZO.
   */
  private async validarGarantiaAlojamiento(idservicio: number) {
    const servicio = await db.servicioBase.findUnique({
      where: { idservicio: idservicio },
      include: { alojamiento: true, proveedor: true },
    });

    if (!servicio || servicio.estado !== "ACTIVO" || (servicio.proveedor && servicio.proveedor.estado !== "ACTIVO")) {
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
   * Valida que los servicios incluidos existan, estén activos y pertenezcan a un proveedor activo (CAT-10).
   */
  private async validarServiciosExisten(ids: number[]) {
    for (const idservicio of ids) {
      const servicio = await db.servicioBase.findUnique({
        where: { idservicio },
        include: { proveedor: true },
      });
      if (!servicio || servicio.estado !== "ACTIVO" || (servicio.proveedor && servicio.proveedor.estado !== "ACTIVO")) {
        throw CustomError.badRequest(
          `El servicio con ID ${idservicio} no existe o no está activo.`
        );
      }
    }
  }

  /**
   * Genera un número de paquete auto-incremental (PKG-0001, PKG-0002, etc.).
   */
  private async generarNroPaquete(intento = 0): Promise<string> {
    const total = await this.repository.contarPaquetes();
    const numero = (total + 1 + intento).toString().padStart(4, "0");
    return `PKG-${numero}`;
  }
}
