import { enteroOpcional } from "../../../shared/filtros";
import { textoRequerido } from "../../../shared/validaciones";

export class CrearCircuitoDto {
  private constructor(
    public nombreCircuito: string,
    public duracionDias: number,
    public dificultad: string,
    public minimoGuias: number,
    public parametrosPorteadores?: string,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearCircuitoDto?] {
    if (!obj || typeof obj !== "object") return ["El cuerpo de la petición es requerido"];

    const { nombreCircuito, duracionDias, dificultad, minimoGuias, parametrosPorteadores } = obj;

    if (!nombreCircuito) return ["nombreCircuito es requerido"];
    if (typeof nombreCircuito !== "string") return ["nombreCircuito debe ser un texto"];

    if (duracionDias == null) return ["duracionDias es requerido"];
    if (typeof duracionDias !== "number" || !Number.isInteger(duracionDias) || duracionDias <= 0) {
      return ["duracionDias debe ser un número entero mayor a 0"];
    }

    if (!dificultad) return ["dificultad es requerido"];
    if (typeof dificultad !== "string") return ["dificultad debe ser un texto"];

    if (minimoGuias == null) return ["minimoGuias es requerido"];
    if (typeof minimoGuias !== "number" || !Number.isInteger(minimoGuias) || minimoGuias <= 0) {
      return ["minimoGuias debe ser un número entero mayor a 0"];
    }

    if (parametrosPorteadores != null && typeof parametrosPorteadores !== "string") {
      return ["parametrosPorteadores debe ser un texto (ej. '1 por cada 2 pasajeros')"];
    }

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
    if (!obj || typeof obj !== "object") return ["El cuerpo de la petición es requerido"];

    let { nombreCircuito, duracionDias, dificultad, minimoGuias, parametrosPorteadores } = obj;

    // Al menos un campo debe venir
    if (!nombreCircuito && duracionDias === undefined && !dificultad && minimoGuias === undefined && parametrosPorteadores === undefined) {
      return ["Debe enviar al menos un campo para modificar"];
    }

    // CAT-20: un texto que viene no puede estar vacío ni ser de otro tipo
    if (nombreCircuito !== undefined) {
      const [error, limpio] = textoRequerido(nombreCircuito, "nombreCircuito", 255);
      if (error) return [error];
      nombreCircuito = limpio;
    }
    if (dificultad !== undefined) {
      const [error, limpio] = textoRequerido(dificultad, "dificultad", 255);
      if (error) return [error];
      dificultad = limpio;
    }

    if (duracionDias !== undefined && (typeof duracionDias !== "number" || !Number.isInteger(duracionDias) || duracionDias <= 0)) {
      return ["duracionDias debe ser un número entero mayor a 0"];
    }

    if (minimoGuias !== undefined && (typeof minimoGuias !== "number" || !Number.isInteger(minimoGuias) || minimoGuias <= 0)) {
      return ["minimoGuias debe ser un número entero mayor a 0"];
    }

    if (parametrosPorteadores != null && typeof parametrosPorteadores !== "string") {
      return ["parametrosPorteadores debe ser un texto (ej. '1 por cada 2 pasajeros')"];
    }

    return [undefined, new ModificarCircuitoDto(nombreCircuito, duracionDias, dificultad, minimoGuias, parametrosPorteadores)];
  }
}

// CU-01 / CAT-13: filtros del listado (un valor inválido es 400, no un error de Prisma)
export class FiltrosCircuitoDto {
  private constructor(
    public duracionDias?: number,
    public dificultad?: string,
    public estado?: string,
  ) {}

  public static create(query: { [key: string]: any }): [string | undefined, FiltrosCircuitoDto?] {
    const [error, duracionDias] = enteroOpcional(query.duracionDias, "duracionDias");
    if (error) return [error];
    return [undefined, new FiltrosCircuitoDto(duracionDias, query.dificultad, query.estado)];
  }
}
