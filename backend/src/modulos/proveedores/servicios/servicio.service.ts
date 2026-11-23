import { CustomError } from "../../../error/CustomError";
import { ESTADO, MODALIDAD_BLOQUEO_PLAZAS, ESTADO_SALIDA, TIPO_SERVICIO, TipoServicio, tipoDeServicio } from "../../../shared/constantes";
import { hoyUTC } from "../../../shared/fechas";
import { claveDia, OcupacionDias, ocupadoPorDia, totalDe } from "../../../shared/ocupacion";
import { CAMPOS_MODIFICAR, CrearServicioDto, FiltrosServicioDto, ModificarServicioDto, RangoOcupacionDto } from "./servicio.dto";
import { ServicioRepository } from "./servicio.repository";

type ServicioCompleto = NonNullable<Awaited<ReturnType<ServicioRepository["findById"]>>>;

const CAMPOS_BASE_EDITABLES = ["nombreServicio", "descripcion", "costoBase", "localidad"];

export class ServicioService {
  private repository: ServicioRepository;

  constructor() {
    this.repository = new ServicioRepository();
  }

  // CU-18: Consultar servicios de un proveedor
  async consultarServiciosProveedor(idproveedor: number, filtros: FiltrosServicioDto) {
    const proveedor = await this.repository.findProveedor(idproveedor);
    if (!proveedor) throw CustomError.notFound(`No se encontró el proveedor con ID ${idproveedor}.`);

    const servicios = await this.repository.findByProveedor(idproveedor, filtros.estado);
    const ocupaciones = await this.repository.ocupacionesDesdeHoy(servicios.map((s) => s.idservicio));

    return servicios.map((s) => this.formatear(s, ocupaciones.filter((o) => o.idservicio === s.idservicio)));
  }

  // DCD: solicitarEdicionServicio. Devuelve los datos actuales + qué se puede editar y qué restricciones hay.
  async obtenerServicio(id: number) {
    const servicio = await this.buscarOFallar(id);
    const tipo = tipoDeServicio(servicio) as TipoServicio;

    const ocupaciones = await this.repository.ocupacionesDesdeHoy([id]);
    const enUso = (await this.repository.contarSalidasActivas(id)) > 0;
    const garantiza = (await this.repository.contarGarantiasDePaquetesActivos(id)) > 0;

    return {
      ...this.formatear(servicio, ocupaciones),
      edicion: {
        camposEditables: [...CAMPOS_BASE_EDITABLES, ...Object.keys(CAMPOS_MODIFICAR[tipo])],
        enUsoEnSalidasActivas: enUso,
        garantizaPaquetesActivos: garantiza,
      },
    };
  }

  // A1: GET /api/servicios/:id/ocupacion. Lo ocupado y disponible de cada día y las salidas que lo usaron (historial)
  async consultarOcupacion(id: number, { desde, hasta }: RangoOcupacionDto) {
    const servicio = await this.buscarOFallar(id);
    const historial = await this.repository.historialOcupacion(id, desde, hasta);
    // Para el día cuentan todas hasta su `hasta`, también las finalizadas (noches posteriores y reacondicionamiento)
    const activas = historial.filter((o) => o.salida.estado !== ESTADO_SALIDA.CANCELADA);
    const total = totalDe(servicio);
    return {
      total,
      dias: [...ocupadoPorDia(activas, desde, hasta)].map(([fecha, ocupado]) => ({ fecha, ocupado, disponible: total - ocupado })),
      ocupaciones: historial.map((o) => ({
        nroSalida: o.salida.nroSalida,
        desde: claveDia(o.desde),
        hasta: claveDia(o.hasta),
        cantidad: o.cantidad,
        estadoSalida: o.salida.estado,
      })),
    };
  }

  // CU-19: Registrar servicio de un proveedor
  async registrarServicio(idproveedor: number, dto: CrearServicioDto) {
    const proveedor = await this.repository.findProveedor(idproveedor);
    if (!proveedor) throw CustomError.notFound(`No se encontró el proveedor con ID ${idproveedor}.`);

    // CU-17: un proveedor dado de baja queda inhabilitado para nuevos servicios
    if (proveedor.estado !== ESTADO.ACTIVO) {
      throw CustomError.badRequest("No se pueden registrar servicios para un proveedor inactivo.");
    }
    // El rubro del servicio debe coincidir con el del proveedor
    if (proveedor.tipoProveedor !== dto.tipo) {
      throw CustomError.badRequest(
        `El proveedor es de tipo ${proveedor.tipoProveedor}: solo puede registrar servicios de ese tipo.`
      );
    }
    if (await this.repository.existeNombre(idproveedor, dto.base.nombreServicio)) {
      throw CustomError.conflict(`El proveedor ya tiene un servicio activo llamado "${dto.base.nombreServicio}".`);
    }

    const creado = await this.repository.create(idproveedor, dto);
    return this.formatear(creado);
  }

