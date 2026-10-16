export const TIPO_EVALUADO = ["PERSONAL", "PROVEEDOR"] as const;
export type TipoEvaluado = (typeof TIPO_EVALUADO)[number];

// CU-42: el administrador evalúa a una persona o a un proveedor de una salida
export class EvaluarDto {
  private constructor(
    public tipo: TipoEvaluado,
    public id: number,
    public puntaje: number,
    public comentario: string | null,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, EvaluarDto?] {
    const { tipo, id, puntaje, comentario } = obj;

    if (!(TIPO_EVALUADO as readonly string[]).includes(tipo)) return ["tipo debe ser PERSONAL o PROVEEDOR"];
    if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
      return ["id es requerido: el idpersonal o el idproveedor a evaluar"];
    }
    if (typeof puntaje !== "number" || !Number.isInteger(puntaje) || puntaje < 1 || puntaje > 5) {
      return ["puntaje debe ser un entero de 1 a 5"];
    }
    if (comentario !== undefined && comentario !== null && (typeof comentario !== "string" || comentario.length > 500)) {
      return ["comentario debe ser un texto de hasta 500 caracteres"];
    }

    const texto = typeof comentario === "string" && comentario.trim() ? comentario.trim() : null;
    return [undefined, new EvaluarDto(tipo, id, puntaje, texto)];
  }
}
