import { CustomError } from "../../../error/CustomError";
import { ESTADO } from "../../../shared/constantes";
import { CrearServicioDto, FiltrosServicioDto, ModificarServicioDto } from "./servicio.dto";
import { ServicioRepository } from "./servicio.repository";
import { TIPO_SERVICIO, TipoServicio, MODALIDAD_BLOQUEO_PLAZAS } from "../../../shared/constantes";

type ServicioCompleto = NonNullable<Awaited<ReturnType<ServicioRepository["findById"]>>>;

export class ServicioService {
  private repository = new ServicioRepository();

  // CU-18: Consultar servicios
  async consultarServicios(filtros: FiltrosServicioDto) {
    const servicios = await this.repository.findServicios(filtros);
    const equipamientos = servicios.filter((s) => s.equipamiento !== null).map((s) => s.idservicio);
    const mapaComprometidas = await this.repository.comprometidasPorServicio(equipamientos);

    return servicios.map((s) => this.formatear(s, mapaComprometidas.get(s.idservicio) ?? 0));
  }

  // CU-19: Alta de servicio
  async crearServicio(idproveedor: number, dto: CrearServicioDto) {
    const proveedor = await this.repository.findProveedor(idproveedor);
    if (!proveedor) throw CustomError.notFound(`No se encontró el proveedor con ID ${idproveedor}.`);
    if (proveedor.estado !== ESTADO.ACTIVO) {
      throw CustomError.badRequest("No se pueden dar de alta servicios para un proveedor dado de baja.");
    }

    // Regla de negocio: el servicio debe corresponder al rubro del proveedor
    if (dto.tipo !== proveedor.tipoProveedor) {
      throw CustomError.badRequest(
        `El tipo de servicio (${dto.tipo}) no coincide con el rubro del proveedor (${proveedor.tipoProveedor}).`
      );
    }

    // Unicidad de nombre de servicio por proveedor (activos)
    if (await this.repository.existeNombreEnProveedor(dto.base.nombreServicio, idproveedor)) {
      throw CustomError.badRequest(
        `El proveedor ya tiene un servicio activo con el nombre "${dto.base.nombreServicio}".`
      );
    }

    const creado = await this.repository.create(idproveedor, dto);
    return this.formatear(creado, 0);
  }

  // CU-20: Modificar servicio
  async modificarServicio(id: number, dto: ModificarServicioDto) {
    const servicio = await this.buscarOFallar(id);
    if (servicio.estado !== ESTADO.ACTIVO) {
      throw CustomError.badRequest("No se puede modificar un servicio dado de baja.");
    }

    const tipo = dto.tipo;
    const especifico = dto.especifico;
    const actual = this.datosEspecificos(servicio, tipo);

    // 1. Unicidad de nombre si cambió
    if (
      dto.base.nombreServicio !== undefined &&
      dto.base.nombreServicio !== servicio.nombreServicio &&
      (await this.repository.existeNombreEnProveedor(dto.base.nombreServicio, servicio.idproveedor, id))
    ) {
      throw CustomError.badRequest(
        `El proveedor ya tiene un servicio activo con el nombre "${dto.base.nombreServicio}".`
      );
    }

    // 2. Equipamiento: no se puede reducir stock por debajo de lo comprometido en salidas activas
    if (tipo === TIPO_SERVICIO.EQUIPAMIENTO && especifico.cantidadDisponible !== undefined) {
      const comprometida = await this.repository.cantidadComprometida(id);
      if (especifico.cantidadDisponible < comprometida) {
        throw CustomError.badRequest(
          `No se puede reducir el stock a ${especifico.cantidadDisponible}: hay ${comprometida} unidad(es) comprometida(s) en salidas activas o en curso.`
        );
      }
    }

    // 3. Alojamiento: no se puede pasar a A_SOLICITUD si es garantía de un paquete activo (CU-20, regla de negocio)
    if (
      tipo === TIPO_SERVICIO.ALOJAMIENTO &&
      especifico.modalidadConfirmacion !== undefined &&
      especifico.modalidadConfirmacion !== MODALIDAD_BLOQUEO_PLAZAS
    ) {
      if (
        (await this.repository.contarGarantiasDePaquetesActivos(id)) > 0 &&
        actual.modalidadConfirmacion === MODALIDAD_BLOQUEO_PLAZAS
      ) {
        throw CustomError.badRequest(
          "Un establecimiento garantizado por un paquete debe mantener la modalidad de bloqueo de plazas."
        );
      }
    }

    // 4. Cambio estructural sobre un servicio en uso: rige solo para salidas futuras (versión nueva)
    const cambiaEstructura =
      (tipo === TIPO_SERVICIO.ALOJAMIENTO || tipo === TIPO_SERVICIO.TRANSPORTE) &&
      ((dto.base.localidad !== undefined && dto.base.localidad !== servicio.localidad) ||
        Object.entries(especifico).some(([campo, valor]) => actual[campo] !== valor));

    if (cambiaEstructura && (await this.repository.contarSalidasActivas(id)) > 0) {
      const nuevo = await this.repository.versionar(servicio, tipo, dto.base, { ...actual, ...especifico });
      return {
        servicio: this.formatear(nuevo, 0),
        versionado: true,
        idservicioAnterior: id,
      };
    }

    const actualizado = await this.repository.updateEnSitio(id, tipo, dto.base, especifico);
    const comprometida =
      tipo === TIPO_SERVICIO.EQUIPAMIENTO ? await this.repository.cantidadComprometida(id) : 0;
    return { servicio: this.formatear(actualizado, comprometida), versionado: false };
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

    // CAT-09: No permitir la baja de un servicio si está incluido en paquetes activos
    const paquetesActivosConServicio = await this.repository.contarPaquetesActivosQueLoIncluyen(id);
    if (paquetesActivosConServicio > 0) {
      throw CustomError.badRequest(
        `Error. El servicio está incluido en ${paquetesActivosConServicio} paquete(s) activo(s).`
      );
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
    const { idservicio, ...resto } = sub ?? {};
    return resto;
  }

  private formatear(s: ServicioCompleto, comprometida: number) {
    const { idproveedor, proveedor, alojamiento, transporte, tren, equipamiento, ...base } = s;
    const tipo =
      alojamiento ? TIPO_SERVICIO.ALOJAMIENTO
      : transporte ? TIPO_SERVICIO.TRANSPORTE
      : tren ? TIPO_SERVICIO.TREN
      : TIPO_SERVICIO.EQUIPAMIENTO;

    const especifico = this.datosEspecificos(s, tipo);
    const stock = equipamiento ? equipamiento.cantidadDisponible : null;

    return {
      ...base,
      tipo,
      proveedor: {
        idproveedor: proveedor.idproveedor,
        razonSocial: proveedor.razonSocial,
        localidad: proveedor.localidad,
        tipoProveedor: proveedor.tipoProveedor,
        estado: proveedor.estado,
      },
      ...especifico,
      ...(stock !== null && {
        cantidadDisponible: stock,
        cantidadComprometida: comprometida,
        cantidadLibre: Math.max(0, stock - comprometida),
      }),
    };
  }
}
