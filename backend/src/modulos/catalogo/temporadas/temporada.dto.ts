export class CrearTemporadaDto {
  private constructor(
    public nombre: string,
    public fechaInicio: Date,
    public fechaFin: Date,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearTemporadaDto?] {
    const { nombre, fechaInicio, fechaFin } = obj;

    if (!nombre || typeof nombre !== "string") return ["nombre es requerido y debe ser texto"];
    
    if (!fechaInicio) return ["fechaInicio es requerida"];
    const parsedInicio = new Date(fechaInicio);
    if (isNaN(parsedInicio.getTime())) return ["fechaInicio no es una fecha válida"];

    if (!fechaFin) return ["fechaFin es requerida"];
    const parsedFin = new Date(fechaFin);
    if (isNaN(parsedFin.getTime())) return ["fechaFin no es una fecha válida"];

    if (parsedInicio >= parsedFin) {
      return ["fechaInicio debe ser anterior a fechaFin"];
    }

    return [undefined, new CrearTemporadaDto(nombre, parsedInicio, parsedFin)];
  }
}

export class ModificarTemporadaDto {
  private constructor(
    public nombre?: string,
    public fechaInicio?: Date,
    public fechaFin?: Date,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, ModificarTemporadaDto?] {
    const { nombre, fechaInicio, fechaFin } = obj;

    if (!nombre && !fechaInicio && !fechaFin) {
      return ["Debe enviar al menos un campo para modificar"];
    }

    let parsedInicio: Date | undefined;
    if (fechaInicio) {
      parsedInicio = new Date(fechaInicio);
      if (isNaN(parsedInicio.getTime())) return ["fechaInicio no es una fecha válida"];
    }

    let parsedFin: Date | undefined;
    if (fechaFin) {
      parsedFin = new Date(fechaFin);
      if (isNaN(parsedFin.getTime())) return ["fechaFin no es una fecha válida"];
    }

    // Si mandan las dos fechas, validar que inicio < fin
    if (parsedInicio && parsedFin && parsedInicio >= parsedFin) {
      return ["fechaInicio debe ser anterior a fechaFin"];
    }

    return [undefined, new ModificarTemporadaDto(nombre, parsedInicio, parsedFin)];
  }
}
