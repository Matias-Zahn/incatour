import { hoyUTC } from "../../../shared/fechas";
import bcrypt from "bcrypt";
import { CustomError } from "../../../error/CustomError";
import { ESTADO } from "../../../shared/constantes";
import { CrearCuentaGuiaDto, FiltrosCuentaGuiaDto, ModificarCuentaGuiaDto } from "./cuenta-guia.dto";
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

  // CU-45: Alta de cuenta de guía
  async crearCuentaGuia(dto: CrearCuentaGuiaDto) {
    const personal = await this.repository.findPersonalGuia(dto.idpersonal);
    if (!personal) {
      throw CustomError.notFound(`No se encontró personal operativo con ID ${dto.idpersonal}.`);
    }
    if (personal.rol !== "Guía") {
      throw CustomError.badRequest("Solo el personal con rol de 'Guía' puede tener una cuenta de acceso.");
    }
    if (personal.estado !== ESTADO.ACTIVO) {
      throw CustomError.badRequest("No se puede crear una cuenta para un guía dado de baja.");
    }
    if (personal.guia?.idusuario) {
      throw CustomError.badRequest("Este guía ya posee una cuenta de acceso registrada.");
    }

    const emailExiste = await this.repository.checkEmailExists(dto.email);
    if (emailExiste) {
      throw CustomError.badRequest("El email ya se encuentra en uso por otra cuenta.");
    }

    const partes = personal.nombreCompleto.trim().split(" ");
    const nombre = partes[0] || personal.nombreCompleto;
    const apellido = partes.slice(1).join(" ") || "Guía";

    const salt = await bcrypt.genSalt(10);
    const contraseniaHasheada = await bcrypt.hash(dto.contrasenia, salt);

    const cuentaCreada = await this.repository.crearCuentaGuia(
      dto.idpersonal,
      nombre,
      apellido,
      dto.email,
      contraseniaHasheada,
      dto.nroHabilitacion,
      dto.fechaHabilitacion
    );

    return this.formatear(cuentaCreada as CuentaGuia);
  }

  // Modificar cuenta de guía (por administrador)
  async modificarCuenta(idusuario: number, dto: ModificarCuentaGuiaDto) {
    const cuenta = await this.repository.findCuenta(idusuario);
    if (!cuenta || !cuenta.usuario) {
      throw CustomError.notFound(`No se encontró una cuenta de guía con ID de usuario ${idusuario}.`);
    }

    if (dto.email && dto.email !== cuenta.usuario.email) {
      const emailExiste = await this.repository.checkEmailExists(dto.email);
      if (emailExiste && emailExiste.idusuario !== idusuario) {
        throw CustomError.badRequest("El email ya se encuentra en uso por otra cuenta.");
      }
    }

    let contraseniaHasheada: string | undefined;
    if (dto.contrasenia) {
      const salt = await bcrypt.genSalt(10);
      contraseniaHasheada = await bcrypt.hash(dto.contrasenia, salt);
    }

    const cuentaModificada = await this.repository.modificarCuenta(idusuario, cuenta.idpersonal, {
      nombre: dto.nombre,
      apellido: dto.apellido,
      email: dto.email,
      contraseniaHasheada,
      nroHabilitacion: dto.nroHabilitacion,
      fechaHabilitacion: dto.fechaHabilitacion,
    });

    return this.formatear(cuentaModificada as CuentaGuia);
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
    const hoy = hoyUTC();
    return fecha >= hoy ? "VIGENTE" : "VENCIDA";
  }
}