  // CU-20: Modificar servicio de un proveedor
  async modificarServicio(id: number, dto: ModificarServicioDto) {
    const servicio = await this.buscarOFallar(id);
    if (servicio.estado !== ESTADO.ACTIVO) {
      throw CustomError.badRequest("No se puede modificar un servicio que está dado de baja.");
    }

    if (
      dto.base.nombreServicio &&
      dto.base.nombreServicio !== servicio.nombreServicio &&
      (await this.repository.existeNombre(servicio.idproveedor, dto.base.nombreServicio))
    ) {
      throw CustomError.conflict(`El proveedor ya tiene un servicio activo llamado "${dto.base.nombreServicio}".`);
    }

    const tipo = tipoDeServicio(servicio) as TipoServicio;

    // 1. Solo se aceptan campos que correspondan al rubro del servicio
    const permitidos = Object.keys(CAMPOS_MODIFICAR[tipo]);
    const ajenos = Object.keys(dto.especifico).filter((c) => !permitidos.includes(c));
    if (ajenos.length > 0) {
      throw CustomError.badRequest(`Los campos ${ajenos.join(", ")} no corresponden a un servicio de tipo ${tipo}.`);
    }

    const actual = this.datosEspecificos(servicio, tipo);
    const especifico: { [k: string]: any } = { ...dto.especifico };

    // 2. A1: se edita el total (inventario o plazas). Subirlo es libre; bajarlo no puede dejarlo debajo del día
    // de mayor ocupación de hoy en adelante. Las bajas por rotura o pérdida se registran en CU-41.
    // Se controla dentro de la transacción del guardado, con el ServicioBase bloqueado: quien ocupa lo bloquea también.
    const total = especifico.inventarioTotal ?? especifico.capacidadDisponible;
    const controlarTotal =
      total === undefined
        ? undefined
        : (ocupaciones: OcupacionDias[]) => {
            const { pico } = usoDe(ocupaciones);
            if (total < pico.ocupado) {
              const unidad = tipo === TIPO_SERVICIO.ALOJAMIENTO ? "plazas" : "unidades";
              throw CustomError.badRequest(
                `Hay ${pico.ocupado} ${unidad} comprometidas el ${pico.fecha.slice(8, 10)}/${pico.fecha.slice(5, 7)}: el total no puede quedar en ${total}.`
              );
            }
          };
    // Bloque 8: con bloqueo de plazas el hotel necesita su capacidad
    if (
      tipo === TIPO_SERVICIO.ALOJAMIENTO &&
      (especifico.modalidadConfirmacion ?? actual.modalidadConfirmacion) === MODALIDAD_BLOQUEO_PLAZAS &&
      (especifico.capacidadDisponible ?? actual.plazasTotales) === null
    ) {
      throw CustomError.badRequest("Un alojamiento con bloqueo de plazas necesita la capacidad (capacidadDisponible).");
    }

    // 3. CAT-31/32: se edita en el lugar; lo que ya está en salidas activas no puede quedar inconsistente
    if (tipo === TIPO_SERVICIO.TRANSPORTE && especifico.capacidadVehiculo !== undefined) {
      const pasajeros = await this.repository.maxPasajerosConfirmadosEnSalidasActivas(id);
      if (especifico.capacidadVehiculo < pasajeros) {
        throw CustomError.badRequest(
          `La nueva capacidad (${especifico.capacidadVehiculo}) es inferior a los pasajeros confirmados de una salida activa (${pasajeros}).`
        );
      }
    }
    if (tipo === TIPO_SERVICIO.ALOJAMIENTO) {
      const garantiza = (await this.repository.contarGarantiasDePaquetesActivos(id)) > 0;
      const enSalidas = garantiza || (await this.repository.contarSalidasActivas(id)) > 0;
      const cambiaCriterio =
        (dto.base.localidad !== undefined && dto.base.localidad !== servicio.localidad) ||
        (especifico.categoria !== undefined && especifico.categoria !== actual.categoria) ||
        (especifico.tipoHabitacion !== undefined && especifico.tipoHabitacion !== actual.tipoHabitacion);
      if (garantiza && cambiaCriterio) {
        throw CustomError.badRequest(
          "El servicio es el establecimiento garantizado por un paquete activo: no se pueden cambiar su localidad, categoría ni tipo de habitación. Modificá primero el paquete."
        );
      }
      if (
        especifico.modalidadConfirmacion !== undefined &&
        especifico.modalidadConfirmacion !== MODALIDAD_BLOQUEO_PLAZAS &&
        garantiza
      ) {
        throw CustomError.badRequest(
          "Un establecimiento garantizado por un paquete debe mantener la modalidad de bloqueo de plazas."
        );
      }
      if (
        !garantiza &&
        enSalidas &&
        (cambiaCriterio ||
          (especifico.modalidadConfirmacion !== undefined && especifico.modalidadConfirmacion !== actual.modalidadConfirmacion))
      ) {
        throw CustomError.badRequest(
          "El alojamiento está en salidas activas: no se pueden cambiar su localidad, categoría, tipo de habitación ni modalidad de confirmación."
        );
      }
    }

    const actualizado = await this.repository.updateEnSitio(id, tipo, dto.base, especifico, controlarTotal);
    return { servicio: this.formatear(actualizado, await this.repository.ocupacionesDesdeHoy([id])) };
  }

