// CU-38: confirmarReemplazo(salidaId, originalId, reemplazanteId, motivo)
export class ConfirmarReemplazoDto {
  private constructor(
    public idoriginal: number,
    public idreemplazante: number,
    public motivo: string,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, ConfirmarReemplazoDto?] {
    const { idoriginal, idreemplazante, motivo } = obj;

    if (!esEnteroPositivo(idoriginal)) return ["idoriginal es requerido y debe ser un entero positivo"];
    if (!esEnteroPositivo(idreemplazante)) return ["idreemplazante es requerido y debe ser un entero positivo"];
    if (idoriginal === idreemplazante) return ["El reemplazante tiene que ser otra persona"];

    if (typeof motivo !== "string" || motivo.trim().length < 5 || motivo.trim().length > 500) {
      return ["El motivo es requerido (entre 5 y 500 caracteres)"];
    }

    return [undefined, new ConfirmarReemplazoDto(idoriginal, idreemplazante, motivo.trim())];
  }
}

const esEnteroPositivo = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
