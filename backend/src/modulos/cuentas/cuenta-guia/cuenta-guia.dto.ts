import { ESTADO } from "../../../shared/constantes";

// Hoy solo los guías tienen cuenta de acceso (los porteadores no, CU-23): el único rol de cuenta es GUIA.
export const ROLES_CUENTA = ["GUIA"];
const ESTADOS = [ESTADO.ACTIVO, ESTADO.INACTIVO] as string[];
export const SITUACIONES_HABILITACION = ["VIGENTE", "VENCIDA"];

// CU-44: filtros del listado de cuentas de guía
export class FiltrosCuentaGuiaDto {
  private constructor(
    public rol?: string,
    public estado?: string,
    public habilitacion?: string,
    public busqueda?: string
  ) {}

  public static create(query: { [key: string]: any }): [string | undefined, FiltrosCuentaGuiaDto?] {
    const { rol, estado, habilitacion, busqueda } = query;

    if (rol !== undefined && !ROLES_CUENTA.includes(rol)) {
      return [`rol debe ser uno de: ${ROLES_CUENTA.join(", ")}.`];
    }
    if (estado !== undefined && !ESTADOS.includes(estado)) {
      return [`estado debe ser uno de: ${ESTADOS.join(", ")}.`];
    }
    if (habilitacion !== undefined && !SITUACIONES_HABILITACION.includes(habilitacion)) {
      return [`habilitacion debe ser uno de: ${SITUACIONES_HABILITACION.join(", ")}.`];
    }
    const texto = typeof busqueda === "string" && busqueda.trim().length > 0 ? busqueda.trim() : undefined;

    return [undefined, new FiltrosCuentaGuiaDto(rol, estado, habilitacion, texto)];
  }
}

// CU-45: Alta de cuenta de guía para un personal guía registrado
export class CrearCuentaGuiaDto {
  private constructor(
    public idpersonal: number,
    public email: string,
    public contrasenia: string,
    public nroHabilitacion?: string,
    public fechaHabilitacion?: Date
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearCuentaGuiaDto?] {
    let { idpersonal, email, contrasenia, nroHabilitacion, fechaHabilitacion } = obj;

    const id = Number(idpersonal);
    if (!Number.isInteger(id) || id <= 0) {
      return ["idpersonal debe ser un número entero positivo"];
    }

    if (!email || typeof email !== "string") return ["El email es requerido"];
    email = email.trim().toLowerCase();
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexEmail.test(email)) return ["El formato del email no es válido"];

    if (!contrasenia || typeof contrasenia !== "string") return ["La contraseña es requerida"];
    if (contrasenia.length < 8) return ["La contraseña debe tener como mínimo 8 caracteres"];

    let fechaHab: Date | undefined;
    if (fechaHabilitacion !== undefined && fechaHabilitacion !== null) {
      fechaHab = new Date(fechaHabilitacion);
      if (isNaN(fechaHab.getTime())) return ["La fecha de habilitación no es válida"];
    }

    if (nroHabilitacion !== undefined && nroHabilitacion !== null) {
      nroHabilitacion = String(nroHabilitacion).trim();
      if (nroHabilitacion.length === 0) nroHabilitacion = undefined;
    }

    return [
      undefined,
      new CrearCuentaGuiaDto(id, email, contrasenia, nroHabilitacion, fechaHab),
    ];
  }
}

// Modificar cuenta de guía (por administrador)
export class ModificarCuentaGuiaDto {
  private constructor(
    public nombre?: string,
    public apellido?: string,
    public email?: string,
    public contrasenia?: string,
    public nroHabilitacion?: string,
    public fechaHabilitacion?: Date,
    public estado?: string
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, ModificarCuentaGuiaDto?] {
    let { nombre, apellido, email, contrasenia, nroHabilitacion, fechaHabilitacion, estado } = obj;

    if (
      nombre === undefined &&
      apellido === undefined &&
      email === undefined &&
      contrasenia === undefined &&
      nroHabilitacion === undefined &&
      fechaHabilitacion === undefined &&
      estado === undefined
    ) {
      return ["No se envió ningún dato para modificar la cuenta de guía"];
    }

    const regexLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
    if (nombre !== undefined) {
      if (typeof nombre !== "string") return ["El nombre debe ser una cadena de texto"];
      nombre = nombre.trim();
      if (nombre.length === 0 || nombre.length > 64) return ["El nombre debe tener entre 1 y 64 caracteres"];
      if (!regexLetras.test(nombre)) return ["El nombre solo puede contener letras y espacios"];
    }

    if (apellido !== undefined) {
      if (typeof apellido !== "string") return ["El apellido debe ser una cadena de texto"];
      apellido = apellido.trim();
      if (apellido.length === 0 || apellido.length > 64) return ["El apellido debe tener entre 1 y 64 caracteres"];
      if (!regexLetras.test(apellido)) return ["El apellido solo puede contener letras y espacios"];
    }

    if (email !== undefined) {
      if (typeof email !== "string") return ["El email debe ser una cadena de texto"];
      email = email.trim().toLowerCase();
      const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!regexEmail.test(email)) return ["El formato del email no es válido"];
    }

    if (contrasenia !== undefined) {
      if (typeof contrasenia !== "string") return ["La contraseña debe ser una cadena de texto"];
      if (contrasenia.length < 8) return ["La contraseña debe tener como mínimo 8 caracteres"];
    }

    let fechaHab: Date | undefined;
    if (fechaHabilitacion !== undefined && fechaHabilitacion !== null) {
      fechaHab = new Date(fechaHabilitacion);
      if (isNaN(fechaHab.getTime())) return ["La fecha de habilitación no es válida"];
    }

    if (nroHabilitacion !== undefined && nroHabilitacion !== null) {
      nroHabilitacion = String(nroHabilitacion).trim();
    }

    if (estado !== undefined && !ESTADOS.includes(estado)) {
      return [`estado debe ser uno de: ${ESTADOS.join(", ")}.`];
    }

    return [
      undefined,
      new ModificarCuentaGuiaDto(nombre, apellido, email, contrasenia, nroHabilitacion, fechaHab, estado),
    ];
  }
}
