export class LoginDto {
  private constructor(
    public email: string,
    public contrasenia: string
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, LoginDto?] {
    let { email, contrasenia } = obj;

    if (!email || typeof email !== 'string') return ["El email es requerido"];
    email = email.trim().toLowerCase();

    if (!contrasenia || typeof contrasenia !== 'string') return ["La contraseña es requerida"];

    return [undefined, new LoginDto(email, contrasenia)];
  }
}
