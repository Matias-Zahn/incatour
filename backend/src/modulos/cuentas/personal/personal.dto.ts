import { ESTADO, EMAIL_REGEX } from "../../../shared/constantes";
// Un solo lugar para estos valores: evita errores por tildes o mayúsculas ("Guía" vs "Guia")
export const ROL_GUIA = "Guía";
export const ROL_PORTEADOR = "Porteador";

export class CrearPersonalDto {
  private constructor(
    public nombre: string,
    public apellido: string,
    public nroPasaporte: string,
    public nacionalidad: string,
    public fechaVencimientoPasaporte: Date,
    public rolOperativo: string,
    // Solo para guías: cuenta de acceso (opcional, email y contraseña juntos) y habilitación (viven en las tablas Usuario y Guia)
    public email?: string,
    public contrasenia?: string,
    public nroHabilitacion?: string,
    public fechaHabilitacion?: Date
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearPersonalDto?] {
    let {
      nombre, apellido, email, contrasenia, nroPasaporte, nacionalidad,
      fechaVencimientoPasaporte, rolOperativo, nroHabilitacion, fechaHabilitacion,
    } = obj;

    // Consistencia estricta de Nombre
    if (!nombre || typeof nombre !== "string") return ["El nombre es requerido"];
    nombre = nombre.trim();
    if (nombre.length === 0 || nombre.length > 64) return ["El nombre debe tener entre 1 y 64 caracteres"];
    const regexLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
    if (!regexLetras.test(nombre)) return ["El nombre solo puede contener letras y espacios"];

    // Consistencia estricta de Apellido
    if (!apellido || typeof apellido !== "string") return ["El apellido es requerido"];
    apellido = apellido.trim();
    if (apellido.length === 0 || apellido.length > 64) return ["El apellido debe tener entre 1 y 64 caracteres"];
    if (!regexLetras.test(apellido)) return ["El apellido solo puede contener letras y espacios"];

    if (!nroPasaporte || typeof nroPasaporte !== "string") return ["El número de pasaporte es requerido"];
    nroPasaporte = nroPasaporte.trim();
    if (!nroPasaporte) return ["El número de pasaporte es requerido"];

    if (!nacionalidad || typeof nacionalidad !== "string") return ["La nacionalidad es requerida"];
    nacionalidad = nacionalidad.trim();

    if (!fechaVencimientoPasaporte) return ["La fecha de vencimiento del pasaporte es requerida"];
    const fechaPasaporte = new Date(fechaVencimientoPasaporte);
    if (isNaN(fechaPasaporte.getTime())) return ["La fecha proporcionada no es válida"];

    if (!rolOperativo || ![ROL_GUIA, ROL_PORTEADOR].includes(rolOperativo)) {
      return [`El rol operativo debe ser '${ROL_GUIA}' o '${ROL_PORTEADOR}'`];
    }

    // Porteador: sin cuenta de acceso ni habilitación. Se ignoran esos campos si vinieran.
    if (rolOperativo === ROL_PORTEADOR) {
      return [
        undefined,
        new CrearPersonalDto(nombre, apellido, nroPasaporte, nacionalidad, fechaPasaporte, rolOperativo),
      ];
    }

    // Guía: la cuenta de acceso es opcional (CTA-03): email y contraseña van juntos o ninguno.
    // Sin cuenta, se crea después con POST /api/cuentas-guia. La habilitación sí es obligatoria.
    const vacio = (v: unknown) => v === undefined || v === null || v === "";
    if (vacio(email) !== vacio(contrasenia)) {
      return [vacio(email) ? "El email es requerido si se envía la contraseña" : "La contraseña es requerida si se envía el email"];
    }
    if (!vacio(email)) {
      if (typeof email !== "string") return ["El email debe ser una cadena de texto"];
      email = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(email)) return ["El formato del correo electrónico no es válido"];

      if (typeof contrasenia !== "string") return ["La contraseña debe ser una cadena de texto"];
      if (contrasenia.length < 8) return ["La contraseña debe tener como mínimo 8 caracteres"];
    } else {
      email = undefined;
      contrasenia = undefined;
    }

    if (!nroHabilitacion || typeof nroHabilitacion !== "string") {
      return ["El número de habilitación es requerido para un guía"];
    }
    nroHabilitacion = nroHabilitacion.trim();

