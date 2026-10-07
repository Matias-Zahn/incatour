export class CrearCircuitoDto {
  private constructor(
    public nombreCircuito: string,
    public duracionDias: number,
    public dificultad: string,
    public minimoGuias: number,
    public parametrosPorteadores?: string,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearCircuitoDto?] {
    const { nombreCircuito, duracionDias, dificultad, minimoGuias, parametrosPorteadores } = obj;

    if (!nombreCircuito) return ["nombreCircuito es requerido"];
    if (typeof nombreCircuito !== "string") return ["nombreCircuito debe ser un texto"];

    if (duracionDias == null) return ["duracionDias es requerido"];
    if (typeof duracionDias !== "number" || duracionDias <= 0) return ["duracionDias debe ser un número mayor a 0"];

    if (!dificultad) return ["dificultad es requerido"];
    if (typeof dificultad !== "string") return ["dificultad debe ser un texto"];

    if (minimoGuias == null) return ["minimoGuias es requerido"];
    if (typeof minimoGuias !== "number" || minimoGuias <= 0) return ["minimoGuias debe ser un número mayor a 0"];

    return [undefined, new CrearCircuitoDto(nombreCircuito, duracionDias, dificultad, minimoGuias, parametrosPorteadores)];
  }
}

export class ModificarCircuitoDto {
  private constructor(
    public nombreCircuito?: string,
    public duracionDias?: number,
    public dificultad?: string,
    public minimoGuias?: number,
    public parametrosPorteadores?: string,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, ModificarCircuitoDto?] {
    const { nombreCircuito, duracionDias, dificultad, minimoGuias, parametrosPorteadores } = obj;

    // Al menos un campo debe venir
    if (!nombreCircuito && duracionDias == null && !dificultad && minimoGuias == null && parametrosPorteadores === undefined) {
      return ["Debe enviar al menos un campo para modificar"];
    }

    if (duracionDias != null && (typeof duracionDias !== "number" || duracionDias <= 0)) {
      return ["duracionDias debe ser un número mayor a 0"];
    }

    if (minimoGuias != null && (typeof minimoGuias !== "number" || minimoGuias <= 0)) {
      return ["minimoGuias debe ser un número mayor a 0"];
    }

    return [undefined, new ModificarCircuitoDto(nombreCircuito, duracionDias, dificultad, minimoGuias, parametrosPorteadores)];
  }
}
