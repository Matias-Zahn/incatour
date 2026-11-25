import { Prisma } from "@prisma/client";
import { CustomError } from "../../../error/CustomError";
import { db } from "../../../config/postgresDatabase";
import { TIPO_SERVICIO, TipoServicio, tipoDeServicio } from "../../../shared/constantes";
import { claveDia } from "../../../shared/ocupacion";
import { diasHabilitados, fechaMinimaInicio } from "../../../shared/ventaAbierta";
import { CrearPaqueteDto, ModificarPaqueteDto, ServiciosPaquete } from "./paquete.dto";
import { FiltrosPaquete, PaqueteDetalle, PaqueteRepository, ReemplazoServicios } from "./paquete.repository";

type ConServicios = { servicios: { servicio: Parameters<typeof tipoDeServicio>[0] }[] };

/** B2: cada servicio con su tipo, y el aviso de los paquetes viejos que no tienen transporte. */
export function formatearPaquete<P extends ConServicios>(p: P) {
  const servicios = p.servicios.map((ps) => ({ ...ps, tipo: tipoDeServicio(ps.servicio) }));
  return { ...p, servicios, faltaTransporte: !servicios.some((s) => s.tipo === TIPO_SERVICIO.TRANSPORTE) };
}

/** B9 y 12.6: los días que el asistente de crear salida deja elegir. Las reglas viven en shared/ventaAbierta. */
function calendarioSalidas(p: PaqueteDetalle) {
  const tren = p.servicios.find((s) => s.servicio.tren)?.servicio;
  return {
    diasHabilitados: diasHabilitados({
      diasDisponibles: p.diasDisponibles,
      tren: tren?.tren && { nombreServicio: tren.nombreServicio, diasOperacion: tren.tren.diasOperacion },
    }),
    fechaMinima: claveDia(fechaMinimaInicio(p.diasCierreVenta)),
  };
}

const NOMBRE_TIPO: Partial<Record<TipoServicio, string>> = { TRANSPORTE: "un transporte", TREN: "un tren", EQUIPAMIENTO: "un equipamiento" };

export class PaqueteService {
  private repository = new PaqueteRepository();

  async consultarPaquetes(filtros?: FiltrosPaquete) {
    return (await this.repository.findAll(filtros)).map(formatearPaquete);
  }

