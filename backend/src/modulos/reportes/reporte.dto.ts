const MS_DIA = 24 * 60 * 60 * 1000;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Período de un reporte: `hasta` incluye todo ese día
export class FiltrosReporteDto {
  private constructor(public desde?: Date, public hastaExclusivo?: Date) {}

  public static create(query: { [key: string]: any }): [string | undefined, FiltrosReporteDto?] {
    const { desde, hasta } = query;
    for (const [nombre, valor] of [["desde", desde], ["hasta", hasta]]) {
      if (valor !== undefined && (!FECHA.test(valor) || isNaN(new Date(valor).getTime()))) {
        return [`${nombre} no es una fecha válida (usá YYYY-MM-DD).`];
      }
    }
    if (desde && hasta && desde > hasta) return ["desde no puede ser posterior a hasta."];

    return [
      undefined,
      new FiltrosReporteDto(
        desde ? new Date(desde) : undefined,
        hasta ? new Date(new Date(hasta).getTime() + MS_DIA) : undefined
      ),
    ];
  }
}
