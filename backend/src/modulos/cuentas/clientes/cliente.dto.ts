export class CrearClienteDto {
  private constructor(
    public idusuario: number,
    public nroCliente: string,
    public nombre: string,
    public apellido: string,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearClienteDto?] {
    const { idusuario, nroCliente, nombre, apellido } = obj;

    if (!idusuario) return ["idusuario es requerido"];
    if (!nroCliente) return ["nroCliente es requerido"];
    if (!nombre) return ["nombre es requerido"];
    if (!apellido) return ["apellido es requerido"];

    return [undefined, new CrearClienteDto(idusuario, nroCliente, nombre, apellido)];
  }
}

export class ModificarClienteDto {
  private constructor(
    public nombre?: string,
    public apellido?: string,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, ModificarClienteDto?] {
    const { nombre, apellido } = obj;

    if (!nombre && !apellido) return ["Debe proporcionar al menos un campo para modificar"];

    return [undefined, new ModificarClienteDto(nombre, apellido)];
  }
}