  // CAT-24: el detalle del admin (GET /paquetes/:id) también muestra los inactivos que lista con ?estado=INACTIVO
  async consultarPaquetePorId(id: number, incluirInactivos = false) {
    const paquete = await this.repository.findById(id);
    if (!paquete || (!incluirInactivos && paquete.estado !== "ACTIVO")) {
      throw CustomError.notFound("Paquete no encontrado o inactivo.");
    }
    return { ...formatearPaquete(paquete), calendarioSalidas: calendarioSalidas(paquete) };
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

    // 3. DSS: h = buscarPorId(alojamientoId) + validarGarantiaAlojamiento (B2: en la localidad de "Sale desde")
    if (dto.tipoGarantia === "POR_ESTABLECIMIENTO") {
      await this.validarGarantiaAlojamiento(dto.idservicioGarantizado!, dto.localidadGarantizada!);
    }

    // 4. DSS: validarViabilidadComercial(matrizPrecios)
    await this.validarViabilidadComercial(dto.matrizPrecios);

    // 5. B2: el transporte, el tren y el equipo tienen que existir, estar activos y ser de ese tipo
    await this.validarServiciosPaquete(dto.servicios);

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
        diasCierreVenta: dto.diasCierreVenta,
        ...dto.porteador,
      },
      dto.matrizPrecios,
      [
        { idservicio: dto.servicios.idtransporte! },
        ...(dto.servicios.idtren ? [{ idservicio: dto.servicios.idtren }] : []),
        ...(dto.servicios.equipo ?? []),
      ]
    ).then(formatearPaquete);
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
      await this.validarGarantiaAlojamiento(idGarantizadoFinal, dto.localidadGarantizada ?? paquete.localidadGarantizada);
    }

    // CAT-08/CAT-14: por categoría se valida el estado final (RF-06) y no puede quedar un hotel garantizado
    if (tipoGarantiaFinal === "POR_CATEGORIA") {
      if (dto.idservicioGarantizado != null) {
        throw CustomError.badRequest("Con garantía por categoría, no debe indicarse idservicioGarantizado.");
      }
      if (!(dto.categoriaGarantizada ?? paquete.categoriaGarantizada)) {
        throw CustomError.badRequest("Con garantía por categoría, categoriaGarantizada es obligatoria.");
      }
      if (!(dto.tipoHabitacionGarantizada ?? paquete.tipoHabitacionGarantizada)) {
        throw CustomError.badRequest("Con garantía por categoría, tipoHabitacionGarantizada es obligatoria.");
      }
    }

    // B2: los tipos que vienen se validan y se reemplazan enteros
    await this.validarServiciosPaquete(dto.servicios);
    const { idtransporte, idtren, equipo } = dto.servicios;
    const reemplazos: ReemplazoServicios = {};
    if (idtransporte !== undefined) reemplazos.transporte = [{ idservicio: idtransporte }];
    if (idtren !== undefined) reemplazos.tren = idtren ? [{ idservicio: idtren }] : [];
    if (equipo !== undefined) reemplazos.equipamiento = equipo;

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
    if (dto.diasCierreVenta !== undefined) dataUpdate.diasCierreVenta = dto.diasCierreVenta;
    Object.assign(dataUpdate, dto.porteador);

    const hasData = Object.keys(dataUpdate).length > 0;
    const hasServicios = Object.keys(reemplazos).length > 0;
    const hasGarantia = dto.idservicioGarantizado !== undefined || dto.tipoGarantia !== undefined;

    if (hasData || hasServicios || hasGarantia) {
      await this.repository.update(
        id,
        dataUpdate,
        reemplazos,
        dto.idservicioGarantizado,
        dto.tipoGarantia
      );
    }

    // 2. Si viene matrizPrecios, reemplazar tarifas (CAT-06); las temporadas ya se validaron arriba
    if (dto.matrizPrecios && dto.matrizPrecios.length > 0) {
      await this.repository.reemplazarTarifas(id, dto.matrizPrecios);
    }

    return formatearPaquete((await this.repository.findById(id))!);
  }

  /**
   * CU-13: Baja de Paquete Turístico (Baja Lógica).
   * RN: No se puede dar de baja si tiene salidas activas (PUBLICADA, CERRADA, EN_CURSO).
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
  private async validarGarantiaAlojamiento(idservicio: number, saleDesde: string) {
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

    // B2: el hotel garantizado está en la ciudad de "Sale desde"
    if (servicio.localidad !== saleDesde) {
      throw CustomError.badRequest(`El hotel garantizado está en ${servicio.localidad} y el paquete sale desde ${saleDesde}.`);
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

  /** B2: los servicios del paquete existen, están activos, son de un proveedor activo (CAT-10) y son del tipo de su campo. */
  private async validarServiciosPaquete({ idtransporte, idtren, equipo }: ServiciosPaquete) {
    if (idtransporte !== undefined) await this.validarServicioDeTipo(idtransporte, TIPO_SERVICIO.TRANSPORTE);
    if (idtren) await this.validarServicioDeTipo(idtren, TIPO_SERVICIO.TREN);
    for (const e of equipo ?? []) await this.validarServicioDeTipo(e.idservicio, TIPO_SERVICIO.EQUIPAMIENTO);
  }

  private async validarServicioDeTipo(idservicio: number, tipo: TipoServicio) {
    const servicio = await db.servicioBase.findUnique({
      where: { idservicio },
      include: { proveedor: true, alojamiento: true, transporte: true, tren: true, equipamiento: true },
    });
    if (!servicio || servicio.estado !== "ACTIVO" || (servicio.proveedor && servicio.proveedor.estado !== "ACTIVO")) {
      throw CustomError.badRequest(`El servicio con ID ${idservicio} no existe o no está activo.`);
    }
    if (tipoDeServicio(servicio) !== tipo) throw CustomError.badRequest(`El servicio con ID ${idservicio} no es ${NOMBRE_TIPO[tipo]}.`);
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
