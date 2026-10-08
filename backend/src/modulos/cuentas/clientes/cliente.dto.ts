export class CrearClienteDto {
  private constructor(
    public email: string,
    public contrasenia: string,
    public nombre: string,
    public apellido: string,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearClienteDto?] {
    let { email, contrasenia, nombre, apellido } = obj;

    // Validación y Normalización de Email
    if (!email || typeof email !== 'string') return ["El email es requerido y debe ser texto"];
    email = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return ["El formato del correo electrónico no es válido"];

    // Validación de Contraseña
    if (!contrasenia || typeof contrasenia !== 'string') return ["La contraseña es requerida y debe ser texto"];
    if (contrasenia.length < 8) return ["La contraseña debe tener como mínimo 8 caracteres"];

    // Regex para validar solo letras, acentos, ñ y espacios
    const letrasRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;

    // Validación y Normalización de Nombre
    if (!nombre || typeof nombre !== 'string') return ["El nombre es requerido y debe ser texto"];
    nombre = nombre.trim();
    if (nombre.length === 0 || nombre.length > 64) return ["El nombre debe tener entre 1 y 64 caracteres"];
    if (!letrasRegex.test(nombre)) return ["El nombre solo puede contener letras y espacios"];

    // Validación y Normalización de Apellido
    if (!apellido || typeof apellido !== 'string') return ["El apellido es requerido y debe ser texto"];
    apellido = apellido.trim();
    if (apellido.length === 0 || apellido.length > 64) return ["El apellido debe tener entre 1 y 64 caracteres"];
    if (!letrasRegex.test(apellido)) return ["El apellido solo puede contener letras y espacios"];

    return [undefined, new CrearClienteDto(email, contrasenia, nombre, apellido)];
  }
}

export class ModificarClienteDto {
  private constructor(
    public nombre?: string,
    public apellido?: string,
    public email?: string,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, ModificarClienteDto?] {
    let { nombre, apellido, email } = obj;

    if (!nombre && !apellido && !email) {
      return ["Debe proporcionar al menos un campo para modificar (nombre, apellido o email)"];
    }

    const letrasRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;

    if (nombre !== undefined) {
      if (typeof nombre !== 'string') return ["El nombre debe ser texto"];
      nombre = nombre.trim();
      if (nombre.length === 0 || nombre.length > 64) return ["El nombre debe tener entre 1 y 64 caracteres"];
      if (!letrasRegex.test(nombre)) return ["El nombre solo puede contener letras y espacios"];
    }

    if (apellido !== undefined) {
      if (typeof apellido !== 'string') return ["El apellido debe ser texto"];
      apellido = apellido.trim();
      if (apellido.length === 0 || apellido.length > 64) return ["El apellido debe tener entre 1 y 64 caracteres"];
      if (!letrasRegex.test(apellido)) return ["El apellido solo puede contener letras y espacios"];
    }

    if (email !== undefined) {
      if (typeof email !== 'string') return ["El email debe ser texto"];
      email = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return ["El formato del correo electrónico no es válido"];
    }

    return [undefined, new ModificarClienteDto(nombre, apellido, email)];
  }
}