  // CU-21: Baja lógica de servicio
  async darDeBaja(id: number) {
    const servicio = await this.buscarOFallar(id);
    if (servicio.estado !== ESTADO.ACTIVO) {
      throw CustomError.badRequest("El servicio ya se encuentra dado de baja.");
    }

    // Mismas protecciones que la baja de proveedor (CU-17) + garantía de paquetes (CU-20, regla de negocio)
    if ((await this.repository.contarSolicitudesPendientes(id)) > 0) {
      throw CustomError.badRequest("Error. El servicio tiene solicitudes pendientes");
    }
    if ((await this.repository.contarSalidasActivas(id)) > 0) {
      throw CustomError.badRequest("Error. El servicio está asignado a salidas activas");
    }
    if ((await this.repository.contarGarantiasDePaquetesActivos(id)) > 0) {
      throw CustomError.badRequest("Error. El servicio es el establecimiento garantizado por un paquete activo");
    }

    // CAT-09: no se da de baja un servicio incluido en paquetes activos
    const paquetesActivos = await this.repository.contarPaquetesActivosQueLoIncluyen(id);
    if (paquetesActivos > 0) {
      throw CustomError.badRequest(`Error. El servicio está incluido en ${paquetesActivos} paquete(s) activo(s).`);
    }

    const baja = await this.repository.updateEstado(id, ESTADO.INACTIVO);
    return this.formatear(baja);
  }

  // ----- helpers -----
  private async buscarOFallar(id: number) {
    const servicio = await this.repository.findById(id);
    if (!servicio) throw CustomError.notFound(`No se encontró el servicio con ID ${id}.`);
    return servicio;
  }

  private datosEspecificos(s: ServicioCompleto, tipo: TipoServicio): { [k: string]: any } {
    const sub: any =
      tipo === TIPO_SERVICIO.ALOJAMIENTO ? s.alojamiento
      : tipo === TIPO_SERVICIO.TRANSPORTE ? s.transporte
      : tipo === TIPO_SERVICIO.TREN ? s.tren
      : s.equipamiento;
    const { idservicio, ...datos } = sub ?? {};
    return datos;
  }

  // A1: los nombres viejos se mantienen para el front: "disponible" es lo libre hoy y "comprometida", el pico de hoy en adelante
  private formatear(s: ServicioCompleto, ocupaciones: OcupacionDias[] = []) {
    const tipo = tipoDeServicio(s) as TipoServicio;
    const datos = this.datosEspecificos(s, tipo);
    const uso = usoDe(ocupaciones);

    let disponibilidad: { [k: string]: number | string | null };
    switch (tipo) {
      case TIPO_SERVICIO.EQUIPAMIENTO:
        disponibilidad = {
          cantidadDisponible: datos.cantidadTotal - uso.hoy,
          cantidadComprometida: uso.pico.ocupado,
          inventarioTotal: datos.cantidadTotal,
        };
        break;
      case TIPO_SERVICIO.ALOJAMIENTO:
        disponibilidad = {
          capacidadDisponible: datos.plazasTotales === null ? null : datos.plazasTotales - uso.hoy,
          modalidadConfirmacion: datos.modalidadConfirmacion,
        };
        break;
      case TIPO_SERVICIO.TRANSPORTE:
        disponibilidad = { capacidadVehiculo: datos.capacidadVehiculo };
        break;
      default:
        disponibilidad = { diasOperacion: datos.diasOperacion };
    }

    return {
      idservicio: s.idservicio,
      tipo,
      nombreServicio: s.nombreServicio,
      descripcion: s.descripcion,
      costoBase: s.costoBase,
      localidad: s.localidad,
      estado: s.estado,
      proveedor: s.proveedor,
      datos,
      disponibilidad,
    };
  }
}

/** A1: lo ocupado hoy y el día de mayor ocupación de hoy en adelante. */
export const usoDe = (ocupaciones: OcupacionDias[], hoy = hoyUTC()) => {
  const fin = new Date(Math.max(hoy.getTime(), ...ocupaciones.map((o) => o.hasta.getTime())));
  const dias = [...ocupadoPorDia(ocupaciones, hoy, fin)];
  const [fecha, ocupado] = dias.reduce((pico, dia) => (dia[1] > pico[1] ? dia : pico));
  return { hoy: dias[0]![1], pico: { fecha, ocupado } };
};
