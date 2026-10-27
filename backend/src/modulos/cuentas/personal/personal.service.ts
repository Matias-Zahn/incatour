import bcrypt from "bcrypt";
import { CustomError } from "../../../error/CustomError";
import { PersonalRepository } from "./personal.repository";
import { ConsultarPersonalDto, CrearPersonalDto, ModificarPersonalDto, ROL_GUIA } from "./personal.dto";
import { ESTADO, ESTADO_PERMISO } from "../../../shared/constantes";
import { hoyUTC } from "../../../shared/fechas";

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

    const hoy = hoyUTC();
    if (dto.fechaVencimientoPasaporte && dto.fechaVencimientoPasaporte < hoy) {
      throw CustomError.badRequest("El pasaporte no puede estar vencido");
    }
    if (dto.fechaHabilitacion && dto.fechaHabilitacion < hoy) {
      throw CustomError.badRequest("La habilitación no puede estar vencida");
    }

    // FIX CTA-16 y CTA-17: Validaciones contra salidas y asignaciones activas
    const asignaciones = await this.repository.consultarAsignacionesActivas(idpersonal);

    if (asignaciones.length > 0) {
      // 1. Calculamos la fecha exacta en la que finaliza su última salida asignada
      const maximaFechaFin = new Date(
        Math.max(...asignaciones.map((a) => new Date(a.salida.fechaFin).getTime()))
      );

      // CTA-16: El pasaporte debe cubrir toda la duración de las salidas activas
      if (dto.fechaVencimientoPasaporte && new Date(dto.fechaVencimientoPasaporte) < maximaFechaFin) {
        throw CustomError.conflict(
          `El pasaporte no puede vencer antes de que termine su última salida asignada (${maximaFechaFin.toISOString().split('T')[0]}).`
        );
      }

      // CTA-17: La habilitación del guía debe cubrir toda la duración de las salidas activas
      if (dto.fechaHabilitacion && new Date(dto.fechaHabilitacion) < maximaFechaFin) {
        throw CustomError.conflict(
          `La habilitación no puede vencer antes de que termine su última salida asignada (${maximaFechaFin.toISOString().split('T')[0]}).`
        );
      }

      // CTA-16: Bloquear modificación de datos nominales (nombre/pasaporte) si hay permiso EMITIDO
      const cambiaDatosNominales =
        (dto.nroPasaporte && dto.nroPasaporte !== personal.nroPasaporte) ||
        (dto.nombreCompleto && dto.nombreCompleto !== personal.nombreCompleto);

      if (cambiaDatosNominales) {
        const tienePermisoEmitido = asignaciones.some((a) =>
          a.salida.permisos && a.salida.permisos.some((p) => p.estadoTramite === ESTADO_PERMISO.EMITIDO)
        );

        if (tienePermisoEmitido) {
          throw CustomError.conflict(
            "No se pueden modificar datos nominales (nombre o pasaporte) porque el personal tiene un permiso emitido en salidas activas."
          );
        }
      }
    }

    if (dto.nroPasaporte && dto.nroPasaporte !== personal.nroPasaporte) {
      const existe = await this.repository.checkPasaporteExists(dto.nroPasaporte);
      if (existe) throw CustomError.conflict("Este número de pasaporte ya está registrado");
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
    const hoy = hoyUTC();

    // 1. Pasaporte: único y vigente (aplica a guías y porteadores)
    const existePasaporte = await this.repository.checkPasaporteExists(dto.nroPasaporte);
    if (existePasaporte) {
      throw CustomError.conflict("Este número de pasaporte ya está registrado en la base de datos");
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
    if (!nroHabilitacion || !fechaHabilitacion) {
      throw CustomError.badRequest("Faltan datos obligatorios del guía (habilitación)");
    }

    // CTA-03: la cuenta es opcional; el DTO garantiza que email y contraseña vienen juntos
    if (email) {
      const existeEmail = await this.repository.checkEmailExists(email);
      if (existeEmail) throw CustomError.conflict("El email ya está registrado en el sistema");
    }

    // Se asume que fechaHabilitacion es la fecha de VENCIMIENTO de la habilitación (CU-40
    // exige habilitación vigente). Si es la fecha de emisión, borrá este control.
    if (fechaHabilitacion < hoy) {
      throw CustomError.badRequest("No se puede registrar un guía con la habilitación vencida");
    }

    const contraseniaHasheada = contrasenia ? await bcrypt.hash(contrasenia, await bcrypt.genSalt(10)) : undefined;

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

    // Nunca devolver el hash; sin cuenta, credencialesAcceso es null
    let credencialesAcceso = null;
    if (resultado.usuario) {
      const { contrasenia: _hash, ...usuarioSeguro } = resultado.usuario;
      credencialesAcceso = usuarioSeguro;
    }
    return {
      mensaje: "Personal registrado exitosamente",
      perfilOperativo: resultado.personal,
      credencialesAcceso,
    };
  }
}
