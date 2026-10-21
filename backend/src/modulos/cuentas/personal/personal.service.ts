import bcrypt from "bcrypt";
import { CustomError } from "../../../error/CustomError";
import { PersonalRepository } from "./personal.repository";
import { ConsultarPersonalDto, CrearPersonalDto, ModificarPersonalDto, ROL_GUIA } from "./personal.dto";
import { ESTADO } from "../../../shared/constantes";

export class PersonalService {
  private repository = new PersonalRepository();

  // CU-22: Consultar personal operativo
  async consultarPersonal(dto: ConsultarPersonalDto) {
    return this.repository.buscar(dto);
  }

  // CU-24: Modificar personal operativo
  async modificarPersonal(idpersonal: number, dto: ModificarPersonalDto) {
    const personal = await this.repository.buscarPorId(idpersonal);
    if (!personal) throw CustomError.notFound("El personal no existe");
    if (personal.estado !== ESTADO.ACTIVO) throw CustomError.badRequest("No se puede modificar personal dado de baja");

    if (dto.modificaHabilitacion && !personal.guia) {
      throw CustomError.badRequest("La habilitación solo corresponde a un guía");
    }

    const hoy = new Date();
    if (dto.fechaVencimientoPasaporte && dto.fechaVencimientoPasaporte < hoy) {
      throw CustomError.badRequest("El pasaporte no puede estar vencido");
    }
    if (dto.fechaHabilitacion && dto.fechaHabilitacion < hoy) {
      throw CustomError.badRequest("La habilitación no puede estar vencida");
    }

    if (dto.nroPasaporte && dto.nroPasaporte !== personal.nroPasaporte) {
      const existe = await this.repository.checkPasaporteExists(dto.nroPasaporte);
      if (existe) throw CustomError.badRequest("Este número de pasaporte ya está registrado");
    }

    // El nombre del guía vive también en su cuenta (Usuario): se actualiza junto con el legajo
    let usuario: { idusuario: number; nombre: string; apellido: string } | undefined;
    if (dto.nombreCompleto && personal.guia?.idusuario) {
      const [nombre, ...resto] = dto.nombreCompleto.trim().split(/\s+/);
      if (!resto.length) throw CustomError.badRequest("El nombre completo de un guía debe incluir nombre y apellido");
      usuario = { idusuario: personal.guia.idusuario, nombre: nombre!, apellido: resto.join(" ") };
    }

    return this.repository.modificar(idpersonal, dto, usuario);
  }

  // CU-25: Baja lógica de personal operativo
  async darDeBaja(idpersonal: number) {
    const personal = await this.repository.buscarPorId(idpersonal);
    if (!personal) throw CustomError.notFound("El personal no existe");
    if (personal.estado !== ESTADO.ACTIVO) throw CustomError.badRequest("El personal ya está dado de baja");

    const resultado = await this.repository.darDeBaja(idpersonal, personal.guia?.idusuario ?? null);
    if ("bloqueadoPor" in resultado) {
      throw CustomError.badRequest(
        `No se puede dar de baja: está asignado a ${resultado.bloqueadoPor} salida(s) que todavía no finalizaron`
      );
    }
    return resultado.personal;
  }

  async crearPersonal(dto: CrearPersonalDto) {
    const hoy = new Date();

    // 1. Pasaporte: único y vigente (aplica a guías y porteadores)
    const existePasaporte = await this.repository.checkPasaporteExists(dto.nroPasaporte);
    if (existePasaporte) {
      throw CustomError.badRequest("Este número de pasaporte ya está registrado en la base de datos");
    }
    if (dto.fechaVencimientoPasaporte < hoy) {
      throw CustomError.badRequest("No se puede registrar personal con un pasaporte vencido");
    }

    // 2. Porteador: solo legajo, sin cuenta de acceso
    if (dto.rolOperativo !== ROL_GUIA) {
      const personal = await this.repository.crearPorteador(dto);
      return {
        mensaje: "Personal registrado exitosamente",
        perfilOperativo: personal,
        credencialesAcceso: null,
      };
    }

    // 3. Guía: cuenta + legajo + habilitación
    const { email, contrasenia, nroHabilitacion, fechaHabilitacion } = dto;
    if (!email || !contrasenia || !nroHabilitacion || !fechaHabilitacion) {
      throw CustomError.badRequest("Faltan datos obligatorios del guía (email, contraseña y habilitación)");
    }

    const existeEmail = await this.repository.checkEmailExists(email);
    if (existeEmail) throw CustomError.badRequest("El email ya está registrado en el sistema");

    // Se asume que fechaHabilitacion es la fecha de VENCIMIENTO de la habilitación (CU-40
    // exige habilitación vigente). Si es la fecha de emisión, borrá este control.
    if (fechaHabilitacion < hoy) {
      throw CustomError.badRequest("No se puede registrar un guía con la habilitación vencida");
    }

    const salt = await bcrypt.genSalt(10);
    const contraseniaHasheada = await bcrypt.hash(contrasenia, salt);

    const resultado = await this.repository.crearGuia(
      {
        nombre: dto.nombre,
        apellido: dto.apellido,
        nroPasaporte: dto.nroPasaporte,
        nacionalidad: dto.nacionalidad,
        fechaVencimientoPasaporte: dto.fechaVencimientoPasaporte,
        email,
        nroHabilitacion,
        fechaHabilitacion,
      },
      contraseniaHasheada
    );

    // Nunca devolver el hash
    const { contrasenia: _hash, ...usuarioSeguro } = resultado.usuario;
    return {
      mensaje: "Personal registrado exitosamente",
      perfilOperativo: resultado.personal,
      credencialesAcceso: usuarioSeguro,
    };
  }
}
