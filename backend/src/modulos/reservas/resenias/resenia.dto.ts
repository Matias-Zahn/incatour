// CU-47: Publicar reseña de la experiencia
export class PublicarReseniaDto {
  private constructor(
    public idsalida: number,
    public valoracion: number,
    public comentario: string | null
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, PublicarReseniaDto?] {
    const { idsalida, valoracion, comentario } = obj;

    if (!Number.isInteger(idsalida) || idsalida <= 0) return ["idsalida es requerido y debe ser un número entero."];

    // Regla de negocio 3: toda reseña lleva una valoración entre 1 y 5 estrellas
    if (!Number.isInteger(valoracion) || valoracion < 1 || valoracion > 5) {
      return ["La valoración debe ser un número entero entre 1 y 5."];
    }

    let comentarioLimpio: string | null = null;
    if (comentario !== undefined && comentario !== null && comentario !== "") {
      if (typeof comentario !== "string") return ["El comentario debe ser un texto."];
      comentarioLimpio = comentario.trim();
      if (comentarioLimpio.length > 1000) return ["El comentario no puede superar los 1000 caracteres."];
      if (comentarioLimpio.length === 0) comentarioLimpio = null;
    }

    return [undefined, new PublicarReseniaDto(idsalida, valoracion, comentarioLimpio)];
  }
}

// CU-43: filtros de consulta del administrador
export class FiltrosReseniaDto {
  private constructor(
    public idsalida?: number,
    public idpaquete?: number,
    public valoracionMin?: number,
    public valoracionMax?: number,
    public fechaDesde?: Date,
    public fechaHasta?: Date
  ) {}

  public static create(query: { [key: string]: any }): [string | undefined, FiltrosReseniaDto?] {
    const entero = (valor: any, nombre: string): [string | undefined, (number | undefined)?] => {
      if (valor === undefined) return [undefined, undefined];
      const n = parseInt(valor);
      return isNaN(n) ? [`${nombre} debe ser un número entero.`] : [undefined, n];
    };
    const fecha = (valor: any, nombre: string): [string | undefined, (Date | undefined)?] => {
      if (valor === undefined) return [undefined, undefined];
      const f = new Date(valor);
      return isNaN(f.getTime()) ? [`${nombre} no es una fecha válida (YYYY-MM-DD).`] : [undefined, f];
    };

    const [e1, idsalida] = entero(query.idsalida, "idsalida");
    if (e1) return [e1];
    const [e2, idpaquete] = entero(query.idpaquete, "idpaquete");
    if (e2) return [e2];
    const [e3, valoracionMin] = entero(query.valoracionMin, "valoracionMin");
    if (e3) return [e3];
    const [e4, valoracionMax] = entero(query.valoracionMax, "valoracionMax");
    if (e4) return [e4];
    for (const v of [valoracionMin, valoracionMax]) {
      if (v !== undefined && (v < 1 || v > 5)) return ["Las valoraciones deben estar entre 1 y 5."];
    }
    if (valoracionMin && valoracionMax && valoracionMin > valoracionMax) {
      return ["valoracionMin no puede ser mayor que valoracionMax."];
    }
    const [e5, fechaDesde] = fecha(query.fechaDesde, "fechaDesde");
    if (e5) return [e5];
    const [e6, fechaHasta] = fecha(query.fechaHasta, "fechaHasta");
    if (e6) return [e6];

    return [undefined, new FiltrosReseniaDto(idsalida, idpaquete, valoracionMin, valoracionMax, fechaDesde, fechaHasta)];
  }
}