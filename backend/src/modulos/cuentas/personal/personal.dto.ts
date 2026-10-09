export class CrearPersonalDto {
  private constructor(
    public nombre: string,
    public apellido: string,
    public email: string,
    public contrasenia: string,
    public nroPasaporte: string,
    public nacionalidad: string,
    public fechaVencimientoPasaporte: Date,
    public rolOperativo: string
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearPersonalDto?] {
    let { nombre, apellido, email, contrasenia, nroPasaporte, nacionalidad, fechaVencimientoPasaporte, rolOperativo } = obj;

    // Consistencia estricta de Nombre
    if (!nombre || typeof nombre !== 'string') return ["El nombre es requerido"];
    nombre = nombre.trim();
    if (nombre.length === 0 || nombre.length > 64) return ["El nombre debe tener entre 1 y 64 caracteres"];
    const regexLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
    if (!regexLetras.test(nombre)) return ["El nombre solo puede contener letras y espacios"];

    // Consistencia estricta de Apellido
    if (!apellido || typeof apellido !== 'string') return ["El apellido es requerido"];
    apellido = apellido.trim();
    if (apellido.length === 0 || apellido.length > 64) return ["El apellido debe tener entre 1 y 64 caracteres"];
    if (!regexLetras.test(apellido)) return ["El apellido solo puede contener letras y espacios"];

    // Consistencia de Email
    if (!email || typeof email !== 'string') return ["El email es requerido"];
    email = email.trim().toLowerCase();

    // Consistencia estricta de Contraseña
    if (!contrasenia || typeof contrasenia !== 'string') return ["La contraseña es requerida"];
    if (contrasenia.length < 8) return ["La contraseña debe tener como mínimo 8 caracteres"];

    // Limpieza de campos extra
    if (!nroPasaporte || typeof nroPasaporte !== 'string') return ["El número de pasaporte es requerido"];
    nroPasaporte = nroPasaporte.trim();

    if (!nacionalidad || typeof nacionalidad !== 'string') return ["La nacionalidad es requerida"];
    nacionalidad = nacionalidad.trim();

    // Consistencia de Fecha
    if (!fechaVencimientoPasaporte) return ["La fecha de vencimiento del pasaporte es requerida"];
    const fechaObj = new Date(fechaVencimientoPasaporte);
    if (isNaN(fechaObj.getTime())) return ["La fecha proporcionada no es válida"];
    
    // Consistencia de Roles Operativos
    if (!rolOperativo || !["Guía", "Porteador"].includes(rolOperativo)) {
      return ["El rol operativo debe ser 'Guía' o 'Porteador'"];
    }

    return [
      undefined, 
      new CrearPersonalDto(nombre, apellido, email, contrasenia, nroPasaporte, nacionalidad, fechaObj, rolOperativo)
    ];
  }
}
