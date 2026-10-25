import { enteroOpcional, fechaOpcionalQuery } from "../../../shared/filtros";

// CU-26 / CAT-13: filtros del catálogo público (un valor inválido es 400, no un error de Prisma)
export class FiltrosCatalogoDto {
  private constructor(
    public dificultad?: string,
    public duracionDias?: number,
    public fechaDesde?: string,
    public fechaHasta?: string,
  ) {}

  public static create(query: { [key: string]: any }): [string | undefined, FiltrosCatalogoDto?] {
    const [e1, duracionDias] = enteroOpcional(query.duracionDias, "duracionDias");
    if (e1) return [e1];
    const [e2, fechaDesde] = fechaOpcionalQuery(query.fechaDesde ?? query.fechaInicio, "fechaDesde");
    if (e2) return [e2];
    const [e3, fechaHasta] = fechaOpcionalQuery(query.fechaHasta ?? query.fechaFin, "fechaHasta");
    if (e3) return [e3];
    return [undefined, new FiltrosCatalogoDto(query.dificultad, duracionDias, fechaDesde, fechaHasta)];
  }
}
