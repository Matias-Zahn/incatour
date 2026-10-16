// CU-49: estado con el que el guía informa cada tramo
export const ESTADO_TRAMO = { COMPLETADO: "COMPLETADO", DEMORADO: "DEMORADO" } as const;

// CU-49: registrarAvance(salidaId, hitoId, estadoTramo, fechaHoraLlegada)
export class RegistrarAvanceDto {
  private constructor(
    public numeroOrden: number,
    public estadoTramo: string,
    public fechaHoraLlegada: Date,
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, RegistrarAvanceDto?] {
    const { numeroOrden, estadoTramo, fechaHoraLlegada } = obj;

    if (typeof numeroOrden !== "number" || !Number.isInteger(numeroOrden) || numeroOrden <= 0) {
      return ["numeroOrden (la etapa alcanzada) es requerido y debe ser un entero positivo"];
    }
    const estados: string[] = Object.values(ESTADO_TRAMO);
    if (!estados.includes(estadoTramo)) return [`estadoTramo debe ser ${estados.join(" o ")}`];

    const llegada = new Date(String(fechaHoraLlegada));
    if (fechaHoraLlegada === undefined || isNaN(llegada.getTime())) {
      return ["fechaHoraLlegada es requerida y debe ser una fecha y hora válida (ej. 2026-12-10T14:35:00-05:00)"];
    }

    return [undefined, new RegistrarAvanceDto(numeroOrden, estadoTramo, llegada)];
  }
}
