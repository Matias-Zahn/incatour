import { CustomError } from "../../../error/CustomError";
import { ESTADO, MODALIDAD_BLOQUEO_PLAZAS, TIPO_SERVICIO, TipoServicio, tipoDeServicio } from "../../../shared/constantes";
import { CAMPOS_MODIFICAR, CrearServicioDto, FiltrosServicioDto, ModificarServicioDto } from "./servicio.dto";
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
    const idsEquipamiento = servicios.filter((s) => s.equipamiento).map((s) => s.idservicio);
    const comprometidas = await this.repository.comprometidasPorServicio(idsEquipamiento);

    return servicios.map((s) => this.formatear(s, comprometidas.get(s.idservicio) ?? 0));
  }

  // DCD: solicitarEdicionServicio. Devuelve los datos actuales + qué se puede editar y qué restricciones hay.
  async obtenerServicio(id: number) {
    const servicio = await this.buscarOFallar(id);
    const tipo = tipoDeServicio(servicio) as TipoServicio;

    const comprometida = tipo === TIPO_SERVICIO.EQUIPAMIENTO ? await this.repository.cantidadComprometida(id) : 0;
    const enUso = (await this.repository.contarSalidasActivas(id)) > 0;
    const garantiza = (await this.repository.contarGarantiasDePaquetesActivos(id)) > 0;

    return {
      ...this.formatear(servicio, comprometida),
      edicion: {
        camposEditables: [...CAMPOS_BASE_EDITABLES, ...Object.keys(CAMPOS_MODIFICAR[tipo])],
        enUsoEnSalidasActivas: enUso,
        garantizaPaquetesActivos: garantiza,
      },
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
    return this.formatear(creado, 0);
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
    let especifico: { [k: string]: any } = { ...dto.especifico };

    // 2. Equipamiento: el stock es el inventario físico real (CU-20). No puede quedar debajo de lo comprometido.
    if (tipo === TIPO_SERVICIO.EQUIPAMIENTO && especifico.inventarioTotal !== undefined) {
      const comprometida = await this.repository.cantidadComprometida(id);
      const total = especifico.inventarioTotal as number;
      if (total < comprometida) {
        throw CustomError.badRequest(
          `La nueva cantidad (${total}) es inferior a la comprometida en salidas activas (${comprometida}).`
        );
      }
      const { inventarioTotal, ...resto } = especifico;
      // cantidadDisponible guarda lo que queda libre: inventario total menos lo ya comprometido
      especifico = { ...resto, cantidadDisponible: total - comprometida };
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

    const actualizado = await this.repository.updateEnSitio(id, tipo, dto.base, especifico);
    const comprometida =
      tipo === TIPO_SERVICIO.EQUIPAMIENTO ? await this.repository.cantidadComprometida(id) : 0;
    return { servicio: this.formatear(actualizado, comprometida) };
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
    return this.formatear(baja, 0);
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

  private formatear(s: ServicioCompleto, comprometida: number) {
    const tipo = tipoDeServicio(s) as TipoServicio;
    const datos = this.datosEspecificos(s, tipo);

    let disponibilidad: { [k: string]: number | string };
    switch (tipo) {
      case TIPO_SERVICIO.EQUIPAMIENTO:
        disponibilidad = {
          cantidadDisponible: datos.cantidadDisponible,
          cantidadComprometida: comprometida,
          inventarioTotal: datos.cantidadDisponible + comprometida,
        };
        break;
      case TIPO_SERVICIO.ALOJAMIENTO:
        disponibilidad = { capacidadDisponible: datos.capacidadDisponible, modalidadConfirmacion: datos.modalidadConfirmacion };
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