    if (!fechaHabilitacion) return ["La fecha de la habilitación es requerida para un guía"];
    const fechaHab = new Date(fechaHabilitacion);
    if (isNaN(fechaHab.getTime())) return ["La fecha de habilitación no es válida"];

    return [
      undefined,
      new CrearPersonalDto(
        nombre, apellido, nroPasaporte, nacionalidad, fechaPasaporte, rolOperativo,
        email, contrasenia, nroHabilitacion, fechaHab
      ),
    ];
  }
}

// CU-22: filtros por query string (texto y todos opcionales)
export class ConsultarPersonalDto {
  private constructor(
    public rol: string | undefined,
    public estado: string | undefined,
    public habilitacionVigente: boolean | undefined,
  ) {}

  public static create(query: { [key: string]: any }): [string | undefined, ConsultarPersonalDto?] {
    const { rol, estado, habilitacionVigente } = query;

    if (rol !== undefined && ![ROL_GUIA, ROL_PORTEADOR].includes(rol)) {
      return [`rol debe ser '${ROL_GUIA}' o '${ROL_PORTEADOR}'`];
    }
    if (estado !== undefined && !Object.values(ESTADO).includes(estado)) {
      return [`estado debe ser ${Object.values(ESTADO).join(" o ")}`];
    }
    if (habilitacionVigente !== undefined && !["true", "false"].includes(habilitacionVigente)) {
      return ["habilitacionVigente debe ser true o false"];
    }

    const vigente = habilitacionVigente === undefined ? undefined : habilitacionVigente === "true";
    return [undefined, new ConsultarPersonalDto(rol, estado, vigente)];
  }
}

// CU-24: modificación parcial. El rol y el estado no se cambian acá (el estado es la baja, CU-25)
export class ModificarPersonalDto {
  private constructor(
    public nombreCompleto: string | undefined,
    public nroPasaporte: string | undefined,
    public nacionalidad: string | undefined,
    public fechaVencimientoPasaporte: Date | undefined,
    public nroHabilitacion: string | undefined,
    public fechaHabilitacion: Date | undefined,
  ) {}

  get modificaHabilitacion() {
    return this.nroHabilitacion !== undefined || this.fechaHabilitacion !== undefined;
  }

  public static create(obj: { [key: string]: any }): [string | undefined, ModificarPersonalDto?] {
    const { rol, rolOperativo, estado } = obj;
    if (rol !== undefined || rolOperativo !== undefined) return ["El rol no se puede modificar"];
    if (estado !== undefined) return ["El estado se cambia con la baja (CU-25)"];

    const [e1, nombreCompleto] = texto(obj.nombreCompleto, "nombreCompleto", /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/);
    if (e1) return [e1];
    const [e2, nroPasaporte] = texto(obj.nroPasaporte, "nroPasaporte");
    if (e2) return [e2];
    const [e3, nacionalidad] = texto(obj.nacionalidad, "nacionalidad");
    if (e3) return [e3];
    const [e4, nroHabilitacion] = texto(obj.nroHabilitacion, "nroHabilitacion");
    if (e4) return [e4];
    const [e5, fechaVencimientoPasaporte] = fecha(obj.fechaVencimientoPasaporte, "fechaVencimientoPasaporte");
    if (e5) return [e5];
    const [e6, fechaHabilitacion] = fecha(obj.fechaHabilitacion, "fechaHabilitacion");
    if (e6) return [e6];

    const dto = new ModificarPersonalDto(
      nombreCompleto, nroPasaporte, nacionalidad, fechaVencimientoPasaporte, nroHabilitacion, fechaHabilitacion,
    );
    if (Object.values(dto).every((v) => v === undefined)) return ["No se envió ningún dato para modificar"];
    return [undefined, dto];
  }
}

const texto = (valor: unknown, campo: string, formato?: RegExp): [string | undefined, string?] => {
  if (valor === undefined) return [undefined];
  if (typeof valor !== "string" || valor.trim().length === 0 || valor.trim().length > 128) {
    return [`${campo} debe ser un texto de 1 a 128 caracteres`];
  }
  if (formato && !formato.test(valor.trim())) return [`${campo} solo puede contener letras y espacios`];
  return [undefined, valor.trim()];
};

const fecha = (valor: unknown, campo: string): [string | undefined, Date?] => {
  if (valor === undefined) return [undefined];
  const f = new Date(String(valor));
  if (typeof valor !== "string" || isNaN(f.getTime())) return [`${campo} debe ser una fecha válida (AAAA-MM-DD)`];
  return [undefined, f];
};
