export class EtapaIndividualDto {
  constructor(
    public numeroOrden: number,
    public puntoInicio: string,
    public puntoFin: string,
    public campamentoPrevisto?: string | null,
  ) {}
}

export class EstablecerSecuenciaDto {
  private constructor(public etapas: EtapaIndividualDto[]) {}

  public static create(obj: { [key: string]: any }): [string | undefined, EstablecerSecuenciaDto?] {
    const { etapas } = obj;

    if (!Array.isArray(etapas)) {
      return ["El campo 'etapas' debe ser un arreglo."];
    }

    if (etapas.length === 0) {
      return ["La secuencia de etapas no puede estar vacía."];
    }

    const etapasValidadas: EtapaIndividualDto[] = [];

    for (let i = 0; i < etapas.length; i++) {
      const e = etapas[i];

      if (e.numeroOrden == null || typeof e.numeroOrden !== "number" || e.numeroOrden <= 0) {
        return [`La etapa en el índice ${i} tiene un 'numeroOrden' inválido.`];
      }
      
      if (!e.puntoInicio || typeof e.puntoInicio !== "string") {
        return [`La etapa en el índice ${i} requiere un 'puntoInicio' de texto.`];
      }
      
      if (!e.puntoFin || typeof e.puntoFin !== "string") {
        return [`La etapa en el índice ${i} requiere un 'puntoFin' de texto.`];
      }

      etapasValidadas.push(
        new EtapaIndividualDto(
          e.numeroOrden,
          e.puntoInicio,
          e.puntoFin,
          e.campamentoPrevisto !== undefined ? String(e.campamentoPrevisto) : null
        )
      );
    }

    return [undefined, new EstablecerSecuenciaDto(etapasValidadas)];
  }
}
