import { CustomError } from "../../../error/CustomError";
import { ESTADO } from "../../../shared/constantes";
import { FiltrosCuentaGuiaDto } from "./cuenta-guia.dto";
import { CuentaGuiaRepository } from "./cuenta-guia.repository";

type CuentaGuia = NonNullable<Awaited<ReturnType<CuentaGuiaRepository["findCuenta"]>>>;

export class CuentaGuiaService {
  private repository: CuentaGuiaRepository;

  constructor() {
    this.repository = new CuentaGuiaRepository();
  }

  // CU-44: Consultar usuarios guía
  async consultarUsuariosGuia(filtros: FiltrosCuentaGuiaDto) {
    const cuentas = await this.repository.findCuentas(filtros);
    return cuentas.map((c) => this.formatear(c));
  }

  // CU-46: Baja cuenta guía
  async darDeBajaCuenta(idusuario: number) {
    const cuenta = await this.repository.findCuenta(idusuario);
    if (!cuenta || !cuenta.usuario) {
      throw CustomError.notFound(`No se encontró una cuenta de guía con ID de usuario ${idusuario}.`);
    }
    if (cuenta.usuario.estado === ESTADO.INACTIVO) {
      throw CustomError.badRequest("La cuenta ya se encuentra dada de baja.");
    }

    const resultado = await this.repository.darDeBaja(idusuario, cuenta.idpersonal);
    if ("bloqueadoPor" in resultado) {
      throw CustomError.badRequest(
        `No se puede dar de baja la cuenta: el guía está asignado a ${resultado.bloqueadoPor} salida(s) cuyo recorrido no finalizó.`
      );
    }

    const actualizada = await this.repository.findCuenta(idusuario);
    return this.formatear(actualizada as CuentaGuia);
  }

  // ---- helpers ----
  private formatear(c: CuentaGuia) {
    const usuario = c.usuario!;
    const salidasPendientes = c.personal.asignaciones.length;

    return {
      idusuario: usuario.idusuario,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
      estado: usuario.estado,
      creadoEn: usuario.creadoEn,
      guia: {
        idpersonal: c.personal.idpersonal,
        nombreCompleto: c.personal.nombreCompleto,
        nroPasaporte: c.personal.nroPasaporte,
        estadoPersonal: c.personal.estado,
      },
      habilitacion: {
        nroHabilitacion: c.nroHabilitacion ?? null,
        fechaHabilitacion: c.fechaHabilitacion ?? null,
        situacion: this.situacionHabilitacion(c.fechaHabilitacion ?? null),
      },
      salidasPendientes,
      puedeDarseDeBaja: usuario.estado === ESTADO.ACTIVO && salidasPendientes === 0,
    };
  }

  // Se asume que fechaHabilitacion es la fecha de VENCIMIENTO (CU-40 exige habilitación vigente)
  private situacionHabilitacion(fecha: Date | null): "VIGENTE" | "VENCIDA" | "SIN_DATOS" {
    if (!fecha) return "SIN_DATOS";
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return fecha >= hoy ? "VIGENTE" : "VENCIDA";
  }
}