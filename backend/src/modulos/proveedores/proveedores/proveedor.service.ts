import { CustomError } from "../../../error/CustomError";
import { ESTADO } from "../../../shared/constantes";
import { CrearProveedorDto, FiltrosProveedorDto, ModificarProveedorDto } from "./proveedor.dto";
import { ProveedorRepository } from "./proveedor.repository";

export class ProveedorService {
  private repository: ProveedorRepository;

  constructor() {
    this.repository = new ProveedorRepository();
  }

  // CU-14: Consultar proveedores
  async consultarProveedores(filtros: FiltrosProveedorDto) {
    const proveedores = await this.repository.findAll(filtros);
    return proveedores.map((p) => this.formatear(p));
  }

  async obtenerProveedor(id: number) {
    const proveedor = await this.repository.findById(id);
    if (!proveedor) throw CustomError.notFound(`No se encontró el proveedor con ID ${id}.`);
    return this.formatear(proveedor);
  }

  // CU-15: Alta proveedor
  async crearProveedor(dto: CrearProveedorDto) {
    if (await this.repository.existeRazonSocial(dto.razonSocial, dto.localidad)) {
      throw CustomError.conflict(
        `Ya existe un proveedor activo "${dto.razonSocial}" en ${dto.localidad}.`
      );
    }
    return this.formatear(await this.repository.create(dto));
  }

  // CU-16: Modificar proveedor
  async modificarProveedor(id: number, dto: ModificarProveedorDto) {
    const proveedor = await this.repository.findById(id);
    if (!proveedor) throw CustomError.notFound(`No se encontró el proveedor con ID ${id}.`);

    // Cambiar el rubro dejaría servicios de un tipo distinto al del proveedor
    if (dto.tipoProveedor && dto.tipoProveedor !== proveedor.tipoProveedor) {
      if ((await this.repository.contarServicios(id)) > 0) {
        throw CustomError.badRequest(
          "No se puede cambiar el tipo de un proveedor que ya tiene servicios registrados."
        );
      }
    }

    const razonSocial = dto.razonSocial ?? proveedor.razonSocial;
    const localidad = dto.localidad ?? proveedor.localidad;
    if (
      (dto.razonSocial !== undefined || dto.localidad !== undefined) &&
      (await this.repository.existeRazonSocial(razonSocial, localidad, id))
    ) {
      throw CustomError.conflict(`Ya existe un proveedor activo "${razonSocial}" en ${localidad}.`);
    }

    // Pasar a Inactivo por esta vía es una baja: rigen las mismas reglas del CU-17
    if (dto.estado === ESTADO.INACTIVO && proveedor.estado === ESTADO.ACTIVO) {
      await this.validarBaja(id);
    }

    return this.formatear(await this.repository.update(id, dto));
  }

  // CU-17: Baja lógica de proveedor
  async darDeBaja(id: number) {
    const proveedor = await this.repository.findById(id);
    if (!proveedor) throw CustomError.notFound(`No se encontró el proveedor con ID ${id}.`);
    if (proveedor.estado !== ESTADO.ACTIVO) {
      throw CustomError.badRequest("El proveedor ya se encuentra dado de baja.");
    }

    await this.validarBaja(id);
    return this.formatear(await this.repository.updateEstado(id, ESTADO.INACTIVO));
  }

  private async validarBaja(id: number) {
    if (await this.repository.tieneSolicitudesPendientes(id)) {
      throw CustomError.badRequest("Error. El proveedor tiene solicitudes pendientes");
    }
    if (await this.repository.tieneSalidasActivas(id)) {
      throw CustomError.badRequest("Error. El proveedor cuenta con salidas activas");
    }
  }

  private formatear<T extends { _count: { servicios: number } }>(proveedor: T) {
    const { _count, ...resto } = proveedor;
    return { ...resto, cantidadServicios: _count.servicios };
  }
}
